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
  setDoc
} from 'firebase/firestore';
import { 
  ref, 
  set, 
  remove 
} from 'firebase/database';
import { db, rtdb } from '../firebase';
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
  UserIcon
} from '@heroicons/react/24/solid';

// Define Room interface
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
  room: string;
}

// Define Instructor interface
interface Instructor {
  id: string;
  fullName: string;
  department: string;
}

// Define Subject interface
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
  schedules: Schedule[];
  instructors: string[];
}

// Department color mapping
const DEPARTMENT_COLORS: { [key: string]: string } = {
  'Computer Science': 'bg-blue-100 text-blue-800',
  'Mathematics': 'bg-green-100 text-green-800',
  'Physics': 'bg-purple-100 text-purple-800',
  'Biology': 'bg-teal-100 text-teal-800',
  'Chemistry': 'bg-red-100 text-red-800',
  'default': 'bg-gray-100 text-gray-800'
};

const AdminSubjects: React.FC = () => {
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
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
    schedules: [],
    instructors: []
  });

  // Fetch subjects, departments, instructors, and rooms
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subjects
        const subjectsCollection = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          schedules: doc.data().schedules || [],
          instructors: doc.data().instructors || []
        } as Subject));
        
        // Fetch departments and instructors from teachers
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        
        const uniqueDepartments = Array.from(
          new Set(teachersSnapshot.docs.map(doc => doc.data().department).filter(Boolean))
        );

        const instructorsData = teachersSnapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().fullName || '',
          department: doc.data().department || ''
        } as Instructor));

        // Fetch rooms
        const roomsCollection = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsCollection);
        const roomsData = roomsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          capacity: doc.data().capacity,
          location: doc.data().location
        } as Room));

        setSubjects(subjectsData);
        setDepartments(uniqueDepartments);
        setInstructors(instructorsData);
        setRooms(roomsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch data. Please try again.'
        });
      }
    };

    fetchData();
  }, []);

  // Filtered and sorted subjects
  const filteredSubjects = useMemo(() => {
    return selectedDepartment === 'all'
      ? subjects
      : subjects.filter(subject => subject.department === selectedDepartment);
  }, [subjects, selectedDepartment]);

  // Handle schedule addition
  const addSchedule = () => {
    setFormData({
      ...formData,
      schedules: [...formData.schedules, { day: '', startTime: '', endTime: '', room: '' }]
    });
  };

  // Handle schedule change
  const handleScheduleChange = (index: number, field: keyof Schedule, value: string) => {
    const updatedSchedules = formData.schedules.map((schedule, i) =>
      i === index ? { ...schedule, [field]: value } : schedule
    );
    setFormData({ ...formData, schedules: updatedSchedules });
  };

  // Remove schedule
  const removeSchedule = (index: number) => {
    setFormData({
      ...formData,
      schedules: formData.schedules.filter((_, i) => i !== index)
    });
  };

  // Handle instructor assignment
  const handleInstructorChange = (instructorId: string) => {
    const updatedInstructors = formData.instructors.includes(instructorId)
      ? formData.instructors.filter(id => id !== instructorId)
      : [...formData.instructors, instructorId];
    setFormData({ ...formData, instructors: updatedInstructors });
  };

  // Add or update subject, store in Firestore and Realtime Database
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
        setSubjects(prev => 
          prev.map(subject => 
            subject.id === formData.id ? { ...formData } : subject
          )
        );
      } else {
        // Add new subject to Firestore
        const { id, ...newSubjectData } = formData;
        const newSubjectRef = await addDoc(subjectsCollection, newSubjectData);
        subjectId = newSubjectRef.id;
        subjectDataWithId = { ...formData, id: subjectId };
        setSubjects(prev => [
          ...prev, 
          subjectDataWithId
        ]);
      }

      // Update teachers collection in Firestore with full subject details including schedules
      const prevSubject = subjects.find(s => s.id === subjectId);
      const prevInstructors = prevSubject ? prevSubject.instructors : [];
      const newInstructors = formData.instructors;

      // Remove subject from instructors who were unassigned
      const unassignedInstructors = prevInstructors.filter(id => !newInstructors.includes(id));
      for (const instructorId of unassignedInstructors) {
        const teacherRef = doc(db, 'teachers', instructorId);
        await updateDoc(teacherRef, {
          assignedSubjects: arrayRemove({ ...prevSubject }) // Remove old subject data
        });

        // Remove from Realtime Database
        const rtdbRef = ref(rtdb, `Instructors/${instructorId}/AssignedSubjects/${subjectId}`);
        await remove(rtdbRef);
      }

      // Add or update subject details for assigned instructors in Firestore
      for (const instructorId of newInstructors) {
        const teacherRef = doc(db, 'teachers', instructorId);
        const teacherDoc = await getDocs(query(collection(db, 'teachers'), where('__name__', '==', instructorId)));
        if (!teacherDoc.empty) {
          const existingData = teacherDoc.docs[0].data();
          const existingAssignedSubjects = (existingData.assignedSubjects || []).filter(
            (sub: Subject) => sub.id !== subjectId
          );
          // Include schedules in the Firestore update
          await updateDoc(teacherRef, {
            assignedSubjects: [...existingAssignedSubjects, subjectDataWithId]
          });
        } else {
          // Include schedules in the initial Firestore set
          await setDoc(teacherRef, {
            fullName: instructors.find(i => i.id === instructorId)?.fullName || 'Unknown',
            department: instructors.find(i => i.id === instructorId)?.department || '',
            assignedSubjects: [subjectDataWithId]
          });
        }

        // Update Realtime Database without schedules
        const instructor = instructors.find(i => i.id === instructorId);
        const rtdbRef = ref(rtdb, `Instructors/${instructorId}/AssignedSubjects/${subjectId}`);
        await set(rtdbRef, {
          uid: subjectId,
          name: subjectDataWithId.name,
          department: subjectDataWithId.department,
          details: subjectDataWithId.details || '',
          code: subjectDataWithId.code || '',
          credits: subjectDataWithId.credits || 0,
          prerequisites: subjectDataWithId.prerequisites || [],
          learningObjectives: subjectDataWithId.learningObjectives || [],
          status: subjectDataWithId.status,
          instructors: subjectDataWithId.instructors,
          instructorFullName: instructor?.fullName || 'Unknown',
          updatedAt: new Date().toISOString()
        });
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
        schedules: [],
        instructors: []
      });
      setIsModalOpen(false);

      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: formData.id ? 'Subject updated successfully' : 'Subject added successfully',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    } catch (error) {
      console.error('Error saving subject or updating instructors:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to save subject or update instructors. Please try again.'
      });
    }
  };

  // Delete subject and remove its details from both Firestore and Realtime Database
  const handleDelete = async (subjectId: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this subject?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        // Remove subject details from assigned instructors
        const subjectToDelete = subjects.find(s => s.id === subjectId);
        if (subjectToDelete && subjectToDelete.instructors.length > 0) {
          for (const instructorId of subjectToDelete.instructors) {
            // Remove from Firestore (includes schedules)
            const teacherRef = doc(db, 'teachers', instructorId);
            await updateDoc(teacherRef, {
              assignedSubjects: arrayRemove(subjectToDelete)
            });

            // Remove from Realtime Database
            const rtdbRef = ref(rtdb, `Instructors/${instructorId}/AssignedSubjects/${subjectId}`);
            await remove(rtdbRef);
          }
        }

        // Delete the subject from subjects collection in Firestore
        await deleteDoc(doc(db, 'subjects', subjectId));
        setSubjects(prev => prev.filter(subject => subject.id !== subjectId));
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Subject has been deleted.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      } catch (error) {
        console.error('Error deleting subject:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete subject. Please try again.'
        });
      }
    }
  };

  // Prevent unauthorized access
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
                <p className="text-gray-600 mt-2">Manage subjects, schedules, and instructors</p>
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
                    schedules: [],
                    instructors: []
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
                  {departments.map(dept => (
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
              {filteredSubjects.map(subject => (
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
                    {subject.schedules.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Schedules:</span>
                        <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                          {subject.schedules.map((schedule, index) => (
                            <li key={index}>
                              {schedule.day}: {schedule.startTime} - {schedule.endTime} ({schedule.room})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {subject.instructors.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Instructors:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {subject.instructors.map((instructorId, index) => {
                            const instructor = instructors.find(i => i.id === instructorId);
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
              ))}
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
                      {departments.map(dept => (
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

                {/* Schedules */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Schedules</label>
                    <button
                      type="button"
                      onClick={addSchedule}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center"
                    >
                      <PlusIcon className="h-5 w-5 mr-1" /> Add Schedule
                    </button>
                  </div>
                  {formData.schedules.map((schedule, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-2 mb-2 items-center">
                      <select
                        className="w-full md:w-1/4 p-2 border rounded-lg"
                        value={schedule.day}
                        onChange={(e) => handleScheduleChange(index, 'day', e.target.value)}
                      >
                        <option value="">Day</option>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        className="w-full md:w-1/4 p-2 border rounded-lg"
                        value={schedule.startTime}
                        onChange={(e) => handleScheduleChange(index, 'startTime', e.target.value)}
                      />
                      <input
                        type="time"
                        className="w-full md:w-1/4 p-2 border rounded-lg"
                        value={schedule.endTime}
                        onChange={(e) => handleScheduleChange(index, 'endTime', e.target.value)}
                      />
                      <select
                        className="w-full md:w-1/4 p-2 border rounded-lg"
                        value={schedule.room}
                        onChange={(e) => handleScheduleChange(index, 'room', e.target.value)}
                      >
                        <option value="">Select Room</option>
                        {rooms.map(room => (
                          <option key={room.id} value={room.name}>
                            {room.name} {room.capacity ? `(${room.capacity} seats)` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeSchedule(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Instructors */}
                <div>
                  <label className="block text-sm font-medium mb-1">Instructors</label>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
                    {instructors.map(instructor => (
                      <div key={instructor.id} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={formData.instructors.includes(instructor.id)}
                          onChange={() => handleInstructorChange(instructor.id)}
                          className="mr-2"
                        />
                        <label className="text-sm">{instructor.fullName} ({instructor.department})</label>
                      </div>
                    ))}
                  </div>
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