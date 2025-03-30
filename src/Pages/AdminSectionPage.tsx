import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { ref, set, update } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import AdminSidebar from '../components/AdminSidebar';
import AddSectionModal from '../components/AddSectionModal';
import AssignStudentsModal from '../components/AssignStudentsModal';

// Define interfaces for Firestore data structure
interface Section {
  id: string;
  name: string;
  code: string;
  students: string[]; // Array of student full names
  instructorRfidUid: string;
  instructorId: string; // Added for consistency with TakeAttendance
  subjectId: string;
  createdAt: string;
}

interface Instructor {
  id: string;
  fullName: string;
  rfidUid: string;
}

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
  rfidUid?: string;
  sectionId?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

const AdminSectionPage = () => {
  // State declarations
  const [sections, setSections] = useState<Section[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    // Fetch sections
    const unsubscribeFromSections = onSnapshot(
      collection(db, 'sections'),
      (snapshot) => {
        const sectionsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Section[];
        setSections(sectionsData);
      },
      (error) => {
        console.error('Error fetching sections:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load sections. Please try again.',
        });
      }
    );

    // Fetch instructors
    const unsubscribeFromInstructors = onSnapshot(
      collection(db, 'teachers'),
      (snapshot) => {
        const instructorsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          fullName: doc.data().fullName || '',
          rfidUid: doc.data().rfidUid || '',
        })) as Instructor[];
        setInstructors(instructorsData);
      },
      (error) => {
        console.error('Error fetching instructors:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load instructors. Please try again.',
        });
      }
    );

    // Fetch students
    const unsubscribeFromStudents = onSnapshot(
      collection(db, 'students'),
      (snapshot) => {
        const studentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          fullName: doc.data().fullName || '',
          idNumber: doc.data().idNumber || '',
          rfidUid: doc.data().rfidUid || '',
          sectionId: doc.data().sectionId || '',
        })) as Student[];
        setStudents(studentsData);
      },
      (error) => {
        console.error('Error fetching students:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load students. Please try again.',
        });
      }
    );

    // Fetch subjects
    const unsubscribeFromSubjects = onSnapshot(
      collection(db, 'subjects'),
      (snapshot) => {
        const subjectsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || '',
          code: doc.data().code || '',
        })) as Subject[];
        setSubjects(subjectsData);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching subjects:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load subjects. Please try again.',
        });
      }
    );

    // Cleanup subscriptions
    return () => {
      unsubscribeFromSections();
      unsubscribeFromInstructors();
      unsubscribeFromStudents();
      unsubscribeFromSubjects();
    };
  }, []);

  // Handle adding a new section
  const handleAddSection = async (sectionData: {
    name: string;
    code: string;
    instructorRfidUid: string;
    instructorId: string; // Added
    subjectId: string;
    studentNames: string[];
  }) => {
    try {
      const newSectionRef = await addDoc(collection(db, 'sections'), {
        name: sectionData.name,
        code: sectionData.code,
        students: sectionData.studentNames,
        instructorRfidUid: sectionData.instructorRfidUid,
        instructorId: sectionData.instructorId, // Added
        subjectId: sectionData.subjectId,
        createdAt: new Date().toISOString(),
      });

      // Update RTDB for each student
      const studentUpdates = sectionData.studentNames.map(async (studentName) => {
        const student = students.find((s) => s.fullName === studentName);
        if (student && student.rfidUid) {
          const studentRef = ref(rtdb, `/Students/${student.rfidUid}`);
          await update(studentRef, { sectionId: newSectionRef.id });
        }
      });
      await Promise.all(studentUpdates);

      setIsModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'Section Added Successfully',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error('Error adding section:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to add section. Please try again.',
      });
    }
  };

  // Handle removing a student from a section
  const handleRemoveStudent = async (sectionId: string, studentName: string) => {
    try {
      const sectionRef = doc(db, 'sections', sectionId);
      const section = sections.find((s) => s.id === sectionId);

      if (section) {
        const updatedStudents = section.students.filter((name) => name !== studentName);
        await updateDoc(sectionRef, { students: updatedStudents });

        // Update Firestore student's sectionId
        const student = students.find((s) => s.fullName === studentName);
        if (student) {
          const studentRef = doc(db, 'students', student.id);
          await updateDoc(studentRef, { sectionId: null });

          // Update RTDB student's sectionId
          if (student.rfidUid) {
            const studentRtdbRef = ref(rtdb, `/Students/${student.rfidUid}`);
            await update(studentRtdbRef, { sectionId: null });
          }
        }

        Swal.fire({
          icon: 'success',
          title: 'Student Removed',
          showConfirmButton: false,
          timer: 1500,
        });
      }
    } catch (error) {
      console.error('Error removing student:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to remove student. Please try again.',
      });
    }
  };

  // Handle deleting a section
  const handleDeleteSection = async (sectionId: string) => {
    try {
      const sectionRef = doc(db, 'sections', sectionId);
      const section = sections.find((s) => s.id === sectionId);

      if (section) {
        // Clear sectionId from all associated students in Firestore and RTDB
        await Promise.all(
          section.students.map(async (studentName) => {
            const student = students.find((s) => s.fullName === studentName);
            if (student) {
              const studentRef = doc(db, 'students', student.id);
              await updateDoc(studentRef, { sectionId: null });

              if (student.rfidUid) {
                const studentRtdbRef = ref(rtdb, `/Students/${student.rfidUid}`);
                await update(studentRtdbRef, { sectionId: null });
              }
            }
          })
        );

        // Delete the section
        await deleteDoc(sectionRef);

        Swal.fire({
          icon: 'success',
          title: 'Section Deleted',
          showConfirmButton: false,
          timer: 1500,
        });
      }
    } catch (error) {
      console.error('Error deleting section:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to delete section. Please try again.',
      });
    }
  };

  // Handle assigning students to a section
  const handleAssignStudents = async (studentIds: string[]) => {
    if (!selectedSection) return;

    try {
      const sectionRef = doc(db, 'sections', selectedSection.id);
      const newStudentNames = studentIds
        .map((id) => students.find((s) => s.id === id)?.fullName || '')
        .filter(Boolean);

      // Update Firestore section with new students
      await updateDoc(sectionRef, {
        students: [...selectedSection.students, ...newStudentNames],
      });

      // Update each student's sectionId in Firestore and RTDB
      await Promise.all(
        studentIds.map(async (studentId) => {
          const studentRef = doc(db, 'students', studentId);
          await updateDoc(studentRef, { sectionId: selectedSection.id });

          const student = students.find((s) => s.id === studentId);
          if (student && student.rfidUid) {
            const studentRtdbRef = ref(rtdb, `/Students/${student.rfidUid}`);
            await update(studentRtdbRef, { sectionId: selectedSection.id });
          }
        })
      );

      setIsAssignModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'Students Assigned Successfully',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error('Error assigning students:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to assign students. Please try again.',
      });
    }
  };

  // Skeleton loader for loading state
  const SkeletonCard = () => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-6 w-32 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-48 bg-gray-200 rounded mb-1"></div>
          <div className="h-4 w-40 bg-gray-200 rounded"></div>
        </div>
        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
      </div>
      <div className="mb-4">
        <div className="h-4 w-40 bg-gray-200 rounded mb-2"></div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-200 rounded-full mr-3"></div>
              <div>
                <div className="h-4 w-32 bg-gray-200 rounded mb-1"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
              </div>
            </div>
            <div className="w-5 h-5 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
      <div className="flex space-x-2">
        <div className="flex-1 h-10 bg-gray-200 rounded-lg"></div>
        <div className="flex-1 h-10 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  );

  // Render UI
  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="ml-[80px] lg:ml-64 p-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">Section Management</h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Section
            </button>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="text-center py-10">
              <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No sections available. Add a section to get started.</p>
            </div>
          ) : (
            /* Sections Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sections.map((section) => {
                const instructor = instructors.find((i) => i.rfidUid === section.instructorRfidUid);
                const subject = subjects.find((s) => s.id === section.subjectId);
                return (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200"
                  >
                    {/* Section Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{section.name}</h2>
                        <p className="text-sm text-gray-600">
                          Instructor: {instructor?.fullName || 'Not Assigned'}
                        </p>
                        <p className="text-sm text-gray-600">
                          RFID UID: {section.instructorRfidUid || 'Not Assigned'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Subject: {subject?.name || 'Not Assigned'} ({subject?.code || ''})
                        </p>
                        <p className="text-sm text-gray-600">Code: {section.code}</p>
                      </div>
                      <UserGroupIcon className="w-8 h-8 text-indigo-600" />
                    </div>

                    {/* Students List */}
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Enrolled Students ({section.students?.length || 0})
                      </h3>
                      <div className="max-h-48 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        <AnimatePresence>
                          {section.students?.length > 0 ? (
                            section.students.map((studentName) => {
                              const student = students.find((s) => s.fullName === studentName);
                              return (
                                <motion.div
                                  key={studentName}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                                >
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                                      <span className="text-indigo-600 font-medium">
                                        {studentName[0]}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{studentName}</p>
                                      {student && (
                                        <>
                                          <p className="text-xs text-gray-500">ID: {student.idNumber}</p>
                                          <p className="text-xs text-gray-500">
                                            RFID UID: {student.rfidUid || 'Not Assigned'}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      Swal.fire({
                                        title: 'Remove Student',
                                        text: `Are you sure you want to remove ${studentName} from ${section.name}?`,
                                        icon: 'warning',
                                        showCancelButton: true,
                                        confirmButtonColor: '#ef4444',
                                        cancelButtonColor: '#6b7280',
                                        confirmButtonText: 'Yes, remove',
                                      }).then((result) => {
                                        if (result.isConfirmed) {
                                          handleRemoveStudent(section.id, studentName);
                                        }
                                      })
                                    }
                                    className="text-red-500 hover:text-red-700 transition-colors duration-150"
                                  >
                                    <TrashIcon className="w-5 h-5" />
                                  </button>
                                </motion.div>
                              );
                            })
                          ) : (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-sm text-gray-500 text-center py-4"
                            >
                              No students enrolled yet.
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setSelectedSection(section);
                          setIsAssignModalOpen(true);
                        }}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <PlusIcon className="w-5 h-5" />
                        Assign Students
                      </button>
                      <button
                        onClick={() =>
                          Swal.fire({
                            title: 'Delete Section',
                            text: `Are you sure you want to delete ${section.name}? This action cannot be undone.`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#ef4444',
                            cancelButtonColor: '#6b7280',
                            confirmButtonText: 'Yes, delete',
                          }).then((result) => {
                            if (result.isConfirmed) {
                              handleDeleteSection(section.id);
                            }
                          })
                        }
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <TrashIcon className="w-5 h-5" />
                        Delete Section
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddSectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddSection}
        instructors={instructors}
        subjects={subjects}
        students={students}
      />
      <AssignStudentsModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSubmit={handleAssignStudents}
        students={students}
      />
    </div>
  );
};

export default AdminSectionPage;