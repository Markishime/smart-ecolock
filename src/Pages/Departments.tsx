import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import Sidebar from '../components/Sidebar';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  BookOpenIcon
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

interface Department {
  id: string;
  name: string;
  description: string;
  head: string;
  courses: string[];
  studentCount: number;
  instructorCount: number;
}

const Departments = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    head: '',
    courses: ['']
  });

  const { currentUser } = useAuth();

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'departments'));
      const departmentsData = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const data = doc.data();
          // Get counts from users collection
          const studentsQuery = query(
            collection(db, 'students'),
            where('department', '==', data.name)
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          const instructorsQuery = query(
            collection(db, 'teachers'),
            where('department', '==', data.name)
          );
          const instructorsSnapshot = await getDocs(instructorsQuery);
          
          return {
            id: doc.id,
            ...data,
            studentCount: studentsSnapshot.size,
            instructorCount: instructorsSnapshot.size
          } as Department;
        })
      );
      setDepartments(departmentsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setLoading(false);
    }
  };

  const handleAddCourse = () => {
    setFormData(prev => ({
      ...prev,
      courses: [...prev.courses, '']
    }));
  };

  const handleRemoveCourse = (index: number) => {
    setFormData(prev => ({
      ...prev,
      courses: prev.courses.filter((_, i) => i !== index)
    }));
  };

  const handleCourseChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      courses: prev.courses.map((course, i) => (i === index ? value : course))
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDepartment) {
        await updateDoc(doc(db, 'departments', editingDepartment.id), {
          ...formData,
          courses: formData.courses.filter(course => course.trim() !== '')
        });
        Swal.fire({
          icon: 'success',
          title: 'Department Updated',
          text: 'The department has been updated successfully.',
          background: '#f8fafc',
          iconColor: '#3b82f6',
          confirmButtonColor: '#3b82f6'
        });
      } else {
        await addDoc(collection(db, 'departments'), {
          ...formData,
          courses: formData.courses.filter(course => course.trim() !== '')
        });
        Swal.fire({
          icon: 'success',
          title: 'Department Added',
          text: 'New department has been created successfully.',
          background: '#f8fafc',
          iconColor: '#3b82f6',
          confirmButtonColor: '#3b82f6'
        });
      }
      setShowAddModal(false);
      setEditingDepartment(null);
      setFormData({ name: '', description: '', head: '', courses: [''] });
      fetchDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      Swal.fire('Error', 'Failed to save department', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        await deleteDoc(doc(db, 'departments', id));
        setDepartments(prev => prev.filter(dept => dept.id !== id));
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Department has been deleted.',
          background: '#f8fafc',
          iconColor: '#3b82f6',
          confirmButtonColor: '#3b82f6'
        });
      }
    } catch (error) {
      console.error('Error deleting department:', error);
      Swal.fire('Error', 'Failed to delete department', 'error');
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description,
      head: department.head,
      courses: department.courses
    });
    setShowAddModal(true);
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="mt-2 text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      
      <div className={`flex-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-20' : 'ml-64'} overflow-y-auto`}>
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Departments</h1>
              <p className="mt-2 text-gray-600">
                Manage academic departments and their courses
              </p>
            </div>
            <button
              onClick={() => {
                setEditingDepartment(null);
                setFormData({ name: '', description: '', head: '', courses: [''] });
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Add Department</span>
            </button>
          </div>

          {/* Departments Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map((department) => (
                <motion.div
                  key={department.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                          <BuildingOfficeIcon className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {department.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Head: {department.head}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDelete(department.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(department)}
                          className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-4 text-gray-600">
                      {department.description}
                    </p>

                    <div className="mt-4 flex items-center space-x-4">
                      <div className="flex items-center text-gray-600">
                        <UserGroupIcon className="w-5 h-5 mr-2" />
                        <span>{department.studentCount} Students</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <BookOpenIcon className="w-5 h-5 mr-2" />
                        <span>{department.instructorCount} Instructors</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        Courses
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {department.courses.map((course, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
                          >
                            {course}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {editingDepartment ? 'Edit Department' : 'Add New Department'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Head
                </label>
                <input
                  type="text"
                  value={formData.head}
                  onChange={(e) => setFormData({ ...formData, head: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Courses
                </label>
                {formData.courses.map((course, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => handleCourseChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Course name"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCourse(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddCourse}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center space-x-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Course</span>
                </button>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingDepartment(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingDepartment ? 'Update Department' : 'Add Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
