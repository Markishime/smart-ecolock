import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
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
  ChartBarIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
  BellIcon,
  ClipboardDocumentListIcon,
  DocumentIcon,
  TableCellsIcon,
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
import debounce from 'lodash/debounce';

interface TeacherSchedule {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  subject: string;
  section: string;
  sectionId: string;
  instructorName: string;
}

interface Section {
  id: string;
  name: string;
  students: string[];
  instructorId: string;
  room?: string;
  subjectId?: string;
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
  schedules: TeacherSchedule[];
  subjects: Subject[];
  assignedStudents: string[];
}

interface RoomStatus {
  occupancy: boolean;
  roomId: string;
}

interface ScheduleStatus {
  status: string;
  color: string;
  details: string;
  subject?: string;
  room?: string;
  timeRemaining?: string;
}

interface AttendanceRecord {
  id: string;
  studentName: string;
  studentEmail: string;
  date: string;
  time: string;
  status: 'present' | 'late' | 'absent';
  subjectName: string;
  room: string;
  timeIn?: string;
  timeOut?: string;
  sensor?: string;
  sectionId: string;
}

interface Student {
  name: string;
  email: string;
}

interface SortConfig {
  key: keyof AttendanceRecord;
  direction: 'asc' | 'desc';
}

interface DateRange {
  start: string;
  end: string;
}

interface StudentPerformance {
  name: string;
  absences?: number;
  attendanceRate?: number;
}

interface AttendancePattern {
  time: string;
  rate: number;
}

const travelThemeColors = {
  primary: 'from-teal-500 to-emerald-600',
  background: 'from-teal-50 via-sky-50 to-emerald-50',
  accent: 'from-indigo-500 to-purple-600',
};

