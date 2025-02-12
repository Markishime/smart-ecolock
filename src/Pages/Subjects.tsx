import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpenIcon, 
  AcademicCapIcon, 
  DocumentTextIcon,
  PlusIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  InformationCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  ChartBarIcon,
  ClockIcon
} from '@heroicons/react/24/solid';
import { 
  collection, 
  query, 
  onSnapshot, 
  getDocs, 
  where, 
  updateDoc, 
  doc, 
  deleteDoc, 
  addDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Swal from 'sweetalert2';
import { useAuth } from '../Pages/AuthContext';
import { Subject, InstructorData, DepartmentSubjects } from '../types';

// Enhanced color palette for departments
const departmentColorMap = {
  'Computer Science': {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-800',
    icon: 'text-blue-600',
    gradient: 'from-blue-100 to-blue-200'
  },
  'Mathematics': {
    bg: 'bg-green-50',
    border: 'border-green-400',
    text: 'text-green-800',
    icon: 'text-green-600',
    gradient: 'from-green-100 to-green-200'
  },
  'Physics': {
    bg: 'bg-purple-50',
    border: 'border-purple-400',
    text: 'text-purple-800',
    icon: 'text-purple-600',
    gradient: 'from-purple-100 to-purple-200'
  },
  'Engineering': {
    bg: 'bg-red-50',
    border: 'border-red-400',
    text: 'text-red-800',
    icon: 'text-red-600',
    gradient: 'from-red-100 to-red-200'
  },
  'Biology': {
    bg: 'bg-teal-50',
    border: 'border-teal-400',
    text: 'text-teal-800',
    icon: 'text-teal-600',
    gradient: 'from-teal-100 to-teal-200'
  },
  'Chemistry': {
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    text: 'text-yellow-800',
    icon: 'text-yellow-600',
    gradient: 'from-yellow-100 to-yellow-200'
  },
  'default': {
    bg: 'bg-gray-50',
    border: 'border-gray-400',
    text: 'text-gray-800',
    icon: 'text-gray-600',
    gradient: 'from-gray-100 to-gray-200'
  }
};

const Subjects: React.FC = () => {
  const [departmentSubjects, setDepartmentSubjects] = useState<DepartmentSubjects>({});
  const [teachers, setTeachers] = useState<InstructorData[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchSubjectsAndTeachers = async () => {
      try {
        // Fetch teachers to get unique departments
        const teachersRef = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersRef);
        
        const uniqueDepartments = new Set<string>();
        const teachersList: InstructorData[] = [];

        teachersSnapshot.docs.forEach(doc => {
          const teacherData = { id: doc.id, ...doc.data() } as InstructorData;
          teachersList.push(teacherData);
          
          if (teacherData.department) {
            uniqueDepartments.add(teacherData.department);
          }
        });

        // Fetch subjects
        const subjectsRef = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        
        const subjectsByDepartment: DepartmentSubjects = {};
        subjectsSnapshot.docs.forEach(doc => {
          const subject = { id: doc.id, ...doc.data() } as Subject;
          const department = subject.department || 'Unassigned';
          
          if (!subjectsByDepartment[department]) {
            subjectsByDepartment[department] = [];
          }
          subjectsByDepartment[department].push(subject);
        });

        setDepartmentSubjects(subjectsByDepartment);
        setTeachers(teachersList);
        setDepartments(['all', ...Array.from(uniqueDepartments)]);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching subjects and teachers:', error);
        Swal.fire('Error', 'Could not fetch subjects and teachers', 'error');
        setLoading(false);
      }
    };

    fetchSubjectsAndTeachers();
  }, []);

  const filteredSubjects = useMemo(() => {
    let result: Subject[] = [];
    
    Object.values(departmentSubjects).forEach(subjects => {
      result = [...result, ...subjects];
    });

    return result.filter(subject => 
      (selectedDepartment === 'all' || subject.department?.toLowerCase() === selectedDepartment) &&
      (searchQuery === '' || 
        subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subject.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subject.department?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [departmentSubjects, selectedDepartment, searchQuery]);

  const renderSubjectCard = (subject: Subject) => {
    const departmentColors = departmentColorMap[subject.department as keyof typeof departmentColorMap] || departmentColorMap.default;
    
    return (
      <motion.div
        key={subject.id}
        whileHover={{ scale: 1.05 }}
        className={`
          ${departmentColors.bg} ${departmentColors.border}
          border rounded-lg p-4 shadow-md transition-all duration-300 
          bg-gradient-to-br ${departmentColors.gradient}
          flex flex-col justify-between
        `}
      >
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className={`
              font-bold text-lg 
              ${departmentColors.text}
            `}>
              {subject.name}
            </h4>
            <DocumentTextIcon 
              className={`h-6 w-6 
                ${departmentColors.icon}
              `} 
            />
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            <p><strong>Code:</strong> {subject.code}</p>
            <p><strong>Department:</strong> {subject.department || 'N/A'}</p>
            <p><strong>Credits:</strong> {subject.credits || 'N/A'}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <UserCircleIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              {subject.teacherName || 'Unassigned'}
            </span>
          </div>
          {subject.semester && (
            <div className="flex items-center space-x-2">
              <ClockIcon className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                {subject.semester}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderSubjectsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredSubjects.map(renderSubjectCard)}
    </div>
  );

  const renderSubjectsList = () => (
    <div className="space-y-4">
      {filteredSubjects.map(subject => (
        <motion.div
          key={subject.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center hover:shadow-md transition"
        >
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-800">{subject.name}</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Code:</strong> {subject.code}</p>
              <p><strong>Department:</strong> {subject.department || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <UserCircleIcon className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                {subject.teacherName || 'Unassigned'}
              </span>
            </div>
            <ChartBarIcon className="h-6 w-6 text-primary-500" />
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed} 
        userRole="admin"
      />

      <div 
        className={`flex-1 transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-64'
        } p-8`}
      >
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <BookOpenIcon className="h-8 w-8 mr-3 text-primary-500" />
              Subjects Management
            </h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search subjects..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-md pl-10 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept.charAt(0).toUpperCase() + dept.slice(1)}
                  </option>
                ))}
              </select>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md ${
                    viewMode === 'grid' 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Grid
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md ${
                    viewMode === 'list' 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full"
              />
            </div>
          ) : (
            viewMode === 'grid' ? renderSubjectsGrid() : renderSubjectsList()
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Subjects;