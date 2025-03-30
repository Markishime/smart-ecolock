import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
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
import { SparklesIcon, ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Define Interfaces
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface Schedule {
  id: string;
  day: string;
  subject: string;
  classes: { time: string; subject: string }[];
  room?: string;
  status?: 'ongoing' | 'upcoming' | 'completed';
}

interface Subject {
  id: string;
  code: string;
  name: string;
  schedules?: Schedule[];
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

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: 'present' | 'absent' | 'late';
  timestamp: number;
  section: string;
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

    // Fetch Instructor Data including schedules from assignedSubjects
    const teacherRef = doc(db, 'teachers', currentUser.uid);
    const unsubscribeTeacher = onSnapshot(teacherRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const subjects = data.assignedSubjects || []; // Assuming 'assignedSubjects' field
        const allSchedules: Schedule[] = [];

        // Fetch schedules from assigned subjects
        for (const subject of subjects) {
          const subjectSchedules = (subject.schedules || []).map((s: any) => ({
            id: `${currentUser.uid}_${subject.name}_${s.day}`,
            day: s.day,
            subject: subject.name,
            classes: [{ time: `${s.startTime} - ${s.endTime}`, subject: subject.name }],
            room: s.room,
          }));
          allSchedules.push(...subjectSchedules);
        }

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
      }
      setLoading(false);
    });

    // Fetch Total Students under the current instructor
    const studentsQuery = query(collection(db, 'students'), where('teacherId', '==', currentUser.uid));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setTotalStudents(snapshot.size);
    });

    // Fetch Attendance Rate based on section
    const attendanceQuery = query(collection(db, 'attendance'), where('teacherId', '==', currentUser.uid));
    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data() as AttendanceRecord);
      const totalRecords = records.length;
      const presentRecords = records.filter(r => r.status === 'present').length;
      setAttendanceRate(totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0);
    });

    // Fetch Active Classes from teachers db
    const fetchActiveClasses = () => {
      const now = new Date();
      const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false });
      const [currentHour, currentMinute] = currentTimeStr.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMinute;

      const active = instructorData?.schedules.filter(s => {
        const [startTime, endTime] = s.classes[0].time.split(' - ');
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      }).length || 0;

      setActiveClasses(active);
    };

    // Fetch Room Usage from rooms db
    const roomsRef = ref(rtdb, 'rooms');
    const unsubscribeRooms = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const totalRooms = Object.keys(data).length;
        const occupiedRooms = Object.values(data).filter((r: any) => r.occupancy).length;
        setRoomUsage(totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0);
        setRoomOccupancy(Object.entries(data)
          .filter(([_, room]: [string, any]) => room.occupancy)
          .map(([roomId, room]: [string, any]) => ({ roomId, occupancy: room.occupancy })));
      }
    });

    fetchActiveClasses();
    const interval = setInterval(fetchActiveClasses, 60000); // Update every minute

    return () => {
      clearInterval(timer);
      clearInterval(interval);
      unsubscribeTeacher();
      unsubscribeStudents();
      unsubscribeAttendance();
      unsubscribeRooms();
    };
  }, [currentUser, navigate, instructorData?.schedules]);

  const todaySchedule = useMemo(() => {
    const today = currentTime.toLocaleString('en-US', { weekday: 'short' });
    return instructorData?.schedules
      .filter(s => s.day.toLowerCase().startsWith(today.toLowerCase()))
      .sort((a, b) => a.classes[0].time.localeCompare(b.classes[0].time)) || [];
  }, [instructorData?.schedules, currentTime]);

  const weeklySchedule = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      schedules: instructorData?.schedules.filter(s => s.day.toLowerCase().startsWith(day.toLowerCase())) || [],
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
        <div className="w-16 h-16 border-t-4 border-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!instructorData) {
    return <div className="text-center p-8 text-gray-700">No instructor data available</div>;
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

      <main className="container mx-auto px-6 py-10 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Welcome Section */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-gray-100/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Welcome, {instructorData.fullName.split(' ')[0]}!
                  </h1>
                  <p className="text-gray-600 mt-2 text-lg">{instructorData.department} | {instructorData.email}</p>
                </div>
                <div className={`px-6 py-3 rounded-full ${scheduleStatus.color} font-semibold shadow-md transform transition-transform hover:scale-105`}>
                  <span className="text-lg">{scheduleStatus.status}</span>
                  {scheduleStatus.details && (
                    <span className="block text-sm opacity-80">{scheduleStatus.details}</span>
                  )}
                </div>
              </div>

              {/* Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                {[
                  { title: 'Total Students', value: totalStudents, icon: <UsersIcon className="h-8 w-8 text-teal-500" />, color: 'bg-teal-50' },
                  { title: 'Attendance Rate', value: `${attendanceRate.toFixed(1)}%`, icon: <CheckCircleIcon className="h-8 w-8 text-green-500" />, color: 'bg-green-50' },
                  { title: 'Active Classes', value: activeClasses, icon: <BookOpenIcon className="h-8 w-8 text-indigo-500" />, color: 'bg-indigo-50' },
                  { title: 'Room Usage', value: `${roomUsage.toFixed(1)}%`, icon: <MapPinIcon className="h-8 w-8 text-purple-500" />, color: 'bg-purple-50' },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    className={`${stat.color} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">{stat.title}</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                      </div>
                      <div className="p-3 bg-white/50 rounded-full">{stat.icon}</div>
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
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-gray-100/50"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <CalendarIcon className="h-6 w-6 text-indigo-600 mr-2" />
                Today's Schedule
              </h2>
              {todaySchedule.length > 0 ? (
                todaySchedule.map((schedule, index) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    className="flex items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl mb-4 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <BookOpenIcon className="h-8 w-8 text-indigo-600 mr-4" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-lg">{schedule.subject}</p>
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <ClockIcon className="h-5 w-5 mr-2" />
                        {schedule.classes[0].time}
                        {schedule.room && (
                          <>
                            <MapPinIcon className="h-5 w-5 ml-4 mr-2" />
                            {schedule.room}
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-600 text-center py-4">No classes scheduled for today</p>
              )}
            </motion.section>

            {/* Weekly Schedule */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-gray-100/50"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <CalendarIcon className="h-6 w-6 text-indigo-600 mr-2" />
                Weekly Schedule
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {weeklySchedule.map(({ day, schedules }) => (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    <p className="font-semibold text-indigo-800 text-lg mb-4">{day}</p>
                    {schedules.length > 0 ? (
                      schedules.map(s => (
                        <div key={s.id} className="mb-3">
                          <p className="text-sm font-medium text-gray-900">{s.subject}</p>
                          <p className="text-xs text-gray-600 flex items-center mt-1">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            {s.classes[0].time}
                            {s.room && (
                              <>
                                <MapPinIcon className="h-4 w-4 ml-2 mr-1" />
                                {s.room}
                              </>
                            )}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No classes</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            {/* Room Occupancy */}
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-gray-100/50"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <MapPinIcon className="h-6 w-6 text-indigo-600 mr-2" />
                Room Occupancy
              </h2>
              {roomOccupancy.length > 0 ? (
                roomOccupancy.map((room, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    className="flex items-center p-3 bg-gradient-to-r from-gray-50 to-white rounded-xl mb-3 shadow-sm"
                  >
                    <MapPinIcon className="h-6 w-6 text-indigo-600 mr-3" />
                    <p className="text-sm font-medium text-gray-900">Room {room.roomId}: Occupied</p>
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-600 text-center py-4">No rooms currently occupied</p>
              )}
            </motion.section>

            {/* Quick Actions */}
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-gray-100/50"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <ClipboardDocumentCheckIcon className="h-6 w-6 text-indigo-600 mr-2" />
                Quick Actions
              </h2>
              <Link
                to="/instructor/take-attendance"
                className="w-full flex items-center justify-center p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300"
              >
                <ClipboardDocumentCheckIcon className="h-6 w-6 mr-3" />
                Take Attendance
              </Link>
            </motion.section>
          </div>
        </div>
      </main>

      <GeminiChatbot />
    </div>
  );
};

const GeminiChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAuth();

  const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API || '');

  const fetchGeminiResponse = async (query: string): Promise<string> => {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `You are a helpful AI assistant for ${currentUser?.fullName || 'a user'} at Cebu Institute of Technology - University. Respond to: ${query}`;
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Error generating response:', error);
      return 'Sorry, I encountered an error. Please try again.';
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), content: input, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const aiResponse = await fetchGeminiResponse(input);
    const aiMessage: Message = { id: (Date.now() + 1).toString(), content: aiResponse, sender: 'ai', timestamp: new Date() };
    setMessages(prev => [...prev, aiMessage]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transform transition-all duration-300 scale-100">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <SparklesIcon className="w-6 h-6" />
              <h2 className="text-lg font-semibold">Smart EcoLock Assistant</h2>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-700 rounded-full p-1 transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl shadow-sm ${msg.sender === 'user' ? 'bg-indigo-100 text-indigo-800' : 'bg-white text-gray-800'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-200 flex space-x-2 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask me anything..."
              className="flex-grow px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300"
            />
            <button onClick={handleSendMessage} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-full hover:from-indigo-600 hover:to-purple-700 transition-all duration-300">
              Send
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setIsOpen(!isOpen)} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300">
        <ChatBubbleLeftRightIcon className="w-6 h-6" />
      </button>
    </div>
  );
};

export default InstructorDashboard;