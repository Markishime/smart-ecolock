import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  arrayUnion,
  QuerySnapshot, 
  DocumentData,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/solid';
import Sidebar from '../components/Sidebar';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext';

interface Schedule {
  id: string;
  roomNumber: string;
  days: string[];
  startTime: string;
  endTime: string;
  section: string;
  subject?: string;
  subjectCode?: string;
  instructor?: string;
  semester?: string;
  department?: string;
}

interface Subject {
  code: string;
  name: string;
}

const Schedules = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    department: 'all',
    day: 'all',
    semester: 'all'
  });
  const { currentUser } = useAuth();

  // Role-based access control
  const isAdmin = currentUser?.role === 'admin';
  const isInstructor = currentUser?.role === 'instructor';

  // Fetch all schedules from teachers database and subjects database
  const fetchAllSchedules = async () => {
    try {
      setLoading(true);
      
      // Fetch subjects from subjects database
      const subjectsQuery = collection(db, 'subjects');
      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjectsMap = new Map(
        subjectsSnapshot.docs.map(doc => {
          const data = doc.data();
          return [
            doc.id, 
            {
              id: doc.id,
              code: data.code || '',
              name: data.name || ''
            } as Subject
          ];
        })
      );

      // Fetch teachers and their schedules
      const teachersQuery = collection(db, 'teachers');
      const teachersSnapshot = await getDocs(teachersQuery);

      // Collect all schedules from all teachers
      const allSchedules: Schedule[] = [];

      teachersSnapshot.docs.forEach((teacherDoc) => {
        const teacherData = teacherDoc.data();
        const teacherSchedules = teacherData.schedules || [];
        
        // Add teacher name and department to each schedule
        const teacherSchedulesWithDetails = teacherSchedules.map((schedule: Schedule, index: number) => {
          // Find the corresponding subject for this schedule
          const relatedSubject = schedule.subject 
            ? subjectsMap.get(schedule.subject) 
            : null;

          return {
            ...schedule,
            id: `${teacherDoc.id}-${schedule.section}`, // Unique ID
            subject: relatedSubject ? relatedSubject.name : schedule.subject,
            subjectCode: relatedSubject ? relatedSubject.code : schedule.subjectCode,
            instructor: teacherData.fullName,
            department: teacherData.department,
            semester: teacherData.currentSemester || 'Current Semester'
          };
        });

        allSchedules.push(...teacherSchedulesWithDetails);
      });

      // Sort schedules by start time
      allSchedules.sort((a, b) => {
        const timeToMinutes = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      });

      setSchedules(allSchedules);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      Swal.fire('Error', 'Failed to fetch schedules', 'error');
      setLoading(false);
    }
  };

  // Fetch schedules when component mounts or user changes
  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      fetchAllSchedules();
    } else if (currentUser) {
      // If regular user, fetch only their own schedules
      const teacherQuery = query(
        collection(db, 'teachers'), 
        where('uid', '==', currentUser.uid)
      );

      const unsubscribe = onSnapshot(teacherQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
        if (!snapshot.empty) {
          const teacherDoc = snapshot.docs[0];
          const teacherData = teacherDoc.data();
          const teacherSchedules = teacherData.schedules || [];

          setSchedules(teacherSchedules.map((schedule: Schedule, index: number) => ({
            ...schedule,
            id: `${teacherDoc.id}_${index}`
          })));
        }
        setLoading(false);
      }, (error: Error) => {
        console.error("Error fetching schedules:", error);
        Swal.fire({
          icon: 'error',
          title: 'Fetch Error',
          text: error.message || 'Failed to fetch schedules',
          confirmButtonColor: '#3b82f6'
        });
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  // Enhanced filtering logic
  const filteredSchedules = useMemo(() => {
    return schedules.filter((schedule) => {
      // Search query filter
      const matchesSearch = 
        !searchQuery || 
        schedule.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        schedule.instructor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        schedule.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        schedule.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase());

      // Department filter
      const matchesDepartment = 
        filterOptions.department === 'all' || 
        schedule.department === filterOptions.department;

      // Day filter
      const matchesDay = 
        filterOptions.day === 'all' || 
        (schedule.days && schedule.days.includes(filterOptions.day));

      // Semester filter
      const matchesSemester = 
        filterOptions.semester === 'all' || 
        schedule.semester === filterOptions.semester;

      return matchesSearch && matchesDepartment && matchesDay && matchesSemester;
    });
  }, [schedules, searchQuery, filterOptions]);

  // Dynamic filter options
  const getDynamicFilterOptions = () => {
    const departments = Array.from(new Set(schedules.map(s => s.department || 'Unassigned')));
    const days = Array.from(new Set(schedules.flatMap(s => s.days || [])));
    const semesters = Array.from(new Set(schedules.map(s => s.semester || 'Current Semester')));

    return { departments, days, semesters };
  };

  const { departments, days, semesters } = getDynamicFilterOptions();

  const handleAddSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      // Validate form data
      const formData = new FormData(e.currentTarget);
      const selectedDays = Array.from(
        e.currentTarget.querySelectorAll('input[name="days"]:checked')
      ).map(input => (input as HTMLInputElement).value);

      // Find related subject
      const subjectCode = formData.get('subjectCode') as string;
      const relatedSubject = schedules.find(s => s.subjectCode === subjectCode);

      if (!relatedSubject) {
        Swal.fire('Error', 'Subject not found', 'error');
        return;
      }

      // Prepare new schedule
      const newSchedule: Schedule = {
        id: '', // Will be set by Firestore
        roomNumber: formData.get('roomNumber') as string,
        days: selectedDays,
        startTime: formData.get('startTime') as string,
        endTime: formData.get('endTime') as string,
        section: formData.get('section') as string || 'N/A', // Ensure section is always present
        subjectCode: subjectCode,
        subject: relatedSubject.subject,
        semester: formData.get('semester') as string || '',
        department: currentUser?.department || 'Unassigned'
      };

      // Add schedule to teacher's document
      if (currentUser) {
        const teacherRef = doc(db, 'teachers', currentUser.uid);
        
        // Update teacher's schedules
        await updateDoc(teacherRef, {
          schedules: arrayUnion(newSchedule)
        });

        // Refresh schedules based on user role
        if (currentUser.role === 'admin') {
          await fetchAllSchedules();
        }

        // Show success message
        Swal.fire({
          icon: 'success',
          title: 'Schedule Added',
          text: `Schedule for ${newSchedule.subject} has been added successfully`,
          timer: 2000,
          showConfirmButton: false
        });

        // Close modal
        setShowModal(false);
      }
    } catch (error) {
      console.error('Error adding schedule:', error);
      Swal.fire('Error', 'Failed to add schedule', 'error');
    }
  };

  const handleDeleteSchedule = async (scheduleToDelete: Schedule) => {
    if (!isAdmin) {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'Only administrators can delete schedules.'
      });
      return;
    }

    try {
      // Find the teacher document containing this schedule
      const teacherQuery = query(
        collection(db, 'teachers'), 
        where('schedules', 'array-contains', scheduleToDelete)
      );

      const teacherSnapshot = await getDocs(teacherQuery);
      if (teacherSnapshot.empty) {
        throw new Error('Teacher document not found');
      }

      const teacherDoc = teacherSnapshot.docs[0];
      const currentSchedules = teacherDoc.data().schedules || [];

      // Remove the specific schedule
      const updatedSchedules = currentSchedules.filter(
        (schedule: Schedule) => schedule.id !== scheduleToDelete.id
      );

      // Update teacher's document with updated schedules
      await updateDoc(teacherDoc.ref, { schedules: updatedSchedules });

      // Update local state
      setSchedules(prevSchedules => 
        prevSchedules.filter(schedule => schedule.id !== scheduleToDelete.id)
      );

      Swal.fire('Success', 'Schedule deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      Swal.fire('Error', `Failed to delete schedule: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const renderScheduleCard = (schedule: Schedule) => {
    // Color mapping for different departments
    const departmentColors: { [key: string]: string } = {
      'Computer Science': 'bg-blue-50 border-blue-200 text-blue-800',
      'Mathematics': 'bg-green-50 border-green-200 text-green-800',
      'Physics': 'bg-purple-50 border-purple-200 text-purple-800',
      'Engineering': 'bg-indigo-50 border-indigo-200 text-indigo-800',
      'default': 'bg-gray-50 border-gray-200 text-gray-800'
    };

    const colorClass = departmentColors[schedule.department || 'default'];

    return (
      <motion.div
        key={schedule.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`
          ${colorClass}
          rounded-2xl p-6 
          border 
          shadow-md 
          hover:shadow-lg 
          transition-all 
          duration-300 
          transform 
          hover:-translate-y-2
          space-y-4
        `}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold mb-2">
              {schedule.subject || 'Unassigned Subject'}
            </h3>
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <span className="flex items-center">
                <ClockIcon className="w-4 h-4 mr-1" />
                {schedule.startTime} - {schedule.endTime}
              </span>
              <span className="flex items-center">
                <CalendarIcon className="w-4 h-4 mr-1" />
                {schedule.days?.join(', ') || 'N/A'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-500">
              Room: {schedule.roomNumber || 'TBD'}
            </p>
            <p className="text-sm text-gray-600">
              {schedule.instructor || 'Unassigned'}
            </p>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center">
          <span className="text-xs font-medium px-3 py-1 rounded-full 
            bg-gray-100 text-gray-600">
            {schedule.department || 'Unassigned Department'}
          </span>
          <span className="text-xs font-medium px-3 py-1 rounded-full 
            bg-gray-100 text-gray-600">
            {schedule.semester || 'Current Semester'}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
      />
      
      <div className={`
        flex-1 p-8 transition-all duration-300 
        ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}
        overflow-y-auto
      `}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Course Schedules
          </h1>
          <p className="text-gray-600">
            View and manage course schedules across departments
          </p>
        </motion.div>

        {/* Search and Filter Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 flex flex-wrap gap-4 items-center justify-between"
        >
          <div className="flex-grow max-w-md">
            <div className="relative">
              <input 
                type="text"
                placeholder="Search schedules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full px-4 py-2 pl-10 
                  border border-gray-300 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-primary-500
                "
              />
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 absolute left-3 top-3 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                />
              </svg>
            </div>
          </div>

          <div className="flex space-x-4">
            <select 
              value={filterOptions.department}
              onChange={(e) => setFilterOptions(prev => ({ ...prev, department: e.target.value }))}
              className="
                px-4 py-2 border border-gray-300 rounded-lg 
                focus:outline-none focus:ring-2 focus:ring-primary-500
              "
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            <select 
              value={filterOptions.day}
              onChange={(e) => setFilterOptions(prev => ({ ...prev, day: e.target.value }))}
              className="
                px-4 py-2 border border-gray-300 rounded-lg 
                focus:outline-none focus:ring-2 focus:ring-primary-500
              "
            >
              <option value="all">All Days</option>
              {days.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>

            <select 
              value={filterOptions.semester}
              onChange={(e) => setFilterOptions(prev => ({ ...prev, semester: e.target.value }))}
              className="
                px-4 py-2 border border-gray-300 rounded-lg 
                focus:outline-none focus:ring-2 focus:ring-primary-500
              "
            >
              <option value="all">All Semesters</option>
              {semesters.map(semester => (
                <option key={semester} value={semester}>{semester}</option>
              ))}
            </select>

            {isAdmin && (
              <button 
                onClick={() => setShowModal(true)}
                className="
                  px-4 py-2 bg-primary-500 text-white 
                  rounded-lg hover:bg-primary-600 
                  transition-colors flex items-center
                "
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Schedule
              </button>
            )}
          </div>
        </motion.div>

        {/* Schedules Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-primary-500"></div>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white rounded-2xl shadow-md"
          >
            <p className="text-xl text-gray-600 mb-4">
              No schedules found
            </p>
            <p className="text-gray-500">
              Try adjusting your search or filter options
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.map(schedule => renderScheduleCard(schedule))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Schedules;
