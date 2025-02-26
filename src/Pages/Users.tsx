import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, addDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserIcon,
  TrashIcon,
  PencilIcon,
  AcademicCapIcon,
  PlusIcon,
  ClockIcon,
  ViewColumnsIcon,
  CheckIcon
} from '@heroicons/react/24/solid';
import Sidebar from '../components/AdminSidebar';
import Swal from 'sweetalert2';
import AdminSidebar from '../components/AdminSidebar';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'instructor' | 'student';
  department?: string;
  studentId?: string;
  uid?: string;
}

interface Subject {
  id: string;
  name: string;
  department: string;
  status: 'active' | 'inactive';
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  section: string;
  room?: string;
  subject?: string;
}

interface InstructorDetails {
  subjects?: string[];
  schedules?: Schedule[];
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'all' | 'admin' | 'instructor' | 'student'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'department'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<User | null>(null);
  const [instructorDetails, setInstructorDetails] = useState<InstructorDetails>({
    subjects: [],
    schedules: []
  });
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [newScheduleSubject, setNewScheduleSubject] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const usersCollection = collection(db, 'users');
        const teachersCollection = collection(db, 'teachers');
        const studentsCollection = collection(db, 'students');

        // Fetch users from the main users collection
        const usersSnapshot = await getDocs(usersCollection);
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User));

        // Fetch teachers with additional details
        const teachersSnapshot = await getDocs(teachersCollection);
        const teachersData = teachersSnapshot.docs.map(doc => {
          const teacherData = doc.data();
          return {
            id: doc.id,
            fullName: teacherData.fullName,
            email: teacherData.email,
            role: 'instructor',
            department: teacherData.department,
            uid: teacherData.uid
          } as User;
        });

        // Fetch students with additional details
        const studentsSnapshot = await getDocs(studentsCollection);
        const studentsData = studentsSnapshot.docs.map(doc => {
          const studentData = doc.data();
          return {
            id: doc.id,
            fullName: studentData.fullName,
            email: studentData.email,
            role: 'student',
            department: studentData.department,
            studentId: studentData.studentId,
            uid: studentData.uid
          } as User;
        });

        // Combine all users, prioritizing main users collection
        const combinedUsers = [
          ...usersData,
          ...teachersData.filter(teacher => 
            !usersData.some(user => user.uid === teacher.uid)
          ),
          ...studentsData.filter(student => 
            !usersData.some(user => user.uid === student.uid)
          )
        ];

        setUsers(combinedUsers);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching users:", error);
        Swal.fire('Error', 'Failed to fetch users', 'error');
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectsCollection = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Subject));
        setSubjects(subjectsData);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        Swal.fire({
          icon: 'error',
          title: 'Fetch Error',
          text: 'Failed to fetch subjects'
        });
      }
    };

    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectsCollection = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Subject));
        setSubjects(subjectsData.filter(subject => subject.status === 'active'));
      } catch (error) {
        console.error('Error fetching subjects:', error);
      }
    };

    fetchSubjects();
  }, []);

  // Get unique departments for filtering
  const departments = Array.from(new Set(
    users.map(user => user.department || 'Unknown')
  ));

  const handleDeleteUser = async (userId: string, userRole: string) => {
    try {
      const collectionName = userRole === 'instructor' ? 'teachers' : 
                           userRole === 'student' ? 'students' : 'users';
      
      await deleteDoc(doc(db, collectionName, userId));
      
      Swal.fire({
        icon: 'success',
        title: 'User Deleted',
        text: 'The user has been successfully removed.',
        background: '#f8fafc',
        iconColor: '#3b82f6',
        confirmButtonColor: '#3b82f6'
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      Swal.fire('Error', 'Failed to delete user', 'error');
    }
  };

  const handleSort = (field: 'name' | 'role' | 'department') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedUsers.map(userId => {
          const user = users.find(u => u.id === userId);
          if (user) {
            const collectionName = user.role === 'instructor' ? 'teachers' : 
                                user.role === 'student' ? 'students' : 'users';
            return deleteDoc(doc(db, collectionName, userId));
          }
        })
      );
      
      setSelectedUsers([]);
      setShowDeleteModal(false);
      
      Swal.fire({
        icon: 'success',
        title: 'Users Deleted',
        text: 'Selected users have been removed successfully.',
        background: '#f8fafc',
        iconColor: '#3b82f6',
        confirmButtonColor: '#3b82f6'
      });
    } catch (error) {
      console.error("Error deleting users:", error);
      Swal.fire('Error', 'Failed to delete users', 'error');
    }
  };

  const handleAssignmentModal = async (user: User) => {
    try {
      // Fetch existing instructor details
      const teacherDoc = await getDoc(doc(db, 'teachers', user.id));
      const existingDetails = teacherDoc.data() as InstructorDetails || {};

      setSelectedInstructor(user);
      setSelectedTeacherId(user.id);
      setInstructorDetails({
        subjects: existingDetails.subjects || [],
        schedules: existingDetails.schedules || []
      });
      setIsAssignmentModalOpen(true);
    } catch (error) {
      console.error('Error fetching instructor details:', error);
      Swal.fire('Error', 'Failed to load instructor details', 'error');
    }
  };

  const handleSubjectToggle = (subjectId: string) => {
    setInstructorDetails(prev => {
      const currentSubjects = prev.subjects || [];
      return {
        ...prev,
        subjects: currentSubjects.includes(subjectId)
          ? currentSubjects.filter(id => id !== subjectId)
          : [...currentSubjects, subjectId]
      };
    });
  };

  const addNewSchedule = () => {
    setInstructorDetails(prev => ({
      ...prev,
      schedules: [
        ...(prev.schedules || []),
        {
          day: '',
          startTime: '',
          endTime: '',
          section: '',
          room: '',
          subject: ''
        }
      ]
    }));
  };

  const handleSaveAssignments = async () => {
    try {
      // Validate selected teacher
      if (!selectedTeacherId) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Please select a teacher first'
        });
        return;
      }

      // Map subject IDs to subject names with null safety
      const subjectNames = (instructorDetails.subjects || [])
        .map(subjectId => {
          const subject = subjects.find(s => s.id === subjectId);
          return subject ? subject.name : '';
        })
        .filter(name => name !== '');

      // Validate schedules
      const validSchedules = (instructorDetails.schedules || []).filter(
        schedule => 
          schedule.startTime && 
          schedule.endTime && 
          schedule.section &&
          schedule.day
      );

      // Prepare update object
      const updateData = {
        subjects: subjectNames,
        schedules: validSchedules
      };

      // Reference to the selected teacher's document
      const teacherDocRef = doc(db, 'teachers', selectedTeacherId);

      // Fetch current teacher data to get department
      const teacherDoc = await getDoc(teacherDocRef);
      const teacherData = teacherDoc.data();

      // Update teacher document
      await updateDoc(teacherDocRef, updateData);

      // Optional: Sync subjects with subjects collection
      const subjectsRef = collection(db, 'subjects');
      
      // Collect all unique subjects from schedules and assigned subjects
      const allSubjects = [
        ...subjectNames,
        ...(validSchedules.map(schedule => schedule.subject || '').filter(Boolean))
      ];

      // Add new subjects to the subjects collection if they don't exist
      for (const subjectName of allSubjects) {
        // Check if subject already exists
        const subjectQuery = query(
          subjectsRef, 
          where('name', '==', subjectName),
          where('department', '==', teacherData?.department)
        );
        
        const existingSubjects = await getDocs(subjectQuery);
        
        if (existingSubjects.empty) {
          // Add new subject if it doesn't exist
          await addDoc(subjectsRef, {
            name: subjectName,
            department: teacherData?.department || 'Unassigned',
            status: 'active',
            createdAt: new Date()
          });
        }
      }

      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Assignments Saved',
        text: 'Teacher assignments and subjects have been successfully updated',
        timer: 2000,
        showConfirmButton: false
      });

      // Close the modal
      setIsAssignmentModalOpen(false);

      // Optional: Refresh teacher data
      // fetchTeachers();
    } catch (error) {
      console.error('Error saving assignments:', error);
      Swal.fire({
        icon: 'error',
        title: 'Save Error',
        text: error instanceof Error 
          ? error.message 
          : 'Failed to save teacher assignments'
      });
    }
  };

  const updateScheduleSubject = (index: number, subject: string) => {
    setInstructorDetails(prev => {
      const updatedSchedules = [...(prev.schedules || [])];
      updatedSchedules[index] = {
        ...updatedSchedules[index],
        subject
      };
      return {
        ...prev,
        schedules: updatedSchedules
      };
    });
  };

  const renderScheduleInputs = () => {
    return (instructorDetails.schedules || []).map((schedule, index) => (
      <motion.div 
        key={index} 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="grid grid-cols-6 gap-4 mb-4 items-center"
      >
        {/* Day Dropdown */}
        <select
          value={schedule.day}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = {
              ...updatedSchedules[index],
              day: e.target.value
            };
            setInstructorDetails(prev => ({
              ...prev,
              schedules: updatedSchedules
            }));
          }}
          className="col-span-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select Day</option>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>

        {/* Start Time */}
        <input
          type="time"
          value={schedule.startTime}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = {
              ...updatedSchedules[index],
              startTime: e.target.value
            };
            setInstructorDetails(prev => ({
              ...prev,
              schedules: updatedSchedules
            }));
          }}
          className="col-span-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {/* End Time */}
        <input
          type="time"
          value={schedule.endTime}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = {
              ...updatedSchedules[index],
              endTime: e.target.value
            };
            setInstructorDetails(prev => ({
              ...prev,
              schedules: updatedSchedules
            }));
          }}
          className="col-span-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {/* Section */}
        <input
          type="text"
          placeholder="Section"
          value={schedule.section}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = {
              ...updatedSchedules[index],
              section: e.target.value
            };
            setInstructorDetails(prev => ({
              ...prev,
              schedules: updatedSchedules
            }));
          }}
          className="col-span-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {/* Room */}
        <input
          type="text"
          placeholder="Room"
          value={schedule.room || ''}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = {
              ...updatedSchedules[index],
              room: e.target.value
            };
            setInstructorDetails(prev => ({
              ...prev,
              schedules: updatedSchedules
            }));
          }}
          className="col-span-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {/* Subject Dropdown */}
        <select
          value={schedule.subject}
          onChange={(e) => updateScheduleSubject(index, e.target.value)}
          className="col-span-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select Subject</option>
          {subjects.map(subject => (
            <option key={subject.id} value={subject.name}>{subject.name}</option>
          ))}
        </select>

        {/* Delete Button */}
        <button
          onClick={() => {
            // Remove this specific schedule
            setInstructorDetails(prev => ({
              ...prev,
              schedules: (prev.schedules || []).filter((_, i) => i !== index)
            }));
          }}
          className="text-red-500 hover:text-red-700"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </motion.div>
    ));
  };

  const filteredUsers = users
    .filter(user => 
      (selectedRole === 'all' || user.role === selectedRole) &&
      (selectedDepartment === 'all' || user.department?.toLowerCase() === selectedDepartment.toLowerCase()) &&
      (searchQuery === '' || 
        user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
    .sort((a, b) => {
      let valueA, valueB;
      switch (sortBy) {
        case 'name':
          valueA = a.fullName?.toLowerCase() || '';
          valueB = b.fullName?.toLowerCase() || '';
          break;
        case 'role':
          valueA = a.role?.toLowerCase() || '';
          valueB = b.role?.toLowerCase() || '';
          break;
        case 'department':
          valueA = a.department?.toLowerCase() || '';
          valueB = b.department?.toLowerCase() || '';
          break;
        default:
          valueA = '';
          valueB = '';
      }

      return sortOrder === 'asc' 
        ? valueA.localeCompare(valueB) 
        : valueB.localeCompare(valueA);
    });

  const renderUserCard = (user: User) => (
    <motion.div
      key={user.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden
        ${selectedUsers.includes(user.id) ? 'ring-2 ring-indigo-500' : ''}
      `}
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="checkbox"
              checked={selectedUsers.includes(user.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUsers([...selectedUsers, user.id]);
                } else {
                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                }
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${user.role === 'admin' ? 'bg-blue-100' :
                user.role === 'instructor' ? 'bg-purple-100' : 'bg-green-100'}
            `}>
              {user.role === 'student' ? (
                <AcademicCapIcon className="w-6 h-6 text-green-600" />
              ) : (
                <UserIcon className={`w-6 h-6 ${
                  user.role === 'admin' ? 'text-blue-600' : 'text-purple-600'
                }`} />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{user.fullName}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {user.role === 'instructor' && (
              <button
                onClick={() => handleAssignmentModal(user)}
                className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors duration-200 flex items-center space-x-2"
              >
                <PlusIcon className="w-5 h-5 mr-1" />
                Assign
              </button>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`
            px-3 py-1 rounded-full text-xs font-medium
            ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
              user.role === 'instructor' ? 'bg-purple-100 text-purple-800' :
              'bg-green-100 text-green-800'}
          `}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </span>
          {user.department && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {user.department}
            </span>
          )}
          {user.studentId && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              ID: {user.studentId}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderAssignmentModal = () => {
    if (!isAssignmentModalOpen || !selectedInstructor) return null;

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto flex"
        >
          {/* Sidebar with Instructor Info */}
          <div className="w-1/3 bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedInstructor.fullName}</h2>
                  <p className="text-sm opacity-75">{selectedInstructor.email}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm opacity-75 mb-1">Department</p>
                  <p className="font-semibold">
                    {selectedInstructor.department || 'Not Specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm opacity-75 mb-1">Current Assignments</p>
                  <div className="flex flex-wrap gap-2">
                    {instructorDetails.subjects?.length === 0 ? (
                      <span className="text-xs bg-white bg-opacity-10 px-2 py-1 rounded">
                        No subjects assigned
                      </span>
                    ) : (
                      instructorDetails.subjects?.map(subjectId => {
                        const subject = subjects.find(s => s.id === subjectId);
                        return (
                          <span 
                            key={subjectId} 
                            className="text-xs bg-white bg-opacity-10 px-2 py-1 rounded"
                          >
                            {subject?.name}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-auto">
              <p className="text-xs opacity-75 mb-2">Last Updated</p>
              <p className="text-sm font-medium">
                {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="w-2/3 p-8 overflow-y-auto">
            <div className="space-y-8">

              {/* Schedules Section */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                  <ClockIcon className="w-6 h-6 mr-3 text-green-600" />
                  Weekly Schedule
                </h3>
                <div className="space-y-4">
                  {renderScheduleInputs()}
                  <div className="flex justify-center">
                    <button
                      onClick={addNewSchedule}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                    >
                      <PlusIcon className="w-5 h-5" />
                      <span>Add New Schedule</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 flex justify-end space-x-4 border-t pt-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsAssignmentModalOpen(false)}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 rounded-lg border"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSaveAssignments}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
              >
                <CheckIcon className="w-5 h-5 mr-2" />
                Save Assignments
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      
      <div className={`flex-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-20' : 'ml-64'} overflow-y-auto`}>
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
              <p className="mt-2 text-gray-600">
                {filteredUsers.length} users found
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-64 px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex flex-wrap gap-4">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="instructor">Instructor</option>
                <option value="student">Student</option>
              </select>
              
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept || 'Unknown'}</option>
                ))}
              </select>
            </div>

            {/* Sort Controls */}
            <div className="flex gap-4">
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value as typeof sortBy)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="name">Sort by Name</option>
                <option value="role">Sort by Role</option>
                <option value="department">Sort by Department</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="bg-indigo-50 p-4 rounded-lg flex items-center justify-between">
              <span className="text-indigo-700">
                {selectedUsers.length} users selected
              </span>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Selected
              </button>
            </div>
          )}

          {/* Users Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map(renderUserCard)}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Delete Selected Users
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedUsers.length} selected users? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Users
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {renderAssignmentModal()}
    </div>
  );
};

export default Users;