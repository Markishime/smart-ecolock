import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { useAuth } from './AuthContext';
import NavBar from '../components/NavBar';
import {
  CalendarIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SeatPlanLayout from '../components/SeatPlanLayout';
import Swal from 'sweetalert2';

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
  email: string;
  mobileNumber?: string;
  department?: string;
  role?: string;
  major?: string;
  sections?: string[];
  attendance?: {
    [key: string]: AttendanceRecordRTDB;
  };
}

interface Section {
  id: string;
  name: string;
  students: string[];
  instructorId?: string;
  room?: string;
  subjectId: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  sectionId: string;
  sectionName: string;
  subjectId: string;
  room: string;
  status: 'present' | 'absent' | 'late';
  confirmed: boolean;
  rfidAuthenticated: boolean;
  weightAuthenticated: boolean;
  timestamp: { seconds: number; nanoseconds: number };
  date: string;
  submittedBy: { id: string };
}

interface AttendanceRecordRTDB {
  allSchedules: {
    day: string;
    endTime: string;
    instructorName: string;
    roomName: string;
    section: string;
    sectionId: string;
    startTime: string;
    subject: string;
    subjectCode: string;
  }[];
  attendanceInfo: {
    action: string;
    assignedSensorId: number;
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
  };
  personalInfo: {
    department: string;
    email: string;
    fullName: string;
    idNumber: string;
    mobileNumber: string;
    role: string;
  };
  scheduleMatched: {
    day: string;
    endTime: string;
    instructorName: string;
    roomName: string;
    section: string;
    sectionId: string;
    startTime: string;
    subject: string;
    subjectCode: string;
  };
}

interface ScheduleRTDB {
  day: string;
  startTime: string;
  endTime: string;
  instructorName: string;
  roomName: string;
  section: string;
  sectionId: string;
  subject: string;
  subjectCode: string;
}

interface AttendanceSummary {
  weekly: { present: number; late: number; absent: number };
  monthly: { present: number; late: number; absent: number };
  detailedRecords: {
    weekly: AttendanceRecordRTDB[];
    monthly: AttendanceRecordRTDB[];
  };
}

interface AttendanceStats {
  totalStudents: number;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string;
  sectionId: string;
  subjectCode: string;
}

const AttendanceManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [instructorDetails, setInstructorDetails] = useState<{
    fullName: string;
    department: string;
    role: 'admin' | 'instructor' | 'student';
  }>({
    fullName: currentUser?.displayName || 'Instructor',
    department: 'Unknown',
    role: 'instructor',
  });

  // Fetch instructor details from RTDB
  useEffect(() => {
    if (!currentUser?.uid) return;

    const instructorRef = ref(rtdb, `Instructors/${currentUser.uid}/Profile`);
    const unsubscribe = onValue(
      instructorRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setInstructorDetails({
            fullName: data.fullName || currentUser.displayName || 'Instructor',
            department: data.department || 'Unknown',
            role: data.role || 'instructor',
          });
        }
      },
      (error) => {
        console.error('Error fetching instructor:', error);
        toast.error('Failed to load instructor data');
      }
    );

    return () => off(instructorRef, 'value', unsubscribe);
  }, [currentUser]);

  // Fetch sections
  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchSections = async () => {
      try {
        setLoading(true);
        const sectionsRef = collection(db, 'sections');
        const q = query(sectionsRef, where('instructorId', '==', currentUser.uid));
        const sectionsSnapshot = await getDocs(q);
        const fetchedSections = sectionsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || '',
          students: doc.data().students || [],
          instructorId: doc.data().instructorId || '',
          room: doc.data().room || '',
          subjectId: doc.data().subjectId || '',
        }));
        setSections(fetchedSections);
        if (fetchedSections.length > 0) {
          setSelectedSection(fetchedSections[0].id);
        }
      } catch (error) {
        console.error('Error fetching sections:', error);
        toast.error('Failed to load sections');
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, [currentUser]);

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectsRef = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        const fetchedSubjects = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || '',
          code: doc.data().code || '',
        }));
        setSubjects(fetchedSubjects);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        toast.error('Failed to load subjects');
      }
    };

    fetchSubjects();
  }, []);

  // Fetch students and their attendance from RTDB
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('role', '==', 'student'));
        const querySnapshot = await getDocs(q);
        
        const fetchedStudents: Student[] = [];
        for (const doc of querySnapshot.docs) {
          const studentData = doc.data();
          const student: Student = {
            id: doc.id,
            fullName: studentData.fullName || '',
            idNumber: studentData.idNumber || '',
            email: studentData.email || '',
            mobileNumber: studentData.mobileNumber,
            department: studentData.department,
            role: studentData.role,
            major: studentData.major,
            sections: studentData.sections || [],
            attendance: {}
          };
          fetchedStudents.push(student);
        }
        setStudents(fetchedStudents);
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
      }
    };

    fetchStudents();
  }, []);

  // Fetch schedules from RTDB
  useEffect(() => {
    if (!currentUser?.uid) return;

    const scheduleRef = ref(rtdb, `Instructors/${currentUser.uid}/ClassStatus/schedule`);
    const unsubscribe = onValue(
      scheduleRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setSchedules([
            {
              day: data.day || '',
              startTime: data.startTime || '',
              endTime: data.endTime || '',
              roomName: typeof data.roomName === 'string' ? data.roomName : data.roomName?.name || '',
              sectionId: sections.find((s) => s.name === data.section)?.id || '',
              subjectCode: data.subjectCode || '',
            },
          ]);
        } else {
          setSchedules([]);
        }
      },
      (error) => {
        console.error('Error fetching schedules:', error);
        toast.error('Failed to load schedules');
      }
    );

    return () => off(scheduleRef, 'value', unsubscribe);
  }, [currentUser, sections]);

  // Fetch attendance records from Firestore (unchanged)
  useEffect(() => {
    if (!selectedSection) {
      setAttendanceRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const attendanceRef = collection(db, 'attendanceRecords');
    const q = query(
      attendanceRef,
      where('sectionId', '==', selectedSection),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedRecords = snapshot.docs.map((doc) => ({
          id: doc.id,
          studentId: doc.data().studentId || '',
          studentName: doc.data().studentName || '',
          studentEmail: doc.data().studentEmail || '',
          sectionId: doc.data().sectionId || '',
          sectionName: doc.data().sectionName || '',
          subjectId: doc.data().subjectId || '',
          room: doc.data().room || '',
          status: doc.data().status || 'absent',
          confirmed: doc.data().confirmed || false,
          rfidAuthenticated: doc.data().rfidAuthenticated || false,
          weightAuthenticated: doc.data().weightAuthenticated || false,
          timestamp: doc.data().timestamp || { seconds: 0, nanoseconds: 0 },
          date: doc.data().date || '',
          submittedBy: doc.data().submittedBy || { id: '' },
        }));
        setAttendanceRecords(fetchedRecords);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching attendance records:', error);
        toast.error('Failed to load attendance records');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedSection]);

  // Check if class has ended
  const hasClassEnded = (record: AttendanceRecordRTDB): boolean => {
    if (!record.attendanceInfo.date) return false;

    const recordDate = new Date(record.attendanceInfo.date.replace(/_/g, '-'));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const recordDay = dayNames[recordDate.getDay()];

    const schedule = schedules.find(
      (sched) =>
        sched.sectionId === record.scheduleMatched.sectionId &&
        sched.day === recordDay &&
        sched.subjectCode === record.scheduleMatched.subjectCode
    );

    if (!schedule || !schedule.endTime) return false;

    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
    const classEndTime = new Date(recordDate);
    classEndTime.setHours(endHour, endMinute, 0, 0);

    const now = new Date();
    return now >= classEndTime;
  };

  // Parse RTDB timestamp to Date
  const parseRTDBTimestamp = (timestamp: string): Date => {
    const [date, time] = timestamp.split('_');
    const [year, month, day] = date.split('_').map(Number);
    const [hour, minute, second] = time.split('_').map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
  };

  // Update the getAttendanceSummary function to better handle the RTDB structure
  const getAttendanceSummary = (student: Student): AttendanceSummary => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const weeklyRecords: AttendanceRecordRTDB[] = [];
    const monthlyRecords: AttendanceRecordRTDB[] = [];

    Object.entries(student.attendance || {}).forEach(([sessionId, record]) => {
      const recordDate = new Date(record.attendanceInfo.date.replace(/_/g, '-'));
      
      if (recordDate >= oneWeekAgo) {
        weeklyRecords.push(record);
      }
      if (recordDate >= oneMonthAgo) {
        monthlyRecords.push(record);
      }
    });

    const getStatusCount = (records: AttendanceRecordRTDB[]) => {
      return records.reduce(
        (acc, record) => {
          acc[record.attendanceInfo.status.toLowerCase() as keyof typeof acc]++;
          return acc;
        },
        { present: 0, late: 0, absent: 0 }
      );
    };

    return {
      weekly: getStatusCount(weeklyRecords),
      monthly: getStatusCount(monthlyRecords),
      detailedRecords: {
        weekly: weeklyRecords.sort((a, b) => 
          new Date(b.attendanceInfo.timestamp).getTime() - new Date(a.attendanceInfo.timestamp).getTime()
        ),
        monthly: monthlyRecords.sort((a, b) => 
          new Date(b.attendanceInfo.timestamp).getTime() - new Date(a.attendanceInfo.timestamp).getTime()
        ),
      },
    };
  };

  // Edit attendance record (unchanged, but included for completeness)
  const handleEditAttendance = async (recordId: string, currentStatus: string) => {
    const { value: newStatus } = await Swal.fire({
      title: 'Edit Attendance Status',
      input: 'select',
      inputOptions: {
        present: 'Present',
        late: 'Late',
        absent: 'Absent',
      },
      inputValue: currentStatus,
      showCancelButton: true,
      confirmButtonText: 'Save',
    });

    if (newStatus && newStatus !== currentStatus) {
      try {
        const recordRef = doc(db, 'attendanceRecords', recordId);
        await updateDoc(recordRef, { status: newStatus });
        toast.success('Attendance status updated');
      } catch (error) {
        console.error('Error updating attendance:', error);
        toast.error('Failed to update attendance');
      }
    }
  };

  // Delete attendance record (unchanged, but included for completeness)
  const handleDeleteAttendance = async (recordId: string) => {
    const result = await Swal.fire({
      title: 'Delete Attendance Record',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });

    if (result.isConfirmed) {
      try {
        const recordRef = doc(db, 'attendanceRecords', recordId);
        await deleteDoc(recordRef);
        toast.success('Attendance record deleted');
      } catch (error) {
        console.error('Error deleting attendance:', error);
        toast.error('Failed to delete attendance');
      }
    }
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    const section = sections.find((s) => s.id === selectedSection);
    if (!section) return [];

    return students.filter(
      (student) =>
        (student.sections?.includes(selectedSection) || section.students.includes(student.fullName)) &&
        (!searchQuery || student.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [students, sections, selectedSection, searchQuery]);

  // Calculate stats
  const stats: AttendanceStats = useMemo(() => {
    const section = sections.find((s) => s.id === selectedSection);
    const totalStudents = section?.students.length || 0;
    const relevantRecords = attendanceRecords.filter((r) => {
      const recordDate = new Date(r.date);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const recordDay = dayNames[recordDate.getDay()];
      const schedule = schedules.find(
        (sched) =>
          sched.sectionId === r.sectionId &&
          sched.day === recordDay &&
          sched.subjectCode === subjects.find((s) => s.id === r.subjectId)?.code
      );
      if (!schedule || !schedule.endTime) return false;
      const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
      const classEndTime = new Date(recordDate);
      classEndTime.setHours(endHour, endMinute, 0, 0);
      const now = new Date();
      return now >= classEndTime;
    });
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
  }, [attendanceRecords, sections, selectedSection, schedules, subjects]);

  // Export to CSV
  const exportAttendance = () => {
    const section = sections.find((s) => s.id === selectedSection);
    const subject = subjects.find((s) => s.id === section?.subjectId);
    const csvContent = [
      ['Student Name', 'ID Number', 'Section', 'Subject', 'Weekly Present', 'Weekly Late', 'Weekly Absent', 'Monthly Present', 'Monthly Late', 'Monthly Absent'],
      ...filteredStudents.map((student) => {
        const summary = getAttendanceSummary(student);
        return [
          student.fullName,
          student.idNumber,
          section?.name || 'N/A',
          subject?.name || 'N/A',
          summary.weekly.present,
          summary.weekly.late,
          summary.weekly.absent,
          summary.monthly.present,
          summary.monthly.late,
          summary.monthly.absent,
        ];
      }),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedSection || 'summary'}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Add this new function to format dates for display
  const formatDate = (timestamp: string): string => {
    const date = parseRTDBTimestamp(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Add this new function to format time for display
  const formatTime = (timestamp: string): string => {
    const date = parseRTDBTimestamp(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  if (loading && !sections.length) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        user={{
          role: instructorDetails.role as 'admin' | 'instructor' | 'student',
          fullName: instructorDetails.fullName,
          department: instructorDetails.department,
        }}
        classStatus={{
          status: 'Attendance Overview',
          color: 'bg-indigo-600 text-white',
          details: sections.find((s) => s.id === selectedSection)?.name || 'No section selected',
          fullName: instructorDetails.fullName,
        }}
      />

      <main className="container mx-auto px-4 py-8 mt-16">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
                <p className="text-gray-600">Track student attendance summaries</p>
              </div>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
              >
                <option value="">Select Section</option>
                {sections.map((section) => {
                  const subject = subjects.find((s) => s.id === section.subjectId);
                  return (
                    <option key={section.id} value={section.id}>
                      {section.name} {subject ? `(${subject.name})` : ''} {section.room ? `(Room ${section.room})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {selectedSection && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[                
                  {
                    label: 'Attendance Rate',
                    value: `${stats.attendanceRate.toFixed(1)}%`,
                    icon: ChartBarIcon,
                    color: 'text-blue-600',
                  },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">{stat.label}</p>
                        <p className="text-xl font-semibold">{stat.value}</p>
                      </div>
                      <stat.icon className={`w-8 h-8 ${stat.color}`} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={exportAttendance}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Export CSV
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Student Attendance Summaries</h2>
                {filteredStudents.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No students found for this section</p>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {filteredStudents.map((student) => {
                      const summary = getAttendanceSummary(student);
                      return (
                        <div key={student.id} className="bg-white rounded-lg shadow-md p-6 mb-6">
                          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6">
                            <div className="w-full md:w-auto">
                              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl font-bold text-indigo-600">
                                      {student.fullName.split(' ').map(n => n[0]).join('')}
                                    </span>
                                  </div>
                                  <div>
                                    <h3 className="text-2xl font-bold text-gray-800">{student.fullName}</h3>
                                    <p className="text-indigo-600 font-medium">ID: {student.idNumber}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-gray-600">{student.email}</p>
                                  </div>
                                  {student.mobileNumber && (
                                    <div className="flex items-center gap-2">
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                      </svg>
                                      <p className="text-gray-600">{student.mobileNumber}</p>
                                    </div>
                                  )}
                                  {student.department && (
                                    <div className="flex items-center gap-2">
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                      </svg>
                                      <p className="text-gray-600">{student.department}</p>
                                    </div>
                                  )}
                                  {student.role && (
                                    <div className="flex items-center gap-2">
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                      <p className="text-gray-600 capitalize">{student.role}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                {summary.weekly.present + summary.weekly.late + summary.weekly.absent} times this week
                              </div>
                              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 ml-2">
                                {summary.monthly.present + summary.monthly.late + summary.monthly.absent} times this month
                              </div>
                            </div>
                          </div>

                          {/* Weekly Attendance Summary */}
                          <div className="mb-4">
                            <h4 className="text-lg font-medium text-gray-700 mb-2">Weekly Attendance</h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="bg-green-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">Present</p>
                                <p className="text-xl font-semibold text-green-600">{summary.weekly.present}</p>
                              </div>
                              <div className="bg-yellow-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">Late</p>
                                <p className="text-xl font-semibold text-yellow-600">{summary.weekly.late}</p>
                              </div>
                              <div className="bg-red-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">Absent</p>
                                <p className="text-xl font-semibold text-red-600">{summary.weekly.absent}</p>
                              </div>
                            </div>
                          </div>

                          {/* Monthly Attendance Summary */}
                          <div className="mb-4">
                            <h4 className="text-lg font-medium text-gray-700 mb-2">Monthly Attendance</h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="bg-green-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">Present</p>
                                <p className="text-xl font-semibold text-green-600">{summary.monthly.present}</p>
                              </div>
                              <div className="bg-yellow-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">Late</p>
                                <p className="text-xl font-semibold text-yellow-600">{summary.monthly.late}</p>
                              </div>
                              <div className="bg-red-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">Absent</p>
                                <p className="text-xl font-semibold text-red-600">{summary.monthly.absent}</p>
                              </div>
                            </div>
                          </div>

                          {/* Detailed Attendance Records */}
                          <div>
                            <h4 className="text-lg font-medium text-gray-700 mb-4">Recent Attendance Records</h4>
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time In</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Out</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sensor</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {Object.entries(student.attendance || {}).length > 0 ? (
                                    Object.entries(student.attendance || {})
                                      .sort(([, a], [, b]) => {
                                        const dateA = new Date(a.attendanceInfo.date.replace(/_/g, '-'));
                                        const dateB = new Date(b.attendanceInfo.date.replace(/_/g, '-'));
                                        return dateB.getTime() - dateA.getTime();
                                      })
                                      .map(([sessionId, record]) => {
                                        const attendanceInfo = record.attendanceInfo;
                                        const scheduleMatched = record.scheduleMatched;
                                        return (
                                          <tr key={sessionId} className="hover:bg-gray-50 transition-colors duration-150">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                              {formatDate(attendanceInfo.date)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                              {formatTime(attendanceInfo.timestamp)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                attendanceInfo.status.toLowerCase() === 'present' 
                                                  ? 'bg-green-100 text-green-800' 
                                                  : attendanceInfo.status.toLowerCase() === 'late'
                                                  ? 'bg-yellow-100 text-yellow-800'
                                                  : 'bg-red-100 text-red-800'
                                              }`}>
                                                {attendanceInfo.status}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                              {scheduleMatched.subjectCode}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                              {scheduleMatched.roomName}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                              {formatTime(attendanceInfo.timeIn)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                              {formatTime(attendanceInfo.timeOut)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                              {attendanceInfo.sensor}
                                            </td>
                                          </tr>
                                        );
                                      })
                                  ) : (
                                    <tr>
                                      <td colSpan={8} className="px-4 py-3 text-center text-sm text-gray-500">
                                        No attendance records found
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {sections.find((s) => s.id === selectedSection)?.room && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Classroom Layout</h2>
                  <SeatPlanLayout roomId={sections.find((s) => s.id === selectedSection)?.room || ''} sectionId={selectedSection} />
                </div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default AttendanceManagement;
