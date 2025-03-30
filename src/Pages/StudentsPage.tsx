import React, { useState, useEffect, useMemo, } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AcademicCapIcon, 
  PlusIcon, 
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/solid';
import { collection, query, onSnapshot, where, doc, updateDoc, deleteDoc, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import Swal from 'sweetalert2';
import AdminSidebar from '../components/AdminSidebar';
import UserModal from '../components/UserModal';
import { theme } from '../styles/theme';

interface Student {
  id: string;
  name: string;
  email: string;
  department: string;
  yearLevel: number;
  section: string;
  studentId: string;
  attendance: {
    present: number;
    absent: number;
    late: number;
  };
  status: 'active' | 'inactive';
  createdAt: Date;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  byDepartment: Record<string, number>;
  byYearLevel: Record<string, number>;
  byStatus: Record<string, number>;
}

const StudentsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    department: 'all',
    yearLevel: 'all',
    status: 'all'
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'name' as keyof Student,
    direction: 'asc' as 'asc' | 'desc'
  });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Real-time data subscription
  useEffect(() => {
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentsData: Student[] = [];
      snapshot.forEach((doc) => {
        studentsData.push({ id: doc.id, ...doc.data() } as Student);
      });
      setStudents(studentsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching students:', error);
      Swal.fire('Error', 'Failed to fetch students data', 'error');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Computed Values
  const departments = useMemo(() => 
    Array.from(new Set(students.map(s => s.department))),
    [students]
  );

  const yearLevels = useMemo(() => 
    Array.from(new Set(students.map(s => s.yearLevel))).sort(),
    [students]
  );

  const filteredStudents = useMemo(() => {
    return students.filter(student => 
      (filterOptions.department === 'all' || student.department === filterOptions.department) &&
      (filterOptions.yearLevel === 'all' || student.yearLevel.toString() === filterOptions.yearLevel) &&
      (filterOptions.status === 'all' || student.status === filterOptions.status) &&
      (searchQuery === '' || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    ).sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortConfig.direction === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [students, filterOptions, searchQuery, sortConfig]);

  const calculateStats = (students: Student[]): Stats => {
    const stats: Stats = {
      total: students.length,
      active: students.filter(s => s.status === 'active').length,
      inactive: students.filter(s => s.status === 'inactive').length,
      byDepartment: {},
      byYearLevel: {},
      byStatus: {
        active: 0,
        inactive: 0
      }
    };

    students.forEach(student => {
      // Department stats
      if (student.department) {
        if (!stats.byDepartment[student.department]) {
          stats.byDepartment[student.department] = 0;
        }
        stats.byDepartment[student.department]++;
      }

      // Year level stats
      const yearKey = student.yearLevel?.toString();
      if (yearKey) {
        if (!stats.byYearLevel[yearKey]) {
          stats.byYearLevel[yearKey] = 0;
        }
        stats.byYearLevel[yearKey]++;
      }

      // Status stats
      stats.byStatus[student.status]++;
    });

    return stats;
  };

  const stats = useMemo(() => calculateStats(filteredStudents), [filteredStudents]);

  const handleSort = (key: keyof Student) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
      }).then(async (result) => {
        if (result.isConfirmed) {
          await deleteDoc(doc(db, 'students', studentId));
          Swal.fire('Deleted!', 'Student has been deleted.', 'success');
        }
      });
    } catch (error) {
      console.error('Error deleting student:', error);
      Swal.fire('Error', 'Failed to delete student', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      
      const studentData = {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        department: formData.get('department') as string,
        yearLevel: parseInt(formData.get('yearLevel') as string),
        section: formData.get('section') as string,
        studentId: formData.get('studentId') as string,
        status: formData.get('status') as 'active' | 'inactive',
        attendance: selectedStudent?.attendance || {
          present: 0,
          absent: 0,
          late: 0
        },
        createdAt: selectedStudent?.createdAt || new Date()
      };

      if (selectedStudent) {
        // Update existing student
        await updateDoc(doc(db, 'students', selectedStudent.id), studentData);
        Swal.fire('Success', 'Student updated successfully', 'success');
      } else {
        // Add new student
        await addDoc(collection(db, 'students'), studentData);
        Swal.fire('Success', 'Student added successfully', 'success');
      }

      // Reset form and close modal
      form.reset();
      setShowAddModal(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error saving student:', error);
      Swal.fire('Error', 'Failed to save student data', 'error');
    }
  };

  const getYearSuffix = (year: number) => {
    if (year === 1) return 'st';
    if (year === 2) return 'nd';
    if (year === 3) return 'rd';
    return 'th';
  };

  const openUserModal = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserModalOpen(true);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <AdminSidebar />
      
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'} p-8 overflow-y-auto`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex items-center">
              <AcademicCapIcon className="h-10 w-10 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Students</h1>
                <p className="text-gray-600">Manage and monitor student records</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <select
                value={filterOptions.department}
                onChange={(e) => setFilterOptions(prev => ({ ...prev, department: e.target.value }))}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <select
                value={filterOptions.yearLevel}
                onChange={(e) => setFilterOptions(prev => ({ ...prev, yearLevel: e.target.value }))}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Year Levels</option>
                {yearLevels.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <button
                onClick={() => setShowStatsModal(true)}
                className="p-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-600"
              >
                <ChartBarIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                </div>
                <AcademicCapIcon className="h-8 w-8 text-indigo-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Students</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.active}</p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Inactive Students</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.inactive}</p>
                </div>
                <XCircleIcon className="h-8 w-8 text-red-600" />
              </div>
            </motion.div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Name
                        {sortConfig.key === 'name' && (
                          sortConfig.direction === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <AnimatePresence>
                    {filteredStudents.map((student) => (
                      <motion.tr
                        key={student.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50 transition"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{student.studentId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{student.department}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{student.yearLevel}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            student.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setSelectedStudent(student)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => openUserModal(student.id)}
                              className={theme.components.button.secondary}
                            >
                              View/Edit Details
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl p-6 max-w-lg w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Student Statistics</h2>
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
                    <p className="text-sm text-indigo-600 mb-1">Total Students</p>
                    <p className="text-2xl font-bold text-indigo-900">{stats.total}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600 mb-1">Active Students</p>
                    <p className="text-2xl font-bold text-green-900">{stats.active}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Students by Department</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.byDepartment).map(([dept, count]) => (
                      <div key={dept} className="flex items-center justify-between">
                        <span className="text-gray-600">{dept}</span>
                        <span className="font-semibold text-gray-800">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Students by Year Level</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.byYearLevel).map(([year, count]) => (
                      <div key={year} className="flex items-center justify-between">
                        <span className="text-gray-600">{`${year}${getYearSuffix(parseInt(year))} Year`}</span>
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

     
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        userId={selectedUserId}
        userType="student"
      />
    </div>
  );
};

export default StudentsPage;