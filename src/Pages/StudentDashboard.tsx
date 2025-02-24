import { useEffect, useState } from 'react';
import { useAuth } from '../Pages/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  CalendarIcon,
  UserGroupIcon,
  BookOpenIcon,
  ClockIcon,
  BuildingOfficeIcon,
  UserCircleIcon,
  AcademicCapIcon,
  BellIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/solid';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import Sidebar from '../components/Sidebar';

interface Student {
  uid: string;
  fullName: string;
  email: string;
  idNumber: string;
  major: string;
  mobileNumber: string;
  role: string;
  yearLevel: string;
  sections: string[];
  schedule: {
    days: string[];
    startTime: string;
    endTime: string;
  };
}

interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'late';
  sectionId: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

const StudentDashboard = () => {
  const { currentUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'attendance'>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!currentUser) return;

      try {
        // Fetch student document
        const studentQuery = query(
          collection(db, 'students'), 
          where('uid', '==', currentUser.uid)
        );
        const studentSnapshot = await getDocs(studentQuery);

        if (!studentSnapshot.empty) {
          const studentData = studentSnapshot.docs[0].data() as Student;
          setStudent(studentData);

           // Set first section as default if sections exist
           const sections = studentData.sections || [];
           setSelectedSection(sections[0] || '');

           const attendanceQuery = query(
            collection(db, 'attendance'), 
            where('studentId', '==', studentData.uid)
          );
          const attendanceSnapshot = await getDocs(attendanceQuery);
          setAttendance(attendanceSnapshot.docs.map(d => d.data() as AttendanceRecord));

          const notificationsQuery = query(
            collection(db, 'notifications'), 
            where('studentId', '==', studentData.uid),
            orderBy('date', 'desc'),
            limit(5)
          );
          const notificationsSnapshot = await getDocs(notificationsQuery);
          setNotifications(notificationsSnapshot.docs.map(d => d.data() as Notification));
        } else {
          console.error('Student record not found');
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [currentUser]);

  const getFilteredAttendance = () => {
    if (!selectedSection) return [];
    
    const filtered = attendance.filter(a => a.sectionId === selectedSection);
    const now = new Date();

    switch (reportRange) {
      case 'daily':
        return filtered.filter(a => 
          format(parseISO(a.date), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
        );

      case 'weekly':
        const weekStart = startOfWeek(now);
        const weekEnd = endOfWeek(now);
        return filtered.filter(a => {
          const date = parseISO(a.date);
          return date >= weekStart && date <= weekEnd;
        });

      case 'monthly':
        return filtered.filter(a => 
          format(parseISO(a.date), 'yyyy-MM') === format(now, 'yyyy-MM')
        );

      default:
        return filtered;
    }
  };

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

  const getAttendanceStats = () => {
    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const absent = attendance.filter(a => a.status === 'absent').length;

    return [
      { name: 'Present', value: present },
      { name: 'Late', value: late },
      { name: 'Absent', value: absent }
    ];
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading student data...</div>;
  }

  if (!student) {
    return <div className="p-8 text-center">No student data found.</div>;
  }

  const attendanceRecords = attendance || [];
  const overallAttendance = attendanceRecords.length > 0
    ? ((attendanceRecords.filter(a => a.status === 'present').length / attendanceRecords.length) * 100 || 0).toFixed(1)
    : 0;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen bg-gray-50">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
        userRole="student"
      />
      
      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="p-8">
        {/* Header */}
        <motion.div 
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          className="bg-white rounded-lg p-6 shadow-sm mb-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="bg-indigo-100 p-3 rounded-full">
                <UserCircleIcon className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{student.fullName}</h1>
                <p className="text-gray-500">{student.major} • Year {student.yearLevel}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="relative bg-indigo-50 p-2 rounded-full"
              >
                <BellIcon className="w-6 h-6 text-indigo-600" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </motion.button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-4 rounded-lg text-white"
            >
              <p className="text-indigo-100">Enrolled Sections</p>
              <p className="text-2xl font-bold">{student.sections?.length || 0}</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 rounded-lg text-white"
            >
              <p className="text-emerald-100">Attendance Rate</p>
              <p className="text-2xl font-bold">{overallAttendance}%</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 rounded-lg text-white"
            >
              <p className="text-amber-100">Current Section</p>
              <p className="text-2xl font-bold">{selectedSection || 'None'}</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-r from-rose-500 to-rose-600 p-4 rounded-lg text-white"
            >
              <p className="text-rose-100">Next Class</p>
              <p className="text-2xl font-bold">{format(new Date(), 'HH:mm')}</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg p-4 mb-8 flex space-x-4">
          {['overview', 'schedule', 'attendance'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab 
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        </div>

        {/* Main Content */}
        <AnimatePresence mode='wait'>
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-6"
          >
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-1 space-y-8">
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <UserGroupIcon className="w-6 h-6 text-indigo-600" />
                      Your Sections
                    </h2>
                    
                    <div className="space-y-3">
                      {student.sections?.map(sectionId => (
                        <motion.button
                          key={sectionId}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedSection(sectionId)}
                          className={`w-full p-3 text-left rounded-lg transition-colors ${
                            selectedSection === sectionId 
                              ? 'bg-indigo-100 border-l-4 border-indigo-500'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <p className="font-semibold">{sectionId}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <BellIcon className="w-6 h-6 text-indigo-600" />
                      Recent Notifications
                    </h2>
                    <div className="space-y-4">
                      {notifications.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No new notifications</p>
                      ) : (
                        notifications.map(notification => (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-3 bg-gray-50 rounded-lg"
                          >
                            <p className="font-medium">{notification.title}</p>
                            <p className="text-sm text-gray-500">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{notification.date}</p>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <ChartBarIcon className="w-6 h-6 text-indigo-600" />
                        Attendance Overview
                      </h2>
                      <select
                        value={reportRange}
                        onChange={(e) => setReportRange(e.target.value as any)}
                        className="bg-gray-50 p-2 rounded-lg border border-gray-200"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getFilteredAttendance()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="status" stroke="#4F46E5" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getAttendanceStats()}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {getAttendanceStats().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <ClipboardDocumentListIcon className="w-6 h-6 text-indigo-600" />
                      Today's Schedule
                    </h2>
                    <div className="space-y-4">
                      {student.schedule?.days.map((day, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-4 bg-gray-50 rounded-lg flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-full">
                              <ClockIcon className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-medium">{day}</p>
                              <p className="text-sm text-gray-500">
                                {student.schedule.startTime} - {student.schedule.endTime}
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-sm">
                            {selectedSection}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}
            {activeTab === 'schedule' && (
              <div>
                Schedule
              </div>
            )}
            {activeTab === 'attendance' && (
              <div>
                Attendance
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default StudentDashboard;