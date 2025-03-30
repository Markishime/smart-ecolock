import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import AdminSidebar from '../components/AdminSidebar';
import {
  ClockIcon,
  FunnelIcon,
  Bars3CenterLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

// Department color mapping for consistent color coding
const DEPARTMENT_COLORS: { [key: string]: string } = {
  'Computer Science': 'bg-blue-100 text-blue-800',
  'Mathematics': 'bg-green-100 text-green-800',
  'Physics': 'bg-purple-100 text-purple-800',
  'Biology': 'bg-teal-100 text-teal-800',
  'Chemistry': 'bg-red-100 text-red-800',
  'default': 'bg-gray-100 text-gray-800',
};

// Updated interfaces
interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  subject?: string; // Subject name (optional, for display purposes)
}

interface Subject {
  id: string;
  name: string;
  department: string;
  status: 'active' | 'inactive';
  instructors: string[]; // Array of instructor IDs (uids or teacher IDs)
  schedules: Schedule[];
}

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  department: string;
  uid?: string; // Optional Firebase UID
}

const AdminSchedules = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Schedule; direction: 'asc' | 'desc' }>({
    key: 'day',
    direction: 'asc',
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  // Fetch teachers, subjects, and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch teachers
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        const teachersData = teachersSnapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().fullName,
          email: doc.data().email,
          department: doc.data().department,
          uid: doc.data().uid || doc.id, // Fallback to doc.id if uid is missing
        } as Teacher));

        // Fetch subjects
        const subjectsCollection = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          department: doc.data().department,
          status: doc.data().status || 'active',
          instructors: doc.data().instructors || [],
          schedules: doc.data().schedules || [],
        } as Subject));

        // Extract unique departments from teachers
        const uniqueDepartments = Array.from(
          new Set(teachersData.map(teacher => teacher.department))
        ).filter(Boolean);

        setTeachers(teachersData);
        setSubjects(subjectsData);
        setDepartments(uniqueDepartments);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch teachers and subjects',
        });
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper function to format time with AM/PM
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const adjustedHours = hours % 12 || 12; // Convert 0 or 12 to 12
    return `${adjustedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Define the order of days for sorting
  const dayOrder: { [key: string]: number } = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7,
  };

  // Get schedules for the selected teacher from subjects
  const sortedSchedules = useMemo(() => {
    if (!selectedTeacher) return [];

    // Filter subjects where the selected teacher is an instructor
    const teacherSubjects = subjects.filter(subject =>
      subject.instructors.includes(selectedTeacher.uid || selectedTeacher.id)
    );

    // Flatten schedules from these subjects and add subject name
    const schedules = teacherSubjects.flatMap(subject =>
      subject.schedules.map(schedule => ({
        ...schedule,
        subject: subject.name, // Add subject name to each schedule
      }))
    );

    // Sort schedules
    return schedules.sort((a, b) => {
      if (sortConfig.key === 'day') {
        const dayA = dayOrder[a.day] || 8; // Default to high number if day not found
        const dayB = dayOrder[b.day] || 8;
        const comparison = dayA - dayB;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      } else {
        const valueA = a[sortConfig.key] ?? '';
        const valueB = b[sortConfig.key] ?? '';
        const comparisonResult = String(valueA).localeCompare(String(valueB));
        return sortConfig.direction === 'asc' ? comparisonResult : -comparisonResult;
      }
    });
  }, [selectedTeacher, subjects, sortConfig]);

  const filteredTeachers = useMemo(() => {
    return selectedDepartment === 'all'
      ? teachers
      : teachers.filter(teacher => teacher.department === selectedDepartment);
  }, [teachers, selectedDepartment]);

  // Handle teacher selection
  const handleTeacherSelect = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    setSelectedTeacher(teacher || null);
  };

  // Clear selected teacher
  const clearSelectedTeacher = () => {
    setSelectedTeacher(null);
  };

  // Color coding for departments
  const getDepartmentColor = (department: string) => {
    return DEPARTMENT_COLORS[department] || DEPARTMENT_COLORS['default'];
  };

  // Sorting toggle function
  const toggleSort = (key: keyof Schedule) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Access control
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'instructor')) {
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
                <h1 className="text-3xl font-bold text-gray-900">Schedule Management</h1>
                <p className="text-gray-600 mt-2">
                  View schedules by teacher and department
                </p>
              </div>
            </div>

            {/* Enhanced Filtering Section */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white p-4 rounded-xl shadow-lg"
              >
                <div className="flex items-center mb-4">
                  <FunnelIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Filter by Department</h3>
                </div>
                <select
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-white p-4 rounded-xl shadow-lg"
              >
                <div className="flex items-center mb-4">
                  <Bars3CenterLeftIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Select Teacher</h3>
                </div>
                <select
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  onChange={(e) => handleTeacherSelect(e.target.value)}
                  value={selectedTeacher ? selectedTeacher.id : ''}
                >
                  <option value="">Select a Teacher</option>
                  {filteredTeachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName} ({teacher.department})
                    </option>
                  ))}
                </select>
              </motion.div>
            </div>

            {/* Loading Spinner */}
            {loading && (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
              </div>
            )}

            {/* Enhanced Schedule List */}
            {!loading && selectedTeacher && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">
                      {selectedTeacher.fullName}'s Schedules
                    </h2>
                    <div className={`inline-block px-3 py-1 rounded-full mt-2 text-sm font-medium ${getDepartmentColor(selectedTeacher.department)}`}>
                      {selectedTeacher.department}
                    </div>
                  </div>
                  <button
                    onClick={clearSelectedTeacher}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                  >
                    <XMarkIcon className="h-5 w-5 mr-2" />
                    Clear Selection
                  </button>
                </div>

                {sortedSchedules.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {(['subject', 'day', 'startTime', 'room'] as (keyof Schedule)[]).map(key => (
                            <th
                              key={key}
                              onClick={() => toggleSort(key)}
                              className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                            >
                              <div className="flex items-center">
                                {key.charAt(0).toUpperCase() + key.slice(1)}
                                {sortConfig.key === key && (
                                  <span className="ml-2 text-gray-400">
                                    {sortConfig.direction === 'asc' ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sortedSchedules.map((schedule, index) => (
                          <motion.tr
                            key={index} // Use index as key since schedules from subjects might not have unique IDs
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="hover:bg-indigo-50 transition-colors duration-200"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getDepartmentColor(selectedTeacher.department)}`}>
                                  {schedule.subject}
                                </div>
                                <span className="text-xs text-gray-500 mt-1">
                                  {selectedTeacher.department}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700">{schedule.day}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                              <div className="flex items-center">
                                <ClockIcon className="h-4 w-4 text-indigo-500 mr-2" />
                                {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700">{schedule.room}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <h3 className="text-lg font-medium text-gray-600">No Schedules Found</h3>
                    <p className="text-gray-500 mt-2">
                      The selected teacher has no schedules assigned in any subjects.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {!loading && !selectedTeacher && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-lg p-6 text-center"
              >
                <h3 className="text-lg font-medium text-gray-600">Select a Teacher</h3>
                <p className="text-gray-500 mt-2">
                  Please select a teacher from the dropdown above to view their schedules.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSchedules;