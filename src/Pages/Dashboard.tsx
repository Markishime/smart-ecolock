import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, onValue, off, Database, DataSnapshot } from 'firebase/database';
import { auth, db, rtdb } from '../firebase';
import { useAuth } from './AuthContext';
import { signOut } from 'firebase/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  BookOpenIcon, 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { 
  UserGroupIcon, 
  AcademicCapIcon, 
  ArrowDownIcon,
  ArrowUpIcon,
  MinusIcon
} from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import NavBar from '../components/NavBar';
import {
  LockClosedIcon,
  UserIcon,
  HomeIcon,
  UsersIcon,
  CogIcon,
  ArrowLeftEndOnRectangleIcon,
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  ClipboardDocumentCheckIcon,
  BookmarkIcon,
  ChartBarIcon,
  XMarkIcon,
  ClipboardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ViewfinderCircleIcon,
  PlusIcon,
  DocumentCheckIcon,
  QuestionMarkCircleIcon,
  GlobeAltIcon,
  MapIcon,
  RocketLaunchIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import { Student } from '../interfaces/Student';
import Modal from '../components/Modal';


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
  timestamp?: number;
}

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  code: string;
  studentCount?: number;
}

interface TeacherDocument {
  uid?: string;
  fullName?: string;
  email?: string;
  department?: string;
  schedules?: {
    subject: string;
    day: string;
    startTime: string;
    endTime: string;
    room?: string;
  }[];
  subjects?: Subject[];
  assignedStudents?: string[];
}

interface TeacherData {
  id: string;
  fullName?: string;
  name?: string;
  email?: string;
  department?: string;
  instructor?: string;
  schedules?: {
    subject: string;
    day: string;
    startTime: string;
    endTime: string;
    room?: string;
    section?: string;
  }[];
  subjects?: Subject[];
  assignedStudents?: string[];
}

interface InstructorData {
  id: string;
  fullName: string;
  email: string;
  department: string;
  schedules: Schedule[];
  sections: Section[];
  subjects: Subject[];
  teacherData: {
    assignedStudents: string[];
  };
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  name: string;
  status: 'present' | 'absent' | 'late';
  timestamp: number;
  sectionId: string;
  subject: string;
}

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  attendanceRate: number;
  onTimeRate: number;
}

interface AccessLog {
  id: string;
  timestamp: Date | string;
  type: string;
  room: string;
  userId: string;
  status: string;
  location?: string;
  deviceId?: string;
}

interface ClassTime {
  time: string;
  duration?: number;
}

interface TeacherSchedule {
  id: string;
  teacherId: string;
  subject: string;
  day: string;
  room?: string;
  classes: ClassTime[];
  section?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProcessedSchedule extends TeacherSchedule {
  timestamp: number;
  status: 'ongoing' | 'upcoming' | 'completed';
}

interface ScheduleStatus {
  status: string;
  color: string;
  details: string;
  fullName: string;
}

interface AttendanceManagement {
  id: string;
  studentId: string;
  studentName: string;
  section: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  timeIn?: string;
  timeOut?: string;
  notes?: string;
}

interface DetailedSchedule {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  room: string;
  section: string;
  courseCode: string;
  students: number;
  isActive: boolean;
}

interface RoomStatus {
  lights: boolean;
  ac: boolean;
  temperature: number;
  humidity: number;
  occupancy: boolean;
  energyUsage: number;
}

const travelThemeColors = {
  primary: 'from-teal-500 to-emerald-600',
  secondary: 'from-sky-400 to-blue-500',
  accent: 'from-amber-400 to-orange-500',
  background: 'from-teal-50 via-sky-50 to-emerald-50'
};

const getClassStatus = (scheduleTime: Date, duration: number = 60): 'ongoing' | 'upcoming' | 'completed' => {
  const now = new Date();
  const endTime = new Date(scheduleTime.getTime() + duration * 60000);
  
  if (now >= scheduleTime && now <= endTime) {
    return 'ongoing';
  } else if (now < scheduleTime) {
    return 'upcoming';
  } else {
    return 'completed';
  }
};

const getScheduleStatus = (instructorData: any | null, currentDay: string): ScheduleStatus => {
  // Return default status if instructorData is null or schedules is undefined
  if (!instructorData || !instructorData.schedules) {
    return {
      status: 'Loading...',
      color: 'bg-gray-100 text-gray-600',
      details: 'Fetching schedule information',
      fullName: 'Instructor'
    };
  }

  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false });
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;
  
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Sort schedules by day and time
  const sortedSchedules = [...instructorData.schedules].sort((a, b) => {
    const dayA = weekdays.indexOf(a.day.substring(0, 3));
    const dayB = weekdays.indexOf(b.day.substring(0, 3));
    if (dayA === dayB) {
      const timeA = a.classes[0].time.split(' - ')[0];
      const timeB = b.classes[0].time.split(' - ')[0];
      return timeA.localeCompare(timeB);
    }
    return dayA - dayB;
  });

  // Check today's remaining classes first
  const todaySchedules = sortedSchedules.filter(schedule => 
    schedule.day.substring(0, 3) === currentDay
  );

  if (todaySchedules.length === 0) {
    // Find next scheduled class
    const nextSchedule = sortedSchedules.find(schedule => {
      const dayIndex = weekdays.indexOf(schedule.day.substring(0, 3));
      const currentDayIndex = weekdays.indexOf(currentDay);
      return dayIndex > currentDayIndex;
    });

    return {
      status: 'No Classes Today',
      color: 'bg-gray-100 text-gray-800',
      details: nextSchedule 
        ? `Next: ${nextSchedule.day} ${nextSchedule.classes[0].time}`
        : 'No upcoming classes',
      fullName: instructorData?.fullName || 'Instructor'
    };
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
        fullName: instructorData?.fullName || 'Instructor'
      };
    }
    
    if (currentMinutes < startMinutes) {
      const minutesUntilClass = startMinutes - currentMinutes;
      const hours = Math.floor(minutesUntilClass / 60);
      const minutes = minutesUntilClass % 60;
      const timeUntilClass = hours > 0 
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;
      
      return {
        status: 'Next Class',
        color: 'bg-indigo-100 text-indigo-800',
        details: `${schedule.subject} in ${timeUntilClass}`,
        fullName: instructorData?.fullName || 'Instructor'
      };
    }
  }

  // If we've gone through all classes and none are current or upcoming
  return {
    status: 'Classes Finished',
    color: 'bg-gray-100 text-gray-800',
    details: 'All classes completed for today',
    fullName: instructorData?.fullName || 'Instructor'
  };
};

