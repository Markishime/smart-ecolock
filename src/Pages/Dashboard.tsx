import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { auth, db, rtdb } from '../firebase';
import { useAuth } from './AuthContext';
import {
  BookOpenIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import NavBar from '../components/NavBar';
import Swal from 'sweetalert2';
import {
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon as SolidClipboard,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from '../types';

interface Schedule {
  id: string;
  day: string;
  subject: string;
  classes: { time: string; subject: string }[];
  room?: string;
  status?: 'ongoing' | 'upcoming' | 'completed';
}

interface Section {
  capacity: number;
  code: string;
  currentEnrollment: number;
  id: string;
  name: string;
  schedules: { day: string; startTime: string; endTime: string; roomName?: string }[];
}

interface Subject {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
  details: string;
  learningObjectives: string[];
  prerequisites: string[];
  sections: Section[];
}

interface InstructorData {
  id: string;
  fullName: string;
  email: string;
  department: string;
  schedules: Schedule[];
  subjects: Subject[];
  assignedStudents: string[];
}

interface RoomStatus {
  occupancy: boolean;
  roomId: string;
}

const travelThemeColors = {
  primary: 'from-teal-500 to-emerald-600',
  background: 'from-teal-50 via-sky-50 to-emerald-50',
  accent: 'from-indigo-500 to-purple-600',
};

const getScheduleStatus = (schedules: Schedule[], currentDay: string, currentTime: string) => {
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  const todaySchedules = schedules.filter((s) => s.day.toLowerCase().startsWith(currentDay.toLowerCase()));
  if (!todaySchedules.length) {
    return { status: 'No Classes Today', color: 'bg-gray-100 text-gray-800', details: '' };
  }

  for (const schedule of todaySchedules) {
    const [startTime, endTime] = schedule.classes[0].time.split(' - ');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return {
        status: 'In Class',
        color: 'bg-green-100 text-green-800',
        details: `${schedule.subject} until ${endTime}`,
      };
    }
    if (currentMinutes < startMinutes) {
      const minutesUntil = startMinutes - currentMinutes;
      const hours = Math.floor(minutesUntil / 60);
      const minutes = minutesUntil % 60;
      return {
        status: 'Next Class',
        color: 'bg-indigo-100 text-indigo-800',
        details: `${schedule.subject} in ${hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}`,
      };
    }
  }
  return { status: 'Classes Finished', color: 'bg-gray-100 text-gray-800', details: 'All done for today' };
};

const InstructorDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [instructorData, setInstructorData] = useState<InstructorData | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [activeClasses, setActiveClasses] = useState(0);
  const [roomUsage, setRoomUsage] = useState(0);
  const [roomOccupancy, setRoomOccupancy] = useState<RoomStatus[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Fetch Instructor Data from Firestore 'teachers' collection
    const teacherRef = doc(db, 'teachers', currentUser.uid);
    const unsubscribeTeacher = onSnapshot(
      teacherRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const subjects: Subject[] = data.assignedSubjects || [];
          const allSchedules: Schedule[] = [];

          // Extract schedules from sections within assignedSubjects
          subjects.forEach((subject: Subject) => {
            if (subject.sections && Array.isArray(subject.sections)) {
              subject.sections.forEach((section) => {
                if (section.schedules && Array.isArray(section.schedules)) {
                  const sectionSchedules = section.schedules.map((s, index) => ({
                    id: `${currentUser.uid}_${subject.name}_${section.code}_${s.day}_${index}`,
                    day: s.day,
                    subject: subject.name,
                    classes: [{ time: `${s.startTime} - ${s.endTime}`, subject: subject.name }],
                    room: s.roomName,
                  }));
                  allSchedules.push(...sectionSchedules);
                }
              });
            }
          });

          setInstructorData({
            id: currentUser.uid,
            fullName: data.fullName || 'Instructor',
            email: data.email || '',
            department: data.department || 'N/A',
            schedules: allSchedules,
            subjects,
            assignedStudents: data.assignedStudents || [],
          });
        } else {
          Swal.fire('Error', 'Instructor data not found', 'error');
          setInstructorData(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching instructor data:', error);
        Swal.fire('Error', 'Failed to load instructor data', 'error');
        setLoading(false);
      }
    );

    // Fetch Total Students
    const studentsQuery = query(collection(db, 'students'), where('teacherId', '==', currentUser.uid));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setTotalStudents(snapshot.size);
    });

    // Fetch Attendance Rate
    const attendanceQuery = query(collection(db, 'attendance'), where('teacherId', '==', currentUser.uid));
    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const records = snapshot.docs.map((doc) => doc.data() as any);
      const totalRecords = records.length;
      const presentRecords = records.filter((r) => r.status === 'present').length;
      setAttendanceRate(totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0);
    });

    // Fetch Active Classes
    const fetchActiveClasses = () => {
      const now = new Date();
      const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false });
      const [currentHour, currentMinute] = currentTimeStr.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMinute;

      const active = instructorData?.schedules.filter((s) => {
        const [startTime, endTime] = s.classes[0].time.split(' - ');
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      }).length || 0;

      setActiveClasses(active);
    };

    // Fetch Room Usage from Realtime Database 'rooms'
    const roomsRef = ref(rtdb, 'rooms');
    const unsubscribeRooms = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const totalRooms = Object.keys(data).length;
        const occupiedRooms = Object.values(data).filter((r: any) => r.occupancy).length;
        setRoomUsage(totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0);
        setRoomOccupancy(
          Object.entries(data)
            .filter(([_, room]: [string, any]) => room.occupancy)
            .map(([roomId, room]: [string, any]) => ({ roomId, occupancy: room.occupancy }))
        );
      }
    });

    fetchActiveClasses();
    const interval = setInterval(fetchActiveClasses, 60000);

    return () => {
      clearInterval(timer);
      clearInterval(interval);
      unsubscribeTeacher();
      unsubscribeStudents();
      unsubscribeAttendance();
      off(roomsRef);
    };
  }, [currentUser, navigate, instructorData?.schedules]);

  const todaySchedule = useMemo(() => {
    const today = currentTime.toLocaleString('en-US', { weekday: 'short' }); // e.g., "Wed"
    return (
      instructorData?.schedules
        .filter((s) => s.day.toLowerCase().startsWith(today.toLowerCase()))
        .sort((a, b) => a.classes[0].time.localeCompare(b.classes[0].time)) || []
    );
  }, [instructorData?.schedules, currentTime]);

  const weeklySchedule = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day) => ({
      day,
      schedules: instructorData?.schedules.filter((s) => s.day.toLowerCase().startsWith(day.toLowerCase())) || [],
    }));
  }, [instructorData?.schedules]);

  const scheduleStatus = useMemo(() => {
    return getScheduleStatus(
      instructorData?.schedules || [],
      currentTime.toLocaleString('en-US', { weekday: 'short' }),
      currentTime.toLocaleTimeString('en-US', { hour12: false })
    );
  }, [instructorData?.schedules, currentTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-teal-50 to-emerald-50">
        <div className="w-12 h-12 sm:w-16 sm:h-16 border-t-4 border-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!instructorData) {
    return <div className="text-center p-6 sm:p-8 text-gray-700 text-base sm:text-lg">No instructor data available</div>;
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${travelThemeColors.background}`}>
      <NavBar
        currentTime={currentTime}
        classStatus={{
          status: scheduleStatus.status,
          color: scheduleStatus.color,
          details: scheduleStatus.details,
          fullName: instructorData.fullName,
        }}
        user={{
          role: 'instructor',
          fullName: instructorData.fullName,
          department: instructorData.department,
        }}
      />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            {/* Welcome Section */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-gray-100/50"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Welcome, {instructorData.fullName.split(' ')[0]}!
                  </h1>
                  <p className="text-gray-600 mt-2 text-sm sm:text-lg">
                    {instructorData.department} | {instructorData.email}
                  </p>
                </div>
                <div
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full ${scheduleStatus.color} font-semibold shadow-md transform transition-transform hover:scale-105 text-sm sm:text-base`}
                >
                  <span>{scheduleStatus.status}</span>
                  {scheduleStatus.details && (
                    <span className="block text-xs sm:text-sm opacity-80">{scheduleStatus.details}</span>
                  )}
                </div>
              </div>

              {/* Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-6 sm:mt-8">
                {[
                  {
                    title: 'Total Students',
                    value: totalStudents,
                    icon: <UsersIcon className="h-6 w-6 sm:h-8 sm:w-8 text-teal-500" />,
                    color: 'bg-teal-50',
                  },
                  {
                    title: 'Attendance Rate',
                    value: `${attendanceRate.toFixed(1)}%`,
                    icon: <CheckCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />,
                    color: 'bg-green-50',
                  },
                  {
                    title: 'Active Classes',
                    value: activeClasses,
                    icon: <BookOpenIcon className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-500" />,
                    color: 'bg-indigo-50',
                  },
                  {
                    title: 'Room Usage',
                    value: `${roomUsage.toFixed(1)}%`,
                    icon: <MapPinIcon className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />,
                    color: 'bg-purple-50',
                  },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    className={`${stat.color} rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-md sm:shadow-lg hover:shadow-xl transition-all duration-300`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{stat.title}</p>
                        <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                      </div>
                      <div className="p-2 sm:p-3 bg-white/50 rounded-full">{stat.icon}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            {/* Today's Schedule */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-gray-100/50"
            >
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center">
                <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 mr-2" />
                Today's Schedule
              </h2>
              {todaySchedule.length > 0 ? (
                todaySchedule.map((schedule, index) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    className="flex items-center p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg sm:rounded-xl mb-3 sm:mb-4 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <BookOpenIcon className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 mr-3 sm:mr-4" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-base sm:text-lg">{schedule.subject}</p>
                      <div className="flex flex-wrap items-center text-xs sm:text-sm text-gray-600 mt-1 gap-2 sm:gap-4">
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                          {schedule.classes[0].time}
                        </div>
                        {schedule.room && (
                          <div className="flex items-center">
                            <MapPinIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                            {schedule.room}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-600 text-center py-4 text-sm sm:text-base">No classes scheduled for today</p>
              )}
            </motion.section>

            {/* Weekly Schedule */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-gray-100/50"
            >
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center">
                <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 mr-2" />
                Weekly Schedule
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {weeklySchedule.map(({ day, schedules }) => (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="p-4 sm:p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg sm:rounded-2xl shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    <p className="font-semibold text-indigo-800 text-base sm:text-lg mb-3 sm:mb-4">{day}</p>
                    {schedules.length > 0 ? (
                      schedules.map((s) => (
                        <div key={s.id} className="mb-2 sm:mb-3">
                          <p className="text-xs sm:text-sm font-medium text-gray-900">{s.subject}</p>
                          <p className="text-xs text-gray-600 flex flex-wrap items-center mt-1 gap-2">
                            <span className="flex items-center">
                              <ClockIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              {s.classes[0].time}
                            </span>
                            {s.room && (
                              <span className="flex items-center">
                                <MapPinIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                {s.room}
                              </span>
                            )}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs sm:text-sm text-gray-500 italic">No classes</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6 sm:space-y-8">
            {/* Quick Actions */}
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-gray-100/50"
            >
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center">
                <SolidClipboard className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 mr-2" />
                Quick Actions
              </h2>
              <Link
                to="/instructor/take-attendance"
                className="w-full flex items-center justify-center p-3 sm:p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg sm:rounded-2xl shadow-md sm:shadow-lg hover:shadow-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 text-sm sm:text-base"
              >
                <ClipboardDocumentCheckIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
                Take Attendance
              </Link>
            </motion.section>
          </div>
        </div>
        <GeminiChatbot />
      </main>
    </div>
  );
};

const GeminiChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const { currentUser } = useAuth();

  // Initialize Gemini with API key
  const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API || '');

  const fetchGeminiResponse = async (query: string): Promise<string> => {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Add context about the user
      const prompt = `You are a helpful AI assistant that can answer any questions accurately, including about Mark Lloyd Cuizon, Clarence Emmanuel Jamora, and Jean Ricka Rosalita - Creators of Smart EcoLock.

They are 4th-year BS Computer Engineering students from Cebu Institute of Technology - University (CIT-U). Their project, Smart EcoLock, addresses energy management, attendance control, and security for CIT-U's rooms and offices.

Smart EcoLock utilizes an ESP32 microcontroller for efficient sensor handling and low power consumption, leveraging its dual-core architecture and built-in Wi-Fi capabilities. With occupancy recognition, it detects room usage through a combination of PZEM for power monitoring and weight sensors, automatically turning off lights and electronics in unoccupied rooms to reduce energy waste. LDR (Light-Dependent Resistor) sensors measure ambient light levels, adjusting classroom lighting dynamically to optimize energy use based on natural daylight availability.

Attendance tracking is achieved through a multi-layered approach. Access control data from RFID (Radio-Frequency Identification) tags ensures only authorized individuals enter, logging entry times into a unified database. Additionally, weight sensors embedded in chairs provide precise occupancy detection by measuring the presence of individuals (e.g., detecting weights above a threshold like 20 kg to confirm a person is seated). This data cross-references RFID logs to validate attendance, reducing errors from manual tracking or proxy entries. The system uploads real-time updates to a Firebase Realtime Database, enabling administrators to monitor occupancy and attendance seamlessly.

Security is enhanced via RFID authentication, restricting access to authorized personnel and students, while weight sensors add an extra layer of verification by confirming physical presence. The system features a React.js website with a Firebase backend, offering an intuitive interface for monitoring room status, controlling devices, and generating attendance reports.

This system boosts sustainability by minimizing energy consumption, improves management efficiency with automated tracking, and enhances security at CIT-U through integrated technology.

Provide complete answers, ensuring clarity and professionalism. Always include full code implementations when relevant and internet sources for additional information, even if the question is unrelated to Smart EcoLock. Format responses to facilitate prompt chatbot replies. As an AI assistant helping ${
        currentUser?.fullName || 'a user'
      } who is an ${currentUser?.role || 'user'} at the institution, respond professionally and concisely to the following query: ${query}.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating response:', error);
      return 'Sorry, I encountered an error. Please try again.';
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage: Message = {
      id: generateId(),
      content: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      // Fetch AI response
      const aiResponse = await fetchGeminiResponse(input);

      // Construct AI response message
      const aiMessage: Message = {
        id: generateId(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Gemini API Error:', error);

      // Provide a more informative error response
      const errorMessage: Message = {
        id: generateId(),
        content:
          "🚨 **Error:** I encountered an issue while processing your request. Please check your input or try again later.",
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const toggleChatbot = () => setIsOpen(!isOpen);

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
      <div>
        {isOpen && (
          <div className="w-full max-w-[90vw] sm:w-80 md:w-96 h-[400px] sm:h-[500px] bg-white rounded-lg sm:rounded-2xl shadow-xl sm:shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
            {/* Chatbot Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-600 text-white p-3 sm:p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                <h2 className="text-base sm:text-lg font-semibold">Smart EcoLock Assistant</h2>
              </div>
              <button
                onClick={toggleChatbot}
                className="hover:bg-indigo-700 rounded-full p-1 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Messages Container */}
            <div className="flex-grow overflow-y-auto p-3 sm:p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg sm:rounded-2xl text-xs sm:text-sm ${
                      msg.sender === 'user' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 sm:p-4 border-t border-gray-200 flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me anything..."
                className="flex-grow px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm"
              />
              <button
                onClick={handleSendMessage}
                className="bg-indigo-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-xs sm:text-sm"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chatbot Trigger Button */}
      <button
        onClick={toggleChatbot}
        className="bg-indigo-600 text-white p-3 sm:p-4 rounded-full shadow-xl sm:shadow-2xl hover:bg-indigo-700 transition-colors"
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
    </div>
  );
};

export default InstructorDashboard;