import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  sectionId: string;
}

interface AttendanceInfo {
  action: string;
  assignedSensorId: string;
  date: string;
  sensor: string;
  sensorConfirmed: boolean;
  sessionId: string;
  status: string;
  timeIn: string;
  timeOut: string;
  timestamp: string;
  weight: number;
  weightUnit: string;
}

interface Student {
  uid: string;
  fullName: string;
  email: string;
  department: string;
  idNumber: string;
  mobileNumber: string;
  role: string;
  createdAt: string;
  lastUpdated: string;
  rfidUid: string;
  schedules: TeacherSchedule[];
  lastSession: string;
  latestAttendanceStatus?: string;
  attendance?: {
    [key: string]: {
      attendanceInfo: AttendanceInfo;
    };
  };
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
    .filter((schedule) => schedule.day === currentDay && schedule.startTime && schedule.endTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todaySchedules.length === 0) {
    return {
      status: 'No Classes Today',
      color: 'bg-gray-100 text-gray-800',
      details: currentDay,
    };
  }

  const currentSchedule = todaySchedules.find(
    (schedule) => currentTimeStr >= schedule.startTime && currentTimeStr <= schedule.endTime
  );

  const upcomingSchedule = todaySchedules.find((schedule) => currentTimeStr < schedule.startTime);

  if (currentSchedule) {
    try {
      const endTime = new Date(now);
      const [endHour, endMinute] = currentSchedule.endTime.split(':').map(Number);
      endTime.setHours(endHour, endMinute, 0);
      const minutesRemaining = Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60));

      return {
        status: 'Class In Session',
        color: 'bg-green-100 text-green-800',
        details: `${minutesRemaining} minutes remaining`,
        subject: currentSchedule.subject,
        room: currentSchedule.room,
      };
    } catch (error) {
      console.error('Error parsing current schedule time:', error);
      return {
        status: 'Error',
        color: 'bg-red-100 text-red-800',
        details: 'Invalid schedule time format',
      };
    }
  }

  if (upcomingSchedule) {
    try {
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
          room: upcomingSchedule.room,
        };
      }

      return {
        status: 'Next Class',
        color: 'bg-blue-100 text-blue-800',
        details: `Starts at ${upcomingSchedule.startTime}`,
        subject: upcomingSchedule.subject,
        room: upcomingSchedule.room,
      };
    } catch (error) {
      console.error('Error parsing upcoming schedule time:', error);
      return {
        status: 'Error',
        color: 'bg-red-100 text-red-800',
        details: 'Invalid schedule time format',
      };
    }
  }

  const lastSchedule = todaySchedules[todaySchedules.length - 1];
  return {
    status: 'Classes Ended',
    color: 'bg-amber-100 text-amber-800',
    details: lastSchedule ? `Last class: ${lastSchedule.subject}` : 'No classes today',
    subject: lastSchedule?.subject,
    room: lastSchedule?.room,
  };
};

const InstructorDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [instructorData, setInstructorData] = useState<InstructorData | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>({
    status: 'Loading...',
    color: 'bg-gray-100 text-gray-800',
    details: 'Fetching schedule...',
  });
  const [teacherSchedule, setTeacherSchedule] = useState<TeacherSchedule[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);

  const debouncedStudentSearch = useCallback(
    debounce((query: string) => setStudentSearchQuery(query), 300),
    []
  );

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchTeacherSchedule = async () => {
      try {
        const teacherRef = doc(db, 'teachers', currentUser.uid);
        const unsubscribeTeacher = onSnapshot(teacherRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
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
              schedules,
              subjects: data.assignedSubjects || [],
              assignedStudents: data.assignedStudents || [],
            });

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

    const studentsQuery = query(collection(db, 'students'), where('teacherId', '==', currentUser.uid));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setTotalStudents(snapshot.size);
    });

    const studentsRef = ref(rtdb, 'Students');
    const unsubscribeStudentsRTDB = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const studentList: Student[] = Object.entries(data).map(([uid, studentData]: [string, any]) => {
          let latestAttendanceStatus = 'N/A';
          let lastSession = 'N/A';

          if (studentData.Attendance) {
            const attendanceEntries = Object.entries(studentData.Attendance);
            if (attendanceEntries.length > 0) {
              const [latestSessionId, latestAttendance] = attendanceEntries[attendanceEntries.length - 1];
              lastSession = latestSessionId;
              latestAttendanceStatus = (latestAttendance as { attendanceInfo: AttendanceInfo }).attendanceInfo?.status || 'N/A';
            }
          }

          return {
            uid,
            fullName: studentData.Profile?.fullName || 'Unknown',
            email: studentData.Profile?.email || 'N/A',
            department: studentData.Profile?.department || 'N/A',
            idNumber: studentData.Profile?.idNumber || 'N/A',
            mobileNumber: studentData.Profile?.mobileNumber || 'N/A',
            role: studentData.Profile?.role || 'student',
            createdAt: studentData.Profile?.createdAt || 'N/A',
            lastUpdated: studentData.Profile?.lastUpdated || 'N/A',
            rfidUid: studentData.Profile?.rfidUid || 'N/A',
            schedules: studentData.Profile?.schedules || [],
            lastSession,
            latestAttendanceStatus,
            attendance: studentData.Attendance || {},
          };
        });
        setStudents(studentList);
      } else {
        setStudents([]);
      }
    });

    return () => {
      unsubscribeStudents();
      off(studentsRef);
    };
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const sectionsQuery = query(collection(db, 'sections'), where('instructorId', '==', currentUser.uid));
    const unsubscribeSections = onSnapshot(sectionsQuery, (snapshot) => {
      const sectionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Section[];
      setSections(sectionsData);
    });

    return () => {
      unsubscribeSections();
    };
  }, [currentUser]);

  const filteredStudents = useMemo(() => {
    let filtered = students;

    if (selectedSection) {
      const section = sections.find((s) => s.id === selectedSection);
      if (section) {
        filtered = filtered.filter((student) =>
          student.schedules.some((schedule) => schedule.sectionId === selectedSection)
        );
      }
    }

    if (studentSearchQuery) {
      const query = studentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.fullName.toLowerCase().includes(query) || student.email.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [students, selectedSection, studentSearchQuery, sections]);

  const handleViewStudentDetails = (student: Student) => {
    Swal.fire({
      title: student.fullName,
      html: `
        <div class="text-left">
          <p><strong>Email:</strong> ${student.email}</p>
          <p><strong>Department:</strong> ${student.department}</p>
          <p><strong>ID Number:</strong> ${student.idNumber}</p>
          <p><strong>Mobile Number:</strong> ${student.mobileNumber}</p>
          <p><strong>Created At:</strong> ${new Date(student.createdAt).toLocaleString()}</p>
          <p><strong>Last Updated:</strong> ${new Date(student.lastUpdated).toLocaleString()}</p>
          <p><strong>RFID UID:</strong> ${student.rfidUid}</p>
          <p><strong>Last Session:</strong> ${student.lastSession}</p>
          <p><strong>Latest Class Status:</strong> ${student.latestAttendanceStatus}</p>
          <h3 class="mt-4 font-semibold">Schedules:</h3>
          <ul class="list-disc pl-5">
            ${student.schedules
              .map(
                (s) =>
                  `<li>${s.subject} (${s.section}) - ${s.day} ${s.startTime}-${s.endTime} in Room ${s.room}</li>`
              )
              .join('')}
          </ul>
          <h3 class="mt-4 font-semibold">Recent Attendance:</h3>
          <ul class="list-disc pl-5">
            ${Object.entries(student.attendance || {})
              .slice(-5)
              .map(
                ([sessionId, record]: [string, any]) =>
                  `<li>${sessionId}: ${record.attendanceInfo?.status || 'N/A'} (${record.attendanceInfo?.timeIn || 'N/A'})</li>`
              )
              .join('')}
          </ul>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Close',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-teal-50 to-emerald-50">
        <div className="w-12 h-12 sm:w-16 sm:h-16 border-t-4 border-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!instructorData) {
    return (
      <div className="text-center p-6 sm:p-8 text-gray-700 text-base sm:text-lg">
        No instructor data available
      </div>
    );
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
          <div className="space-y-6 sm:space-y-8">
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

            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-gray-100/50"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                    <UsersIcon className="h-6 w-6 text-indigo-600 mr-2" />
                    Student Management
                  </h2>
                  <p className="text-gray-600 mt-1">View and manage student details</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="border rounded-lg px-4 py-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto shadow-sm"
                  >
                    <option value="">All Sections</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name} {section.room ? `(Room ${section.room})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative mb-6">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students by name or email..."
                  value={studentSearchQuery}
                  onChange={(e) => {
                    setStudentSearchQuery(e.target.value);
                    debouncedStudentSearch(e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm shadow-sm"
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID Number
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mobile
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Latest Class Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <tr key={student.uid} className="hover:bg-gray-50 transition-colors duration-200">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-sm">
                                  <span className="text-indigo-600 font-medium">
                                    {student.fullName.split(' ').map((n) => n[0]).join('')}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{student.fullName}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {student.email}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {student.department}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {student.idNumber}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {student.mobileNumber}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                student.latestAttendanceStatus === 'Present'
                                  ? 'bg-green-100 text-green-800'
                                  : student.latestAttendanceStatus === 'Late'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : student.latestAttendanceStatus === 'Absent'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {student.latestAttendanceStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => handleViewStudentDetails(student)}
                              className="text-indigo-600 hover:text-indigo-900 font-medium transition-colors duration-200"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-3 text-center text-sm text-gray-500"
                        >
                          No students found for the selected section or search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
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
                    {new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const daySchedules = teacherSchedule.filter((s) => s.day === day);
                  return (
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
                          {daySchedules.length} {daySchedules.length === 1 ? 'Class' : 'Classes'}
                        </span>
                      </div>
                      {daySchedules.length > 0 ? (
                        <div className="space-y-3">
                          {daySchedules.map((s, index) => (
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
                                  <span>
                                    {s.startTime} - {s.endTime}
                                  </span>
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
                  );
                })}
              </div>
            </motion.section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstructorDashboard;
