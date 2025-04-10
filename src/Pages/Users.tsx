import React, { useState, useEffect } from 'react';
import { collection, doc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserIcon,
  TrashIcon,
  AcademicCapIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/solid';
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

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string; // Changed from roomId to roomName
}

interface Section {
  id: string;
  name: string;
  code: string;
  capacity: number;
  currentEnrollment: number;
  schedules: Schedule[];
}

interface AssignedSubject {
  id: string;
  name: string;
  department: string;
  status: 'active' | 'inactive';
  sections: Section[];
}

interface InstructorDetails {
  assignedSubjects: AssignedSubject[];
}

interface Room {
  id: string;
  name: string;
  status?: 'available' | 'occupied';
}

interface SectionDoc {
  id: string;
  name: string;
  code: string;
  teacherId?: string;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]); // Still needed for other potential uses, but not for schedules
  const [sections, setSections] = useState<SectionDoc[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'all' | 'admin' | 'instructor' | 'student'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'department'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<User | null>(null);
  const [instructorDetails, setInstructorDetails] = useState<InstructorDetails>({
    assignedSubjects: []
  });
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Fetch Users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const usersCollection = collection(db, 'users');
        const teachersCollection = collection(db, 'teachers');
        const studentsCollection = collection(db, 'students');

        const [usersSnapshot, teachersSnapshot, studentsSnapshot] = await Promise.all([
          getDocs(usersCollection),
          getDocs(teachersCollection),
          getDocs(studentsCollection)
        ]);

        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User));
        const teachersData = teachersSnapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().fullName,
          email: doc.data().email,
          role: 'instructor',
          department: doc.data().department,
          uid: doc.data().uid || doc.id
        } as User));
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().fullName,
          email: doc.data().email,
          role: 'student',
          department: doc.data().department,
          studentId: doc.data().studentId,
          uid: doc.data().uid || doc.id
        } as User));

        const combinedUsers = [
          ...usersData,
          ...teachersData.filter(teacher => !usersData.some(user => user.uid === teacher.uid)),
          ...studentsData.filter(student => !usersData.some(user => user.uid === student.uid))
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

  // Fetch Rooms (optional now for schedules, but kept for potential other uses)
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomsCollection = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsCollection);
        const roomsData = roomsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          status: doc.data().status || 'available',
        } as Room));
        setRooms(roomsData.filter(room => room.status === 'available'));
      } catch (error) {
        console.error('Error fetching rooms:', error);
        Swal.fire({ icon: 'error', title: 'Fetch Error', text: 'Failed to fetch rooms' });
      }
    };

    fetchRooms();
  }, []);

  // Fetch Sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const sectionsCollection = collection(db, 'sections');
        const sectionsSnapshot = await getDocs(sectionsCollection);
        const sectionsData = sectionsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          code: doc.data().code,
          teacherId: doc.data().instructorId
        } as SectionDoc));
        setSections(sectionsData);
      } catch (error) {
        console.error('Error fetching sections:', error);
        Swal.fire({ icon: 'error', title: 'Fetch Error', text: 'Failed to fetch sections' });
      }
    };

    fetchSections();
  }, []);

  // Handle Delete User
  const handleDeleteUser = async (userId: string, userRole: string) => {
    try {
      const collectionName = userRole === 'instructor' ? 'teachers' : userRole === 'student' ? 'students' : 'users';
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

  // Handle Sort
  const handleSort = (field: 'name' | 'role' | 'department') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Handle Bulk Delete
  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedUsers.map(userId => {
          const user = users.find(u => u.id === userId);
          if (user) {
            const collectionName = user.role === 'instructor' ? 'teachers' : user.role === 'student' ? 'students' : 'users';
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

  // Handle Details Modal
  const handleDetailsModal = async (user: User) => {
    try {
      console.log('Opening details modal for user:', user);
      setSelectedInstructor(user);

      const teacherRef = doc(db, 'teachers', user.id);
      const teacherDoc = await getDoc(teacherRef);

      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();
        const assignedSubjects = teacherData.assignedSubjects || [];
        
        setInstructorDetails({
          assignedSubjects: assignedSubjects.map((subject: any) => ({
            id: subject.id,
            name: subject.name,
            department: subject.department || 'Unknown',
            status: subject.status || 'active',
            sections: subject.sections || []
          }))
        });
      } else {
        console.warn(`No teacher document found for ID: ${user.id}`);
        setInstructorDetails({ assignedSubjects: [] });
      }

      setIsDetailsModalOpen(true);
    } catch (error) {
      console.error('Error fetching instructor details:', error);
      Swal.fire('Error', 'Failed to load instructor details', 'error');
    }
  };

  // Filtered Users
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
        case 'name': valueA = a.fullName?.toLowerCase() || ''; valueB = b.fullName?.toLowerCase() || ''; break;
        case 'role': valueA = a.role?.toLowerCase() || ''; valueB = b.role?.toLowerCase() || ''; break;
        case 'department': valueA = a.department?.toLowerCase() || ''; valueB = b.department?.toLowerCase() || ''; break;
        default: valueA = ''; valueB = '';
      }
      return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    });

  const renderUserCard = (user: User) => (
    <motion.div
      key={user.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${selectedUsers.includes(user.id) ? 'ring-2 ring-indigo-500' : ''}`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="checkbox"
              checked={selectedUsers.includes(user.id)}
              onChange={(e) => {
                if (e.target.checked) setSelectedUsers([...selectedUsers, user.id]);
                else setSelectedUsers(selectedUsers.filter(id => id !== user.id));
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-blue-100' : user.role === 'instructor' ? 'bg-purple-100' : 'bg-green-100'}`}>
              {user.role === 'student' ? (
                <AcademicCapIcon className="w-6 h-6 text-green-600" />
              ) : (
                <UserIcon className={`w-6 h-6 ${user.role === 'admin' ? 'text-blue-600' : 'text-purple-600'}`} />
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
                onClick={() => handleDetailsModal(user)}
                className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors duration-200 flex items-center space-x-2"
              >
                <ViewColumnsIcon className="w-5 h-5 mr-1" />
                <span>Details</span>
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : user.role === 'instructor' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
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

  // Helper function to format time
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const adjustedHours = hours % 12 || 12;
    return `${adjustedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Helper function to format schedule
  const formatSchedule = (schedule: Schedule) => {
    return `${schedule.day}: ${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)} (${schedule.roomName})`;
  };

  const renderDetailsModal = () => {
    if (!isDetailsModalOpen || !selectedInstructor) return null;

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
          <div className="w-1/3 bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-6 flex flex-col justify-between">
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
                  <p className="text-sm opacity-75 mb-1">Assigned Subjects</p>
                  <div className="flex flex-wrap gap-2">
                    {instructorDetails.assignedSubjects.length === 0 ? (
                      <span className="text-xs bg-white bg-opacity-10 px-2 py-1 rounded">
                        No subjects assigned
                      </span>
                    ) : (
                      instructorDetails.assignedSubjects.map(subject => (
                        <span
                          key={subject.id}
                          className="text-xs bg-white bg-opacity-10 px-2 py-1 rounded"
                        >
                          {subject.name}
                        </span>
                      ))
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
              {/* Subjects Section */}
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <AcademicCapIcon className="w-6 h-6 mr-3 text-indigo-600" />
                  Assigned Subjects & Schedules
                </h3>
                {instructorDetails.assignedSubjects.length === 0 ? (
                  <p className="text-gray-600">No subjects assigned to this instructor.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {instructorDetails.assignedSubjects.map(subject => (
                      <div
                        key={subject.id}
                        className="bg-gray-50 p-4 rounded-lg shadow-sm"
                      >
                        <h4 className="text-lg font-semibold text-gray-900">{subject.name}</h4>
                        <p className="text-sm text-gray-600">Department: {subject.department}</p>
                        <p className="text-sm text-gray-600">Status: {subject.status}</p>
                        {subject.sections && subject.sections.length > 0 ? (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-700">Sections:</p>
                            {subject.sections.map(section => (
                              <div key={section.id} className="mt-2 pl-4 border-l-2 border-indigo-200">
                                <p className="text-sm font-medium text-gray-800">{section.name} ({section.code})</p>
                                <p className="text-xs text-gray-600">
                                  Enrollment: {section.currentEnrollment}/{section.capacity}
                                </p>
                                {section.schedules && section.schedules.length > 0 ? (
                                  <div className="mt-1">
                                    <p className="text-sm font-medium text-gray-700">Schedules:</p>
                                    <ul className="list-disc list-inside text-sm text-gray-600">
                                      {section.schedules.map((schedule, index) => (
                                        <li key={index}>
                                          {formatSchedule(schedule)}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 mt-1">No schedules assigned</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 mt-2">No sections assigned</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 flex justify-end space-x-4 border-t pt-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 rounded-lg border"
              >
                Close
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const departments = Array.from(new Set(users.map(user => user.department || 'Unknown')));

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

      {/* Details Modal */}
      {renderDetailsModal()}
    </div>
  );
};

export default Users;