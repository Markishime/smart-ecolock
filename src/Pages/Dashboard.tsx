import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from './AuthContext';
import { signOut } from 'firebase/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  BookOpenIcon, 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon 
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
  DocumentCheckIcon
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
  subject: string;
  days: string[];
  startTime: string;
  endTime: string;
  roomNumber: string;
  subjectCode: string;
  section?: string;
  teacherName?: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
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
  subjects: Subject[];
  schedules: Schedule[];
  sections: Section[];
  teacherData?: TeacherData;
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
            subject: schedule.subject,
            days: [schedule.day],  
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            roomNumber: schedule.room || '',  
            subjectCode: schedule.subject.split(' ')[0] || '',  
            section: schedule.section,
            teacherName: completeTeacherData.fullName || completeTeacherData.name
          }));

          // Update instructor data
          setInstructorData(prevData => ({
            ...(prevData || {}),
            id: teacherDoc.id,
            fullName: completeTeacherData.fullName || completeTeacherData.name || '',
            email: completeTeacherData.email || '',
            department: completeTeacherData.department || '',
            schedules: fetchedSchedules,
            subjects: completeTeacherData.subjects || [],
            sections: prevData?.sections || [],
            teacherData: {
              assignedStudents: completeTeacherData.assignedStudents || []
            }
          } as InstructorData));

          // Set initial section if not already set
          if (fetchedSchedules.length > 0 && !selectedSection) {
            const firstValidSection = fetchedSchedules.find(schedule => schedule.section)?.section;
            if (firstValidSection) {
              setSelectedSection(firstValidSection);
            } else if (fetchedSchedules[0].section) {
              // Fallback to the first schedule's section if it exists
              setSelectedSection(fetchedSchedules[0].section);
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
          instructorData.schedules.map(schedule => schedule.subjectCode)
        )];

        // If no subject codes, return
        if (subjectCodes.length === 0) return;

        // Query subjects collection based on subject codes
        const subjectsQuery = query(
          collection(db, 'subjects'),
          where('code', 'in', subjectCodes)
        );

        const subjectsSnapshot = await getDocs(subjectsQuery);
        
        const fetchedSubjects: Subject[] = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          code: doc.data().code || 'N/A',
          name: doc.data().name || 'Unnamed Subject',
        }));

        // Update instructor data with fetched subjects
        setInstructorData(prev => {
          if (!prev) return null;
          
          return {
            ...prev,
            subjects: fetchedSubjects
          };
        });

      } catch (error) {
        console.error('Error fetching subjects:', error);
        toast.error('Failed to fetch subjects');
      }
    };

    fetchSubjectsFromSchedules();
  }, [currentUser, instructorData?.schedules]);

  const getSectionColor = (section: string) => {
    const colors: { [key: string]: string } = {
      'default': 'bg-indigo-50 border-indigo-500',
      'subjects': 'bg-green-50 border-green-500',
      'schedules': 'bg-blue-50 border-blue-500',
      'attendance': 'bg-purple-50 border-purple-500'
    };
    return colors[section] || colors['default'];
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

  const renderScheduleCalendar = () => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return (
      <DashboardSection title="Weekly Schedule" section="schedules">
        <div className="grid grid-cols-7 gap-2">
          {daysOfWeek.map((day, index) => {
            const daySchedules = instructorData?.schedules?.filter(
              schedule => schedule.days.includes(day)
            ) || [];

            return (
              <div
                key={day}
                className={`
                  rounded-lg p-2 text-center 
                  ${daySchedules.length > 0 
                    ? 'bg-blue-50 border-2 border-blue-200' 
                    : 'bg-gray-100 border-2 border-gray-200'}
                `}
              >
                <p className="font-semibold text-sm mb-1">{day}</p>
                <p className="text-xs text-gray-600">
                  {daySchedules.length > 0 
                    ? `${daySchedules.length} class${daySchedules.length > 1 ? 'es' : ''}` 
                    : 'No classes'}
                </p>
              </div>
            );
          })}
        </div>
        
        {/* Detailed Schedule List */}
        <div 
          className="mt-4 space-y-2"
        >
          {instructorData?.schedules?.slice(0, 3).map((schedule, index) => (
            <div
              key={schedule.id}
              className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center hover:shadow-md transition-all"
            >
              <div>
                <h4 className="font-semibold text-gray-800">{schedule.subject}</h4>
                <p className="text-sm text-gray-500">
                  {schedule.days.join(', ')} | {schedule.startTime} - {schedule.endTime}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <MapPinIcon className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-gray-600">{schedule.roomNumber}</span>
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
            className="bg-white rounded-xl p-4 shadow-sm"
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
            className="bg-white rounded-xl p-4 shadow-sm"
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
                  : 'bg-red-50 border-l-4 border-red-500'}
              `}
            >
              <div>
                <p className="font-medium text-gray-800">{activity.studentName}</p>
                <p className="text-sm text-gray-600">{activity.timestamp || 'No time recorded'}</p>
              </div>
              <span className={`
                px-2 py-1 rounded-full text-xs font-medium
                ${activity.status === 'present' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'}
              `}>
                {activity.status === 'present' ? 'Present' : 'Absent'}
              </span>
            </div>
          ))}
        </div>
      </DashboardSection>
    );
  };

  useEffect(() => {
    // Ensure we have a current user
    if (!currentUser) return;

    // Reference to the specific teacher document
    const teacherQuery = query(
      collection(db, 'teachers'), 
      where('instructor', '==', currentUser.uid)
    );

    // Set up real-time listener
    const unsubscribeTeacher = onSnapshot(
      teacherQuery, 
      (snapshot) => {
        if (!snapshot.empty) {
          const teacherDoc = snapshot.docs[0];
          const teacherData = teacherDoc.data();

          // Transform schedules to match Schedule interface
          const fetchedSchedules: Schedule[] = (teacherData.schedules || []).map((schedule: any) => ({
            id: `${teacherDoc.id}_${schedule.subject}_${schedule.day}`,
            subject: schedule.subject,
            days: [schedule.day],
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            roomNumber: schedule.room || '',
            subjectCode: schedule.subject.split(' ')[0] || '',
            section: schedule.section,
            teacherName: teacherData.fullName || teacherData.name
          }));

          // Update instructor data
          setInstructorData(prevData => ({
            ...(prevData || {}),
            id: teacherDoc.id,
            fullName: teacherData.fullName || teacherData.name || '',
            email: teacherData.email || '',
            department: teacherData.department || '',
            schedules: fetchedSchedules,
            subjects: teacherData.subjects || [],
            sections: prevData?.sections || [],
            teacherData: {
              assignedStudents: teacherData.assignedStudents || []
            }
          } as InstructorData));

          // Set initial section if not already set
          if (fetchedSchedules.length > 0 && !selectedSection) {
            const firstValidSection = fetchedSchedules.find(schedule => schedule.section)?.section;
            if (firstValidSection) {
              setSelectedSection(firstValidSection);
            } else if (fetchedSchedules[0].section) {
              setSelectedSection(fetchedSchedules[0].section);
            }
          }
        }
      },
      (error) => {
        console.error('Error fetching real-time teacher data:', error);
      }
    );

    // Cleanup subscription on component unmount
    return () => {
      unsubscribeTeacher();
    };
  }, [currentUser]);

  const safeIncludes = (arr: any[] | undefined, item: any): boolean => {
    return Array.isArray(arr) ? arr.includes(item) : false;
  };

  // Function to determine current class status based on schedule
  const getCurrentClassStatus = () => {
    if (!instructorData?.schedules) {
      return {
        status: 'No Classes',
        color: 'text-gray-500',
        details: 'No scheduled classes today',
        fullName: instructorData?.fullName
      };
    }

    const now = new Date();
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' });
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const currentSchedule = instructorData.schedules.find(schedule => 
      schedule.days.includes(currentDay) &&
      currentTime >= schedule.startTime &&
      currentTime <= schedule.endTime
    );

    if (currentSchedule) {
      return {
        status: 'In Session',
        color: 'text-green-600',
        details: `${currentSchedule.subject} in ${currentSchedule.roomNumber}`,
        fullName: instructorData?.fullName
      };
    }

    // Check for upcoming classes
    const upcomingSchedule = instructorData.schedules
      .filter(schedule => schedule.days.includes(currentDay))
      .find(schedule => currentTime < schedule.startTime);

    if (upcomingSchedule) {
      return {
        status: 'Upcoming',
        color: 'text-blue-600',
        details: `Next: ${upcomingSchedule.subject} at ${upcomingSchedule.startTime}`,
        fullName: instructorData?.fullName
      };
    }

    return {
      status: 'No Active Classes',
      color: 'text-gray-500',
      details: 'No classes scheduled for today',
      fullName: instructorData?.fullName
    };
  };

  const getClassStatus = useMemo(() => {
    if (!instructorData?.schedules || !instructorData.schedules.length) {
      return 'No Schedule';
    }
    
  
    const currentTime = new Date();
    const now = currentTime.getHours() * 60 + currentTime.getMinutes(); // Convert current time to minutes in 24-hour format
  
    // Find the schedule for today
    const todaySchedule = instructorData.schedules.find(schedule => 
      safeIncludes(schedule.days, 
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

  const AnimatedDashboardCard = ({ 
    title, 
    children, 
    className = '', 
    onClick 
  }: { 
    title: string, 
    children: React.ReactNode, 
    className?: string, 
    onClick?: () => void 
  }) => (
    <div
      className={`bg-white shadow-lg rounded-xl p-6 space-y-4 border border-gray-100 hover:shadow-xl transition-all duration-300 ${className}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
        {onClick && (
          <button 
            className="text-blue-500 hover:text-blue-600"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        )}
      </div>
      {children}
    </div>
  );

  const RefreshButton = ({ onRefresh }: { onRefresh: () => void }) => (
    <button
      onClick={onRefresh}
      className="text-gray-500 hover:text-blue-600 transition-colors duration-300"
    >
      <ViewfinderCircleIcon className="h-6 w-6" />
    </button>
  );

  const filteredStudents = useMemo(() => {
    if (!instructorData?.sections) return [];
    
    return instructorData.sections.flatMap(section => 
      section.students?.filter(studentId => 
        safeIncludes(
          instructorData.teacherData?.assignedStudents, 
          studentId
        )
      ) || []
    );
  }, [instructorData?.sections, instructorData?.teacherData?.assignedStudents]);

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
      ? (presentStudents.length / totalStudents) * 100 
      : 0;
    
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

  if (!instructorData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
        <NavBar 
          currentTime={currentTime}
          instructor={{
            fullName: instructorData?.fullName || 'Instructor',
            department: instructorData?.department || 'Department'
          }}
          classStatus={getCurrentClassStatus()}
        />
        
        <main className="container mx-auto px-6 py-8 mt-16">  
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Profile and Class Overview */}
            <div className="md:col-span-2 space-y-8">
              <DashboardSection title="Welcome, Instructor">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    Welcome, {instructorData.fullName.split(' ')[0]}
                  </h2>
                  <span className={`
                    px-3 py-1 rounded-full text-sm font-medium
                    ${
                      getClassStatus === 'Class In Session' 
                        ? 'bg-green-100 text-green-800' 
                        : getClassStatus === 'Class Ended' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {getClassStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Current Schedule</h3>
                    {instructorData.schedules[0] ? (
                      <div className="space-y-2 text-gray-600">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-5 h-5 text-indigo-500" />
                          <span>{instructorData.schedules[0].startTime} - {instructorData.schedules[0].endTime}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5 text-indigo-500" />
                          <span>{instructorData.schedules[0].days?.join(', ') || 'No days'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="w-5 h-5 text-indigo-500" />
                          <span>Room {instructorData.schedules[0].roomNumber}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">No schedule assigned</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Assigned Subjects</h3>
                    {renderSubjectsSection()}
                  </div>
                </div>
              </DashboardSection>

              {/* Quick Stats */}
              {renderQuickStats()}
            </div>

            {/* Sidebar with Recent Activities and Attendance Management */}
            <div className="space-y-8">
              <DashboardSection title="Recent Activities">
                {recentAttendance.length > 0 ? (
                  <div className="space-y-4">
                    {recentAttendance.slice(0, 5).map((activity) => (
                      <div 
                        key={activity.id} 
                        className="bg-gray-100 rounded-lg p-3 flex items-center gap-3"
                      >
                        <div className="bg-indigo-100 p-2 rounded-full">
                          <UsersIcon className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{activity.studentName}</p>
                          <p className="text-sm text-gray-600">{activity.subject}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {activity.date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">No recent activities</p>
                )}
              </DashboardSection>

              <DashboardSection title="Attendance Management">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Attendance Management</h2>
                  <button 
                    onClick={() => navigate('/attendance')}
                    className="text-sm text-indigo-600 hover:text-indigo-800 transition"
                  >
                    View Full Attendance
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Section Selector */}
                  {instructorData.sections?.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Section
                      </label>
                      <select 
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {instructorData.sections.map(section => (
                          <option key={section.id} value={section.id}>
                            Section {section.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Attendance Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-600">Present</p>
                      <p className="text-2xl font-bold text-green-600">
                        {recentAttendance.filter(r => r.status === 'present').length}
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-600">Late</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {recentAttendance.filter(r => r.status === 'late').length}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-600">Absent</p>
                      <p className="text-2xl font-bold text-red-600">
                        {recentAttendance.filter(r => r.status === 'absent').length}
                      </p>
                    </div>
                  </div>

                  {/* Attendance List */}
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Attendance</h3>
                    {recentAttendance.length > 0 ? (
                      <div className="space-y-3">
                        {recentAttendance.slice(0, 5).map((record) => (
                          <div 
                            key={record.id} 
                            className="flex items-center justify-between bg-gray-100 p-3 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`
                                w-2 h-2 rounded-full
                                ${
                                  record.status === 'present' ? 'bg-green-500' :
                                  record.status === 'late' ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }
                              `}></div>
                              <div>
                                <p className="font-medium text-gray-800">{record.studentName}</p>
                                <p className="text-sm text-gray-600">{record.subject}</p>
                              </div>
                            </div>
                            <span className={`
                              px-2 py-1 rounded-full text-xs font-medium
                              ${
                                record.status === 'present' ? 'bg-green-100 text-green-800' :
                                record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }
                            `}>
                              {record.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500">No recent attendance records</p>
                    )}
                  </div>

                  {/* Take Attendance Button */}
                  <div className="mt-4">
                    <button
                      onClick={() => navigate('/instructor/take-attendance')}
                      className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center space-x-2"
                    >
                      <DocumentCheckIcon className="w-6 h-6" />
                      <span>Take Attendance</span>
                    </button>
                  </div>
                </div>
              </DashboardSection>
              {renderScheduleCalendar()}
              {renderAttendanceInsights()}
              <GeminiChatbot />
            </div>  
          </div>
        </main>
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
