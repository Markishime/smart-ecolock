import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
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
  AcademicCapIcon 
} from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
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
  status?: 'present' | 'absent' | 'late';
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
    
    const fetchInstructorDetails = async () => {
      if (!currentUser) return;

      try {
        // Fetch teachers collection
        const teachersCollection = collection(db, 'teachers');
        const teachersQuery = query(
          teachersCollection, 
          where('instructor', '==', currentUser.uid)
        );
        const teachersSnapshot = await getDocs(teachersQuery);

        if (!teachersSnapshot.empty) {
          const teacherDoc = teachersSnapshot.docs[0];
          const teacherData: TeacherData = {
            id: teacherDoc.id,
            ...teacherDoc.data()
          };

          // Fetch user details to ensure complete profile
          const userQuery = query(
            collection(db, 'users'), 
            where('id', '==', teacherDoc.id)
          );
          const userSnapshot = await getDocs(userQuery);
          
          let userData: Partial<TeacherData> = {};
          if (!userSnapshot.empty) {
            userData = userSnapshot.docs[0].data() as Partial<TeacherData>;
          }

          // Combine teacher and user data
          const completeTeacherData: TeacherData = {
            ...teacherData,
            ...userData
          };

          // Transform schedules to match Schedule interface
          const fetchedSchedules: Schedule[] = (completeTeacherData.schedules || []).map((schedule) => ({
            id: `${teacherDoc.id}_${schedule.subject}_${schedule.day}`,
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
            id: teacherDoc.id,
            fullName: completeTeacherData.fullName || completeTeacherData.name || 'Instructor',
            email: completeTeacherData.email || '',
            department: completeTeacherData.department || 'Department',
            schedules: fetchedSchedules,
            subjects: completeTeacherData.subjects || [],
            sections: prevData?.sections || [],
            teacherData: {
              assignedStudents: completeTeacherData.assignedStudents || []
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
        }
      } catch (error) {
        console.error('Error fetching instructor details:', error);
      }
    };

    fetchInstructorDetails();

    const unsubscribeStudents = onSnapshot(
      query(collection(db, 'students'), where('section', '==', selectedSection)),
      (snapshot) => {
        const studentsList = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          section: doc.data().section || '',
          attendance: doc.data().attendance || false,
          timeIn: doc.data().timeIn,
          lastAttendance: doc.data().attendanceHistory?.[0] || null,
          ...doc.data()
        })) as Student[];
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

    // Fetch subjects based on schedules
    const fetchSubjectsFromSchedules = async () => {
      try {
        if (!instructorData?.schedules || instructorData.schedules.length === 0) return;

        // Extract unique subject codes from schedules
        const subjectCodes = [...new Set(
          instructorData.schedules.map(schedule => schedule.subject)
        )];

        // If no subject codes, return
        if (subjectCodes.length === 0) return;

        // Query subjects collection based on subject codes
        const subjectsQuery = query(
          collection(db, 'subjects'),
          where('code', 'in', subjectCodes)
        );

        const subjectsSnapshot = await getDocs(subjectsQuery);
        
        const subjects = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          code: doc.data().code || '',
          name: doc.data().name || '',
          ...doc.data()
        })) as Subject[];

        // Update instructor data with fetched subjects
        setInstructorData(prev => {
          if (!prev) return null;
          
          return {
            ...prev,
            subjects: subjects
          };
        });

      } catch (error) {
        console.error('Error fetching subjects:', error);
        toast.error('Failed to fetch subjects');
      }
    };

    fetchSubjectsFromSchedules();
  }, [currentUser, instructorData?.schedules]);

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!currentUser?.email) return;

      const schedulesRef = collection(db, 'schedules');
      const q = query(
        schedulesRef,
        where('teacherId', '==', currentUser.email)
      );

      const querySnapshot = await getDocs(q);
      const scheduleList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        day: doc.data().day,
        subject: doc.data().subject,
        classes: doc.data().classes || [],
        room: doc.data().room || 'TBA',
        timestamp: doc.data().timestamp || new Date().getTime()
      }));

      setSchedules(processSchedules(scheduleList).sort((a, b) => a.timestamp - b.timestamp));
    };
    fetchSchedules();
  }, [currentUser, db]);

  useEffect(() => {
    const fetchAccessLogs = async () => {
      try {
        const accessLogsQuery = query(collection(db, 'accessLogs'));
        const accessLogsSnapshot = await getDocs(accessLogsQuery);
        const logs = accessLogsSnapshot.docs.map(doc => ({
          id: doc.id,
          timestamp: doc.data().timestamp,
          type: doc.data().type,
          room: doc.data().room,
          userId: doc.data().userId,
          status: doc.data().status,
          location: doc.data().location,
          deviceId: doc.data().deviceId
        }));
        setAccessLogs(logs);
        setLastAccess(logs[0]?.timestamp || null);
      } catch (error) {
        console.error('Error fetching access logs:', error);
      }
    };
    fetchAccessLogs();
  }, [db]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchSchedules = () => {
      const today = new Date().toLocaleString('en-US', { weekday: 'short' });
      const teacherSchedulesRef = collection(db, 'schedules');
      
      const scheduleQuery = query(
        teacherSchedulesRef,
        where('teacherId', '==', currentUser.uid)
      );

      const unsubscribe = onSnapshot(scheduleQuery, (snapshot) => {
        const allSchedules = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TeacherSchedule[];

        const todaySchedules = allSchedules
          .filter(schedule => schedule.day === today)
          .map(schedule => {
            const [hours, minutes] = schedule.classes[0].time.split(':').map(Number);
            const scheduleTime = new Date();
            scheduleTime.setHours(hours, minutes, 0, 0);
            
            return {
              ...schedule,
              timestamp: scheduleTime.getTime(),
              status: getClassStatus(scheduleTime, schedule.classes[0].duration || 60)
            } as ProcessedSchedule;
          })
          .sort((a, b) => a.timestamp - b.timestamp);

setCurrentDaySchedule(todaySchedules);
        setIsLoadingSchedule(false);
      }, (error) => {
        console.error("Error fetching schedules:", error);
        setIsLoadingSchedule(false);
      });

      return unsubscribe;
    };

    return fetchSchedules();
  }, [currentUser]);

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
          name: doc.data().name || '',
          section: doc.data().section || '',
          attendance: doc.data().attendance || false,
          timeIn: doc.data().timeIn,
          lastAttendance: doc.data().attendanceHistory?.[0] || null,
          ...doc.data()
        })) as Student[];
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
        // Fetch teacher's basic info
        const teacherRef = doc(db, 'teachers', currentUser.uid);
        const teacherSnap = await getDocs(collection(db, 'teachers'));
        
        // Fetch all related collections in parallel
        const [
          schedulesSnap,
          subjectsSnap,
          sectionsSnap,
          studentsSnap
        ] = await Promise.all([
          getDocs(query(
            collection(db, 'schedules'),
        where('teacherId', '==', currentUser.uid),
            orderBy('day')
          )),
          getDocs(query(
            collection(db, 'subjects'),
            where('teacherId', '==', currentUser.uid)
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

        // Process subjects with section counts
        const subjects = subjectsSnap.docs.map(doc => ({
          id: doc.id,
          code: doc.data().code || '',
          name: doc.data().name || '',
          ...doc.data()
        })) as Subject[];

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
          fullName: teacherSnap.docs[0]?.data().fullName || 'Instructor',
          email: teacherSnap.docs[0]?.data().email || '',
          department: teacherSnap.docs[0]?.data().department || '',
          schedules,
          sections,
          subjects,
          teacherData: {
            assignedStudents: studentsSnap.docs.map(doc => doc.id)
          }
        });

        setLoading(false);

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
        instructor={{
          fullName: instructorData?.fullName || 'Instructor',
          department: instructorData?.department || 'Department'
        }}
        classStatus={{
          status: scheduleStatus.status,
          color: scheduleStatus.color,
          details: scheduleStatus.details,
          fullName: instructorData?.fullName || 'Instructor'
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

              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  {
                    title: "Take Attendance",
                    icon: <ClipboardDocumentCheckIcon className="h-6 w-6" />,
                    color: "bg-blue-500 hover:bg-blue-600"
                  },
                  {
                    title: "Generate Report",
                    icon: <DocumentArrowDownIcon className="h-6 w-6" />,
                    color: "bg-green-500 hover:bg-green-600"
                  },
                  {
                    title: "Room Control",
                    icon: <MapPinIcon className="h-6 w-6" />,
                    color: "bg-purple-500 hover:bg-purple-600"
                  },
                  {
                    title: "View Analytics",
                    icon: <ChartBarIcon className="h-6 w-6" />,
                    color: "bg-orange-500 hover:bg-orange-600"
                  }
                ].map((action) => (
                  <button
                    key={action.title}
                    className={`${action.color} text-white rounded-xl p-4 flex flex-col items-center justify-center transition-colors`}
                  >
                    {action.icon}
                    <span className="text-sm mt-2">{action.title}</span>
                  </button>
                ))}
              </div>

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

              {/* Attendance Management Section */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-white/80 rounded-3xl shadow-xl p-8 border border-white/20"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Attendance Management</h2>
                  <div className="flex gap-3">
                    <select
                      className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                    >
                      <option value="">All Sections</option>
                      {instructorData?.sections?.map((section) => (
                        <option key={section.id} value={section.id}>{section.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {/* Add export function */}}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <DocumentArrowDownIcon className="w-5 h-5" />
                      Export
                    </button>
                  </div>
                </div>

                {/* Student Attendance Tracking */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time In</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.filter(student => 
                        !selectedSection || student.section === selectedSection
                      ).map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{student.name}</div>
                                <div className="text-sm text-gray-500">ID: {student.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                              {student.section}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={student.status || 'absent'}
                              onChange={(e) => handleUpdateAttendance(student.id, e.target.value as 'present' | 'absent' | 'late')}
                              className={`text-sm rounded-lg border-gray-200 focus:ring-2 focus:ring-offset-2 ${
                                student.status === 'present' ? 'text-green-800 bg-green-50 focus:ring-green-500' :
                                student.status === 'late' ? 'text-yellow-800 bg-yellow-50 focus:ring-yellow-500' :
                                'text-red-800 bg-red-50 focus:ring-red-500'
                              }`}
                            >
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="late">Late</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.status === 'present' || student.status === 'late' 
                              ? new Date().toLocaleTimeString() 
                              : '-'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleAddNotes(student.id)}
                              className="text-indigo-600 hover:text-indigo-900 mr-3"
                            >
                              Add Notes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            </motion.section>
            </motion.section>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Room Control & Energy Monitoring */}
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="backdrop-blur-lg bg-white/80 rounded-3xl shadow-xl p-6 border border-white/20"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Smart Room Control</h3>
              <div className="space-y-4">
                {/* Room Status Cards */}
                {instructorData?.schedules?.map((schedule) => (
                  <div 
                    key={schedule.id}
                    className="bg-white rounded-lg shadow-sm p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">Room {schedule.room}</h4>
                        <p className="text-sm text-gray-500">{schedule.subject}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        schedule.status === 'ongoing' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {schedule.status === 'ongoing' ? 'In Use' : 'Available'}
                      </div>
                    </div>

                    {/* Room Controls */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Lights</span>
                          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none hover:bg-gray-300">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Energy: 45W</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">AC</span>
                          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-200 transition-colors focus:outline-none hover:bg-green-300">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Temp: 23°C</p>
                      </div>
                    </div>

                    {/* Energy Usage */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Energy Usage</span>
                        <span className="text-gray-900 font-medium">2.4 kWh</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div 
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: '65%' }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">65% efficiency rate</p>
                    </div>
                  </div>
                ))}

                {/* Quick Controls */}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg p-3 transition-colors">
                    <MapPinIcon className="h-5 w-5" />
                    <span className="text-sm">Access Log</span>
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg p-3 transition-colors">
                    <ChartBarIcon className="h-5 w-5" />
                    <span className="text-sm">Energy Report</span>
                  </button>
                </div>
              </div>
            </motion.section>

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
      <GeminiChatbot />
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
                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button 
                onClick={handleSendMessage}
                disabled={isLoading}
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
