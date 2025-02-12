import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from './AuthContext';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Sidebar from '../components/Sidebar';
import {
  LockClosedIcon,
  UserIcon,
  HomeIcon,
  UsersIcon,
  UserGroupIcon,
  CogIcon,
  ArrowLeftEndOnRectangleIcon,
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  ClipboardDocumentCheckIcon,
  CalendarIcon,
  BookmarkIcon,
  ChartBarIcon,
  XMarkIcon,
  ClipboardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,

} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';


interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface Student {
  id: string;
  name: string;
  section: string;
  attendance: boolean;
  timeIn?: string;
}

interface Schedule {
  id: string;
  days: string[];
  startTime: string;
  endTime: string;
  roomNumber: string;
  semester?: string;
  subjectCode: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface InstructorData {
  id: string;
  fullName: string;
  email: string;
  department: string;
  subjects: Subject[];
  schedules: Schedule[];
  sections: Section[];
}
interface Section {
  id: string;
  name: string;
  course: string;
  subjectCode: string;
  maxStudents: number;
  students: string[];
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  timestamp: any;
}

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  attendanceRate: number;
  onTimeRate: number;
}

const InstructorDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [instructorData, setInstructorData] = useState<InstructorData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClasses: 0,
    attendanceRate: 0,
    onTimeRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const handleRemoveSection = async (sectionId: string) => {
    try {
      await updateDoc(doc(db, 'teachers', currentUser!.uid), {
        sections: instructorData!.sections.filter(s => s.id !== sectionId)
      });
      Swal.fire('Success', 'Section deleted successfully!', 'success');
    } catch (error) {
      Swal.fire('Error', 'Failed to delete section', 'error');
    }
  };

  const handleRemoveSchedule = async (scheduleId: string) => {
    try {
      await updateDoc(doc(db, 'teachers', currentUser!.uid), {
        schedules: instructorData!.schedules.filter(s => s.id !== scheduleId)
      });
      Swal.fire('Success', 'Schedule deleted successfully!', 'success');
    } catch (error) {
      Swal.fire('Error', 'Failed to delete schedule', 'error');
    }
  };

  const handleRemoveSubject = async (subjectId: string) => {
    try {
      await updateDoc(doc(db, 'teachers', currentUser!.uid), {
        subjects: instructorData!.subjects.filter(s => s.id !== subjectId)
      });
      Swal.fire('Success', 'Subject deleted successfully!', 'success');
    } catch (error) {
      Swal.fire('Error', 'Failed to delete subject', 'error');
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const instructorRef = doc(db, 'teachers', currentUser.uid);
    const unsubscribeInstructor = onSnapshot(instructorRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as InstructorData;
        setInstructorData(data);
        if (data.sections?.length) setSelectedSection(data.sections[0].id);
      }
    });

    const unsubscribeStudents = onSnapshot(
      query(collection(db, 'students'), where('section', '==', selectedSection)),
      (snapshot) => {
        setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      }
    );

    // Fetch recent attendance records
    const attendanceQuery = query(
      collection(db, 'attendance'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AttendanceRecord));
      setRecentAttendance(records);
    });

    // Fetch dashboard statistics
    const fetchStats = async () => {
      const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
      const classesQuery = query(collection(db, 'schedules'));
      const attendanceQuery = query(collection(db, 'attendance'));

      const unsubscribeStats = onSnapshot(studentsQuery, (studentsSnapshot) => {
        const totalStudents = studentsSnapshot.size;

        onSnapshot(classesQuery, (classesSnapshot) => {
          const totalClasses = classesSnapshot.size;

          onSnapshot(attendanceQuery, (attendanceSnapshot) => {
            const attendanceRecords = attendanceSnapshot.docs.map(doc => doc.data());
            const totalRecords = attendanceRecords.length;
            const presentRecords = attendanceRecords.filter(record => record.status === 'present').length;
            const onTimeRecords = attendanceRecords.filter(record => record.status !== 'late').length;

            setStats({
              totalStudents,
              totalClasses,
              attendanceRate: totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0,
              onTimeRate: totalRecords > 0 ? (onTimeRecords / totalRecords) * 100 : 0,
            });
            setLoading(false);
          });
        });
      });

      return () => {
        unsubscribeStats();
      };
    };

    fetchStats();
    return () => {
      clearInterval(timer);
      unsubscribeInstructor();
      unsubscribeStudents();
      unsubscribeAttendance();
    };
  }, [currentUser, navigate, selectedSection]);

  const getClassStatus = useMemo(() => {
    if (!instructorData?.schedules || !instructorData.schedules.length) {
      return 'No Schedule';
    }
    
  
    const currentTime = new Date();
    const now = currentTime.getHours() * 60 + currentTime.getMinutes(); // Convert current time to minutes in 24-hour format
  
    // Find the schedule for today
    const todaySchedule = instructorData.schedules.find(schedule => 
      schedule.days.includes(
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][currentTime.getDay()]
      )
    );
  
    if (!todaySchedule) {
      return 'No Class Today';
    }
  
    // Parse start and end times in 24-hour format
    const [startHour, startMinute] = todaySchedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = todaySchedule.endTime.split(':').map(Number);
  
    const classStart = startHour * 60 + startMinute; // Convert start time to minutes
    const classEnd = endHour * 60 + endMinute; // Convert end time to minutes
  
    if (now < classStart) {
      return 'Class Not Started';
    } else if (now >= classStart && now <= classEnd) {
      return 'Class In Session';
    } else {
      return 'Class Ended';
    }
  }, [instructorData?.schedules, currentTime]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'absent':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'late':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const handleUpdateAttendance = async (studentId: string, attended: boolean) => {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        attendance: attended,
        timeIn: attended ? new Date().toLocaleTimeString() : null
      });
    } catch (error) {
      Swal.fire('Error', 'Failed to update attendance', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      Swal.fire('Logout Error', 'Failed to logout. Please try again.', 'error');
    }
  };
  

  const mainContentStyle = useMemo(() => ({
    marginLeft: isCollapsed ? '5rem' : '16rem',
    transition: 'margin-left 300ms ease-in-out',
    width: isCollapsed ? 'calc(100% - 5rem)' : 'calc(100% - 16rem)',
  }), [isCollapsed]);

  if (!instructorData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed} 

      />
      
      <div style={mainContentStyle} className="transition-all duration-300">
        <NavBar 
          currentTime={currentTime}
          instructor={instructorData}
          classStatus={getClassStatus}
        />
        
        <main className="p-6 mt-16">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-800">
                  {instructorData.schedules[0]?.roomNumber ? `Room ${instructorData.schedules[0].roomNumber}` : 'My Classroom'}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 100 }}
                    className={`px-3 py-1 rounded-full text-sm ${
                      getClassStatus === 'Class In Session' ? 'bg-green-100 text-green-800' : getClassStatus === 'Class Ended' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {getClassStatus}
                  </motion.span>
                  {instructorData.schedules[0] && (
                    <span className="text-gray-600 text-sm">
                      {instructorData.schedules[0].days.join(', ')} {instructorData.schedules[0].startTime} - {instructorData.schedules[0].endTime}
                    </span>
                  )}
                </div>
              </div>
              
              {instructorData.sections?.length > 0 && (
                <select 
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-4 py-2 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {instructorData.sections.map(section => (
                    <option key={section.id} value={section.id}>
                      Section {section.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <CalendarIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">Current Schedule</h2>
                </div>
                {instructorData.schedules[0] ? (
                  <div className="space-y-2">
                    <p className="text-gray-600">
                      <span className="font-semibold">Time:</span> {instructorData.schedules[0].startTime} - {instructorData.schedules[0].endTime}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Days:</span> {instructorData.schedules[0].days.join(', ')}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Room:</span> {instructorData.schedules[0].roomNumber}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500">No schedule assigned</p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <ClipboardIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">Assigned Subjects</h2>
                </div>
                <div className="space-y-2">
                  {instructorData.subjects?.map(subject => (
                    <motion.div
                      key={subject.id}
                      whileHover={{ scale: 1.02 }}
                      className="flex justify-between items-center p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="font-medium">{subject.code}</span>
                      <span className="text-gray-600">{subject.name}</span>
                    </motion.div>
                  ))}
                  {!instructorData.subjects?.length && (
                    <p className="text-gray-500">No subjects assigned</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <UsersIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">Class Statistics</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="text-center p-4 bg-green-50 rounded-lg"
                  >
                    <p className="text-2xl font-bold text-green-600">
                      {students.filter(s => s.attendance).length}
                    </p>
                    <p className="text-sm text-gray-600">Present</p>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="text-center p-4 bg-red-50 rounded-lg"
                  >
                    <p className="text-2xl font-bold text-red-600">
                      {students.filter(s => !s.attendance).length}
                    </p>
                    <p className="text-sm text-gray-600">Absent</p>
                  </motion.div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <UsersIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">Total Students</h2>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <CalendarIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">Total Classes</h2>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalClasses}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <ChartBarIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">Attendance Rate</h2>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate.toFixed(1)}%</p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <ClockIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">On-time Rate</h2>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.onTimeRate.toFixed(1)}%</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <ClipboardIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">Recent Attendance</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="pb-3 text-gray-600">Student</th>
                        <th className="pb-3 text-gray-600">Subject</th>
                        <th className="pb-3 text-gray-600">Date</th>
                        <th className="pb-3 text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-gray-500">
                            Loading recent activity...
                          </td>
                        </tr>
                      ) : recentAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-gray-500">
                            No recent attendance records
                          </td>
                        </tr>
                      ) : (
                        recentAttendance.map((record) => (
                          <motion.tr
                            key={record.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="border-b"
                          >
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="bg-gray-100 p-2 rounded-full">
                                  <UsersIcon className="w-5 h-5 text-gray-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{record.studentName}</p>
                                  <p className="text-sm text-gray-500">ID: {record.studentId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-gray-600">{record.subject}</td>
                            <td className="py-3 text-gray-600">{record.date}</td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(record.status)}
                                <span className={`capitalize ${
                                  record.status === 'present' ? 'text-green-600' :
                                  record.status === 'absent' ? 'text-red-600' :
                                  'text-yellow-600'
                                }`}>
                                  {record.status}
                                </span>
                              </div>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white p-6 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <ClipboardIcon className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-xl font-semibold">Student Attendance</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="pb-3 text-gray-600">Student Name</th>
                        <th className="pb-3 text-gray-600">Status</th>
                        <th className="pb-3 text-gray-600">Time In</th>
                        <th className="pb-3 text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <motion.tr
                          key={student.id}
                          whileHover={{ scale: 1.02 }}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="py-3 text-gray-800">{student.name}</td>
                          <td className="py-3">
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              student.attendance 
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {student.attendance ? 'Present' : 'Absent'}
                            </span>
                          </td>
                          <td className="py-3 text-gray-600">
                            {student.timeIn || '--:--'}
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => handleUpdateAttendance(student.id, !student.attendance)}
                              className={`px-3 py-1 rounded-lg text-sm ${
                                student.attendance 
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {student.attendance ? 'Mark Absent' : 'Mark Present'}
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
        <GeminiChatbot />
      </div>
    </div>
  );
};

const GeminiChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Replace with your actual Gemini API key
  const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || '');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
  
    // Add user message to chat
    const userMessage: Message = {
      id: generateId(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };
  
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
  
    try {
      // Fetch AI response
      const response = await fetchGeminiResponse(inputMessage);
  
      // Extract structured sections from response
      const responseSections = response.split("\n\n");
  
      const answer = responseSections[0] || "I'm sorry, but I couldn't generate an answer.";
      const reasoning = responseSections[1] || "";
      const source = responseSections[2] || "";
      const confidence = responseSections[3] || "";
  
      // Construct AI response message
      const aiMessage: Message = {
        id: generateId(),
        content: `${answer}\n\n${reasoning}\n\n${source}\n\n${confidence}`,
        sender: 'ai',
        timestamp: new Date()
      };
  
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Gemini API Error:', error);
  
      // Provide a more informative error response
      const errorMessage: Message = {
        id: generateId(),
        content: "🚨 **Error:** I encountered an issue while processing your request. Please check your input or try again later.",
        sender: 'ai',
        timestamp: new Date()
      };
  
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  

  const fetchGeminiResponse = async (query: string): Promise<string> => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(
      `You are a helpful AI assistant that can answer any questions accurately, can answer about Mark Lloyd Cuizon, Clarence Emmanuel Jamora and Jean Ricka Rosalita - Creators of Smart EcoLock. 
      They are 4rth year BS Computer Engineering Students   from CIT-U and for Smart EcoLock, addresses energy management, attendance control, and security for CIT-U's rooms and offices. 
        It uses an ESP32 microcontroller for efficient sensor handling and low power consumption. With occupancy recognition, it turns off lights and electronics 
        in unoccupied rooms, reducing energy waste. LDR sensors are used to automatically control lighting based on natural light levels in classrooms, optimizing 
        energy use. Attendance is tracked through access control data, with real-time monitoring in a unified database. Security is enhanced via RFID or biometric 
        access control, ensuring only authorized individuals enter. Weight sensors in chairs add precision to attendance tracking. A React.js website with Firebase 
        backend allows system monitoring and control. This system boosts sustainability, management efficiency, and security at CIT-U. 
        Provide complete answers, ensuring clarity and professionalism. Always include full code implementations when relevant and internet sources 
        for additional information, even if the question is unrelated to Smart EcoLock. Format responses to facilitate prompt chatbot replies.

        Respond professionally and concisely to the following query: ${query}.`
      );
      return result.response.text();
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  };

  const toggleChatbot = () => setIsOpen(!isOpen);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          >
            {/* Chatbot Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-600 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <SparklesIcon className="w-6 h-6" />
                <h2 className="text-lg font-semibold">Smart EcoLock Assistant</h2>
              </div>
              <button 
                onClick={toggleChatbot}
                className="hover:bg-indigo-700 rounded-full p-1 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Container */}
            <div className="flex-grow overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: msg.sender === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                      msg.sender === 'user' 
                        ? 'bg-indigo-100 text-indigo-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="text-center text-gray-500 italic">
                  Smart Ecolock Assistant is thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me anything..."
                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button 
                onClick={handleSendMessage}
                disabled={isLoading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chatbot Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleChatbot}
        className="bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-colors"
      >
        <ChatBubbleLeftRightIcon className="w-6 h-6" />
      </motion.button>
    </div>
  );
};

const NavBar = ({ currentTime, instructor, classStatus }: any) => {
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatTime = (date: Date) => date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <nav className="bg-white shadow-md fixed w-full z-10 ">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="text-sm">
              <div className="text-gray-500">{formatDate(currentTime)}</div>
              <div className="text-gray-800 font-semibold">{formatTime(currentTime)}</div>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">{instructor.fullName}</h1>
              <p className="text-sm text-gray-600">{instructor.department}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm ${
              classStatus === 'Class In Session' ? 'bg-green-100 text-green-800' : classStatus === 'Class Ended' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {classStatus}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default InstructorDashboard;