import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, arrayUnion, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  PlusIcon,
  UserIcon,
  TrashIcon,
  CalendarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import AdminSidebar from '../components/AdminSidebar';
import AddSectionModal from '../components/AddSectionModal';

// Define interfaces for Firestore data structure
interface Section {
  id: string;
  name: string;
  students: string[]; // Array of student IDs
}

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
}

const AdminSectionPage = () => {
  // State declarations
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    const unsubscribeFromSections = onSnapshot(collection(db, 'sections'), (snapshot) => {
      const sectionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Section[];
      setSections(sectionsData);
    });

    const unsubscribeFromStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(studentsData);
      setIsLoading(false);
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeFromSections();
      unsubscribeFromStudents();
    };
  }, []);

  // Handle adding a new section
  const handleAddSection = async (sectionData: any) => {
    try {
      // Add section to Firestore with just name and empty students array
      const sectionRef = await addDoc(collection(db, 'sections'), {
        name: sectionData.name,
        students: []
      });

      setIsModalOpen(false);

      Swal.fire({
        icon: 'success',
        title: 'Section Added Successfully',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      console.error('Error adding section:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to add section'
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
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
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

                {/* Students */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">
                      Enrolled Students ({section.students?.length || 0})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {section.students?.length > 0 ? (
                      section.students.map(studentId => {
                        const student = students.find(s => s.id === studentId);
                        if (!student) return null;
                        
                        return (
                          <motion.div
                            key={studentId}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded-lg group hover:bg-gray-100 transition-all duration-200"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{student.fullName}</span>
                              <span className="text-xs text-gray-500">ID: {student.idNumber}</span>
                            </div>
                            <button
                              onClick={() => {
                                Swal.fire({
                                  title: 'Remove Student',
                                  text: `Are you sure you want to remove ${student.fullName} from this section?`,
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
                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all duration-200"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-3 bg-gray-50 rounded-lg">
                        No students enrolled in this section
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddSection}
      />
    </div>
  );
};

export default AdminSectionPage;