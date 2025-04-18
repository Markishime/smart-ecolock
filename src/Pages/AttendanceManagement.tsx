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
  attendanceInfo: {
    action: string;
    assignedSensorId: number;
    date: string;
    sensor: string;
    sensorConfirmed: boolean;
    sessionId: string;
    status: 'present' | 'late' | 'absent';
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
  recentRecords: AttendanceRecordRTDB[];
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
  const [rtdbRecords, setRtdbRecords] = useState<{ [key: string]: AttendanceRecordRTDB }>({});
  const [studentData, setStudentData] = useState<{ [key: string]: any }>({});
  const [attendanceFilter, setAttendanceFilter] = useState<'weekly' | 'monthly'>('weekly');

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

  // Add real-time listener for attendance records
  useEffect(() => {
    if (!currentUser?.uid) return;

    const studentsRef = ref(rtdb, 'Students');
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Raw RTDB Data:', data); // Debug log
      
      if (data) {
        const processedData: { [key: string]: any } = {};
        
        Object.entries(data).forEach(([studentId, studentInfo]: [string, any]) => {
          console.log('Processing student:', studentId, studentInfo); // Debug log
          
          if (studentInfo.Attendance) {
            // Get the first attendance record to extract personal info
            const firstAttendanceKey = Object.keys(studentInfo.Attendance)[0];
            const firstAttendance = studentInfo.Attendance[firstAttendanceKey];
            
            if (firstAttendance && firstAttendance.personalInfo) {
              // Create a properly structured student object
              processedData[studentId] = {
                id: studentId,
                fullName: firstAttendance.personalInfo.fullName,
                idNumber: firstAttendance.personalInfo.idNumber,
                email: firstAttendance.personalInfo.email,
                mobileNumber: firstAttendance.personalInfo.mobileNumber,
                department: firstAttendance.personalInfo.department,
                role: firstAttendance.personalInfo.role,
                attendance: {}
              };
              
              // Process all attendance records
              Object.entries(studentInfo.Attendance).forEach(([sessionId, record]: [string, any]) => {
                processedData[studentId].attendance[sessionId] = {
                  scheduleMatched: {
                    day: record.allSchedules?.[0]?.day || 'N/A',
                    endTime: record.allSchedules?.[0]?.endTime || 'N/A',
                    instructorName: record.allSchedules?.[0]?.instructorName || 'N/A',
                    roomName: record.allSchedules?.[0]?.roomName || 'N/A',
                    section: record.allSchedules?.[0]?.section || 'N/A',
                    sectionId: record.allSchedules?.[0]?.sectionId || 'N/A',
                    startTime: record.allSchedules?.[0]?.startTime || 'N/A',
                    subject: record.allSchedules?.[0]?.subject || 'N/A',
                    subjectCode: record.allSchedules?.[0]?.subjectCode || 'N/A'
                  },
                  attendanceInfo: {
                    action: record.attendanceInfo?.action || 'N/A',
                    assignedSensorId: record.attendanceInfo?.assignedSensorId || 0,
                    date: record.attendanceInfo?.date || 'N/A',
                    sensor: record.attendanceInfo?.sensor || 'N/A',
                    sensorConfirmed: record.attendanceInfo?.sensorConfirmed || false,
                    sessionId: record.attendanceInfo?.sessionId || 'N/A',
                    status: (record.attendanceInfo?.status?.toLowerCase() || 'absent') as 'present' | 'late' | 'absent',
                    timeIn: record.attendanceInfo?.timeIn || 'N/A',
                    timeOut: record.attendanceInfo?.timeOut || 'N/A',
                    timestamp: record.attendanceInfo?.timestamp || 'N/A',
                    weight: record.attendanceInfo?.weight || 0,
                    weightUnit: record.attendanceInfo?.weightUnit || 'N/A'
                  },
                  personalInfo: {
                    department: record.personalInfo?.department || 'N/A',
                    email: record.personalInfo?.email || 'N/A',
                    fullName: record.personalInfo?.fullName || 'N/A',
                    idNumber: record.personalInfo?.idNumber || 'N/A',
                    mobileNumber: record.personalInfo?.mobileNumber || 'N/A',
                    role: record.personalInfo?.role || 'N/A'
                  }
                };
              });
            }
          }
        });
        
        console.log('Processed Student Data:', processedData); // Debug log
        setStudentData(processedData);
      }
    }, (error) => {
      console.error('Error fetching student data:', error);
      toast.error('Failed to load student data');
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Add real-time listener for attendance records
  useEffect(() => {
    if (!currentUser?.uid) return;

    const studentsRef = ref(rtdb, 'Students');
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const records: { [key: string]: AttendanceRecordRTDB } = {};
        
        // Process each student's attendance records
        Object.entries(data).forEach(([studentId, studentData]: [string, any]) => {
          if (studentData.Attendance) {
            Object.entries(studentData.Attendance).forEach(([sessionId, record]: [string, any]) => {
              // Transform the record to match AttendanceRecordRTDB interface
              records[sessionId] = {
                scheduleMatched: {
                  day: record.allSchedules?.[0]?.day || 'N/A',
                  endTime: record.allSchedules?.[0]?.endTime || 'N/A',
                  instructorName: record.allSchedules?.[0]?.instructorName || 'N/A',
                  roomName: record.allSchedules?.[0]?.roomName || 'N/A',
                  section: record.allSchedules?.[0]?.section || 'N/A',
                  sectionId: record.allSchedules?.[0]?.sectionId || 'N/A',
                  startTime: record.allSchedules?.[0]?.startTime || 'N/A',
                  subject: record.allSchedules?.[0]?.subject || 'N/A',
                  subjectCode: record.allSchedules?.[0]?.subjectCode || 'N/A'
                },
                attendanceInfo: {
                  action: record.attendanceInfo?.action || 'N/A',
                  assignedSensorId: record.attendanceInfo?.assignedSensorId || 0,
                  date: record.attendanceInfo?.date || 'N/A',
                  sensor: record.attendanceInfo?.sensor || 'N/A',
                  sensorConfirmed: record.attendanceInfo?.sensorConfirmed || false,
                  sessionId: record.attendanceInfo?.sessionId || 'N/A',
                  status: (record.attendanceInfo?.status?.toLowerCase() || 'absent') as 'present' | 'late' | 'absent',
                  timeIn: record.attendanceInfo?.timeIn || 'N/A',
                  timeOut: record.attendanceInfo?.timeOut || 'N/A',
                  timestamp: record.attendanceInfo?.timestamp || 'N/A',
                  weight: record.attendanceInfo?.weight || 0,
                  weightUnit: record.attendanceInfo?.weightUnit || 'N/A'
                },
                personalInfo: {
                  department: record.personalInfo?.department || 'N/A',
                  email: record.personalInfo?.email || 'N/A',
                  fullName: record.personalInfo?.fullName || 'N/A',
                  idNumber: record.personalInfo?.idNumber || 'N/A',
                  mobileNumber: record.personalInfo?.mobileNumber || 'N/A',
                  role: record.personalInfo?.role || 'N/A'
                }
              };
            });
          }
        });
        
        setRtdbRecords(records);
      }
    }, (error) => {
      console.error('Error fetching RTDB data:', error);
      toast.error('Failed to load attendance records');
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Add real-time listener for schedules
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
    try {
      // Handle the format like "2025_04_18_114401"
      if (timestamp.includes('_')) {
        const parts = timestamp.split('_');
        if (parts.length >= 4) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Month is 0-indexed in JS Date
          const day = parseInt(parts[2]);
          const timeStr = parts[3];
          
          // Parse time (format: HHMMSS)
          const hour = parseInt(timeStr.substring(0, 2));
          const minute = parseInt(timeStr.substring(2, 4));
          const second = parseInt(timeStr.substring(4, 6) || '0');
          
          return new Date(year, month, day, hour, minute, second);
        }
      }
      
      // Fallback to the original implementation
      const [date, time] = timestamp.split('_');
      const [year, month, day] = date.split('_').map(Number);
      const [hour, minute, second] = time.split('_').map(Number);
      return new Date(year, month - 1, day, hour, minute, second);
    } catch (error) {
      console.error('Error parsing timestamp:', error);
      return new Date(); // Return current date as fallback
    }
  };

  // Update the getAttendanceSummary function to use real-time data
  const getAttendanceSummary = (student: Student): AttendanceSummary => {
    console.log('Getting summary for student:', student); // Debug log
    
    if (!student.attendance) {
      console.log('No attendance data for student'); // Debug log
      return {
        weekly: { present: 0, late: 0, absent: 0 },
        monthly: { present: 0, late: 0, absent: 0 },
        recentRecords: []
      };
    }

    const records = Object.entries(student.attendance).map(([sessionId, record]: [string, any]) => {
      console.log('Processing record:', sessionId, record); // Debug log
      return [sessionId, {
        scheduleMatched: {
          day: record.scheduleMatched?.day || 'N/A',
          endTime: record.scheduleMatched?.endTime || 'N/A',
          instructorName: record.scheduleMatched?.instructorName || 'N/A',
          roomName: record.scheduleMatched?.roomName || 'N/A',
          section: record.scheduleMatched?.section || 'N/A',
          sectionId: record.scheduleMatched?.sectionId || 'N/A',
          startTime: record.scheduleMatched?.startTime || 'N/A',
          subject: record.scheduleMatched?.subject || 'N/A',
          subjectCode: record.scheduleMatched?.subjectCode || 'N/A'
        },
        attendanceInfo: {
          action: record.attendanceInfo?.action || 'N/A',
          assignedSensorId: record.attendanceInfo?.assignedSensorId || 0,
          date: record.attendanceInfo?.date || 'N/A',
          sensor: record.attendanceInfo?.sensor || 'N/A',
          sensorConfirmed: record.attendanceInfo?.sensorConfirmed || false,
          sessionId: record.attendanceInfo?.sessionId || 'N/A',
          status: (record.attendanceInfo?.status?.toLowerCase() || 'absent') as 'present' | 'late' | 'absent',
          timeIn: record.attendanceInfo?.timeIn || 'N/A',
          timeOut: record.attendanceInfo?.timeOut || 'N/A',
          timestamp: record.attendanceInfo?.timestamp || 'N/A',
          weight: record.attendanceInfo?.weight || 0,
          weightUnit: record.attendanceInfo?.weightUnit || 'N/A'
        },
        personalInfo: {
          department: record.personalInfo?.department || 'N/A',
          email: record.personalInfo?.email || 'N/A',
          fullName: record.personalInfo?.fullName || 'N/A',
          idNumber: record.personalInfo?.idNumber || 'N/A',
          mobileNumber: record.personalInfo?.mobileNumber || 'N/A',
          role: record.personalInfo?.role || 'N/A'
        }
      }] as [string, AttendanceRecordRTDB];
    });
    
    console.log('Processed records:', records); // Debug log
    
    const sortedRecords = records.sort((a, b) => {
      const dateA = new Date(a[1].attendanceInfo?.timestamp || '');
      const dateB = new Date(b[1].attendanceInfo?.timestamp || '');
      return dateB.getTime() - dateA.getTime();
    });

    // Weekly summary calculation
    const weeklyRecords = sortedRecords.filter(([_, record]) => {
      const recordDate = new Date(record.attendanceInfo?.timestamp || '');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return recordDate >= weekAgo;
    });

    // Monthly summary calculation
    const monthlyRecords = sortedRecords.filter(([_, record]) => {
      const recordDate = new Date(record.attendanceInfo?.timestamp || '');
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return recordDate >= monthAgo;
    });

    const summary = {
      weekly: {
        present: weeklyRecords.filter(([_, r]) => r.attendanceInfo?.status === 'present').length,
        late: weeklyRecords.filter(([_, r]) => r.attendanceInfo?.status === 'late').length,
        absent: weeklyRecords.filter(([_, r]) => r.attendanceInfo?.status === 'absent').length,
      },
      monthly: {
        present: monthlyRecords.filter(([_, r]) => r.attendanceInfo?.status === 'present').length,
        late: monthlyRecords.filter(([_, r]) => r.attendanceInfo?.status === 'late').length,
        absent: monthlyRecords.filter(([_, r]) => r.attendanceInfo?.status === 'absent').length,
      },
      recentRecords: sortedRecords.slice(0, 5).map(([_, record]) => record)
    };

    console.log('Generated summary:', summary); // Debug log
    return summary;
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

  // Update the filtered students logic
  const filteredStudents = useMemo(() => {
    const section = sections.find((s) => s.id === selectedSection);
    if (!section) return [];

    return Object.entries(studentData)
      .filter(([_, student]) => 
        (!searchQuery || student.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .map(([id, student]) => ({
        id,
        fullName: student.fullName,
        idNumber: student.idNumber,
        email: student.email,
        mobileNumber: student.mobileNumber,
        department: student.department,
        role: student.role,
        attendance: student.attendance
      }));
  }, [studentData, sections, selectedSection, searchQuery]);

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

  // Update the formatRTDBTimestamp function to handle the timestamp format correctly
  const formatRTDBTimestamp = (timestamp: string): string => {
    try {
      // Handle the format like "2025_04_18_114401"
      if (timestamp.includes('_')) {
        const parts = timestamp.split('_');
        if (parts.length >= 4) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Month is 0-indexed in JS Date
          const day = parseInt(parts[2]);
          const timeStr = parts[3];
          
          // Parse time (format: HHMMSS)
          const hour = parseInt(timeStr.substring(0, 2));
          const minute = parseInt(timeStr.substring(2, 4));
          const second = parseInt(timeStr.substring(4, 6) || '0');
          
          const date = new Date(year, month, day, hour, minute, second);
          return date.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        }
      }
      
      // Fallback to the original implementation
      const [date, time] = timestamp.split('_');
      const [year, month, day] = date.split('_').map(Number);
      const [hour, minute, second] = time.split('_').map(Number);
      return new Date(year, month - 1, day, hour, minute, second).toLocaleString();
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid Date';
    }
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
                                      {student.fullName.split(' ').map((n: string) => n[0]).join('')}
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

                          {/* Weekly/Monthly Attendance Summary with Filter */}
                          <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-lg font-medium text-gray-700">Attendance Summary</h4>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">View:</span>
                                <div className="relative">
                                  <select
                                    value={attendanceFilter}
                                    onChange={(e) => setAttendanceFilter(e.target.value as 'weekly' | 'monthly')}
                                    className="appearance-none bg-white border border-gray-300 rounded-md py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {attendanceFilter === 'weekly' ? (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl shadow-sm border border-green-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-green-800">Present</p>
                                      <p className="text-2xl font-bold text-green-600 mt-1">{summary.weekly.present}</p>
                                    </div>
                                    <div className="bg-green-200 rounded-full p-3">
                                      <CheckCircleIcon className="w-6 h-6 text-green-600" />
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <div className="w-full bg-green-200 rounded-full h-2">
                                      <div 
                                        className="bg-green-500 rounded-full h-2" 
                                        style={{ 
                                          width: `${summary.weekly.present + summary.weekly.late + summary.weekly.absent > 0 
                                            ? (summary.weekly.present / (summary.weekly.present + summary.weekly.late + summary.weekly.absent)) * 100 
                                            : 0}%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl shadow-sm border border-yellow-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-yellow-800">Late</p>
                                      <p className="text-2xl font-bold text-yellow-600 mt-1">{summary.weekly.late}</p>
                                    </div>
                                    <div className="bg-yellow-200 rounded-full p-3">
                                      <ClockIcon className="w-6 h-6 text-yellow-600" />
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <div className="w-full bg-yellow-200 rounded-full h-2">
                                      <div 
                                        className="bg-yellow-500 rounded-full h-2" 
                                        style={{ 
                                          width: `${summary.weekly.present + summary.weekly.late + summary.weekly.absent > 0 
                                            ? (summary.weekly.late / (summary.weekly.present + summary.weekly.late + summary.weekly.absent)) * 100 
                                            : 0}%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl shadow-sm border border-red-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-red-800">Absent</p>
                                      <p className="text-2xl font-bold text-red-600 mt-1">{summary.weekly.absent}</p>
                                    </div>
                                    <div className="bg-red-200 rounded-full p-3">
                                      <XCircleIcon className="w-6 h-6 text-red-600" />
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <div className="w-full bg-red-200 rounded-full h-2">
                                      <div 
                                        className="bg-red-500 rounded-full h-2" 
                                        style={{ 
                                          width: `${summary.weekly.present + summary.weekly.late + summary.weekly.absent > 0 
                                            ? (summary.weekly.absent / (summary.weekly.present + summary.weekly.late + summary.weekly.absent)) * 100 
                                            : 0}%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl shadow-sm border border-green-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-green-800">Present</p>
                                      <p className="text-2xl font-bold text-green-600 mt-1">{summary.monthly.present}</p>
                                    </div>
                                    <div className="bg-green-200 rounded-full p-3">
                                      <CheckCircleIcon className="w-6 h-6 text-green-600" />
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <div className="w-full bg-green-200 rounded-full h-2">
                                      <div 
                                        className="bg-green-500 rounded-full h-2" 
                                        style={{ 
                                          width: `${summary.monthly.present + summary.monthly.late + summary.monthly.absent > 0 
                                            ? (summary.monthly.present / (summary.monthly.present + summary.monthly.late + summary.monthly.absent)) * 100 
                                            : 0}%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl shadow-sm border border-yellow-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-yellow-800">Late</p>
                                      <p className="text-2xl font-bold text-yellow-600 mt-1">{summary.monthly.late}</p>
                                    </div>
                                    <div className="bg-yellow-200 rounded-full p-3">
                                      <ClockIcon className="w-6 h-6 text-yellow-600" />
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <div className="w-full bg-yellow-200 rounded-full h-2">
                                      <div 
                                        className="bg-yellow-500 rounded-full h-2" 
                                        style={{ 
                                          width: `${summary.monthly.present + summary.monthly.late + summary.monthly.absent > 0 
                                            ? (summary.monthly.late / (summary.monthly.present + summary.monthly.late + summary.monthly.absent)) * 100 
                                            : 0}%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl shadow-sm border border-red-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-red-800">Absent</p>
                                      <p className="text-2xl font-bold text-red-600 mt-1">{summary.monthly.absent}</p>
                                    </div>
                                    <div className="bg-red-200 rounded-full p-3">
                                      <XCircleIcon className="w-6 h-6 text-red-600" />
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <div className="w-full bg-red-200 rounded-full h-2">
                                      <div 
                                        className="bg-red-500 rounded-full h-2" 
                                        style={{ 
                                          width: `${summary.monthly.present + summary.monthly.late + summary.monthly.absent > 0 
                                            ? (summary.monthly.absent / (summary.monthly.present + summary.monthly.late + summary.monthly.absent)) * 100 
                                            : 0}%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
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
                                    (Object.entries(student.attendance || {}) as Array<[string, AttendanceRecordRTDB]>)
                                      .filter(([_, record]) => record && record.scheduleMatched && record.attendanceInfo)
                                      .sort((a, b) => {
                                        const dateA = new Date(a[1].attendanceInfo?.timestamp || '');
                                        const dateB = new Date(b[1].attendanceInfo?.timestamp || '');
                                        return dateB.getTime() - dateA.getTime();
                                      })
                                      .map(([sessionId, record]: [string, AttendanceRecordRTDB]) => (
                                        <tr key={sessionId} className="hover:bg-gray-50 transition-colors duration-150">
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {record.attendanceInfo?.date ? 
                                              new Date(record.attendanceInfo.date.replace(/_/g, '-')).toLocaleDateString() :
                                              'N/A'}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {record.attendanceInfo?.timestamp ? 
                                              formatRTDBTimestamp(record.attendanceInfo.timestamp) :
                                              'N/A'}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                              record.attendanceInfo?.status?.toLowerCase() === 'present'
                                                ? 'bg-green-100 text-green-800'
                                                : record.attendanceInfo?.status?.toLowerCase() === 'late'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                              {record.attendanceInfo?.status || 'absent'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {record.scheduleMatched?.subjectCode || 'N/A'}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {record.scheduleMatched?.roomName || 'N/A'}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {record.attendanceInfo?.timeIn ? 
                                              formatRTDBTimestamp(record.attendanceInfo.timeIn) :
                                              'N/A'}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {record.attendanceInfo?.timeOut ? 
                                              formatRTDBTimestamp(record.attendanceInfo.timeOut) :
                                              'N/A'}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {record.attendanceInfo?.sensor || 'N/A'}
                                          </td>
                                        </tr>
                                      ))
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
