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

  // Filter users based on role and department
  const filteredUsers = users.filter(user => 
    (selectedRole === 'all' || user.role === selectedRole) &&
    (selectedDepartment === 'all' || user.department === selectedDepartment)
  );

  const handleDeleteUser = async (userId: string) => {
    try {
      await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4F46E5',
        cancelButtonColor: '#EF4444',
        confirmButtonText: 'Yes, delete it!'
      }).then(async (result) => {
        if (result.isConfirmed) {
          await deleteDoc(doc(db, 'users', userId));
          Swal.fire(
            'Deleted!',
            'User has been deleted.',
            'success'
          );
        }
      });
    } catch (error) {
      Swal.fire(
        'Error',
        'Failed to delete user.',
        'error'
      );
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'instructor' | 'student') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      Swal.fire(
        'Updated!',
        'User role has been updated.',
        'success'
      );
    } catch (error) {
      Swal.fire(
        'Error',
        'Failed to update user role.',
        'error'
      );
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed}
        userRole="admin"
      />
      
      <div className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
            <p className="mt-2 text-gray-600">
              Manage users and their roles in the system
            </p>
          </div>

          <div className="mb-6">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Users</option>
              <option value="admin">Administrators</option>
              <option value="instructor">Instructors</option>
              <option value="student">Students</option>
            </select>
          </div>

          <div className="mb-6">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Departments</option>
              {departments.map(department => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-3 text-gray-600">Name</th>
                      <th className="pb-3 text-gray-600">Email</th>
                      <th className="pb-3 text-gray-600">Role</th>
                      <th className="pb-3 text-gray-600">Department</th>
                      <th className="pb-3 text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-gray-500">
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-gray-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b"
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="bg-indigo-100 p-2 rounded-full">
                                {user.role === 'student' ? (
                                  <AcademicCapIcon className="w-5 h-5 text-indigo-600" />
                                ) : (
                                  <UserIcon className="w-5 h-5 text-indigo-600" />
                                )}
                              </div>
                              <span className="font-medium text-gray-900">{user.fullName}</span>
                            </div>
                          </td>
                          <td className="py-3 text-gray-600">{user.email}</td>
                          <td className="py-3">
                            <select
                              value={user.role}
                              onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                              className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="admin">Admin</option>
                              <option value="instructor">Instructor</option>
                              <option value="student">Student</option>
                            </select>
                          </td>
                          <td className="py-3 text-gray-600">{user.department || '-'}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                              <button
                                className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-50"
                              >
                                <PencilIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
