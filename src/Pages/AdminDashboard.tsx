import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../Pages/AuthContext';
import { 
  PencilIcon, 
  TrashIcon,
  ClockIcon, 
  BookOpenIcon,
  UserIcon,
  AcademicCapIcon,
  PlusIcon,
  CalendarIcon,
  InformationCircleIcon,
  MagnifyingGlassCircleIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  ChartBarIcon
} from '@heroicons/react/24/solid';
import { InstructorData, Subject, Schedule, Section } from '../types';
import { theme, darkTheme } from '../styles/theme';
import Sidebar from '../components/Sidebar';

// Enhanced color palette with semantic meaning
const colorPalette = {
  primary: {
    50: '#EDF5FF',
    100: '#D1E7FF',
    500: '#2C7BE5',
    700: '#1A4A7A'
  },
  secondary: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    700: '#15803D'
  },
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    500: '#6B7280',
    700: '#374151'
  },
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    700: '#B91C1C'
  }
};

// Animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.2 
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { 
      type: 'spring',
      stiffness: 300,
      damping: 20 
    }
  }
};

interface DepartmentStats {
  department: string;
  totalTeachers: number;
  totalSubjects: number;
  totalStudents: number;
  totalSchedules: number;
  totalSections: number;
}

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, icon }) => (
  <div className="flex items-center space-x-2">
    {icon}
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  </div>
);

