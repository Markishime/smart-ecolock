import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserIcon,
  TrashIcon,
  PencilIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/solid';
import Sidebar from '../components/Sidebar';
import Swal from 'sweetalert2';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'instructor' | 'student';
  department?: string;
  studentId?: string;
  uid?: string;
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

  const sortedAndFilteredUsers = users
    .filter(user => {
      const roleMatch = selectedRole === 'all' || user.role === selectedRole;
      const departmentMatch = selectedDepartment === 'all' || user.department === selectedDepartment;
      const searchMatch = user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      return roleMatch && departmentMatch && searchMatch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.fullName.localeCompare(b.fullName);
      } else if (sortBy === 'role') {
        comparison = a.role.localeCompare(b.role);
      } else if (sortBy === 'department') {
        comparison = (a.department || '').localeCompare(b.department || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      
      <div className={`flex-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-20' : 'ml-64'} overflow-y-auto`}>
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
              <p className="mt-2 text-gray-600">
                {sortedAndFilteredUsers.length} users found
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
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
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
              {sortedAndFilteredUsers.map((user) => (
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
                        <button
                          onClick={() => handleDeleteUser(user.id, user.role)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors duration-200"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors duration-200">
                          <PencilIcon className="w-5 h-5" />
                        </button>
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
              ))}
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
    </div>
  );
};

export default Users;
