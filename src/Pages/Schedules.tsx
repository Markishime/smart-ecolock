import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, where, getDocs, updateDoc, getDoc } from 'firebase/firestore';
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

  useEffect(() => {
    // Fetch all schedules from teachers database
    const fetchAllSchedules = async () => {
      try {
        setLoading(true);
        const teachersQuery = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersQuery);

        // Collect all schedules from all teachers
        const allSchedules: Schedule[] = [];
        const allSubjects: string[] = [];

        teachersSnapshot.docs.forEach((teacherDoc) => {
          const teacherData = teacherDoc.data();
          const teacherSchedules = teacherData.schedules || [];
          const teacherSubjects = teacherData.subjects || [];
          
          // Add teacher name and department to each schedule
          const teacherSchedulesWithDetails = teacherSchedules.map((schedule: Schedule) => {
            // Find the corresponding subject for this schedule
            const relatedSubject = teacherSubjects.find(
              (subject: Subject) => subject.code === schedule.subjectCode
            );

            return {
              ...schedule,
              subject: relatedSubject ? relatedSubject.name : schedule.subject,
              instructor: teacherData.fullName,
              department: teacherData.department
            };
          });

          allSchedules.push(...teacherSchedulesWithDetails);
          allSubjects.push(...teacherSubjects.map((s: Subject) => s.name));
        });

        setSchedules(allSchedules);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching all schedules:", error);
        Swal.fire('Error', 'Failed to fetch schedules', 'error');
        setLoading(false);
      }
    };

    // If user is an admin, fetch all schedules
    if (currentUser && currentUser.role === 'admin') {
      fetchAllSchedules();
    } else if (currentUser) {
      // If regular user, fetch only their own schedules
      const teacherQuery = query(
        collection(db, 'teachers'), 
        where('uid', '==', currentUser.uid)
      );

      const unsubscribe = onSnapshot(teacherQuery, async (snapshot) => {
        if (!snapshot.empty) {
          const teacherDoc = snapshot.docs[0];
          const teacherSchedules = teacherDoc.data().schedules || [];

          setSchedules(teacherSchedules.map((schedule: Schedule, index: number) => ({
            ...schedule,
            id: `${teacherDoc.id}_${index}`
          })));
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching schedules:", error);
        Swal.fire('Error', 'Failed to fetch schedules', 'error');
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  // Derived Data
  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => 
      (filterOptions.department === 'all' || schedule.department === filterOptions.department) &&
      (filterOptions.day === 'all' || schedule.days.includes(filterOptions.day)) &&
      (filterOptions.semester === 'all' || schedule.semester === filterOptions.semester) &&
      (searchQuery === '' || 
        schedule.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        schedule.instructor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        schedule.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [schedules, filterOptions, searchQuery]);

  const departments = useMemo(() => 
    Array.from(new Set(schedules.map(s => s.department || 'Unassigned'))), 
    [schedules]
  );

  const days = useMemo(() => 
    Array.from(new Set(schedules.flatMap(s => s.days))), 
    [schedules]
  );

  const semesters = useMemo(() => 
    Array.from(new Set(schedules.map(s => s.semester || 'Unassigned'))), 
    [schedules]
  );

  const handleAddSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!currentUser) {
      Swal.fire('Error', 'You must be logged in to add a schedule', 'error');
      return;
    }

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const selectedDays = Array.from(formData.getAll('days') as string[]);

    // Validate required fields
    const requiredFields = ['roomNumber', 'startTime', 'endTime', 'subjectCode'];
    for (const field of requiredFields) {
      if (!formData.get(field)) {
        Swal.fire('Error', `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`, 'error');
        return;
      }
    }

    try {
      let teacherDocRef;
      
      // If admin, allow selecting a teacher
      if (isAdmin) {
        const selectedTeacherId = formData.get('teacherId') as string;
        if (!selectedTeacherId) {
          Swal.fire('Error', 'Please select a teacher', 'error');
          return;
        }
        teacherDocRef = doc(db, 'teachers', selectedTeacherId);
      } else {
        // Find the current teacher's document
        const teacherQuery = query(
          collection(db, 'teachers'), 
          where('uid', '==', currentUser.uid)
        );

        const teacherSnapshot = await getDocs(teacherQuery);
        if (teacherSnapshot.empty) {
          throw new Error('Teacher document not found');
        }

        teacherDocRef = teacherSnapshot.docs[0].ref;
      }

      // Fetch current teacher data to get existing schedules and subjects
      const teacherDoc = await getDoc(teacherDocRef);
      const currentSchedules = teacherDoc.data()?.schedules || [];
      const teacherSubjects = teacherDoc.data()?.subjects || [];

      // Find the subject to validate subject code
      const relatedSubject = teacherSubjects.find(
        (s: Subject) => s.code === formData.get('subjectCode')
      );

      if (!relatedSubject) {
        Swal.fire('Error', 'Selected subject code does not exist for this teacher', 'error');
        return;
      }

      // Create new schedule object
      const newSchedule: Schedule = {
        id: Date.now().toString(),
        roomNumber: formData.get('roomNumber') as string,
        days: selectedDays,
        startTime: formData.get('startTime') as string,
        endTime: formData.get('endTime') as string,
        subjectCode: formData.get('subjectCode') as string,
        subject: relatedSubject.name,
        semester: formData.get('semester') as string || '',
        department: teacherDoc.data()?.department || ''
      };

      // Add new schedule to existing schedules
      const updatedSchedules = [...currentSchedules, newSchedule];

      // Update teacher's document with new schedules
      await updateDoc(teacherDocRef, { schedules: updatedSchedules });

      // Reset form and close modal
      form.reset();
      setShowModal(false);

      Swal.fire('Success', 'Schedule added successfully', 'success');
    } catch (error) {
      console.error('Error adding schedule:', error);
      Swal.fire('Error', `Failed to add schedule: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
        userRole={currentUser?.role as 'admin' | 'instructor' | 'student'}
        profileImage={currentUser?.photoURL || undefined}
      />
      
      <main className={`
        flex-1 overflow-x-hidden overflow-y-auto transition-all duration-300
        ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}
        p-6
      `}>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Schedules</h1>
            <div className="flex items-center space-x-4">
              <input 
                type="text" 
                placeholder="Search schedules..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  px-4 py-2 border border-gray-300 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-primary-500
                "
              />
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
              {isAdmin && (
                <button 
                  onClick={() => setShowModal(true)}
                  className="
                    bg-primary-500 text-white 
                    px-4 py-2 rounded-lg 
                    hover:bg-primary-600 
                    transition-colors duration-200
                    flex items-center space-x-2
                  "
                >
                  <PlusIcon className="h-5 w-5" />
                  <span>Add Schedule</span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <p className="mt-4 text-primary-700">Loading schedules...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSchedules.map((schedule, index) => (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="
                    bg-white rounded-2xl shadow-md p-6 
                    border-l-4 border-primary-500 
                    hover:shadow-xl transition-all duration-300
                  "
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        {schedule.subject || 'Unassigned Subject'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Room: {schedule.roomNumber}
                      </p>
                    </div>
                    <CalendarIcon className="h-8 w-8 text-primary-500" />
                  </div>
                  <div className="space-y-2">
                    <p>
                      <strong>Instructor:</strong> {schedule.instructor || 'Not assigned'}
                    </p>
                    <p>
                      <strong>Days:</strong> {schedule.days.join(', ')}
                    </p>
                    <p>
                      <strong>Time:</strong> {schedule.startTime} - {schedule.endTime}
                    </p>
                    <p>
                      <strong>Department:</strong> {schedule.department || 'Unassigned'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {filteredSchedules.length === 0 && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-gray-500 py-12"
            >
              <ClockIcon className="h-16 w-16 mx-auto text-primary-500 mb-4" />
              <p className="text-xl text-neutral-600">
                No schedules found matching your search criteria.
              </p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Schedules;