const AdminDashboard: React.FC = () => {
  // State Management
  const [teachers, setTeachers] = useState<InstructorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'teacherDetails' | 'addItem'>('teacherDetails');
  const [selectedTeacher, setSelectedTeacher] = useState<InstructorData | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Hooks
  const { currentUser } = useAuth();

  // Theme Management
  const currentTheme = isDarkMode ? darkTheme : theme;

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    // Optional: Persist dark mode preference in localStorage
    localStorage.setItem('darkMode', JSON.stringify(!isDarkMode));
  };

  // Load dark mode preference on component mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setIsDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Fetch Teachers Data
  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const teachersRef = collection(db, 'teachers');
      const unsubscribe = onSnapshot(teachersRef, (snapshot) => {
        const teacherData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as InstructorData));
        setTeachers(teacherData);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Data Fetch Error',
        text: 'Unable to load teacher data. Please try again later.',
        background: colorPalette.neutral[50],
        confirmButtonColor: colorPalette.primary[500]
      });
    }
  }, []);

  // Side Effects
  useEffect(() => {
    const teacherSubscription = fetchTeachers();
    return () => {
    };
  }, [fetchTeachers]);

  // Derived Data
  const departments = useMemo(() => 
    Array.from(new Set(teachers.map(t => t.department))), 
    [teachers]
  );

  const filteredTeachers = useMemo(() => 
    teachers.filter(teacher => 
      (selectedDepartment === 'all' || teacher.department === selectedDepartment) &&
      (searchQuery === '' || 
        teacher.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.department.toLowerCase().includes(searchQuery.toLowerCase()))
    ), 
    [teachers, selectedDepartment, searchQuery]
  );

  // Modal Handlers
  const openTeacherDetailsModal = (teacher: InstructorData) => {
    if (teacher) {
      setSelectedTeacher(teacher);
      setModalType('teacherDetails');
      setIsModalOpen(true);
    }
  };

  const openAddItemModal = (teacher: InstructorData) => {
    if (teacher) {
      setSelectedTeacher(teacher);
      setModalType('addItem');
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTeacher(null);
  };

  // New function to fetch department-wise statistics
  const fetchDepartmentStats = useCallback(async () => {
    try {
      const statsPromises = departments.map(async (department) => {
        // Fetch teachers
        const teachersQuery = query(collection(db, 'teachers'));
        const teachersSnapshot = await getDocs(teachersQuery);
        const totalTeachers = teachersSnapshot.docs.filter(
          doc => doc.data().department === department
        ).length;

        // Fetch subjects
        const subjectsQuery = query(collection(db, 'subjects'));
        const subjectsSnapshot = await getDocs(subjectsQuery);
        const totalSubjects = subjectsSnapshot.docs.filter(
          doc => doc.data().department === department
        ).length;

        // Fetch students
        const studentsQuery = query(collection(db, 'students'));
        const studentsSnapshot = await getDocs(studentsQuery);
        const totalStudents = studentsSnapshot.docs.filter(
          doc => doc.data().department === department
        ).length;

        // Fetch schedules
        const schedulesQuery = query(collection(db, 'schedules'));
        const schedulesSnapshot = await getDocs(schedulesQuery);
        const totalSchedules = schedulesSnapshot.docs.filter(
          doc => doc.data().department === department
        ).length;

        // Fetch sections
        const sectionsQuery = query(collection(db, 'sections'));
        const sectionsSnapshot = await getDocs(sectionsQuery);
        const totalSections = sectionsSnapshot.docs.filter(
          doc => doc.data().department === department
        ).length;

        return {
          department,
          totalTeachers,
          totalSubjects,
          totalStudents,
          totalSchedules,
          totalSections
        };
      });

      const stats = await Promise.all(statsPromises);
      setDepartmentStats(stats);
    } catch (error) {
      console.error('Error fetching department statistics:', error);
      Swal.fire({
        icon: 'error',
        title: 'Statistics Fetch Error',
        text: 'Unable to load department statistics. Please try again later.',
        background: colorPalette.neutral[50],
        confirmButtonColor: colorPalette.primary[500]
      });
    }
  }, [departments]);

  // Add useEffect to fetch department stats
  useEffect(() => {
    if (departments.length > 0) {
      fetchDepartmentStats();
    }
  }, [departments, fetchDepartmentStats]);

  // Fetch subjects and schedules
  const fetchSubjectsAndSchedules = useCallback(async () => {
    try {
      // Fetch subjects
      const subjectsRef = collection(db, 'subjects');
      const subjectsSnapshot = await getDocs(subjectsRef);
      const fetchedSubjects = subjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Subject));
      setSubjects(fetchedSubjects);

      // Fetch schedules
      const schedulesRef = collection(db, 'schedules');
      const schedulesSnapshot = await getDocs(schedulesRef);
      const fetchedSchedules = schedulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Schedule));
      setSchedules(fetchedSchedules);
    } catch (error) {
      console.error('Error fetching subjects and schedules:', error);
      Swal.fire({
        icon: 'error',
        title: 'Fetch Error',
        text: 'Unable to load subjects and schedules',
        background: colorPalette.neutral[50],
        confirmButtonColor: colorPalette.primary[500]
      });
    }
  }, []);

  useEffect(() => {
    fetchSubjectsAndSchedules();
  }, [fetchSubjectsAndSchedules]);

  // Add subject
  const handleAddSubject = async (subjectData: Partial<Subject>) => {
    try {
      // Validate subject data
      if (!subjectData.name || !subjectData.code || !subjectData.department || !subjectData.teacherName) {
        Swal.fire({
          title: 'Validation Error',
          text: 'Please fill in all required fields',
          icon: 'warning',
          customClass: {
            popup: 'rounded-xl',
            confirmButton: 'bg-primary-600 hover:bg-primary-700 rounded-lg'
          }
        });
        return;
      }

      // Add timestamp
      const newSubjectWithTimestamp = {
        ...subjectData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add to Firestore
      const subjectsRef = collection(db, 'subjects');
      const docRef = await addDoc(subjectsRef, newSubjectWithTimestamp);

      // Update local state
      const updatedSubject: Subject = { 
        id: docRef.id, 
        code: newSubjectWithTimestamp.code || '', 
        name: newSubjectWithTimestamp.name || '', 
        description: newSubjectWithTimestamp.description,
        semester: newSubjectWithTimestamp.semester,
        department: newSubjectWithTimestamp.department,
        teacherName: newSubjectWithTimestamp.teacherName,
        credits: newSubjectWithTimestamp.credits,
        createdAt: newSubjectWithTimestamp.createdAt,
        updatedAt: newSubjectWithTimestamp.updatedAt
      };
      setSubjects(prevSubjects => [...prevSubjects, updatedSubject]);

      // Close modal and show success message
      setIsSubjectModalOpen(false);
      Swal.fire({
        title: 'Success!',
        text: 'Subject added successfully',
        icon: 'success',
        customClass: {
          popup: 'rounded-xl',
          confirmButton: 'bg-primary-600 hover:bg-primary-700 rounded-lg'
        }
      });
    } catch (error) {
      console.error('Error adding subject:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to add subject. Please try again.',
        icon: 'error',
        customClass: {
          popup: 'rounded-xl',
          confirmButton: 'bg-primary-600 hover:bg-primary-700 rounded-lg'
        }
      });
    }
  };

  // Delete subject
  const handleDeleteSubject = async (subjectToDelete: Subject) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Delete subject ${subjectToDelete.name} (${subjectToDelete.code})`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: colorPalette.error[500],
      cancelButtonColor: colorPalette.primary[500],
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        if (!subjectToDelete.id) {
          throw new Error('Subject ID is missing');
        }

        const subjectDocRef = doc(db, 'subjects', subjectToDelete.id);
        await deleteDoc(subjectDocRef);

        setSubjects(prev => prev.filter(subject => subject.id !== subjectToDelete.id));

        Swal.fire({
          icon: 'success',
          title: 'Subject Deleted',
          text: `${subjectToDelete.name} has been deleted successfully`,
          background: colorPalette.neutral[50],
          confirmButtonColor: colorPalette.primary[500]
        });
      } catch (error) {
        console.error('Error deleting subject:', error);
        Swal.fire({
          icon: 'error',
          title: 'Delete Subject Error',
          text: 'Unable to delete subject',
          background: colorPalette.neutral[50],
          confirmButtonColor: colorPalette.primary[500]
        });
      }
    }
  };

  // Edit subject
  const handleEditSubject = (subject: Subject) => {
    Swal.fire({
      title: 'Edit Subject',
      html: `
        <input id="subjectName" class="swal2-input" placeholder="Subject Name" value="${subject.name}">
        <select id="subjectDepartment" class="swal2-input">
          ${departments.map(dept => 
            `<option value="${dept}" ${subject.department === dept ? 'selected' : ''}>${dept}</option>`
          ).join('')}
        </select>
      `,
      focusConfirm: false,
      preConfirm: () => {
        const nameInput = document.getElementById('subjectName') as HTMLInputElement;
        const departmentInput = document.getElementById('subjectDepartment') as HTMLSelectElement;
        
        const newName = nameInput.value.trim();
        const newDepartment = departmentInput.value;
        
        if (!newName) {
          Swal.showValidationMessage('Please enter a subject name');
          return false;
        }
        
        return { name: newName, department: newDepartment };
      },
      showCancelButton: true,
      confirmButtonText: 'Update',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        try {
          if (!subject.uid) {
            throw new Error('Subject ID is undefined');
          }
          const subjectRef = doc(db, 'subjects', subject.uid);
          await updateDoc(subjectRef, {
            name: result.value.name,
            department: result.value.department
          });
          
          // Update local state
          setSubjects(prevSubjects => 
            prevSubjects.map(s => 
              s.id === subject.id 
                ? { ...s, name: result.value.name, department: result.value.department } 
                : s
            )
          );
          
          Swal.fire({
            icon: 'success',
            title: 'Subject Updated',
            text: `${result.value.name} has been successfully updated.`
          });
        } catch (error) {
          console.error('Error updating subject:', error);
          Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: 'An error occurred while updating the subject.'
          });
        }
      }
    });
  };

  // Add schedule
  const handleAddSchedule = async (scheduleData: Partial<Schedule>) => {
    try {
      // Validate schedule data
      if (!scheduleData.subject || !scheduleData.instructor || !scheduleData.days || 
          scheduleData.days.length === 0 || !scheduleData.startTime || !scheduleData.endTime || 
          !scheduleData.semester) {
        Swal.fire({
          title: 'Validation Error',
          text: 'Please fill in all required fields',
          icon: 'warning',
          customClass: {
            popup: 'rounded-xl',
            confirmButton: 'bg-secondary-600 hover:bg-secondary-700 rounded-lg'
          }
        });
        return;
      }

      // Add timestamp
      const newScheduleWithTimestamp = {
        ...scheduleData,
        startTime: scheduleData.startTime || '',
        endTime: scheduleData.endTime || '',
        roomNumber: scheduleData.roomNumber || '',
        subject: scheduleData.subject || '',
        instructor: scheduleData.instructor || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add to Firestore
      const schedulesRef = collection(db, 'schedules');
      const docRef = await addDoc(schedulesRef, newScheduleWithTimestamp);

      // Update local state
      const updatedSchedule: Schedule = { 
        ...newScheduleWithTimestamp, 
        id: docRef.id,
        days: scheduleData.days || [], // Ensure days is always a string array
      };
      setSchedules(prevSchedules => [...prevSchedules, updatedSchedule]);

      // Close modal and show success message
      setIsScheduleModalOpen(false);
      Swal.fire({
        title: 'Success!',
        text: 'Schedule added successfully',
        icon: 'success',
        customClass: {
          popup: 'rounded-xl',
          confirmButton: 'bg-secondary-600 hover:bg-secondary-700 rounded-lg'
        }
      });
    } catch (error) {
      console.error('Error adding schedule:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to add schedule. Please try again.',
        icon: 'error',
        customClass: {
          popup: 'rounded-xl',
          confirmButton: 'bg-secondary-600 hover:bg-secondary-700 rounded-lg'
        }
      });
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async (scheduleToDelete: Schedule) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Delete schedule for ${scheduleToDelete.subject}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: colorPalette.error[500],
      cancelButtonColor: colorPalette.primary[500],
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        if (!scheduleToDelete.id) {
          throw new Error('Schedule ID is missing');
        }

        const scheduleDocRef = doc(db, 'schedules', scheduleToDelete.id);
        await deleteDoc(scheduleDocRef);

        setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleToDelete.id));

        Swal.fire({
          icon: 'success',
          title: 'Schedule Deleted',
          text: `Schedule for ${scheduleToDelete.subject} has been deleted successfully`,
          background: colorPalette.neutral[50],
          confirmButtonColor: colorPalette.primary[500]
        });
      } catch (error) {
        console.error('Error deleting schedule:', error);
        Swal.fire({
          icon: 'error',
          title: 'Delete Schedule Error',
          text: 'Unable to delete schedule',
          background: colorPalette.neutral[50],
          confirmButtonColor: colorPalette.primary[500]
        });
      }
    }
  };

  // Edit schedule
  const handleEditSchedule = async (scheduleToEdit: Schedule) => {
    try {
      if (!scheduleToEdit.id) {
        throw new Error('Schedule ID is missing');
      }

      const scheduleDocRef = doc(db, 'schedules', scheduleToEdit.id);
      await updateDoc(scheduleDocRef, scheduleToEdit);

      setSchedules(prev => 
        prev.map(schedule => 
          schedule.id === scheduleToEdit.id ? { ...scheduleToEdit } : schedule
        )
      );

      Swal.fire({
        icon: 'success',
        title: 'Schedule Updated',
        text: `Schedule for ${scheduleToEdit.subject} has been updated successfully`,
        background: colorPalette.neutral[50],
        confirmButtonColor: colorPalette.primary[500]
      });
    } catch (error) {
      console.error('Error editing schedule:', error);
      Swal.fire({
        icon: 'error',
        title: 'Edit Schedule Error',
        text: 'Unable to edit schedule',
        background: colorPalette.neutral[50],
        confirmButtonColor: colorPalette.primary[500]
      });
    }
  };

  // Render method for department statistics
  const renderDepartmentStats = () => (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
    >
      {departmentStats.map(stats => (
        <motion.div
          key={stats.department}
          variants={itemVariants}
          className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-primary-500 hover:shadow-xl transition-all"
        >
          <h3 className="text-xl font-bold mb-4 text-neutral-700">
            {stats.department} Department
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatItem 
              icon={<UserIcon className="w-6 h-6 text-primary-500" />} 
              label="Teachers" 
              value={stats.totalTeachers} 
            />
            <StatItem 
              icon={<AcademicCapIcon className="w-6 h-6 text-secondary-500" />} 
              label="Subjects" 
              value={stats.totalSubjects} 
            />
            <StatItem 
              icon={<CalendarIcon className="w-6 h-6 text-green-500" />} 
              label="Schedules" 
              value={stats.totalSchedules} 
            />
            <StatItem 
              icon={<InformationCircleIcon className="w-6 h-6 text-purple-500" />} 
              label="Sections" 
              value={stats.totalSections} 
            />
            <StatItem 
              icon={<MagnifyingGlassCircleIcon className="w-6 h-6 text-blue-500" />} 
              label="Students" 
              value={stats.totalStudents} 
            />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );

  // Render subjects management section
  const renderSubjectsManagement = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-md p-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Subjects Management</h2>
        <button 
          onClick={() => {
            setSelectedSubject(null);
            // Open subject modal or navigate to subjects page
          }}
          className="btn btn-primary"
        >
          <PlusIcon className="h-5 w-5 mr-2" /> Add Subject
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map(subject => (
          <motion.div
            key={subject.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{subject.name}</h3>
                <p className="text-sm text-gray-600">Code: {subject.code}</p>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    setSelectedSubject(subject);
                  }}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button 
                  onClick={() => handleDeleteSubject(subject)}
                  className="text-red-500 hover:text-red-700"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Credits: {subject.credits}</span>
              <span>{subject.department}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  // Render schedules management section
  const renderSchedulesManagement = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-md p-6 mt-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Schedules Management</h2>
        <button 
          onClick={() => {
            setSelectedSchedule(null);
            // Open schedule modal or navigate to schedules page
          }}
          className="btn btn-primary"
        >
          <PlusIcon className="h-5 w-5 mr-2" /> Add Schedule
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((schedule, index) => (
          <motion.div
            key={schedule.id || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-white p-4 rounded-lg shadow-md relative"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex-grow">
                <h3 className="text-md font-semibold text-gray-800">
                  {schedule.subject || 'Unnamed Subject'}
                </h3>
                <p className="text-sm text-gray-500">
                  {schedule.roomNumber || 'No Room'}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditSchedule(schedule)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDeleteSchedule(schedule)}
                  className="text-red-500 hover:text-red-700"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>{(schedule.days || []).length > 0 ? (schedule.days || []).join(', ') : 'No days specified'}</span>
              <span>{schedule.startTime || 'N/A'} - {schedule.endTime || 'N/A'}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  // Render Methods
  const renderTeacherCard = (teacher: InstructorData) => (
    <motion.div 
      key={teacher.id}
      variants={itemVariants}
      className={`
        bg-white rounded-2xl shadow-lg overflow-hidden 
        border-l-4 transition-all duration-300
        ${teacher.department === 'Computer Science' ? 'border-blue-500' : 
          teacher.department === 'Mathematics' ? 'border-green-500' : 
          'border-purple-500'}
        hover:shadow-xl hover:scale-[1.02]
      `}
    >
      <div className="p-6">
        <div className="flex items-center mb-4">
          <UserIcon 
            className={`
              h-12 w-12 mr-4 
              ${teacher.department === 'Computer Science' ? 'text-blue-500' : 
                teacher.department === 'Mathematics' ? 'text-green-500' : 
                'text-purple-500'}
            `} 
          />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">{teacher.fullName}</h3>
            <p className="text-sm text-gray-500">{teacher.department}</p>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <button
            onClick={() => openTeacherDetailsModal(teacher)}
            className="
              text-sm font-medium 
              text-primary-500 hover:text-primary-700 
              transition-colors duration-200
            "
          >
            View Details
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={() => openAddItemModal(teacher)}
              className="
                p-2 rounded-full 
                bg-primary-50 text-primary-500 
                hover:bg-primary-100 
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-primary-300
              "
              title="Add Subject or Schedule"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderModal = () => {
    if (!isModalOpen || !selectedTeacher) return null;

    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 "
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative"
          >
            <button 
              onClick={closeModal}
              className="
                absolute top-4 right-4 
                text-gray-500 hover:text-gray-700 
                focus:outline-none focus:ring-2 focus:ring-primary-300
                rounded-full p-2
              "
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {modalType === 'teacherDetails' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-800">
                  Teacher Details
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-primary-700">
                      Personal Information
                    </h3>
                    <div className="space-y-2">
                      <p><strong>Name:</strong> {selectedTeacher.fullName}</p>
                      <p><strong>Email:</strong> {selectedTeacher.email}</p>
                      <p><strong>Department:</strong> {selectedTeacher.department}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-primary-700">
                      Academic Details
                    </h3>
                    <div className="space-y-2">
                      <p>
                        <AcademicCapIcon className="inline-block h-5 w-5 mr-2 text-green-500" />
                        Subjects: {selectedTeacher.subjects?.length || 0}
                      </p>
                      <p>
                        <CalendarIcon className="inline-block h-5 w-5 mr-2 text-purple-500" />
                        Schedules: {selectedTeacher.schedules?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {modalType === 'addItem' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-800">
                  Add Item for {selectedTeacher.fullName}
                </h2>
                {/* Add form for adding subjects/schedules here */}
              </div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  const SubjectModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSubmit: (subject: Partial<Subject>) => void;
    teachers: InstructorData[];  
  }> = ({ isOpen, onClose, onSubmit, teachers }) => {
    const [newSubject, setNewSubject] = useState<Partial<Subject>>({
      name: '',
      code: '',
      department: '',
      credits: 0,
      description: '',
      teacherName: '',  
    });

    const handleSubmit = () => {
      if (!newSubject.name || !newSubject.code || !newSubject.department || !newSubject.teacherName) {
        Swal.fire({
          title: 'Validation Error',
          text: 'Please fill in all required fields',
          icon: 'warning',
          customClass: {
            popup: 'rounded-xl',
            confirmButton: 'bg-primary-600 hover:bg-primary-700 rounded-lg'
          }
        });
        return;
      }
      onSubmit(newSubject);
      onClose();  
    };

    return (
      <div 
        className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'} overflow-y-auto`}
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
            aria-hidden="true"
            onClick={onClose}
          ></div>

          <div className="inline-block transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <div className="bg-white px-6 pt-6 pb-4">
              <div className="flex items-start">
                <div className="mr-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-100">
                  <BookOpenIcon className="h-6 w-6 text-primary-600" aria-hidden="true" />
                </div>
                <div className="w-full">
                  <h3 
                    className="text-xl font-semibold text-gray-900 mb-4" 
                    id="modal-title"
                  >
                    Add New Subject
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
                      <input
                        type="text"
                        placeholder="Enter subject name (e.g., Advanced Programming)"
                        value={newSubject.name}
                        onChange={(e) => setNewSubject({...newSubject, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code *</label>
                      <input
                        type="text"
                        placeholder="Enter unique subject code (e.g., CS101)"
                        value={newSubject.code}
                        onChange={(e) => setNewSubject({...newSubject, code: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                      <select
                        value={newSubject.department}
                        onChange={(e) => setNewSubject({...newSubject, department: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select Department</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Physics">Physics</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Biology">Biology</option>
                        <option value="Chemistry">Chemistry</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Instructor *</label>
                      <select
                        value={newSubject.teacherName}
                        onChange={(e) => setNewSubject({...newSubject, teacherName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select Instructor</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.fullName}>
                            {teacher.fullName} - {teacher.department}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                      <input
                        type="number"
                        placeholder="Enter credit hours"
                        value={newSubject.credits}
                        onChange={(e) => setNewSubject({...newSubject, credits: Number(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        min="1"
                        max="6"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                      <textarea
                        placeholder="Provide a brief description of the subject"
                        value={newSubject.description}
                        onChange={(e) => setNewSubject({...newSubject, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                Add Subject
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ScheduleModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSubmit: (schedule: Partial<Schedule>) => void;
    teachers: InstructorData[];  
    subjects: Subject[];  
  }> = ({ isOpen, onClose, onSubmit, teachers, subjects }) => {
    const [newSchedule, setNewSchedule] = useState<Partial<Schedule>>({
      subject: '',
      instructor: '',  
      days: [],
      startTime: '',
      endTime: '',
      roomNumber: '',
      semester: ''
    });

    const handleSubmit = () => {
      if (!newSchedule.subject || !newSchedule.instructor || !newSchedule.days || newSchedule.days.length === 0 || 
          !newSchedule.startTime || !newSchedule.endTime || !newSchedule.semester) {
        Swal.fire({
          title: 'Validation Error',
          text: 'Please fill in all required fields',
          icon: 'warning',
          customClass: {
            popup: 'rounded-xl',
            confirmButton: 'bg-secondary-600 hover:bg-secondary-700 rounded-lg'
          }
        });
        return;
      }
      onSubmit(newSchedule);
      onClose();  
    };

    return (
      <div 
        className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'} overflow-y-auto`}
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
            aria-hidden="true"
            onClick={onClose}
          ></div>

          <div className="inline-block transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <div className="bg-white px-6 pt-6 pb-4">
              <div className="flex items-start">
                <div className="mr-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-secondary-100">
                  <ClockIcon className="h-6 w-6 text-secondary-600" aria-hidden="true" />
                </div>
                <div className="w-full">
                  <h3 
                    className="text-xl font-semibold text-gray-900 mb-4" 
                    id="modal-title"
                  >
                    Create New Schedule
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                      <select
                        value={newSchedule.subject}
                        onChange={(e) => setNewSchedule({...newSchedule, subject: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary-500"
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.name}>
                            {subject.name} ({subject.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Instructor *</label>
                      <select
                        value={newSchedule.instructor}
                        onChange={(e) => setNewSchedule({...newSchedule, instructor: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary-500"
                      >
                        <option value="">Select Instructor</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.fullName}>
                            {teacher.fullName} - {teacher.department}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Semester *</label>
                      <select
                        value={newSchedule.semester}
                        onChange={(e) => setNewSchedule({...newSchedule, semester: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary-500"
                      >
                        <option value="">Select Semester</option>
                        <option value="Fall 2025">Fall 2025</option>
                        <option value="Spring 2026">Spring 2026</option>
                        <option value="Summer 2026">Summer 2026</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                        <input
                          type="time"
                          value={newSchedule.startTime}
                          onChange={(e) => setNewSchedule({...newSchedule, startTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                        <input
                          type="time"
                          value={newSchedule.endTime}
                          onChange={(e) => setNewSchedule({...newSchedule, endTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Days *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <label key={day} className="inline-flex items-center">
                            <input
                              type="checkbox"
                              value={day}
                              checked={newSchedule.days && newSchedule.days.includes(day)}
                              onChange={(e) => {
                                const updatedDays = e.target.checked
                                  ? [...(newSchedule.days || []), day]
                                  : (newSchedule.days || []).filter(d => d !== day);
                                setNewSchedule({...newSchedule, days: updatedDays});
                              }}
                              className="form-checkbox h-4 w-4 text-secondary-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Number (Optional)</label>
                      <input
                        type="text"
                        placeholder="Enter room number"
                        value={newSchedule.roomNumber}
                        onChange={(e) => setNewSchedule({...newSchedule, roomNumber: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-secondary-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-secondary-600 rounded-md hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-secondary-500"
              >
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} transition-colors duration-300`}>
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
        userRole={currentUser?.role}
        adminPermissions={currentUser?.adminPermissions}
        profileImage={currentUser?.photoURL || undefined}
      />
      
      <main className="p-6 bg-gray-50 min-h-screen">
        <div className="container mx-auto">
          {/* Dashboard Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 bg-white shadow-lg rounded-xl p-6"
          >
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Admin Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {departmentStats.map((stat) => (
                <motion.div 
                  key={stat.department}
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-blue-100 to-blue-200 p-4 rounded-lg shadow-md"
                >
                  <h2 className="text-xl font-semibold text-gray-700 mb-2">{stat.department}</h2>
                  <div className="space-y-2">
                    <StatItem 
                      label="Teachers" 
                      value={stat.totalTeachers} 
                      icon={<ChartBarIcon className="h-6 w-6 text-blue-500" />} 
                    />
                    <StatItem 
                      label="Subjects" 
                      value={stat.totalSubjects} 
                      icon={<ChartBarIcon className="h-6 w-6 text-green-500" />} 
                    />
                    <StatItem 
                      label="Students" 
                      value={stat.totalStudents} 
                      icon={<ChartBarIcon className="h-6 w-6 text-purple-500" />} 
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Management Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subjects Management */}
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Subjects Management</h2>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsSubjectModalOpen(true)}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  + Add Subject
                </motion.button>
              </div>
              <AnimatePresence>
                {subjects.map((subject) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="flex justify-between items-center bg-gray-100 p-3 rounded-lg mb-2 hover:bg-gray-200 transition-colors"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-700">{subject.name}</h3>
                      <p className="text-sm text-gray-500">{subject.department}</p>
                    </div>
                    <div className="flex space-x-2">
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEditSubject(subject)}
                        className="text-blue-500 hover:text-blue-600"
                      >
                        Edit
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteSubject(subject.uid)}
                        className="text-red-500 hover:text-red-600"
                      >
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Schedules Management */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Schedules Management</h2>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
                >
                  + Create Schedule
                </motion.button>
              </div>
              <AnimatePresence>
                {schedules.map((schedule) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    className="flex justify-between items-center bg-gray-100 p-3 rounded-lg mb-2 hover:bg-gray-200 transition-colors"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-700">{schedule.subject}</h3>
                      <p className="text-sm text-gray-500">{schedule.teacher} | {schedule.time}</p>
                    </div>
                    <div className="flex space-x-2">
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEditSchedule(schedule)}
                        className="text-blue-500 hover:text-blue-600"
                      >
                        Edit
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteSchedule(schedule.uid)}
                        className="text-red-500 hover:text-red-600"
                      >
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Helper component for stat items */}
          {/* Removed StatItem definition from here */}

          {/* Modals remain the same */}
          {isSubjectModalOpen && (
            <SubjectModal 
              isOpen={isSubjectModalOpen} 
              onClose={() => setIsSubjectModalOpen(false)}
              onSubmit={handleAddSubject}
              teachers={teachers}
            />
          )}

          {isScheduleModalOpen && (
            <ScheduleModal 
              isOpen={isScheduleModalOpen} 
              onClose={() => setIsScheduleModalOpen(false)}
              onSubmit={handleAddSchedule}
              teachers={teachers}
              subjects={subjects}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;