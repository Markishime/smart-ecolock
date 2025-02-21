import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import Sidebar from '../components/Sidebar';
import {
  ClockIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  FunnelIcon,
  Bars3CenterLeftIcon,
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import Modal from '../components/Modal';

// Department color mapping for consistent color coding
const DEPARTMENT_COLORS: { [key: string]: string } = {
  'Computer Science': 'bg-blue-100 text-blue-800',
  'Mathematics': 'bg-green-100 text-green-800',
  'Physics': 'bg-purple-100 text-purple-800',
  'Biology': 'bg-teal-100 text-teal-800',
  'Chemistry': 'bg-red-100 text-red-800',
  'default': 'bg-gray-100 text-gray-800'
};

// Existing interfaces remain the same
interface Schedule {
  id: string;
  subject: string;
  room: string;
  day: string;
  startTime: string;
  endTime: string;
  department: string;
  status: 'active' | 'inactive';
  instructor: string;
  instructorEmail: string;
  instructorDepartment: string;
  subjectDetails: Subject | null;
}

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  department: string;
  schedules: Schedule[];
  subjects: string[];
}

interface Subject {
  id: string;
  name: string;
  department: string;
}

const AdminSchedules = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Schedule; direction: 'asc' | 'desc' }>({
    key: 'day',
    direction: 'asc'
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [formData, setFormData] = useState<Partial<Schedule>>({
    subject: '',
    room: '',
    day: 'Monday',
    startTime: '08:00',
    endTime: '09:00',
    department: '',
    status: 'active'
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  // Existing useEffect and data fetching code remains the same
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subjects
        const subjectsCollection = collection(db, 'teachers');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Subject));

        // Fetch teachers
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        const teachersData = teachersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Teacher));

        // Extract unique departments
        const uniqueDepartments = Array.from(
          new Set(teachersData.map(teacher => teacher.department))
        ).filter(Boolean);

        setSubjects(subjectsData);
        setTeachers(teachersData);
        setDepartments(uniqueDepartments);
      } catch (error) {
        console.error('Error fetching data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch schedules and subjects'
        });
      }
    };

    fetchData();
  }, []);

  // Fetch all schedules from teachers
  const fetchAllSchedules = async () => {
    try {
      setLoading(true);
      
      // Fetch all teachers
      const teachersQuery = collection(db, 'teachers');
      const teachersSnapshot = await getDocs(teachersQuery);

      // Collect all schedules and subjects
      const allSchedules: Schedule[] = [];
      const allSubjects: string[] = [];

      // Iterate through teachers to get their schedules and subjects
      for (const teacherDoc of teachersSnapshot.docs) {
        const teacherData = teacherDoc.data() as Teacher;
        
        // Collect subjects from this teacher
        if (teacherData.subjects) {
          allSubjects.push(...teacherData.subjects);
        }

        // Process each schedule for this teacher
        const teacherSchedules = (teacherData.schedules || []).map(schedule => ({
          ...schedule,
          id: `${teacherDoc.id}_${schedule.subject}`, // Unique ID
          instructor: teacherData.fullName,
          instructorEmail: teacherData.email,
          instructorDepartment: teacherData.department
        }));

        allSchedules.push(...teacherSchedules);
      }

      // Create a unique array of subjects
      const uniqueSubjects = Array.from(new Set(allSubjects));

      // Create subject map
      const subjectsMap = new Map(
        uniqueSubjects.map(subjectName => [
          subjectName, 
          { 
            name: subjectName, 
            department: 'Unassigned', // Default department
            id: subjectName.toLowerCase().replace(/\s+/g, '-') // Create a simple ID
          }
        ])
      );

      // Enrich schedules with subject details
      const enrichedSchedules = allSchedules.map(schedule => ({
        ...schedule,
        subjectDetails: subjectsMap.get(schedule.subject) || null
      }));

      // Sort schedules
      const sortedSchedules = enrichedSchedules.sort((a, b) => 
        a.startTime.localeCompare(b.startTime)
      );

      // Explicitly cast to Schedule[] to satisfy TypeScript
      setSchedules(sortedSchedules as Schedule[]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      Swal.fire({
        icon: 'error',
        title: 'Fetch Error',
        text: error instanceof Error 
          ? error.message 
          : 'Failed to fetch schedules'
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSchedules();
  }, []);

  // Sorting and filtering functions
  const sortedSchedules = useMemo(() => {
    if (!selectedTeacher || !selectedTeacher.schedules) return [];
    
    return [...(selectedTeacher.schedules || [])].sort((a, b) => {
      // For subject, use the subject name from details if available
      const getSubjectSortValue = (schedule: Schedule) => {
        return schedule.subjectDetails?.name || schedule.subject;
      };

      // Safely access sort key with nullish coalescing
      const valueA = sortConfig.key === 'subject' 
        ? getSubjectSortValue(a)
        : a[sortConfig.key as keyof Schedule] ?? '';
      const valueB = sortConfig.key === 'subject'
        ? getSubjectSortValue(b)
        : b[sortConfig.key as keyof Schedule] ?? '';

      // Compare values as strings to ensure consistent sorting
      const comparisonResult = String(valueA).localeCompare(String(valueB));
      
      return sortConfig.direction === 'asc' 
        ? comparisonResult 
        : -comparisonResult;
    });
  }, [selectedTeacher, sortConfig]);

  const filteredTeachers = useMemo(() => {
    return selectedDepartment === 'all'
      ? teachers
      : teachers.filter(teacher => teacher.department === selectedDepartment);
  }, [teachers, selectedDepartment]);

 
  // Restore handleDelete function
  const handleDelete = async (scheduleId: string) => {
    if (!selectedTeacher) return;

    try {
      const teacherRef = doc(db, 'teachers', selectedTeacher.id);
      const updatedSchedules = selectedTeacher.schedules.filter(
        schedule => schedule.id !== scheduleId
      );
      
      await updateDoc(teacherRef, {
        schedules: updatedSchedules
      });

      setTeachers(prev =>
        prev.map(teacher =>
          teacher.id === selectedTeacher.id
            ? { ...teacher, schedules: updatedSchedules }
            : teacher
        )
      );

      // Optional: Show a success notification
      Swal.fire({
        icon: 'success',
        title: 'Deleted',
        text: 'Schedule has been successfully deleted.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to delete schedule. Please try again.',
      });
    }
  };

  // Helper function to get subject name
  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.name : subjectId;
  };

  // Color coding for departments
  const getDepartmentColor = (department: string) => {
    return DEPARTMENT_COLORS[department] || DEPARTMENT_COLORS['default'];
  };

  // Sorting toggle function
  const toggleSort = (key: keyof Schedule) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Rest of the component remains similar to the previous implementation
  // with enhanced UI components and interactions

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
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
        userRole="admin"
      />
      
      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="p-8">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Schedule Management</h1>
                <p className="text-gray-600 mt-2">
                  Manage schedules by teacher and department
                </p>
              </div>
            </div>

            {/* Enhanced Filtering Section */}
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
                className="bg-white p-4 rounded-xl shadow"
              >
                <div className="flex items-center mb-4">
                  <Bars3CenterLeftIcon className="h-5 w-5 mr-2 text-gray-500" />
                  <h3 className="text-lg font-semibold">Select Teacher</h3>
                </div>
                <select
                  className="w-full p-2 border rounded-lg"
                  onChange={(e) => {
                    const teacher = teachers.find(t => t.id === e.target.value);
                    setSelectedTeacher(teacher || null);
                  }}
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

            {/* Enhanced Schedule List */}
            {selectedTeacher && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow overflow-hidden"
              >
                <div className="p-6 border-b flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {selectedTeacher.fullName}'s Schedules
                    </h2>
                    <div className={`inline-block px-2 py-1 rounded mt-2 text-sm ${getDepartmentColor(selectedTeacher.department)}`}>
                      {selectedTeacher.department}
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {(['subject', 'instructor', 'day', 'startTime', 'room'] as (keyof Schedule)[]).map(key => (
                          <th 
                            key={key} 
                            onClick={() => toggleSort(key)}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center">
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                              {sortConfig.key === key && (
                                <span className="ml-2">
                                  {sortConfig.direction === 'asc' ? '▲' : '▼'}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedules.map(schedule => (
                        <tr 
                          key={schedule.id} 
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <div className={`inline-block px-2 py-1 rounded text-sm ${getDepartmentColor(schedule.subjectDetails?.department || 'default')}`}>
                                {schedule.subjectDetails?.name || schedule.subject}
                              </div>
                              {schedule.subjectDetails && (
                                <span className="text-xs text-gray-500">
                                  {schedule.subjectDetails.department}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>{schedule.instructor}</span>
                              <span className="text-xs text-gray-500">
                                {schedule.instructorEmail}
                              </span>
                              <div className={`inline-block px-1 py-0.5 rounded text-xs mt-1 ${getDepartmentColor(schedule.instructorDepartment)}`}>
                                {schedule.instructorDepartment}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{schedule.day}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {schedule.startTime} - {schedule.endTime}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{schedule.room}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSchedules;
