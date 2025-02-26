import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, Timestamp, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AcademicCapIcon,
  CalendarIcon,
  UserGroupIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  BookOpenIcon,
  UserIcon,
  BuildingLibraryIcon,
  DocumentChartBarIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import AdminSidebar from '../components/AdminSidebar';
import { useAuth } from './AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Student {
  id: string;
  name: string;
  studentId: string;
  section: string;
  course: string;
  year: string;
  attendance: boolean;
  timeIn?: string;
  subjects: string[];
}

interface Section {
  id: string;
  name: string;
  course: string;
  subjectCode: string;
  maxStudents: number;
  students: Student[];
  schedule: {
    days: string[];
    startTime: string;
    endTime: string;
    roomNumber: string;
  };
}

interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  semester?: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  section: string;
  date: Timestamp;
  status: 'present' | 'absent' | 'late';
  timeIn?: string;
  subjectCode: string;
  department: string;
}

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const attendanceCollection = collection(db, 'attendance');
        const studentsCollection = collection(db, 'students');
        const teachersCollection = collection(db, 'teachers');

        // Fetch attendance records
        const attendanceQuery = query(
          attendanceCollection, 
          orderBy('date', 'desc')
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);

        // Fetch students to get their departments
        const studentsSnapshot = await getDocs(studentsCollection);
        const studentsMap = new Map(
          studentsSnapshot.docs.map(doc => [
            doc.data().studentId, 
            doc.data().department
          ])
        );

        // Fetch teachers to get their departments
        const teachersSnapshot = await getDocs(teachersCollection);
        const teachersMap = new Map(
          teachersSnapshot.docs.map(doc => [
            doc.data().uid, 
            doc.data().department
          ])
        );

        // Process attendance records with department
        const processedAttendanceData = attendanceSnapshot.docs.map(doc => {
          const attendanceData = doc.data() as AttendanceRecord;
          
          // Try to find department from students first, then teachers
          const studentDepartment = studentsMap.get(attendanceData.studentId);
          const teacherDepartment = teachersMap.get(currentUser.uid);
          
          return {
            ...attendanceData,
            id: doc.id,
            department: studentDepartment || teacherDepartment || 'Unknown'
          };
        });

        setAttendanceData(processedAttendanceData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching attendance data:", error);
        Swal.fire('Error', 'Failed to fetch attendance data', 'error');
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        
        const uniqueDepartments = Array.from(new Set(
          teachersSnapshot.docs
            .map(doc => doc.data().department)
            .filter(dept => dept)
        ));
        
        setDepartments(uniqueDepartments);
      } catch (error) {
        console.error("Error fetching departments:", error);
      }
    };

    fetchDepartments();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'late':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'absent':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'late':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'absent':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <UserIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const filterAttendanceData = () => {
    return attendanceData.filter(record => {
      const matchesDepartment = 
        selectedDepartment === 'all' || 
        record.department === selectedDepartment;

      const matchesSection = 
        selectedSection === 'all' || 
        record.section === selectedSection;

      const matchesSearch = 
        record.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.section.toLowerCase().includes(searchQuery.toLowerCase());
      
      const recordDate = record.date.toDate();
      const today = new Date();
      let matchesDate = false;

      switch (dateRange) {
        case 'today':
          matchesDate = recordDate.toDateString() === today.toDateString();
          break;
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = recordDate >= weekAgo;
          break;
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = recordDate >= monthAgo;
          break;
      }

      return matchesDepartment && matchesSection && matchesSearch && matchesDate;
    });
  };

  const getAttendanceStats = () => {
    const filteredData = filterAttendanceData();
    const total = filteredData.length;
    const present = filteredData.filter(r => r.status === 'present').length;
    const late = filteredData.filter(r => r.status === 'late').length;
    const absent = filteredData.filter(r => r.status === 'absent').length;

    return {
      total,
      present,
      late,
      absent,
      presentPercentage: total ? (present / total) * 100 : 0,
      latePercentage: total ? (late / total) * 100 : 0,
      absentPercentage: total ? (absent / total) * 100 : 0,
    };
  };

  const stats = getAttendanceStats();
  const filteredRecords = filterAttendanceData();

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <AdminSidebar />
      
      <div className={`flex-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-20' : 'ml-64'} overflow-y-auto`}>
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Attendance Reports</h1>
            <div className="flex space-x-4">
              {/* Filtering Section */}
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Departments</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>

              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Sections</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.name}>
                    {section.name}
                  </option>
                ))}
              </select>

              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as 'today' | 'week' | 'month')}
                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search students or sections"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <FunnelIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Attendance Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Present Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg shadow-md p-6 border border-green-100 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Present</h3>
                <CheckCircleIcon className="h-8 w-8 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-green-600">{stats.present}</span>
                <span className="text-sm text-green-500">{stats.presentPercentage.toFixed(1)}%</span>
              </div>
            </motion.div>

            {/* Late Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg shadow-md p-6 border border-yellow-100 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Late</h3>
                <ClockIcon className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-yellow-600">{stats.late}</span>
                <span className="text-sm text-yellow-500">{stats.latePercentage.toFixed(1)}%</span>
              </div>
            </motion.div>

            {/* Absent Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg shadow-md p-6 border border-red-100 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Absent</h3>
                <XCircleIcon className="h-8 w-8 text-red-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-red-600">{stats.absent}</span>
                <span className="text-sm text-red-500">{stats.absentPercentage.toFixed(1)}%</span>
              </div>
            </motion.div>
          </div>

          {/* Attendance Records Table */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-lg shadow-md overflow-hidden"
          >
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <ArrowPathIcon className="h-10 w-10 text-indigo-500 animate-spin" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <DocumentChartBarIcon className="h-16 w-16 mb-4" />
                <p className="text-xl">No attendance records found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                    <th className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 flex items-center">
                        <UserIcon className="h-6 w-6 text-gray-400 mr-3" />
                        <span className="font-medium">{record.studentName}</span>
                      </td>
                      <td className="p-4">{record.section}</td>
                      <td className="p-4">{record.subjectCode}</td>
                      <td className="p-4">{record.date.toDate().toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {getStatusIcon(record.status)}
                          <span className="ml-2 capitalize">{record.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Reports;