const processSchedules = (schedules: any[]) => {
  return schedules.map(schedule => ({
    id: schedule.id,
    subject: schedule.subject,
    room: schedule.room || 'TBA',
    timestamp: new Date(schedule.timestamp).getTime(),
    status: getClassStatus(new Date(schedule.timestamp)),
    teacherId: schedule.teacherId,
    day: new Date(schedule.timestamp).toLocaleString('en-US', { weekday: 'short' }),
    classes: schedule.classes?.map((cls: any) => ({
      time: cls.time || 'No time available',
      students: cls.students || 0
    })) || []
  }));
};

const InstructorDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [instructorData, setInstructorData] = useState<InstructorData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [lastAccess, setLastAccess] = useState<string | null>(null);
  const [currentDaySchedule, setCurrentDaySchedule] = useState<ProcessedSchedule[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClasses: 0,
    attendanceRate: 0,
    onTimeRate: 0
  });
  const [roomStatus, setRoomStatus] = useState<{[key: string]: RoomStatus}>({});
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [newSection, setNewSection] = useState({
    name: '',
    code: '',
    subject: ''
  });

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
      // Delete the subject document from the subjects collection
      await deleteDoc(doc(db, 'subjects', subjectId));
      Swal.fire('Success', 'Subject deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting subject:', error);
      Swal.fire('Error', 'Failed to delete subject', 'error');
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const fetchInstructorDetails = async () => {
      if (!currentUser) return;

      try {
        // Fetch directly from teachers collection using currentUser.uid
        const teacherRef = doc(db, 'teachers', currentUser.uid);
        const teacherDoc = await getDocs(query(collection(db, 'teachers'), where('uid', '==', currentUser.uid)));
        
        let teacherData: TeacherDocument = {};
        if (!teacherDoc.empty) {
          teacherData = teacherDoc.docs[0].data() as TeacherDocument;
        } else {
          // Try to get the document directly
          const directDoc = await getDocs(collection(db, 'teachers'));
          const foundDoc = directDoc.docs.find(doc => doc.id === currentUser.uid || doc.data().uid === currentUser.uid);
          if (foundDoc) {
            teacherData = foundDoc.data() as TeacherDocument;
          }
        }

        // Transform schedules to match Schedule interface
        const fetchedSchedules: Schedule[] = (teacherData.schedules || []).map((schedule) => ({
          id: `${currentUser.uid}_${schedule.subject}_${schedule.day}`,
          day: schedule.day,
          subject: schedule.subject,
          classes: [
            {
              time: `${schedule.startTime} - ${schedule.endTime}`,
              subject: schedule.subject
            }
          ],
          room: schedule.room
        }));

        // Update instructor data
        setInstructorData(prevData => ({
          ...(prevData || {}),
          id: currentUser.uid,
          fullName: teacherData.fullName || 'Instructor',
          email: teacherData.email || '',
          department: teacherData.department || 'Department',
          schedules: fetchedSchedules,
          subjects: teacherData.subjects || [],
          sections: prevData?.sections || [],
          teacherData: {
            assignedStudents: teacherData.assignedStudents || []
          }
        } as InstructorData));

        // Set initial section if not already set
        if (fetchedSchedules.length > 0 && !selectedSection) {
          const firstValidSection = fetchedSchedules.find(schedule => schedule.subject)?.subject;
          if (firstValidSection) {
            setSelectedSection(firstValidSection);
          } else if (fetchedSchedules[0].subject) {
            // Fallback to the first schedule's section if it exists
            setSelectedSection(fetchedSchedules[0].subject);
          }
        }
      } catch (error) {
        console.error('Error fetching instructor details:', error);
      }
    };

    fetchInstructorDetails();

    const unsubscribeStudents = onSnapshot(
      query(collection(db, 'students'),
      where('section', '==', selectedSection)),
      (snapshot) => {
        const studentsList = snapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().fullName || doc.data().name || '',
          idNumber: doc.data().idNumber || '',
          email: doc.data().email || '',
          department: doc.data().department || '',
          section: doc.data().section || '',
          major: doc.data().major || '',
          yearLevel: doc.data().yearLevel || '',
          grades: doc.data().grades || [],
          createdAt: doc.data().createdAt || new Date(),
          attendance: doc.data().attendance || false,
          timeIn: doc.data().timeIn || null,
          lastAttendance: doc.data().attendanceHistory?.[0] || null,
          year: doc.data().yearLevel || '',
          ...doc.data()
        })) as unknown as Student[];
        setStudents(studentsList);
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

            setDashboardStats({
              totalStudents,
              totalClasses,
              attendanceRate: totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0,
              onTimeRate: totalRecords > 0 ? (onTimeRecords / totalRecords) * 100 : 0
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
      unsubscribeStudents();
      unsubscribeAttendance();
    };
  }, [currentUser, navigate, selectedSection]);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch Students
    const fetchStudents = () => {
      const studentsRef = collection(db, 'students');
      const studentsQuery = query(
        studentsRef,
        where('teacherId', '==', currentUser.uid)
      );

      const unsubscribe = onSnapshot(studentsQuery, (snapshot) => {
        const studentsList = snapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().name || '',
          idNumber: doc.data().idNumber || '',
          email: doc.data().email || '',
          department: doc.data().department || '',
          section: doc.data().section || '',
          major: doc.data().major || '',
          yearLevel: doc.data().yearLevel || '',
          grades: doc.data().grades || [],
          createdAt: doc.data().createdAt || new Date(),
          attendance: doc.data().attendance || false,
          timeIn: doc.data().timeIn,
          lastAttendance: doc.data().attendanceHistory?.[0] || null,
          year: doc.data().yearLevel || '',
          ...doc.data()
        })) as unknown as Student[];
        setStudents(studentsList);
      });

      return unsubscribe;
    };

    // Fetch Sections
    const fetchSections = () => {
      const sectionsRef = collection(db, 'sections');
      const sectionsQuery = query(
        sectionsRef,
        where('teacherId', '==', currentUser.uid)
      );

      const unsubscribe = onSnapshot(sectionsQuery, (snapshot) => {
        const sectionsList = snapshot.docs.map(doc => ({
        id: doc.id,
          name: doc.data().name || '',
          code: doc.data().code || '',
          studentCount: doc.data().students?.length || 0,
          ...doc.data()
        })) as Section[];
        setInstructorData(prev => ({
          ...prev!,
          sections: sectionsList
        }));
      });

      return unsubscribe;
    };

    // Calculate Attendance Statistics
    const calculateStats = (students: Student[]) => {
      const total = students.length;
      const present = students.filter(s => s.status === 'present').length;
      const late = students.filter(s => s.status === 'late').length;
      const absent = total - present - late;
            
            return {
        presentPercentage: ((present / total) * 100).toFixed(1),
        latePercentage: ((late / total) * 100).toFixed(1),
        absentPercentage: ((absent / total) * 100).toFixed(1),
        totalStudents: total
      };
    };

    const unsubscribeStudents = fetchStudents();
    const unsubscribeSections = fetchSections();

    return () => {
      unsubscribeStudents();
      unsubscribeSections();
    };
  }, [currentUser]);

  const getTimeRemaining = (scheduleTime: number) => {
    const now = new Date().getTime();
    const diff = scheduleTime - now;
    
    if (diff <= 0) return '';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      return `in ${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `in ${hours}h ${remainingMinutes}m`;
  };

  const getSectionColor = (section: string) => {
    const colors: { [key: string]: string } = {
      'default': 'bg-indigo-50 border-indigo-500',
      'subjects': 'bg-green-50 border-green-500',
      'schedules': 'bg-blue-50 border-blue-500',
      'attendance': 'bg-purple-50 border-purple-500'
    };
    return colors[section] || colors['default'];
  };

  const getColor = (subject: string) => {
    switch (subject) {
      case 'Math': return 'bg-blue-200';
      case 'Science': return 'bg-green-200';
      case 'English': return 'bg-yellow-200';
      case 'History': return 'bg-red-200';
      default: return 'bg-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'absent':
        return <XCircleIcon className="w-5 h-5 text-red-600" />;
      case 'late':
        return <ClockIcon className="w-5 h-5 text-yellow-600" />;
      default:
        return <QuestionMarkCircleIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const DashboardSection: React.FC<{
    title: string, 
    children: React.ReactNode, 
    section?: string
  }> = ({ title, children, section = 'default' }) => (
    <div
      className={`rounded-xl shadow-md p-6 ${getSectionColor(section)} 
        border-l-4 hover:shadow-lg transition-all duration-300`}
    >
      <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
        {title}
      </h3>
      {children}
    </div>
  );

  const renderSubjectsSection = () => {
    if (!instructorData?.subjects || instructorData.subjects.length === 0) {
      return (
        <DashboardSection title="No Subjects Assigned" section="subjects">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">
            Your current schedules don't have any associated subjects.
          </p>
        </DashboardSection>
      );
    }

    return (
      <DashboardSection title="Assigned Subjects" section="subjects">
        {instructorData.subjects.slice(0, 3).map((subject, index) => (
          <div
            key={subject.id || index}
            className="bg-white shadow-sm hover:shadow-md transition-all duration-300 rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <h4 className="font-semibold text-gray-800">
                {subject.name || subject.code || 'Unnamed Subject'}
              </h4>
              <p className="text-sm text-gray-500">
                Code: {subject.code || 'N/A'}
              </p>
            </div>
            <DocumentCheckIcon className="h-6 w-6 text-green-500" />
          </div>
        ))}
        
        {instructorData.subjects.length > 3 && (
          <p className="text-sm text-gray-500 text-center mt-2">
            +{instructorData.subjects.length - 3} more subjects
          </p>
        )}
      </DashboardSection>
    );
  };

  const renderQuickStats = () => {
    const stats = [
      { 
        title: 'Total Subjects', 
        value: instructorData?.subjects?.length || 0,
        icon: <AcademicCapIcon className="w-6 h-6 text-blue-500" />
      },
      { 
        title: 'Active Schedules', 
        value: instructorData?.schedules?.length || 0,
        icon: <CalendarIcon className="w-6 h-6 text-green-500" />
      },
      { 
        title: 'Assigned Students', 
        value: instructorData?.teacherData?.assignedStudents?.length || 0,
        icon: <UserGroupIcon className="w-6 h-6 text-purple-500" />
      }
    ];

    return (
      <DashboardSection title="Performance Overview">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <div
              key={stat.title}
              className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4 hover:shadow-lg transition-all"
            >
              <div className="bg-gray-100 p-3 rounded-full">
                {stat.icon}
              </div>
              <div>
                <p className="text-gray-500 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </DashboardSection>
    );
  };

  const renderAttendanceInsights = () => {
    // Calculate attendance statistics
    const totalAttendance = recentAttendance.length;
    const presentCount = recentAttendance.filter(record => record.status === 'present').length;
    const attendancePercentage = totalAttendance > 0 
      ? ((presentCount / totalAttendance) * 100).toFixed(1) 
      : '0.0';

    return (
      <DashboardSection title="Attendance Insights" section="attendance">
        <div className="grid grid-cols-2 gap-4">
          {/* Attendance Overview */}
          <div
            className="bg-white shadow-sm hover:shadow-md transition-all duration-300 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-gray-600 text-sm">Total Attendance</h4>
              <CheckCircleIcon className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{attendancePercentage}%</p>
            <p className="text-xs text-gray-500">
              {presentCount} / {totalAttendance} students present
            </p>
          </div>

          {/* Time Management */}
          <div
            className="bg-white shadow-sm hover:shadow-md transition-all duration-300 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-gray-600 text-sm">On-Time Rate</h4>
              <ClockIcon className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {(stats.onTimeRate * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">Punctuality metric</p>
          </div>
        </div>

        {/* Recent Attendance List */}
        <div 
          className="mt-4 space-y-2"
        >
          {recentAttendance.slice(0, 5).map((activity, index) => (
            <div
              key={index}
              className={`
                rounded-lg p-3 flex items-center justify-between
                ${activity.status === 'present' 
                  ? 'bg-green-50 border-l-4 border-green-500' 
                  : activity.status === 'late'
                    ? 'bg-yellow-50 border-l-4 border-yellow-500'
                    : 'bg-red-50 border-l-4 border-red-500'}
              `}
            >
              <div>
                <p className="font-medium text-gray-800">{activity.name}</p>
                <p className="text-sm text-gray-600">{activity.subject}</p>
                <p className="text-sm text-gray-600">{new Date(activity.timestamp).toLocaleTimeString()}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                activity.status === 'present' 
                  ? 'bg-green-100 text-green-800' 
                  : activity.status === 'late'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
              }`}>
                {activity.status === 'present' ? 'Present' : activity.status === 'late' ? 'Late' : 'Absent'}
              </span>
            </div>
          ))}
        </div>
        
        {/* View All Attendance Link */}
        <div className="mt-4 text-right">
          <Link 
            to="/instructor/attendance-management" 
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <span>View All Attendance Records</span>
            <ChevronDoubleRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </DashboardSection>
    );
  };

  const renderWeeklySchedule = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules?.map((schedule) => (
          <div key={schedule.id} className={`p-4 rounded-lg shadow ${getColor(schedule.subject)}`}> 
            <h2 className="text-xl font-semibold mb-2">{schedule.day}</h2>
            <ul>
              {schedule.classes?.map((item, index) => (
                <li key={index} className="text-gray-700 mb-1">
                  {item?.time || 'No time set'}: {item?.subject || 'No subject'}
                </li>
              )) || <li className="text-gray-500">No classes scheduled</li>}
            </ul>
            {schedule.room && (
              <p className="text-gray-500 mt-2">Room: {schedule.room}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderRFIDAccessLogs = () => {
    return (
      <DashboardSection title="RFID Access Logs">
        <div className="space-y-4">
          {/* Access Logs Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {accessLogs.map((log, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-blue-400">
                      {log.type}
                    </td>
                  </tr>
                ))}
                {accessLogs.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                      No access logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardSection>
    );
  };

  const safeIncludes = (arr: any[] | undefined, item: any): boolean => {
    return Array.isArray(arr) ? arr.includes(item) : false;
  };

  const getNextScheduledDay = useMemo(() => {
    if (!instructorData?.schedules || instructorData.schedules.length === 0) {
      return 'No upcoming classes';
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false });
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;
    
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Sort schedules by day and time
    const sortedSchedules = [...instructorData.schedules].sort((a, b) => {
      const dayA = weekdays.indexOf(a.day.substring(0, 3));
      const dayB = weekdays.indexOf(b.day.substring(0, 3));
      if (dayA === dayB) {
        const timeA = a.classes[0].time.split(' - ')[0];
        const timeB = b.classes[0].time.split(' - ')[0];
        return timeA.localeCompare(timeB);
      }
      return dayA - dayB;
    });

    // Check today's remaining classes first
    const todaySchedules = sortedSchedules.filter(schedule => 
      schedule.day.substring(0, 3) === weekdays[currentDay]
    );

    for (const schedule of todaySchedules) {
      const [startTime] = schedule.classes[0].time.split(' - ');
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const classStartMinutes = startHour * 60 + startMinute;

      if (currentMinutes < classStartMinutes) {
        return `Today at ${startTime}`;
      }
    }

    // Find the next day with classes
    for (let i = 1; i <= 7; i++) {
      const nextDay = (currentDay + i) % 7;
      const nextDaySchedules = sortedSchedules.filter(s => 
        s.day.substring(0, 3) === weekdays[nextDay]
      );

      if (nextDaySchedules.length > 0) {
        const nextClass = nextDaySchedules[0];
        const startTime = nextClass.classes[0].time.split(' - ')[0];
        const dayName = i === 1 ? 'Tomorrow' : nextClass.day;
        return `${dayName} at ${startTime}`;
      }
    }

    return 'No upcoming classes';
  }, [instructorData?.schedules, currentTime]);

  const todaySchedule = useMemo(() => {
    if (!schedules || !Array.isArray(schedules)) return [];
    
    const today = new Date().toLocaleString('en-US', { weekday: 'short' });
    return schedules.filter(schedule => 
      schedule && schedule.day === today && 
      schedule.classes && Array.isArray(schedule.classes)
    ).sort((a, b) => {
      const timeA = a.classes?.[0]?.time || '';
      const timeB = b.classes?.[0]?.time || '';
      return timeA.localeCompare(timeB);
    });
  }, [schedules]);

  const upcomingClasses = useMemo(() => {
    if (!schedules || !Array.isArray(schedules)) return [];
    
    return schedules.filter(schedule => 
      schedule && schedule.classes && Array.isArray(schedule.classes) &&
      schedule.classes.some(cls => cls && cls.time)
    ).slice(0, 3);
  }, [schedules]);

  const scheduleStatus = useMemo(() => {
    return getScheduleStatus(
      instructorData, 
      currentTime.toLocaleString('en-US', { weekday: 'short' })
    );
  }, [instructorData, currentTime]);

  const handleUpdateAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    try {
      const timestamp = new Date().getTime();
      await updateDoc(doc(db, 'students', studentId), {
        status,
        lastUpdated: timestamp
      });

      // Add to attendance history
      const attendanceRef = collection(db, 'attendance');
      await addDoc(attendanceRef, {
        studentId,
        status,
        timestamp,
        subject: selectedSection,
        teacherId: currentUser?.uid
      });

      toast.success('Attendance updated successfully');
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    }
  };

  const handleAddNotes = async (studentId: string) => {
    const { value: notes } = await Swal.fire({
      title: 'Add Notes',
      input: 'textarea',
      inputLabel: 'Notes',
      inputPlaceholder: 'Enter notes about the student...',
      showCancelButton: true
    });

    if (notes) {
      try {
        await updateDoc(doc(db, 'students', studentId), {
          notes,
          notesTimestamp: new Date().getTime()
        });
        toast.success('Notes added successfully');
      } catch (error) {
        console.error('Error adding notes:', error);
        toast.error('Failed to add notes');
      }
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
  

  const filteredStudents = useMemo(() => {
    if (!selectedSection) return recentAttendance;
    return recentAttendance.filter(record => record.sectionId === selectedSection);
  }, [recentAttendance, selectedSection]);

  const stats = useMemo(() => {
    const totalStudents = filteredStudents.length;
    const totalClasses = instructorData?.sections?.length || 0;
    
    // Use recentAttendance to calculate rates
    const presentStudents = recentAttendance.filter(
      record => record.status === 'present' && 
      safeIncludes(filteredStudents, record.studentId)
    );

    const onTimeStudents = recentAttendance.filter(
      record => record.status !== 'late' && 
      safeIncludes(filteredStudents, record.studentId)
    );
    
    const attendanceRate = totalStudents > 0 
      ? ((presentStudents.length / totalStudents) * 100).toFixed(1) 
      : '0.0';

    const onTimeRate = totalStudents > 0
      ? (onTimeStudents.length / totalStudents) * 100
      : 0;

    return {
      totalStudents,
      totalClasses,
      attendanceRate,
      onTimeRate
    };
  }, [filteredStudents, instructorData?.sections, recentAttendance]);

  useEffect(() => {
    if (!currentUser?.uid) return;
  
    const fetchTeacherData = async () => {
      try {
        // Fetch teacher's basic info directly from the teachers collection using currentUser.uid
        const teacherRef = doc(db, 'teachers', currentUser.uid);
        const teacherSnap = await getDocs(collection(db, 'teachers'));
        
        // Get the specific teacher document
        const teacherDoc = await getDocs(query(collection(db, 'teachers'), where('uid', '==', currentUser.uid)));
        let teacherData: TeacherDocument = {};
        
        if (!teacherDoc.empty) {
          teacherData = teacherDoc.docs[0].data() as TeacherDocument;
        }
        
        // Fetch all related collections in parallel
        const [
          schedulesSnap,
          sectionsSnap,
          studentsSnap
        ] = await Promise.all([
          getDocs(query(
            collection(db, 'schedules'),
            where('teacherId', '==', currentUser.uid),
            orderBy('day')
          )),
          getDocs(query(
            collection(db, 'sections'),
            where('teacherId', '==', currentUser.uid)
          )),
          getDocs(query(
            collection(db, 'students'),
            where('teacherId', '==', currentUser.uid)
          ))
        ]);

        // Set up real-time listener for subjects
        const subjectsQuery = query(
          collection(db, 'subjects'),
          where('teacherId', '==', currentUser.uid)
        );

        const unsubscribeSubjects = onSnapshot(subjectsQuery, (snapshot) => {
          const subjects = snapshot.docs.map(doc => ({
            id: doc.id,
            code: doc.data().code || '',
            name: doc.data().name || '',
            ...doc.data()
          })) as Subject[];

          // Process schedules with detailed info
          const schedules = schedulesSnap.docs.map(doc => ({
            id: doc.id,
            day: doc.data().day || '',
            subject: doc.data().subject || '',
            classes: doc.data().classes?.map((cls: any) => ({
              time: cls.time || '',
              subject: cls.subject || ''
            })) || [],
            room: doc.data().room,
            ...doc.data()
          })) as Schedule[];

          // Process sections with student counts
          const sections = sectionsSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || '',
            code: doc.data().code || '',
            studentCount: studentsSnap.docs.filter(s => 
              s.data().section === doc.id
            ).length,
            ...doc.data()
          })) as Section[];

          // Update instructor data with all fetched info
          setInstructorData({
            id: currentUser.uid,
            fullName: teacherData.fullName || 'Instructor',
            email: teacherData.email || '',
            department: teacherData.department || '',
            schedules,
            sections,
            subjects,
            teacherData: {
              assignedStudents: studentsSnap.docs.map(doc => doc.id)
            }
          } as InstructorData);

          setLoading(false);
        });

        // Clean up the subjects listener when component unmounts
        return () => {
          unsubscribeSubjects();
        };

      } catch (error) {
        console.error('Error fetching teacher data:', error);
        toast.error('Failed to load teacher data');
        setLoading(false);
      }
    };

    fetchTeacherData();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const scheduleRef = collection(db, 'schedules');
    const q = query(
      scheduleRef,
      where('teacherId', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scheduleUpdates = snapshot.docChanges();
      
      if (scheduleUpdates.length > 0) {
        setInstructorData(prev => {
          if (!prev) return prev;
          
          const updatedSchedules = [...prev.schedules];
          
          scheduleUpdates.forEach(change => {
            if (change.type === 'modified') {
              const index = updatedSchedules.findIndex(s => s.id === change.doc.id);
              if (index !== -1) {
                updatedSchedules[index] = {
                  id: change.doc.id,
                  ...change.doc.data()
                } as Schedule;
              }
            }
          });

          return {
            ...prev,
            schedules: updatedSchedules
          };
        });
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const markAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    try {
      const studentRef = doc(db, 'students', studentId);
      const student = students.find(s => s.id === studentId);
      
      if (!student) return;

      // Get the current course ID or use a default one
      const courseId = selectedSection || 'default';
      
      const updatedAttendance = {
        ...student.attendance,
        [courseId]: {
          ...student.attendance[courseId],
          [status]: (student.attendance[courseId]?.[status] || 0) + 1
        }
      };

      await updateDoc(studentRef, {
        attendance: updatedAttendance
      });

      Swal.fire({
        icon: 'success',
        title: 'Attendance Marked',
        text: `${student.fullName} marked as ${status}`,
        timer: 1500,
        showConfirmButton: false
      });

      // Remove fetchStudents() call since we have real-time updates
    } catch (error) {
      console.error('Error marking attendance:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to mark attendance'
      });
    }
  };

  useEffect(() => {
    if (!currentUser?.uid) return;

    // Subscribe to real-time room status updates
    const roomsRef = ref(rtdb, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot: DataSnapshot) => {
      if (snapshot.exists()) {
        setRoomStatus(snapshot.val());
      }
    });

    return () => {
      // Unsubscribe from the listener when component unmounts
      unsubscribe();
    };
  }, [currentUser]);

  // Add section handler
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSection.name || !newSection.code || !newSection.subject) return;

    try {
      await addDoc(collection(db, 'sections'), {
        name: newSection.name,
        code: newSection.code,
        subject: newSection.subject,
        teacherId: currentUser?.uid,
        createdAt: new Date()
      });

      setIsAddSectionModalOpen(false);
      setNewSection({ name: '', code: '', subject: '' });
      Swal.fire('Success', 'Section created successfully!', 'success');
    } catch (error) {
      console.error('Error creating section:', error);
      Swal.fire('Error', 'Failed to create section', 'error');
    }
  };

  if (!instructorData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${travelThemeColors.background}`}>
      <NavBar
        currentTime={currentTime}
        classStatus={{
          status: scheduleStatus.status,
          color: scheduleStatus.color,
          details: scheduleStatus.details,
          fullName: instructorData?.fullName || 'Instructor'
        }}
        user={{
          role: currentUser?.role || 'instructor',
          fullName: currentUser?.fullName || 'Instructor',
          department: currentUser?.department || 'Department',
        }}
      />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-6">
            {/* Welcome Section with Glass Effect */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="backdrop-blur-lg bg-white/80 rounded-3xl shadow-xl p-8 border border-white/20"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                    Welcome, {(instructorData?.fullName || 'Instructor').split(' ')[0]}! 📚
                  </h1>
                  <p className="text-indigo-600 mt-2 text-lg">
                    Your virtual classroom dashboard
                  </p>
                </div>
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className={`px-6 py-3 rounded-2xl text-sm font-medium shadow-lg ${scheduleStatus.color}`}
                >
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-lg">{scheduleStatus.status}</span>
                    <span className="text-sm opacity-90">{scheduleStatus.details}</span>
                  </div>
                </motion.div>
              </div>

              {/* Quick Actions */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-white/80 rounded-3xl shadow-xl p-8 border border-white/20"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsAddSectionModalOpen(true)}
                    className="flex items-center justify-center p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Create Section
                  </button>
                  <Link
                    to="/instructor/subjects"
                    className="flex items-center justify-center p-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                  >
                    <BookOpenIcon className="h-5 w-5 mr-2" />
                    View Subjects
                  </Link>
                </div>
              </motion.section>

              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[
                  {
                    title: "Total Students",
                    value: instructorData?.teacherData?.assignedStudents?.length || 0,
                    icon: <UsersIcon className="h-6 w-6 text-blue-600" />,
                    change: "+12% from last month",
                    color: "bg-blue-50"
                  },
                  {
                    title: "Attendance Rate",
                    value: `${stats.attendanceRate}%`,
                    icon: <CheckCircleIcon className="h-6 w-6 text-green-600" />,
                    change: "Average this week",
                    color: "bg-green-50"
                  },
                  {
                    title: "Active Classes",
                    value: currentDaySchedule.filter(s => s.status === 'ongoing').length,
                    icon: <BookOpenIcon className="h-6 w-6 text-purple-600" />,
                    change: "Currently ongoing",
                    color: "bg-purple-50"
                  },
                  {
                    title: "Room Usage",
                    value: "85%",
                    icon: <MapPinIcon className="h-6 w-6 text-orange-600" />,
                    change: "Efficiency rate",
                    color: "bg-orange-50"
                  }
                ].map((stat, index) => (
                <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`${stat.color} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all`}
                  >
                    <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm">{stat.title}</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                        <p className="text-gray-600 text-xs mt-2">{stat.change}</p>
                    </div>
                      <div className="p-3 rounded-xl bg-white/50">{stat.icon}</div>
                  </div>
                </motion.div>
                ))}
              </div>

              {/* Performance Analytics */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-6 mb-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Performance Analytics</h2>
                  <select className="text-sm border rounded-lg px-3 py-2">
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="semester">This Semester</option>
                  </select>
                    </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Attendance Trends */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-gray-700 font-medium mb-4">Attendance Trends</h3>
                    <div className="h-48 flex items-end justify-between">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => (
                        <div key={day} className="flex flex-col items-center">
                          <div 
                            className="w-8 bg-indigo-500 rounded-t-lg"
                            style={{ height: `${Math.random() * 100}%` }}
                          />
                          <span className="text-xs text-gray-600 mt-2">{day}</span>
                  </div>
                      ))}
                    </div>
                  </div>
                  {/* Subject Performance */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-gray-700 font-medium mb-4">Subject Performance</h3>
                    <div className="space-y-4">
                      {instructorData?.subjects?.slice(0, 3).map(subject => (
                        <div key={subject.id} className="flex items-center">
                          <div className="w-32 truncate">{subject.name}</div>
                          <div className="flex-1 ml-4">
                            <div className="h-2 bg-gray-200 rounded-full">
                              <div 
                                className="h-2 bg-indigo-500 rounded-full"
                                style={{ width: `${Math.random() * 100}%` }}
                              />
              </div>
                          </div>
                          <span className="ml-4 text-sm text-gray-600">
                            {Math.floor(Math.random() * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Weekly Schedule Overview */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-white/80 rounded-3xl shadow-xl p-8 border border-white/20"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Weekly Schedule</h2>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-indigo-600" />
                    <span className="text-indigo-600 font-medium">
                      {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                          </div>
                </div>

                <div className="grid grid-cols-5 gap-4">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                    const daySchedules = instructorData?.schedules?.filter(s => s.day.startsWith(day)) || [];
                    return (
                      <div key={day} className="bg-white rounded-xl shadow-sm p-4">
                        <h3 className="font-semibold text-gray-800 mb-3">{day}</h3>
                        <div className="space-y-2">
                          {daySchedules.length > 0 ? (
                            daySchedules.map((schedule, idx) => (
                              <div 
                                key={idx} 
                                className="p-2 bg-indigo-50 rounded-lg text-sm"
                              >
                                <p className="font-medium text-indigo-800">{schedule.subject}</p>
                                <div className="flex items-center text-indigo-600 mt-1 text-xs">
                                  <ClockIcon className="h-3 w-3 mr-1" />
                                  {schedule.classes[0]?.time}
                              {schedule.room && (
                                <>
                                      <MapPinIcon className="h-3 w-3 ml-2 mr-1" />
                                      Room {schedule.room}
                                </>
                              )}
                            </div>
                          </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 text-center">No classes</p>
                          )}
                        </div>
                        </div>
                    );
                  })}
              </div>
            </motion.section>

              {/* Subjects and Sections Overview */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {instructorData?.subjects?.map(subject => (
                    <div 
                      key={subject.id}
                      className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{subject.name}</h3>
                          <p className="text-sm text-gray-500">Code: {subject.code}</p>
                        </div>
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <BookOpenIcon className="h-5 w-5 text-indigo-600" />
                        </div>
              </div>

                      <div className="space-y-2">
                        {instructorData.sections
                          .filter(section => section.code === subject.code)
                          .map(section => (
                            <div 
                              key={section.id}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center">
                                <UserGroupIcon className="h-4 w-4 text-gray-600 mr-2" />
                                <span className="text-sm text-gray-700">{section.name}</span>
                      </div>
                              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                                {section.studentCount} students
                              </span>
                      </div>
                            ))}
                    </div>
                    </div>
                ))}
              </div>
            </motion.section>

              {/* Schedule Cards with Enhanced Design */}
              <div className="grid grid-cols-1 gap-4">
                {todaySchedule?.map((schedule, index) => (
                      <motion.div
                        key={schedule.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    className={`p-6 rounded-2xl shadow-lg border-l-4 ${
                          schedule.status === 'ongoing'
                        ? 'border-l-green-500 bg-gradient-to-r from-green-50 to-white'
                            : schedule.status === 'upcoming'
                          ? 'border-l-indigo-500 bg-gradient-to-r from-indigo-50 to-white'
                          : 'border-l-gray-500 bg-gradient-to-r from-gray-50 to-white'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            schedule.status === 'ongoing'
                              ? 'bg-green-100'
                              : schedule.status === 'upcoming'
                                ? 'bg-indigo-100'
                                : 'bg-gray-100'
                          }`}>
                            <BookOpenIcon className={`h-5 w-5 ${
                              schedule.status === 'ongoing'
                                ? 'text-green-600'
                                : schedule.status === 'upcoming'
                                  ? 'text-indigo-600'
                                  : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className={`font-semibold ${
                                schedule.status === 'ongoing'
                                  ? 'text-green-900'
                                  : schedule.status === 'upcoming'
                                    ? 'text-indigo-900'
                                    : 'text-gray-900'
                              }`}>
                                {schedule.subject}
                              </h3>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                schedule.status === 'ongoing'
                                  ? 'bg-green-100 text-green-800'
                                  : schedule.status === 'upcoming'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}>
                                {schedule.status === 'ongoing' ? 'In Progress' : 
                             schedule.status === 'upcoming' && schedule.timestamp 
                               ? getTimeRemaining(schedule.timestamp) 
                               : 'Completed'}
                              </span>
                            </div>
                            <div className="flex items-center mt-1">
                              <ClockIcon className={`h-4 w-4 mr-1 ${
                                schedule.status === 'ongoing'
                                  ? 'text-green-600'
                                  : schedule.status === 'upcoming'
                                    ? 'text-indigo-600'
                                    : 'text-gray-600'
                              }`} />
                              <p className={`text-sm ${
                                schedule.status === 'ongoing'
                                  ? 'text-green-700'
                                  : schedule.status === 'upcoming'
                                    ? 'text-indigo-700'
                                    : 'text-gray-700'
                              }`}>
                                {schedule.classes && schedule.classes.length > 0 ? schedule.classes[0].time : 'No time available'}
                              </p>
                              {schedule.room && (
                                <>
                                  <MapPinIcon className={`h-4 w-4 ml-3 mr-1 ${
                                    schedule.status === 'ongoing'
                                      ? 'text-green-600'
                                      : schedule.status === 'upcoming'
                                        ? 'text-indigo-600'
                                        : 'text-gray-600'
                                  }`} />
                                  <p className={`text-sm ${
                                    schedule.status === 'ongoing'
                                      ? 'text-green-700'
                                      : schedule.status === 'upcoming'
                                        ? 'text-indigo-700'
                                        : 'text-gray-700'
                                  }`}>
                                    Room {schedule.room}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                ))}
                  </div>

              {/* Quick Attendance Action */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-white/80 rounded-3xl shadow-xl p-8 border border-white/20"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Attendance Actions</h2>
                </div>
                <div className="bg-indigo-50 rounded-xl p-6 text-center">
                  <ClipboardDocumentCheckIcon className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Take Attendance Now</h3>
                  <p className="text-gray-600 mb-4">Redirect to the attendance taking interface</p>
                  <Link
                    to="/instructor/take-attendance"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  >
                    <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2" />
                    Go to Attendance Page
                  </Link>
                </div>
              </motion.section>
            </motion.section>
          </div>

           {/* Right Sidebar */}
           <div className="lg:col-span-4 space-y-6">   
            {/* Real-time Occupancy */}
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="backdrop-blur-lg bg-white/80 rounded-3xl shadow-xl p-6 border border-white/20 mt-6"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Room Occupancy</h3>
              <div className="space-y-3">
                {accessLogs.slice(0, 5).map((log, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        log.status === 'entry' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {log.status === 'entry' 
                          ? <UserGroupIcon className="h-4 w-4 text-green-600" />
                          : <ArrowLeftEndOnRectangleIcon className="h-4 w-4 text-red-600" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Room {log.room}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      log.status === 'entry' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {log.status === 'entry' ? 'Entry' : 'Exit'}
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>
          </div>
        </div>
      </main>

      {/* Add Section Modal */}
      <Modal
        isOpen={isAddSectionModalOpen}
        onClose={() => setIsAddSectionModalOpen(false)}
        title="Create New Section"
      >
        <form onSubmit={handleAddSection} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section Name
            </label>
            <input
              type="text"
              value={newSection.name}
              onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
              className="w-full p-2 border rounded-lg"
              placeholder="e.g., Section A"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section Code
            </label>
            <input
              type="text"
              value={newSection.code}
              onChange={(e) => setNewSection({ ...newSection, code: e.target.value })}
              className="w-full p-2 border rounded-lg"
              placeholder="e.g., SEC-A"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <select
              value={newSection.subject}
              onChange={(e) => setNewSection({ ...newSection, subject: e.target.value })}
              className="w-full p-2 border rounded-lg"
              required
            >
              <option value="">Select Subject</option>
              {instructorData?.subjects?.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => setIsAddSectionModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Create Section
            </button>
          </div>
        </form>
      </Modal>

      <GeminiChatbot />
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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // Add context about the user
      const prompt = `You are a helpful AI assistant that can answer any questions accurately, including about Mark Lloyd Cuizon, Clarence Emmanuel Jamora, and Jean Ricka Rosalita - Creators of Smart EcoLock.

They are 4th-year BS Computer Engineering students from Cebu Institute of Technology - University (CIT-U). Their project, Smart EcoLock, addresses energy management, attendance control, and security for CIT-U's rooms and offices.

Smart EcoLock utilizes an ESP32 microcontroller for efficient sensor handling and low power consumption, leveraging its dual-core architecture and built-in Wi-Fi capabilities. With occupancy recognition, it detects room usage through a combination of PZEM for power monitoring and weight sensors, automatically turning off lights and electronics in unoccupied rooms to reduce energy waste. LDR (Light-Dependent Resistor) sensors measure ambient light levels, adjusting classroom lighting dynamically to optimize energy use based on natural daylight availability.

Attendance tracking is achieved through a multi-layered approach. Access control data from RFID (Radio-Frequency Identification) tags ensures only authorized individuals enter, logging entry times into a unified database. Additionally, weight sensors embedded in chairs provide precise occupancy detection by measuring the presence of individuals (e.g., detecting weights above a threshold like 20 kg to confirm a person is seated). This data cross-references RFID logs to validate attendance, reducing errors from manual tracking or proxy entries. The system uploads real-time updates to a Firebase Realtime Database, enabling administrators to monitor occupancy and attendance seamlessly.

Security is enhanced via RFID authentication, restricting access to authorized personnel and students, while weight sensors add an extra layer of verification by confirming physical presence. The system features a React.js website with a Firebase backend, offering an intuitive interface for monitoring room status, controlling devices, and generating attendance reports.

This system boosts sustainability by minimizing energy consumption, improves management efficiency with automated tracking, and enhances security at CIT-U through integrated technology.

Provide complete answers, ensuring clarity and professionalism. Always include full code implementations when relevant and internet sources for additional information, even if the question is unrelated to Smart EcoLock. Format responses to facilitate prompt chatbot replies. As an AI assistant helping ${currentUser?.fullName || 'a user'} who is an ${currentUser?.role || 'user'} at the institution, respond professionally and concisely to the following query: ${query}.`;

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
      timestamp: new Date()
    };
  
    setMessages(prev => [...prev, userMessage]);
    setInput('');
  
    try {
      // Fetch AI response
      const aiResponse = await fetchGeminiResponse(input);
  
      // Construct AI response message
      const aiMessage: Message = {
        id: generateId(),
        content: aiResponse,
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
    }
  };

  const toggleChatbot = () => setIsOpen(!isOpen);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div>
        {isOpen && (
          <div 
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
                <div
                  key={msg.id}
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
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me anything..."
                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button 
                onClick={handleSendMessage}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
        className="bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-colors"
      >
        <ChatBubbleLeftRightIcon className="w-6 h-6" />
      </button>
    </div>
  );
};

export default InstructorDashboard;
