import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  PlusIcon,
  UserIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import AdminSidebar from '../components/AdminSidebar';
import AddSectionModal from '../components/AddSectionModal';
import { theme } from '../styles/theme';

// Define interfaces for Firestore data structure
interface Section {
  id: string;
  name: string;
  students: string[]; // Array of student IDs
  instructorId: string;
  schedule: {
    day: string;
    startTime: string;
    endTime: string;
    room: string;
    section: string;
    subject: string;
  };
}

interface Instructor {
  id: string;
  fullName: string;
  email: string;
}

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
}

const AdminSectionPage = () => {
  // State declarations
  const [sections, setSections] = useState<Section[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch sections, instructors, and students from Firestore
  const fetchData = async () => {
    try {
      // Fetch sections
      const sectionsSnapshot = await getDocs(collection(db, 'sections'));
      const sectionsData = sectionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Section[];
      setSections(sectionsData);

      // Fetch instructors
      const instructorsSnapshot = await getDocs(collection(db, 'teachers'));
      const instructorsData = instructorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Instructor[];
      setInstructors(instructorsData);

      // Fetch students
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const studentsData = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(studentsData);

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsLoading(false);
    }
  };

  // Handle adding a new section
  const handleAddSection = async (sectionData: any) => {
    try {
      // Get instructor's schedule
      const teacherRef = doc(db, 'teachers', sectionData.instructorId);
      const teacherDoc = await getDoc(teacherRef);
      const teacherData = teacherDoc.data();
      
      if (!teacherData?.schedule) {
        throw new Error('Teacher schedule not found');
      }

      // Find matching schedule based on day and time
      const matchingSchedule = teacherData.schedule.find((schedule: any) => 
        schedule.day === sectionData.schedule.day &&
        schedule.startTime === sectionData.schedule.startTime &&
        schedule.endTime === sectionData.schedule.endTime
      );

      if (!matchingSchedule) {
        throw new Error('No matching schedule found for the teacher');
      }

      // Add section to Firestore with synchronized schedule
      const sectionRef = await addDoc(collection(db, 'sections'), {
        name: sectionData.name,
        students: sectionData.students || [],
        instructorId: sectionData.instructorId,
        schedule: {
          day: matchingSchedule.day,
          startTime: matchingSchedule.startTime,
          endTime: matchingSchedule.endTime,
          room: matchingSchedule.room,
          section: matchingSchedule.section,
          subject: matchingSchedule.subject
        }
      });
      const sectionId = sectionRef.id;

      // Update instructor's assignedSections
      await updateDoc(teacherRef, {
        assignedSections: arrayUnion(sectionId)
      });

      setIsModalOpen(false);
      fetchData();

      Swal.fire({
        icon: 'success',
        title: 'Section Added Successfully',
        text: `Section synchronized with teacher's schedule`,
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      console.error('Error adding section:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Failed to add section'
      });
    }
  };

  // Handle adding students to a section
  const handleAddStudentsToSection = async (studentIds: string[]) => {
    try {
      if (!selectedSection) return;

      const sectionRef = doc(db, 'sections', selectedSection.id);
      await updateDoc(sectionRef, {
        students: [...selectedSection.students, ...studentIds]
      });

      // Update each student's sectionId
      for (const studentId of studentIds) {
        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, {
          sectionId: selectedSection.id
        });
      }

      setIsStudentModalOpen(false);
      fetchData();

      Swal.fire({
        icon: 'success',
        title: 'Students Added Successfully',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      console.error('Error adding students:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to add students'
      });
    }
  };

  // Handle removing a student from a section
  const handleRemoveStudent = async (sectionId: string, studentId: string) => {
    try {
      const sectionRef = doc(db, 'sections', sectionId);
      const section = sections.find(s => s.id === sectionId);

      if (section) {
        // Remove student from section
        await updateDoc(sectionRef, {
          students: section.students.filter(id => id !== studentId)
        });

        // Clear student's sectionId
        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, {
          sectionId: null
        });

        Swal.fire({
          icon: 'success',
          title: 'Student Removed',
          showConfirmButton: false,
          timer: 1500
        });

        fetchData();
      }
    } catch (error) {
      console.error('Error removing student:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to remove student'
      });
    }
  };

  // Render UI
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="transition-all duration-300 ml-[80px] lg:ml-64 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Section Management</h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className={theme.components.button.primary}
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Section
            </button>
          </div>

          {/* Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.map(section => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{section.name}</h2>
                  </div>
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <UserGroupIcon className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>

                {/* Instructor */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Instructor</h3>
                  <div className="flex items-center bg-gray-50 p-3 rounded-lg">
                    <UserIcon className="w-5 h-5 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-900">
                      {instructors.find(i => i.id === section.instructorId)?.fullName || 'Not assigned'}
                    </span>
                  </div>
                </div>

                {/* Students */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">
                      Students ({section.students?.length || 0})
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedSection(section);
                        setIsStudentModalOpen(true);
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Add Student
                    </button>
                  </div>
                  <div className="space-y-2">
                    {section.students?.map(studentId => {
                      const student = students.find(s => s.id === studentId);
                      return (
                        <div key={studentId} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                          <span className="text-sm text-gray-900">{student?.fullName}</span>
                          <button
                            onClick={() => {
                              Swal.fire({
                                title: 'Remove Student',
                                text: `Are you sure you want to remove ${student?.fullName} from this section?`,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#EF4444',
                                cancelButtonColor: '#6B7280',
                                confirmButtonText: 'Yes, remove',
                                cancelButtonText: 'Cancel'
                              }).then((result) => {
                                if (result.isConfirmed) {
                                  handleRemoveStudent(section.id, studentId);
                                }
                              });
                            }}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Start Time */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Start Time</h3>
                  <div className="text-sm text-gray-500">
                    {section.schedule.startTime || 'Not set'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSectionPage;