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
  const [darkMode, setDarkMode] = useState(false);
  const [instructors, setInstructors] = useState<InstructorData[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  // Fetch instructors and calculate department stats
  useEffect(() => {
    const fetchData = async () => {
      try {
        const instructorsQuery = query(collection(db, 'teachers'), orderBy('department'));
        const unsubscribe = onSnapshot(instructorsQuery, (snapshot) => {
          const instructorData: InstructorData[] = [];
          const departmentMap = new Map<string, DepartmentStats>();

          snapshot.forEach((doc) => {
            const data = doc.data() as InstructorData;
            data.id = doc.id;
            instructorData.push(data);

            // Calculate department statistics
            if (!departmentMap.has(data.department)) {
              departmentMap.set(data.department, {
                department: data.department,
                totalTeachers: 0,
                totalSubjects: 0,
                totalStudents: 0,
                totalSchedules: 0,
                totalSections: 0,
              });
            }

            const stats = departmentMap.get(data.department)!;
            stats.totalTeachers++;
            stats.totalSubjects += data.subjects?.length || 0;
            stats.totalSchedules += data.schedules?.length || 0;
            stats.totalSections += data.sections?.length || 0;
            stats.totalStudents += data.sections?.reduce((acc, section) => acc + (section.students?.length || 0), 0) || 0;
          });

          setInstructors(instructorData);
          setDepartmentStats(Array.from(departmentMap.values()));
          if (!selectedDepartment && departmentMap.size > 0) {
            setSelectedDepartment(Array.from(departmentMap.keys())[0]);
          }
          setIsLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedDepartment]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Group instructors by department
  const instructorsByDepartment = useMemo(() => {
    const grouped = new Map<string, InstructorData[]>();
    instructors.forEach((instructor) => {
      if (!grouped.has(instructor.department)) {
        grouped.set(instructor.department, []);
      }
      grouped.get(instructor.department)!.push(instructor);
    });
    return grouped;
  }, [instructors]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar isCollapsed={sidebarCollapsed} setIsCollapsed={setSidebarCollapsed} userRole="admin" />
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'} p-8`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              Admin Dashboard
            </h1>
            <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage your institution's departments, instructors, and courses
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {darkMode ? (
                <SunIcon className="w-6 h-6" />
              ) : (
                <MoonIcon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Department Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {departmentStats.map((stat) => (
            <motion.div
              key={stat.department}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              className={`p-6 rounded-xl shadow-lg ${
                darkMode 
                  ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' 
                  : 'bg-white border-gray-100 hover:bg-gray-50'
              } border cursor-pointer transition-all duration-200`}
              onClick={() => setSelectedDepartment(stat.department)}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {stat.department}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  darkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'
                }`}>
                  {stat.totalTeachers} Teachers
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Subjects</span>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {stat.totalSubjects}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Students</span>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {stat.totalStudents}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Schedules</span>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {stat.totalSchedules}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Department Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-4">
            {Array.from(instructorsByDepartment.keys()).map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`pb-3 px-4 text-sm font-medium transition-all duration-200 ${
                  selectedDepartment === dept
                    ? `border-b-2 border-blue-500 ${darkMode ? 'text-white' : 'text-blue-600'}`
                    : `${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Instructors Grid */}
        {selectedDepartment && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instructorsByDepartment.get(selectedDepartment)?.map((instructor) => (
              <motion.div
                key={instructor.id}
                whileHover={{ scale: 1.02 }}
                className={`p-6 rounded-xl ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' 
                    : 'bg-white border-gray-100 hover:bg-gray-50'
                } border shadow-lg transition-all duration-200`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      {instructor.fullName}
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {instructor.email}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button className={`p-2 rounded-lg ${
                      darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    } transition-colors duration-200`}>
                      <PencilIcon className="w-4 h-4 text-blue-500" />
                    </button>
                    <button className={`p-2 rounded-lg ${
                      darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    } transition-colors duration-200`}>
                      <TrashIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <BookOpenIcon className="w-4 h-4 mr-2 text-gray-500" />
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                      {instructor.subjects?.length || 0} Subjects
                    </span>
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="w-4 h-4 mr-2 text-gray-500" />
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                      {instructor.schedules?.length || 0} Schedules
                    </span>
                  </div>
                  <div className="flex items-center">
                    <UserIcon className="w-4 h-4 mr-2 text-gray-500" />
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                      {instructor.sections?.reduce((acc, section) => acc + (section.students?.length || 0), 0) || 0} Students
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;