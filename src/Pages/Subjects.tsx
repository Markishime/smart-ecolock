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
import { Subject, Instructor, DepartmentSubjects } from '../types';

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
  const [teachers, setTeachers] = useState<Instructor[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'credits'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchSubjectsAndTeachers = async () => {
      try {
        // Fetch teachers to get unique departments
        const teachersRef = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersRef);
        
        const uniqueDepartments = new Set<string>();
        const teachersList: Instructor[] = [];

        teachersSnapshot.docs.forEach(doc => {
          const teacherData = { id: doc.id, ...doc.data() } as Instructor;
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

  const sortedAndFilteredSubjects = useMemo(() => {
    let result: Subject[] = [];
    
    Object.values(departmentSubjects).forEach(subjects => {
      result = [...result, ...subjects];
    });

    // Apply filters
    result = result.filter(subject => 
      (selectedDepartment === 'all' || subject.department?.toLowerCase() === selectedDepartment.toLowerCase()) &&
      (searchQuery === '' || 
        subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subject.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subject.department?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

    // Apply sorting
    return result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'credits':
          comparison = (a.credits || 0) - (b.credits || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [departmentSubjects, selectedDepartment, searchQuery, sortBy, sortOrder]);

  const subjectStats = useMemo(() => {
    const stats = {
      totalSubjects: sortedAndFilteredSubjects.length,
      byDepartment: {} as Record<string, number>,
      averageCredits: 0,
      totalCredits: 0
    };

    sortedAndFilteredSubjects.forEach(subject => {
      const dept = subject.department || 'Unassigned';
      stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
      stats.totalCredits += subject.credits || 0;
    });

    stats.averageCredits = stats.totalCredits / (sortedAndFilteredSubjects.length || 1);

    return stats;
  }, [sortedAndFilteredSubjects]);

  const renderSubjectCard = (subject: Subject) => {
    const departmentColors = departmentColorMap[subject.department as keyof typeof departmentColorMap] || departmentColorMap.default;
    
    return (
      <motion.div
        key={subject.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
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

  const renderSubjectListItem = (subject: Subject) => (
    <motion.div
      key={subject.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed}
        userRole={currentUser?.role}
      />
      
      <main className={`flex-1 overflow-x-hidden overflow-y-auto transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="container mx-auto p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">Subject Management</h1>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'code' | 'credits')}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="name">Sort by Name</option>
                  <option value="code">Sort by Code</option>
                  <option value="credits">Sort by Credits</option>
                </select>
                <button
                  onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode(mode => mode === 'grid' ? 'list' : 'grid')}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  {viewMode === 'grid' ? 'List View' : 'Grid View'}
                </button>
                <button
                  onClick={() => setShowStatsModal(true)}
                  className="p-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-600"
                >
                  <ChartBarIcon className="h-5 w-5" />
                </button>
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Add Subject
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <AnimatePresence>
              <div className={`
                ${viewMode === 'grid' 
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'space-y-4'
                }
              `}>
                {sortedAndFilteredSubjects.map((subject) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    whileHover={{ scale: 1.05 }}
                    className={`
                      ${viewMode === 'grid' ? renderSubjectCard(subject) : renderSubjectListItem(subject)}
                    `}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}

          {sortedAndFilteredSubjects.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-64"
            >
              <DocumentTextIcon className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-xl text-gray-600">No subjects found matching your criteria</p>
            </motion.div>
          )}
        </div>
      </main>

      {/* Stats Modal */}
      <AnimatePresence>
        {showStatsModal && (
          <motion.div
            key="stats-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl p-6 max-w-lg w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Subject Statistics</h2>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="h-6 w-6 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <p className="text-sm text-indigo-600 mb-1">Total Subjects</p>
                    <p className="text-2xl font-bold text-indigo-900">{subjectStats.totalSubjects}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600 mb-1">Average Credits</p>
                    <p className="text-2xl font-bold text-green-900">{subjectStats.averageCredits.toFixed(1)}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Subjects by Department</h3>
                  <div className="space-y-2">
                    {Object.entries(subjectStats.byDepartment).map(([dept, count]) => (
                      <div key={dept} className="flex items-center justify-between">
                        <span className="text-gray-600">{dept}</span>
                        <span className="font-semibold text-gray-800">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Student Modal */}
      <AnimatePresence>
        {(showAddModal || selectedSubject) && (
          <motion.div
            key="add-edit-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            {/* Add/Edit modal content */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Subjects;