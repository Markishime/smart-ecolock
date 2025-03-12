import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
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
  students: string[]; // Array of student IDs
  instructorId: string;
  subjectId: string;
}

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

const AdminSectionPage = () => {
  // State declarations
  const [sections, setSections] = useState<Section[]>([]);
  const [instructors, setInstructors] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    const unsubscribeFromSections = onSnapshot(collection(db, 'sections'), (snapshot) => {
      const sectionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Section[];
      setSections(sectionsData);
    });

    const unsubscribeFromInstructors = onSnapshot(collection(db, 'teachers'), (snapshot) => {
      const instructorsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Student[];
      setInstructors(instructorsData);
    });

    const unsubscribeFromStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Student[];
      setStudents(studentsData);
    });

    const unsubscribeFromSubjects = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      const subjectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Subject[];
      setSubjects(subjectsData);
      setIsLoading(false);
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeFromSections();
      unsubscribeFromInstructors();
      unsubscribeFromStudents();
      unsubscribeFromSubjects();
    };
  }, []);

  // Handle adding a new section
  const handleAddSection = async (sectionData: { name: string; code: string; instructorId: string; subjectId: string }) => {
    try {
      await addDoc(collection(db, 'sections'), {
        name: sectionData.name,
        code: sectionData.code,
        students: [],
        instructorId: sectionData.instructorId,
        subjectId: sectionData.subjectId,
        createdAt: new Date()
      });

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
  const handleRemoveStudent = async (sectionId: string, studentId: string) => {
    try {
      const sectionRef = doc(db, 'sections', sectionId);
      const section = sections.find(s => s.id === sectionId);

      if (section) {
        await updateDoc(sectionRef, {
          students: section.students.filter(id => id !== studentId),
        });

        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, { sectionId: null });

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

  // Handle assigning students to a section
  const handleAssignStudents = async (studentIds: string[]) => {
    if (!selectedSection) return;

    try {
      const sectionRef = doc(db, 'sections', selectedSection.id);
      await updateDoc(sectionRef, {
        students: [...selectedSection.students, ...studentIds],
      });

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

  // Render UI
  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="ml-[80px] lg:ml-64 p-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
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
            <div className="text-center py-10">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Loading sections...</p>
            </div>
          ) : (
            /* Sections Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sections.map(section => {
                const instructor = instructors.find(i => i.id === section.instructorId);
                const subject = subjects.find(s => s.id === section.subjectId);
                return (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{section.name}</h2>
                        <p className="text-sm text-gray-600">
                          Instructor: {instructor?.fullName || 'Not Assigned'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Subject: {subject?.name || 'Not Assigned'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Code: {section.code}
                        </p>
                      </div>
                      <UserGroupIcon className="w-8 h-8 text-indigo-600" />
                    </div>

                    {/* Students List */}
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Enrolled Students ({section.students?.length || 0})
                      </h3>
                      <div className="max-h-48 overflow-y-auto space-y-3">
                        {section.students?.length > 0 ? (
                          section.students.map(studentId => {
                            const student = students.find(s => s.id === studentId);
                            if (!student) return null;
                            return (
                              <motion.div
                                key={studentId}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                              >
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                                    <span className="text-indigo-600 font-medium">
                                      {student.fullName[0]}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{student.fullName}</p>
                                    <p className="text-xs text-gray-500">ID: {student.idNumber}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    Swal.fire({
                                      title: 'Remove Student',
                                      text: `Are you sure you want to remove ${student.fullName} from ${section.name}?`,
                                      icon: 'warning',
                                      showCancelButton: true,
                                      confirmButtonColor: '#ef4444',
                                      cancelButtonColor: '#6b7280',
                                      confirmButtonText: 'Yes, remove',
                                    }).then(result => {
                                      if (result.isConfirmed) {
                                        handleRemoveStudent(section.id, studentId);
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
                          <p className="text-sm text-gray-500 text-center py-4">
                            No students enrolled yet.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Assign Students Button */}
                    <button
                      onClick={() => {
                        setSelectedSection(section);
                        setIsAssignModalOpen(true);
                      }}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
                    >
                      Assign Students
                    </button>
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