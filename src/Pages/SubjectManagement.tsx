import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import AdminSidebar from '../components/AdminSidebar';
import Modal from '../components/Modal';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  FunnelIcon,
  CalendarIcon,
  UserIcon,
} from '@heroicons/react/24/solid';

// Define Room interface (still used elsewhere, but not for schedules)
interface Room {
  id: string;
  name: string;
  capacity?: number;
  location?: string;
}

// Define Schedule interface
interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string; // Changed from roomId to roomName
}

// Define Instructor interface
interface Instructor {
  id: string;
  fullName: string;
  department: string;
}

// Define Section interface (aligned with AdminSectionPage)
interface Section {
  id: string;
  name: string;
  code: string;
  capacity: number;
  currentEnrollment: number;
  subjectId: string;
  instructorRfidUid: string;
  instructorId: string;
  schedules: Schedule[];
  students: string[];
}

// Define Subject interface (simplified for editing)
interface Subject {
  id?: string;
  name: string;
  department: string;
  details?: string;
  code?: string;
  credits?: number;
  prerequisites?: string[];
  learningObjectives?: string[];
  status: 'active' | 'inactive';
}

// Department color mapping
const DEPARTMENT_COLORS: { [key: string]: string } = {
  'Computer Science': 'bg-blue-100 text-blue-800',
  'Mathematics': 'bg-green-100 text-green-800',
  'Physics': 'bg-purple-100 text-purple-800',
  'Biology': 'bg-teal-100 text-teal-800',
  'Chemistry': 'bg-red-100 text-red-800',
  'default': 'bg-gray-100 text-gray-800',
};

