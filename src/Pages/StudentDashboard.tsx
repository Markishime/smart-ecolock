import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import StudentNavbar from '../components/StudentNavbar';
import { Student } from '../interfaces/Student';
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
  ClipboardDocumentListIcon,
  UserIcon
} from '@heroicons/react/24/solid';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { theme } from '../styles/theme';

interface AttendanceRecord {
  id: string;
  studentId: string;
  sectionId: string;
  date: string;
  status: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
}

interface Schedule {
  days: string[];
  startTime: string;
  endTime: string;
}

interface Section {
  id: string;
  name: string;
  code: string;
  instructorId: string;
  schedule: {
    days: string[];
    startTime: string;
    endTime: string;
    room?: string;
  };
}

interface Instructor {
  id: string;
  fullName: string;
  email: string;
  department: string;
}

interface EnhancedStudent extends Student {
  sections?: string[];
  schedule?: Schedule;
}

const StudentDashboard = () => {
  const [studentData, setStudentData] = useState<EnhancedStudent | null>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'attendance'>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);

  useEffect(() => {
    // Get student data from localStorage
    const storedData = localStorage.getItem('userData');
    if (storedData) {
      setStudentData(JSON.parse(storedData));
    }

    // Redirect if not logged in or not a student
    if (!currentUser || localStorage.getItem('userRole') !== 'student') {
      navigate('/login');
    }

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
          const studentData = studentSnapshot.docs[0].data() as EnhancedStudent;
          setStudentData(studentData);

           // Set first section as default if sections exist
           const section = studentData.section || '';
           setSelectedSection(section);

           const attendanceQuery = query(
            collection(db, 'attendance'), 
            where('studentId', '==', studentData.id)
          );
          const attendanceSnapshot = await getDocs(attendanceQuery);
          setAttendance(attendanceSnapshot.docs.map(d => d.data() as AttendanceRecord));

          const notificationsQuery = query(
            collection(db, 'notifications'), 
            where('studentId', '==', studentData.id),
            orderBy('date', 'desc'),
            limit(5)
          );
          const notificationsSnapshot = await getDocs(notificationsQuery);
          setNotifications(notificationsSnapshot.docs.map(d => d.data() as Notification));

          // Fetch section data if student has a section
          if (studentData.section) {
            const sectionsRef = collection(db, 'sections');
            const sectionQuery = query(sectionsRef, where('code', '==', studentData.section));
            const sectionSnapshot = await getDocs(sectionQuery);
            
            if (!sectionSnapshot.empty) {
              const sectionData = {
                id: sectionSnapshot.docs[0].id,
                ...sectionSnapshot.docs[0].data()
              } as Section;
              setSection(sectionData);

              // Fetch instructor data
              if (sectionData.instructorId) {
                const instructorDoc = await getDoc(doc(db, 'teachers', sectionData.instructorId));
                if (instructorDoc.exists()) {
                  setInstructor({
                    id: instructorDoc.id,
                    ...instructorDoc.data()
                  } as Instructor);
                }
              }
            }
          }
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
  }, [currentUser, navigate]);

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

  if (!studentData) {
    return <div className="p-8 text-center">No student data found.</div>;
  }

  const attendanceRecords = attendance || [];
  const overallAttendance = attendanceRecords.length > 0
    ? ((attendanceRecords.filter(a => a.status === 'present').length / attendanceRecords.length) * 100 || 0).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <StudentNavbar student={studentData} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-600 to-blue-500 rounded-2xl shadow-xl p-8 mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h1 className="text-3xl font-bold mb-2">Welcome back, {studentData.fullName}!</h1>
              <p className="opacity-90">{studentData.department} • {studentData.yearLevel}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-lg rounded-xl p-4">
              <p className="text-white text-sm">Current Section</p>
              <p className="text-white text-2xl font-bold">{studentData.section}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "Attendance Rate",
              value: `${overallAttendance}%`,
              icon: <ChartBarIcon className="h-6 w-6" />,
              color: "from-emerald-500 to-teal-600"
            },
            {
              title: "Total Classes",
              value: studentData.courses?.length || 0,
              icon: <BookOpenIcon className="h-6 w-6" />,
              color: "from-blue-500 to-indigo-600"
            },
            {
              title: "Present Today",
              value: attendance.filter(a => 
                a.status === 'present' && 
                format(parseISO(a.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              ).length,
              icon: <ClockIcon className="h-6 w-6" />,
              color: "from-violet-500 to-purple-600"
            },
            {
              title: "Next Class",
              value: studentData.schedule?.startTime || "N/A",
              icon: <CalendarIcon className="h-6 w-6" />,
              color: "from-orange-500 to-red-600"
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-gradient-to-r ${stat.color} rounded-xl p-6 text-white shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className="bg-white/20 p-3 rounded-lg">
                  {stat.icon}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Schedule Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl shadow-lg p-6 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Today's Schedule</h2>
              <select
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
              >
                {studentData.sections?.map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {studentData.schedule?.days.map((day, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-xl">
                      <ClockIcon className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{day}</p>
                      <p className="text-sm text-gray-500">
                        {studentData.schedule?.startTime} - {studentData.schedule?.endTime}
                      </p>
                    </div>
                  </div>
                  <span className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium">
                    {selectedSection}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Attendance Overview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-xl font-bold text-gray-800 mb-6">Attendance Overview</h2>
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
            <div className="grid grid-cols-3 gap-4 mt-6">
              {getAttendanceStats().map((stat, index) => (
                <div key={stat.name} className="text-center">
                  <p className="text-sm text-gray-500">{stat.name}</p>
                  <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {section && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm p-6 mt-8"
          >
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{section.name}</h2>
                <p className="text-sm text-gray-500">Section Code: {section.code}</p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-xl">
                <AcademicCapIcon className="w-8 h-8 text-indigo-600" />
              </div>
            </div>

            {/* Instructor Info */}
            {instructor && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Instructor</h3>
                <div className="flex items-start space-x-4">
                  <div className="bg-white p-2 rounded-lg">
                    <UserIcon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{instructor.fullName}</p>
                    <p className="text-sm text-gray-500">{instructor.email}</p>
                    <p className="text-sm text-gray-500">{instructor.department}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Schedule Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-xs text-gray-500">Days</p>
                    <p className="text-sm font-medium text-gray-900">
                      {section.schedule.days.join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                  <ClockIcon className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-xs text-gray-500">Time</p>
                    <p className="text-sm font-medium text-gray-900">
                      {section.schedule.startTime} - {section.schedule.endTime}
                    </p>
                  </div>
                </div>

                {section.schedule.room && (
                  <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                    <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">Room</p>
                      <p className="text-sm font-medium text-gray-900">
                        {section.schedule.room}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;