const getScheduleStatus = (schedules: TeacherSchedule[]): ScheduleStatus => {
  const now = new Date();
  const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false });

  const todaySchedules = schedules
    .filter(schedule => schedule.day === currentDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todaySchedules.length === 0) {
    return {
      status: 'No Classes Today',
      color: 'bg-gray-100 text-gray-800',
      details: currentDay
    };
  }

  const currentSchedule = todaySchedules.find(
    schedule => currentTimeStr >= schedule.startTime && currentTimeStr <= schedule.endTime
  );

  const upcomingSchedule = todaySchedules.find(
    schedule => currentTimeStr < schedule.startTime
  );

  if (currentSchedule) {
    const endTime = new Date(now);
    const [endHour, endMinute] = currentSchedule.endTime.split(':').map(Number);
    endTime.setHours(endHour, endMinute, 0);
    const minutesRemaining = Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60));

    return {
      status: 'Class In Session',
      color: 'bg-green-100 text-green-800',
      details: `${minutesRemaining} minutes remaining`,
      subject: currentSchedule.subject,
      room: currentSchedule.room
    };
  }

  if (upcomingSchedule) {
    const startTime = new Date(now);
    const [startHour, startMinute] = upcomingSchedule.startTime.split(':').map(Number);
    startTime.setHours(startHour, startMinute, 0);
    const minutesUntilStart = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));

    if (minutesUntilStart <= 30) {
      return {
        status: 'Starting Soon',
        color: 'bg-cyan-100 text-cyan-800',
        details: `Starts in ${minutesUntilStart} minutes`,
        subject: upcomingSchedule.subject,
        room: upcomingSchedule.room
      };
    }

    return {
      status: 'Next Class',
      color: 'bg-blue-100 text-blue-800',
      details: `Starts at ${upcomingSchedule.startTime}`,
      subject: upcomingSchedule.subject,
      room: upcomingSchedule.room
    };
  }

  const lastSchedule = todaySchedules[todaySchedules.length - 1];
  return {
    status: 'Classes Ended',
    color: 'bg-amber-100 text-amber-800',
    details: `Last class: ${lastSchedule.subject}`,
    subject: lastSchedule.subject,
    room: lastSchedule.room
  };
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
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>({
    status: 'Loading...',
    color: 'bg-gray-100 text-gray-800',
    details: 'Fetching schedule...'
  });

  // Add state for teacher's schedule
  const [teacherSchedule, setTeacherSchedule] = useState<TeacherSchedule[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<'weekly' | 'monthly'>('weekly');

  // New state variables for filtering and sorting
  const [statusFilter, setStatusFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: '',
    end: '',
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'studentName',
    direction: 'desc',
  });

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query);
    }, 300),
    []
  );

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Fetch Teacher Schedule from Firestore
    const fetchTeacherSchedule = async () => {
      try {
        const teacherRef = doc(db, 'teachers', currentUser.uid);
        const unsubscribeTeacher = onSnapshot(teacherRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Extract schedules from assignedSubjects
            const schedules: TeacherSchedule[] = [];
            if (data.assignedSubjects && Array.isArray(data.assignedSubjects)) {
              data.assignedSubjects.forEach((subject: any) => {
                if (subject.sections && Array.isArray(subject.sections)) {
                  subject.sections.forEach((section: any) => {
                    if (section.schedules && Array.isArray(section.schedules)) {
                      section.schedules.forEach((schedule: any) => {
                        schedules.push({
                          day: schedule.day || '',
                          startTime: schedule.startTime || '',
                          endTime: schedule.endTime || '',
                          room: schedule.roomName || '',
                          subject: subject.name || '',
                          section: section.name || '',
                          sectionId: section.id || '',
                          instructorName: data.fullName || 'Instructor',
                        });
                      });
                    }
                  });
                }
              });
            }

            setTeacherSchedule(schedules);
            setInstructorData({
              id: currentUser.uid,
              fullName: data.fullName || 'Instructor',
              email: data.email || '',
              department: data.department || 'N/A',
              schedules: schedules,
              subjects: data.assignedSubjects || [],
              assignedStudents: data.assignedStudents || [],
            });

            // Update schedule status immediately
            if (schedules.length > 0) {
              setScheduleStatus(getScheduleStatus(schedules));
            }
          } else {
            Swal.fire('Error', 'Instructor data not found', 'error');
            setInstructorData(null);
          }
          setLoading(false);
        });

        return () => unsubscribeTeacher();
      } catch (error) {
        console.error('Error fetching teacher schedule:', error);
        setLoading(false);
      }
    };

    fetchTeacherSchedule();

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

      const active = instructorData?.schedules?.filter((s) => {
        // Skip this schedule if startTime is undefined or doesn't contain the expected format
        if (!s.startTime || !s.endTime || !s.startTime.includes(':') || !s.endTime.includes(':')) {
          return false;
        }
        
        try {
          // Use direct time extraction instead of assuming "startTime - endTime" format
          const startTimeParts = s.startTime.split(':').map(Number);
          const endTimeParts = s.endTime.split(':').map(Number);
          
          // Ensure we have valid time parts
          if (startTimeParts.length < 2 || endTimeParts.length < 2 || 
              isNaN(startTimeParts[0]) || isNaN(startTimeParts[1]) || 
              isNaN(endTimeParts[0]) || isNaN(endTimeParts[1])) {
            return false;
          }
          
          const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
          const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];
          
          return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } catch (error) {
          console.error('Error parsing schedule time:', error);
          return false;
        }
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
      unsubscribeStudents();
      unsubscribeAttendance();
      off(roomsRef);
      clearInterval(interval);
    };
  }, [currentUser, navigate]);

  // Add attendance-related useEffect
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Fetch sections
    const sectionsQuery = query(collection(db, 'sections'), where('instructorId', '==', currentUser.uid));
    const unsubscribeSections = onSnapshot(sectionsQuery, (snapshot) => {
      const sectionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Section[];
      setSections(sectionsData);
    });

    // Fetch attendance records
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('submittedBy.id', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const records = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];
      setAttendanceRecords(records);
    });

    return () => {
      unsubscribeSections();
      unsubscribeAttendance();
    };
  }, [currentUser]);

  // Calculate attendance stats
  const attendanceStats = useMemo(() => {
    const section = sections.find((s) => s.id === selectedSection);
    const totalStudents = section?.students.length || 0;
    const relevantRecords = attendanceRecords.filter((r) => r.sectionId === selectedSection);
    const present = relevantRecords.filter((r) => r.status === 'present').length;
    const late = relevantRecords.filter((r) => r.status === 'late').length;
    const absent = relevantRecords.filter((r) => r.status === 'absent').length;
    const attendanceRate = totalStudents ? ((present + late) / (present + late + absent || 1)) * 100 : 0;

    return {
      totalStudents,
      present,
      late,
      absent,
      attendanceRate,
    };
  }, [attendanceRecords, sections, selectedSection]);

  const todaySchedule = useMemo(() => {
    const today = currentTime.toLocaleString('en-US', { weekday: 'long' }); // e.g., "Wednesday"
    return teacherSchedule
      .filter((s) => s.day.toLowerCase() === today.toLowerCase())
      .sort((a, b) => {
        const timeA = a.startTime.split(':').map(Number);
        const timeB = b.startTime.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
      });
  }, [teacherSchedule, currentTime]);

  const weeklySchedule = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.map((day) => ({
      day,
      schedules: teacherSchedule
        .filter((s) => s.day.toLowerCase() === day.toLowerCase())
        .sort((a, b) => {
          const timeA = a.startTime.split(':').map(Number);
          const timeB = b.startTime.split(':').map(Number);
          return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
        })
    }));
  }, [teacherSchedule]);

  const sortRecords = (records: AttendanceRecord[]) => {
    if (!sortConfig.key) return records;
    
    return [...records].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue === undefined || bValue === undefined) return 0;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
  };

  const handleSort = (key: keyof AttendanceRecord) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredRecords = useMemo(() => {
    let filtered = attendanceRecords;
    
    if (selectedSection) {
      filtered = filtered.filter(record => record.sectionId === selectedSection);
    }
    
    if (subjectFilter) {
      filtered = filtered.filter(record => record.subjectName === subjectFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record => 
        record.studentName.toLowerCase().includes(query) ||
        record.studentEmail.toLowerCase().includes(query)
      );
    }
    
    return sortRecords(filtered);
  }, [attendanceRecords, selectedSection, subjectFilter, searchQuery, sortConfig]);

  // Data insights calculations
  const frequentAbsentees = useMemo(() => {
    const studentAbsences = new Map<string, number>();
    filteredRecords.forEach((record) => {
      if (record.status === 'absent') {
        studentAbsences.set(
          record.studentName,
          (studentAbsences.get(record.studentName) || 0) + 1
        );
      }
    });
    return Array.from(studentAbsences.entries())
      .map(([name, absences]) => ({ name, absences }))
      .sort((a, b) => b.absences - a.absences)
      .slice(0, 5);
  }, [filteredRecords]);

  const bestPerformers = useMemo(() => {
    const studentAttendance = new Map<string, { present: number; total: number }>();
    filteredRecords.forEach((record) => {
      const stats = studentAttendance.get(record.studentName) || { present: 0, total: 0 };
      stats.total++;
      if (record.status === 'present' || record.status === 'late') {
        stats.present++;
      }
      studentAttendance.set(record.studentName, stats);
    });
    return Array.from(studentAttendance.entries())
      .map(([name, stats]) => ({
        name,
        attendanceRate: Math.round((stats.present / stats.total) * 100),
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 5);
  }, [filteredRecords]);

  const attendancePatterns = useMemo<AttendancePattern[]>(() => {
    const patterns: { [key: string]: number } = {};
    const total: { [key: string]: number } = {};

    filteredRecords.forEach(record => {
      const time = record.time;
      if (!patterns[time]) {
        patterns[time] = 0;
        total[time] = 0;
      }
      if (record.status === 'present') {
        patterns[time]++;
      }
      total[time]++;
    });

    return Object.keys(patterns).map(time => ({
      time,
      rate: (patterns[time] / total[time]) * 100
    }));
  }, [filteredRecords]);

  const exportCSV = () => {
    if (!selectedSection) {
      Swal.fire({
        icon: 'warning',
        title: 'No Section Selected',
        text: 'Please select a section to export attendance records.'
      });
      return;
    }

    if (!attendanceRecords.length) {
      Swal.fire({
        icon: 'warning',
        title: 'No Records Found',
        text: 'There are no attendance records to export for the selected section.'
      });
      return;
    }

    const headers = [
      'Student Name',
      'Student Email',
      'Date',
      'Time',
      'Status',
      'Subject',
      'Room',
      'Time In',
      'Time Out',
      'Sensor'
    ].join(',');

    const rows = attendanceRecords.map(record => [
      record.studentName,
      record.studentEmail,
      record.date,
      record.time,
      record.status,
      record.subjectName,
      record.room,
      record.timeIn || '',
      record.timeOut || '',
      record.sensor || ''
    ].map(field => `"${field}"`).join(','));

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export handlers
  const exportPDF = () => {
    // TODO: Implement PDF export
    Swal.fire('Coming Soon', 'PDF export feature will be available soon!', 'info');
  };

  const exportExcel = () => {
    // TODO: Implement Excel export
    Swal.fire('Coming Soon', 'Excel export feature will be available soon!', 'info');
  };

  const scheduleReport = () => {
    // TODO: Implement report scheduling
    Swal.fire('Coming Soon', 'Report scheduling feature will be available soon!', 'info');
  };

  const handleViewDetails = (record: AttendanceRecord) => {
    // TODO: Implement view details functionality
    Swal.fire('Coming Soon', 'View details feature will be available soon!', 'info');
  };

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
        user={{
          role: 'instructor',
          fullName: instructorData?.fullName || 'Instructor',
          department: instructorData?.department || 'Loading...',
        }}
        classStatus={{
          status: scheduleStatus.status,
          color: scheduleStatus.color.replace('bg-', 'border-l-').replace('text-', ''),
          details: scheduleStatus.subject 
            ? `${scheduleStatus.subject} - Room ${scheduleStatus.room} (${scheduleStatus.details})`
            : scheduleStatus.details,
          fullName: instructorData?.fullName || 'Instructor',
        }}
      />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 mt-16">
        <div className="grid grid-cols-1 gap-6 sm:gap-8">
          {/* Main Content */}
          <div className="space-y-6 sm:space-y-8">
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
            </motion.section>

            {/* Attendance Management Section */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-gray-100/50"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                    <ClipboardDocumentCheckIcon className="h-6 w-6 text-indigo-600 mr-2" />
                    Attendance Management
                  </h2>
                  <p className="text-gray-600 mt-1">Track and manage student attendance</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="border rounded-lg px-4 py-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto shadow-sm"
                  >
                    <option value="">Select Section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name} {section.room ? `(Room ${section.room})` : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value as 'weekly' | 'monthly')}
                    className="border rounded-lg px-4 py-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto shadow-sm"
                  >
                    <option value="weekly">Weekly View</option>
                    <option value="monthly">Monthly View</option>
                  </select>
                </div>
              </div>

              {selectedSection && (
                <>
                  {/* Attendance Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      {
                        label: 'Total Students',
                        value: attendanceStats.totalStudents,
                        icon: UsersIcon,
                        color: 'from-teal-50 to-emerald-50',
                      },
                      {
                        label: 'Present',
                        value: attendanceStats.present,
                        icon: CheckCircleIcon,
                        color: 'from-green-50 to-emerald-50',
                      },
                      {
                        label: 'Late',
                        value: attendanceStats.late,
                        icon: ClockIcon,
                        color: 'from-yellow-50 to-amber-50',
                      },
                      {
                        label: 'Attendance Rate',
                        value: `${attendanceStats.attendanceRate.toFixed(1)}%`,
                        icon: ChartBarIcon,
                        color: 'from-blue-50 to-indigo-50',
                      },
                    ].map((stat) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        className={`bg-gradient-to-br ${stat.color} rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100/50`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">{stat.label}</p>
                            <h3 className="text-xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                          </div>
                          <div className="p-2 bg-white/50 rounded-full shadow-sm">
                            <stat.icon className={`h-6 w-6 ${stat.color.replace('from-', 'text-').replace('to-', '')}`} />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Search and Export */}
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Search Input */}
                      <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search students..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            debouncedSearch(e.target.value);
                          }}
                          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm shadow-sm"
                        />
                      </div>

                      {/* Status Filter */}
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border rounded-lg px-4 py-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      >
                        <option value="">All Status</option>
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                      </select>

                      {/* Subject Filter */}
                      <select
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                        className="border rounded-lg px-4 py-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      >
                        <option value="">All Subjects</option>
                        {sections.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>

                      {/* Date Range Picker */}
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={dateRange.start}
                          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                          className="border rounded-lg px-4 py-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                        <input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                          className="border rounded-lg px-4 py-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Export Options */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Export CSV
                      </button>
                      <button
                        onClick={exportPDF}
                        className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-red-700 hover:to-pink-700 transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        <DocumentIcon className="w-5 h-5" />
                        Export PDF
                      </button>
                      <button
                        onClick={exportExcel}
                        className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        <TableCellsIcon className="w-5 h-5" />
                        Export Excel
                      </button>
                      <button
                        onClick={scheduleReport}
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        <CalendarIcon className="w-5 h-5" />
                        Schedule Report
                      </button>
                    </div>
                  </div>

                  {/* Data Insights */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Most Frequent Absentees */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100/50"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Frequent Absentees</h3>
                      <div className="space-y-2">
                        {frequentAbsentees.map((student, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-900">{student.name}</span>
                            <span className="text-sm text-red-600">{student.absences} absences</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Best Attendance Performers */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100/50"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Best Attendance Performers</h3>
                      <div className="space-y-2">
                        {bestPerformers.map((student, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-900">{student.name}</span>
                            <span className="text-sm text-green-600">{student.attendanceRate}%</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Attendance Patterns */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100/50"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Patterns</h3>
                      <div className="space-y-2">
                        {attendancePatterns.map((pattern: AttendancePattern, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-900">{pattern.time}</span>
                            <span className="text-sm text-blue-600">{pattern.rate.toFixed(1)}% attendance</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  {/* Attendance Records Table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-gray-50 to-white">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('studentName')}>
                            Student {sortConfig.key === 'studentName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>
                            Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('time')}>
                            Time {sortConfig.key === 'time' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                            Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort('subjectName')}
                          >
                            Subject
                            {sortConfig.key === 'subjectName' && (
                              <span className="ml-1">
                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('room')}>
                            Room {sortConfig.key === 'room' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50 transition-colors duration-200">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-sm">
                                    <span className="text-indigo-600 font-medium">
                                      {record.studentName.split(' ').map((n) => n[0]).join('')}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{record.studentName}</div>
                                  <div className="text-sm text-gray-500">{record.studentEmail}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(record.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {record.time}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  record.status === 'present'
                                    ? 'bg-green-100 text-green-800'
                                    : record.status === 'late'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {record.subjectName}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {record.room}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              <button
                                onClick={() => handleViewDetails(record)}
                                className="text-indigo-600 hover:text-indigo-900 font-medium transition-colors duration-200"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.section>

            {/* Weekly Schedule Section */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-gray-100/50"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                    <CalendarIcon className="h-6 w-6 text-indigo-600 mr-2" />
                    Weekly Schedule
                  </h2>
                  <p className="text-gray-600 mt-1">View your teaching schedule for the week</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Current Week:</span>
                  <span className="text-sm font-medium text-indigo-600">
                    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} -{' '}
                    {new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {weeklySchedule.map(({ day, schedules }) => (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="p-4 sm:p-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100/50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-semibold text-indigo-800 text-base sm:text-lg">{day}</p>
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                        {schedules.length} {schedules.length === 1 ? 'Class' : 'Classes'}
                      </span>
                    </div>
                    {schedules.length > 0 ? (
                      <div className="space-y-3">
                        {schedules.map((s, index) => (
                          <motion.div
                            key={`${s.sectionId}-${index}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-3 bg-white/50 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-sm font-medium text-gray-900">{s.subject}</p>
                              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                                {s.section}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center text-xs text-gray-600">
                                <ClockIcon className="h-4 w-4 mr-2 text-indigo-500" />
                                <span>{s.startTime} - {s.endTime}</span>
                              </div>
                              {s.room && (
                                <div className="flex items-center text-xs text-gray-600">
                                  <MapPinIcon className="h-4 w-4 mr-2 text-indigo-500" />
                                  <span>Room {s.room}</span>
                                </div>
                              )}
                              <div className="flex items-center text-xs text-gray-600">
                                <UsersIcon className="h-4 w-4 mr-2 text-indigo-500" />
                                <span>{s.instructorName}</span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 italic">No classes scheduled</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
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