const AdminSubjects: React.FC = () => {
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]); // Kept for potential other uses
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [formData, setFormData] = useState<Subject>({
    name: '',
    department: '',
    details: '',
    code: '',
    credits: 0,
    prerequisites: [],
    learningObjectives: [],
    status: 'active',
  });

  // Fetch subjects, departments, instructors, rooms, and sections
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subjects
        const subjectsCollection = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Subject[];

        // Fetch departments and instructors from teachers
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        
        const uniqueDepartments = Array.from(
          new Set(teachersSnapshot.docs.map((doc) => doc.data().department).filter(Boolean))
        );

        const instructorsData = teachersSnapshot.docs.map((doc) => ({
          id: doc.id,
          fullName: doc.data().fullName || '',
          department: doc.data().department || '',
        })) as Instructor[];

        // Fetch rooms (optional now for schedules, kept for consistency)
        const roomsCollection = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsCollection);
        const roomsData = roomsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || '',
          capacity: doc.data().capacity,
          location: doc.data().location,
        })) as Room[];

        // Fetch sections
        const sectionsCollection = collection(db, 'sections');
        const sectionsSnapshot = await getDocs(sectionsCollection);
        const sectionsData = sectionsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || '',
          code: doc.data().code || '',
          capacity: doc.data().capacity || 0,
          currentEnrollment: doc.data().students?.length || 0,
          subjectId: doc.data().subjectId || '',
          instructorRfidUid: doc.data().instructorRfidUid || '',
          instructorId: doc.data().instructorId || '',
          schedules: doc.data().schedules || [],
          students: doc.data().students || [],
        })) as Section[];

        setSubjects(subjectsData);
        setDepartments(uniqueDepartments);
        setInstructors(instructorsData);
        setRooms(roomsData);
        setSections(sectionsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch data. Please try again.',
        });
      }
    };

    fetchData();
  }, []);

  // Filtered and sorted subjects
  const filteredSubjects = useMemo(() => {
    return selectedDepartment === 'all'
      ? subjects
      : subjects.filter((subject) => subject.department === selectedDepartment);
  }, [subjects, selectedDepartment]);

  // Add or update subject and sync with teachers' assignedSubjects
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subjectsCollection = collection(db, 'subjects');
      let subjectId: string;
      let subjectDataWithId: Subject;

      if (formData.id) {
        // Update existing subject in Firestore
        const subjectRef = doc(db, 'subjects', formData.id);
        const { id, ...subjectData } = formData;
        await updateDoc(subjectRef, subjectData);
        subjectId = formData.id;
        subjectDataWithId = { ...formData };
        setSubjects((prev) =>
          prev.map((subject) =>
            subject.id === formData.id ? { ...formData } : subject
          )
        );
      } else {
        // Add new subject to Firestore
        const { id, ...newSubjectData } = formData;
        const newSubjectRef = await addDoc(subjectsCollection, newSubjectData);
        subjectId = newSubjectRef.id;
        subjectDataWithId = { ...formData, id: subjectId };
        setSubjects((prev) => [
          ...prev,
          subjectDataWithId,
        ]);
      }

      // Update teachers' assignedSubjects based on sections
      const relatedSections = sections.filter((s) => s.subjectId === subjectId);
      const instructorIds = Array.from(new Set(relatedSections.map((s) => s.instructorId)));

      // For each instructor in the sections, update their assignedSubjects
      for (const instructorId of instructorIds) {
        const teacherRef = doc(db, 'teachers', instructorId);
        const assignedSections = relatedSections
          .filter((s) => s.instructorId === instructorId)
          .map((section) => ({
            id: section.id,
            name: section.name,
            code: section.code,
            capacity: section.capacity,
            currentEnrollment: section.currentEnrollment,
            schedules: section.schedules,
          }));

        // Fetch existing teacher data
        const teacherDoc = await getDocs(query(collection(db, 'teachers'), where('__name__', '==', instructorId)));
        if (!teacherDoc.empty) {
          const existingData = teacherDoc.docs[0].data();
          const existingAssignedSubjects = (existingData.assignedSubjects || []).filter(
            (sub: Subject) => sub.id !== subjectId
          );

          await updateDoc(teacherRef, {
            assignedSubjects: [
              ...existingAssignedSubjects,
              {
                ...subjectDataWithId,
                sections: assignedSections,
              },
            ],
          });
        } else {
          // If teacher doesn't exist, create a minimal document (unlikely case)
          await updateDoc(teacherRef, {
            fullName: instructors.find((i) => i.id === instructorId)?.fullName || 'Unknown',
            department: instructors.find((i) => i.id === instructorId)?.department || '',
            assignedSubjects: [
              {
                ...subjectDataWithId,
                sections: assignedSections,
              },
            ],
          });
        }
      }

      // Reset form and close modal
      setFormData({
        name: '',
        department: '',
        details: '',
        code: '',
        credits: 0,
        prerequisites: [],
        learningObjectives: [],
        status: 'active',
      });
      setIsModalOpen(false);

      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: formData.id ? 'Subject updated successfully' : 'Subject added successfully',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
      });
    } catch (error) {
      console.error('Error saving subject or updating teachers:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to save subject or update teachers. Please try again.',
      });
    }
  };

  // Delete subject and remove it from teachers' assignedSubjects
  const handleDelete = async (subjectId: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this subject?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      try {
        const relatedSections = sections.filter((s) => s.subjectId === subjectId);
        const instructorIds = Array.from(new Set(relatedSections.map((s) => s.instructorId)));

        // Remove subject from each instructor's assignedSubjects
        for (const instructorId of instructorIds) {
          const teacherRef = doc(db, 'teachers', instructorId);
          const teacherDoc = await getDocs(query(collection(db, 'teachers'), where('__name__', '==', instructorId)));
          if (!teacherDoc.empty) {
            const existingData = teacherDoc.docs[0].data();
            const updatedAssignedSubjects = (existingData.assignedSubjects || []).filter(
              (sub: Subject) => sub.id !== subjectId
            );
            await updateDoc(teacherRef, {
              assignedSubjects: updatedAssignedSubjects,
            });
          }
        }

        await deleteDoc(doc(db, 'subjects', subjectId));
        setSubjects((prev) => prev.filter((subject) => subject.id !== subjectId));
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Subject has been deleted.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
        });
      } catch (error) {
        console.error('Error deleting subject:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete subject. Please try again.',
        });
      }
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="mt-2 text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="p-8">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Subject Management</h1>
                <p className="text-gray-600 mt-2">Manage subjects and view related sections</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setFormData({
                    name: '',
                    department: '',
                    details: '',
                    code: '',
                    credits: 0,
                    prerequisites: [],
                    learningObjectives: [],
                    status: 'active',
                  });
                  setIsModalOpen(true);
                }}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add New Subject
              </motion.button>
            </div>

            {/* Department Filter */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white p-4 rounded-xl shadow"
              >
                <div className="flex items-center mb-4">
                  <FunnelIcon className="h-5 w-5 mr-2 text-gray-500" />
                  <h3 className="text-lg font-semibold">Filter by Department</h3>
                </div>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </motion.div>
            </div>

            {/* Subjects Grid */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredSubjects.map((subject) => {
                // Aggregate data from sections
                const relatedSections = sections.filter((s) => s.subjectId === subject.id);
                const schedules = relatedSections.flatMap((s) => s.schedules);
                const instructorIds = Array.from(new Set(relatedSections.map((s) => s.instructorId)));
                const sectionIds = relatedSections.map((s) => s.id);

                return (
                  <motion.div
                    key={subject.id}
                    whileHover={{ scale: 1.05 }}
                    className={`
                      bg-white rounded-xl shadow-lg p-6 
                      border-l-4 ${DEPARTMENT_COLORS[subject.department] || DEPARTMENT_COLORS['default']}
                    `}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">{subject.name}</h3>
                      <div className="flex space-x-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          onClick={() => {
                            setFormData(subject);
                            setIsModalOpen(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          onClick={() => handleDelete(subject.id!)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </motion.button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-gray-600 mb-2">{subject.details || 'No details provided'}</p>
                      {subject.code && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-500">Code:</span>
                          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{subject.code}</span>
                        </div>
                      )}
                      {subject.credits !== undefined && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-500">Credits:</span>
                          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{subject.credits}</span>
                        </div>
                      )}
                      {schedules.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 flex items-center">
                            <CalendarIcon className="h-4 w-4 mr-1" /> Schedules:
                          </span>
                          <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                            {schedules.map((schedule, index) => (
                              <li key={index}>
                                {schedule.day}: {schedule.startTime} - {schedule.endTime} ({schedule.roomName})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {instructorIds.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 flex items-center">
                            <UserIcon className="h-4 w-4 mr-1" /> Instructors:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {instructorIds.map((instructorId, index) => {
                              const instructor = instructors.find((i) => i.id === instructorId);
                              return (
                                <span 
                                  key={index} 
                                  className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded"
                                >
                                  {instructor?.fullName || 'Unknown'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {sectionIds.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Sections:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sectionIds.map((sectionId, index) => {
                              const section = sections.find((s) => s.id === sectionId);
                              return (
                                <span 
                                  key={index} 
                                  className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded"
                                >
                                  {section?.name || 'Unknown'} ({section?.code || 'N/A'}) - {section?.currentEnrollment}/{section?.capacity}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <span className={`
                          px-2 py-1 rounded-full text-xs font-medium
                          ${subject.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                          }
                        `}>
                          {subject.status}
                        </span>
                        <span className="text-sm text-gray-500">{subject.department}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Subject Modal */}
            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title={formData.id ? 'Edit Subject' : 'New Subject'}
            >
              <form onSubmit={handleSubmit} className="space-y-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Subject Name</label>
                    <input
                      type="text"
                      required
                      className="w-full p-2 border rounded-lg"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Department</label>
                    <select
                      required
                      className="w-full p-2 border rounded-lg"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Subject Code</label>
                    <input
                      type="text"
                      className="w-full p-2 border rounded-lg"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Credits</label>
                    <input
                      type="number"
                      className="w-full p-2 border rounded-lg"
                      value={formData.credits}
                      onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Subject Details</label>
                  <textarea
                    className="w-full p-2 border rounded-lg"
                    value={formData.details}
                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    className="w-full p-2 border rounded-lg"
                    value={formData.status}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      status: e.target.value as 'active' | 'inactive' 
                    })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    {formData.id ? 'Update Subject' : 'Create Subject'}
                  </button>
                </div>
              </form>
            </Modal>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSubjects;