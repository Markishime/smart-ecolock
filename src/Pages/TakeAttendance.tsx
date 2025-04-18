import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { ref, onValue, off, set } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { useAuth } from '../Pages/AuthContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
} from '@heroicons/react/24/solid';
import NavBar from '../components/NavBar';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

interface Student {
  rfidUid: string;
  idNumber: string;
  studentName: string;
  email: string;
  mobileNumber: string;
  department: string;
  section: string;
  sectionId: string;
  classStatus: string;
  timestamp: string;
  timeIn: string;
  timeOut: string;
  weight: number;
  weightUnit: string;
  sensor: string;
  role: string;
  date: string;
  action: string;
  attendanceStatus: string;
  rfidAuthenticated: boolean;
  weightAuthenticated: boolean;
  confirmed: boolean;
  assignedSensorId: string;
  subject: string;
  subjectCode: string;
  lastSession: string;
  schedules: Array<{
    day: string;
    endTime: string;
    instructorName: string;
    roomName: string;
    section: string;
    sectionId: string;
    startTime: string;
    subject: string;
    subjectCode: string;
  }>;
}

interface Section {
  id: string;
  code: string;
  createdAt: string;
  instructorRfidUid: string;
  name: string;
  students: string[];
  subjectId: string;
  instructorId: string;
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

interface AttendanceStats {
  totalStudents: number;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
  punctualityRate: number;
}

interface Schedule {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  section: string;
  subject: string;
}

const TakeAttendance: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [classStartTime, setClassStartTime] = useState<Date | null>(null);
  const [confirmationStudent, setConfirmationStudent] = useState<Student | null>(null);
  const [confirmationTapTime, setConfirmationTapTime] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'time'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [instructorDetails, setInstructorDetails] = useState<{
    fullName: string;
    department: string;
    role: string;
  }>({
    fullName: currentUser?.displayName || 'Instructor',
    department: 'Unknown',
    role: 'instructor',
  });

  const formattedTime = useMemo(() => currentTime.toLocaleString(), [currentTime]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // Fetch instructor details from RTDB
  useEffect(() => {
    if (!currentUser) return;

    const instructorRef = ref(rtdb, `/Instructors`);
    const unsubscribe = onValue(
      instructorRef,
      (snapshot) => {
        const instructorsData = snapshot.val();
        if (instructorsData) {
          const instructor = Object.values(instructorsData).find(
            (instr: any) => instr.Profile?.email === currentUser.email
          ) as any;
          setInstructorDetails({
            fullName: instructor?.Profile?.fullName || currentUser.displayName || 'Instructor',
            department: instructor?.Profile?.department || 'Unknown',
            role: instructor?.Profile?.role || 'instructor',
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

  // Fetch subjects from Firestore
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!currentUser) return;
      try {
        setSubjectsLoading(true);
        const subjectsRef = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        const fetchedSubjects = subjectsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            code: doc.data().code || '',
            name: doc.data().name || '',
            credits: doc.data().credits || 0,
            department: doc.data().department || '',
            details: doc.data().details || '',
            learningObjectives: doc.data().learningObjectives || [],
            prerequisites: doc.data().prerequisites || [],
            sections: (doc.data().sections || []).map((sec: any) => ({
              id: sec.id || '',
              code: sec.code || '',
              createdAt: sec.createdAt || '',
              instructorRfidUid: sec.instructorRfidUid || '',
              name: sec.name || '',
              students: sec.students || [],
              subjectId: sec.subjectId || '',
              instructorId: sec.instructorId || '',
            })),
          }))
          .filter((subject) =>
            subject.sections.some((section: Section) => section.instructorId === currentUser.uid)
          ) as Subject[];

        setSubjects(fetchedSubjects);
        if (fetchedSubjects.length > 0) {
          setSelectedSubject(fetchedSubjects[0]);
          const instructorSections = fetchedSubjects[0].sections.filter(
            (section: Section) => section.instructorId === currentUser.uid
          );
          setSelectedSection(instructorSections[0] || null);
        } else {
          setSelectedSubject(null);
          setSelectedSection(null);
        }
      } catch (error) {
        console.error('Error fetching subjects:', error);
        toast.error('Failed to load subjects');
      } finally {
        setSubjectsLoading(false);
        setLoading(false);
      }
    };
    fetchSubjects();
  }, [currentUser]);

  // Fetch students from RTDB based on JSON structure
  useEffect(() => {
    if (!selectedSection || !selectedSubject || !instructorDetails.fullName) {
      console.log('Missing required data:', { selectedSection, selectedSubject, instructorFullName: instructorDetails.fullName });
      setStudents([]);
      setClassStartTime(null);
      setLoading(false);
      return;
    }

    const studentsRef = ref(rtdb, '/Students');
    const unsubscribe = onValue(
      studentsRef,
      (snapshot) => {
        setLoading(true);
        try {
          const studentsData = snapshot.val();
          if (!studentsData) {
            console.warn('No students data found in RTDB');
            setStudents([]);
            setClassStartTime(new Date(selectedSection.createdAt));
            setLoading(false);
            return;
          }

          // Create a pattern to match the session key
          const sessionKeyPattern = `${selectedSubject.code}_${selectedSection.name}`;
          console.log('Looking for session key pattern:', sessionKeyPattern);

          const fetchedStudents: Student[] = Object.entries(studentsData)
            .map(([rfidUid, studentData]: [string, any]) => {
              console.log(`Processing student: ${rfidUid}`);

              // Check if student has Attendance data
              if (!studentData.Attendance) {
                console.warn(`No Attendance data for student ${rfidUid}`);
                return null;
              }

              // Find the attendance record for the specific session
              const attendanceKey = Object.keys(studentData.Attendance).find((key) =>
                key.includes(sessionKeyPattern)
              );
              
              if (!attendanceKey) {
                console.warn(`No attendance key matching ${sessionKeyPattern} for ${rfidUid}`);
                return null;
              }

              // Get the session data
              const sessionData = studentData.Attendance[attendanceKey];
              
              // Extract data from the session
              const attendanceInfo = sessionData?.attendanceInfo || {};
              const personalInfo = sessionData?.personalInfo || studentData.personalInfo || {};
              const schedules = sessionData?.allSchedules || [];
              const scheduleMatched = sessionData?.scheduleMatched || null;

              // Verify the schedule matches the subject, section, and instructor
              const hasMatchingSchedule = schedules.some(
                (schedule: any) =>
                  schedule.subjectCode === selectedSubject.code &&
                  schedule.section === selectedSection.name &&
                  schedule.instructorName === instructorDetails.fullName
              );

              if (!hasMatchingSchedule && !scheduleMatched) {
                console.warn(
                  `No schedule match for ${rfidUid}. Expected: subjectCode=${selectedSubject.code}, section=${selectedSection.name}, instructor=${instructorDetails.fullName}`
                );
                return null;
              }

              console.log(`Student ${rfidUid} matched criteria`);

              // Create the student object with all available data
              return {
                rfidUid,
                idNumber: personalInfo.idNumber || '',
                studentName: personalInfo.fullName || 'Unknown',
                email: personalInfo.email || '',
                mobileNumber: personalInfo.mobileNumber || '',
                department: personalInfo.department || '',
                section: selectedSection.name,
                sectionId: selectedSection.id,
                classStatus: attendanceInfo.status || 'Unknown',
                timestamp: attendanceInfo.timestamp || '',
                timeIn: attendanceInfo.timeIn || '',
                timeOut: attendanceInfo.timeOut || '',
                weight: attendanceInfo.weight || 0,
                weightUnit: attendanceInfo.weightUnit || 'kg',
                sensor: attendanceInfo.sensor || '',
                role: personalInfo.role || 'student',
                date: attendanceInfo.date || '',
                action: attendanceInfo.action || '',
                attendanceStatus: 
                  attendanceInfo.status?.toLowerCase() === 'present' 
                    ? 'present' 
                    : attendanceInfo.status?.toLowerCase() === 'late' 
                    ? 'late' 
                    : 'absent',
                rfidAuthenticated: attendanceInfo.action?.includes('Confirmed') || false,
                weightAuthenticated: attendanceInfo.sensorConfirmed || false,
                confirmed: attendanceInfo.status === 'Present' || false,
                assignedSensorId: attendanceInfo.assignedSensorId?.toString() || '',
                subject: selectedSubject.name,
                subjectCode: selectedSubject.code,
                lastSession: attendanceKey || '',
                schedules: schedules.map((sched: any) => ({
                  day: sched.day || '',
                  endTime: sched.endTime || '',
                  instructorName: sched.instructorName || '',
                  roomName: sched.roomName || '',
                  section: sched.section || '',
                  sectionId: sched.sectionId || '',
                  startTime: sched.startTime || '',
                  subject: sched.subject || '',
                  subjectCode: sched.subjectCode || '',
                })),
              };
            })
            .filter((student): student is Student => {
              if (!student) {
                console.warn('Filtered out null student');
                return false;
              }
              return true;
            });

          console.log('Fetched students:', JSON.stringify(fetchedStudents, null, 2));
          setStudents(fetchedStudents);
          setClassStartTime(new Date(selectedSection.createdAt));
        } catch (error) {
          console.error('Error processing students:', error);
          toast.error('Failed to load students');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
        setStudents([]);
        setLoading(false);
      }
    );

    return () => off(studentsRef, 'value', unsubscribe);
  }, [selectedSection, selectedSubject, instructorDetails.fullName]);

  // Fetch instructor's current schedule from RTDB
  useEffect(() => {
    if (!currentUser || !selectedSection || !selectedSubject) return;

    const instructorRef = ref(rtdb, `/Instructors`);
    const unsubscribe = onValue(
      instructorRef,
      (snapshot) => {
        const instructorsData = snapshot.val();
        if (!instructorsData) {
          console.warn('No instructors data found');
          setCurrentSchedule(null);
          setRoomId('');
          return;
        }

        const instructor = Object.entries(instructorsData).find(
          ([, instr]: [string, any]) => instr.Profile?.email === currentUser.email
        )?.[1] as any;

        if (!instructor?.ClassStatus?.schedule) {
          console.warn('No ClassStatus or schedule found for instructor');
          setCurrentSchedule(null);
          setRoomId('');
          return;
        }

        const schedule = instructor.ClassStatus.schedule;
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        if (
          schedule.day === currentDay &&
          schedule.startTime <= currentTime &&
          schedule.endTime >= currentTime &&
          schedule.subjectCode === selectedSubject.code &&
          schedule.section === selectedSection.name
        ) {
          console.log('Schedule match found:', schedule);
          setCurrentSchedule({
            id: `${selectedSubject.code}_${selectedSection.name}`,
            day: schedule.day,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            room: schedule.roomName?.name || 'Unknown',
            section: selectedSection.name,
            subject: selectedSubject.name,
          });
          setRoomId(schedule.roomName?.name || '');
        } else {
          console.warn(
            `No schedule match. Current: day=${currentDay}, time=${currentTime}, subjectCode=${selectedSubject.code}, section=${selectedSection.name}`,
            `Schedule: ${JSON.stringify(schedule)}`
          );
          setCurrentSchedule(null);
          setRoomId('');
        }
      },
      (error) => {
        console.error('Error fetching schedule:', error);
        setCurrentSchedule(null);
        setRoomId('');
      }
    );

    return () => off(instructorRef, 'value', unsubscribe);
  }, [currentUser, selectedSection, selectedSubject]);

  const handleAttendanceChange = async (rfidUid: string, status: 'present' | 'absent' | 'late') => {
    if (!selectedSection || !selectedSubject) {
      toast.error('Please select a subject and section');
      return;
    }

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '_');
      const timeStr =
        dateStr +
        '_' +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');

      const student = students.find((s) => s.rfidUid === rfidUid);

      const dbStatus = status === 'absent' ? 'Absent' : status === 'late' ? 'Late' : 'Present';
      const isPresentOrLate = status === 'present' || status === 'late';
      const sessionId = `${dateStr}_${selectedSubject.code}_${selectedSection.name}_${roomId || 'Unknown'}`;

      // Update the attendanceInfo in the correct path
      await set(ref(rtdb, `/Students/${rfidUid}/Attendance/${sessionId}/attendanceInfo`), {
        action: isPresentOrLate ? 'Confirmed RFID' : 'Not Confirmed',
        assignedSensorId: student?.assignedSensorId || '',
        date: dateStr,
        sensor: student?.sensor || '',
        sensorConfirmed: student?.weightAuthenticated || false,
        sessionId: sessionId,
        status: dbStatus,
        timeIn: isPresentOrLate ? timeStr : '',
        timeOut: '',
        timestamp: timeStr,
        weight: student?.weight || 0,
        weightUnit: student?.weightUnit || 'kg',
      });

      // Update lastSession
      await set(ref(rtdb, `/Students/${rfidUid}/lastSession`), sessionId);

      toast.success(`Marked ${status} for ${student?.studentName} at ${now.toLocaleTimeString()}`);
    } catch (error) {
      console.error('Error updating attendance in RTDB:', error);
      toast.error('Failed to update attendance status');
    }
  };

  const confirmAttendance = async () => {
    if (confirmationStudent && confirmationTapTime && classStartTime && selectedSection && selectedSubject) {
      try {
        const startTimeMs = classStartTime.getTime();
        const tapTimeMs = confirmationTapTime.getTime();
        const gracePeriod = 15 * 60 * 1000;
        const status = tapTimeMs <= startTimeMs + gracePeriod ? 'present' : 'late';
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '_');
        const timeStr =
          dateStr +
          '_' +
          now.getHours().toString().padStart(2, '0') +
          now.getMinutes().toString().padStart(2, '0') +
          now.getSeconds().toString().padStart(2, '0');

        const sessionId = `${dateStr}_${selectedSubject.code}_${selectedSection.name}_${roomId || 'Unknown'}`;
        const dbStatus = status === 'present' ? 'Present' : 'Late';

        // Update the attendanceInfo in the correct path
        await set(ref(rtdb, `/Students/${confirmationStudent.rfidUid}/Attendance/${sessionId}/attendanceInfo`), {
          action: 'Confirmed RFID',
          assignedSensorId: confirmationStudent.assignedSensorId || '',
          date: dateStr,
          sensor: confirmationStudent.sensor || '',
          sensorConfirmed: confirmationStudent.weightAuthenticated || false,
          sessionId: sessionId,
          status: dbStatus,
          timeIn: timeStr,
          timeOut: '',
          timestamp: timeStr,
          weight: confirmationStudent.weight || 0,
          weightUnit: confirmationStudent.weightUnit || 'kg',
        });

        // Update lastSession
        await set(ref(rtdb, `/Students/${confirmationStudent.rfidUid}/lastSession`), sessionId);

        toast.success(`Confirmed ${status} for ${confirmationStudent.studentName}`);
      } catch (error) {
        console.error('Error confirming attendance in RTDB:', error);
        toast.error('Failed to confirm attendance');
      } finally {
        setConfirmationStudent(null);
        setConfirmationTapTime(null);
      }
    }
  };

  const rejectAttendance = () => {
    setConfirmationStudent(null);
    setConfirmationTapTime(null);
  };

  const submitAttendance = async () => {
    if (!selectedSection || !selectedSubject || !currentSchedule) {
      toast.error('Please select a section, subject, and ensure schedule is loaded');
      return;
    }

    if (!currentUser) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const attendanceRef = collection(db, 'attendanceRecords');
      const q = query(
        attendanceRef,
        where('sectionId', '==', selectedSection.id),
        where('subjectId', '==', selectedSubject.id),
        where('date', '==', today),
        where('submittedBy.id', '==', currentUser.uid)
      );
      const existingRecordsSnapshot = await getDocs(q);

      if (!existingRecordsSnapshot.empty) {
        const confirm = await Swal.fire({
          title: 'Attendance Already Submitted',
          text: 'Attendance for this section, subject, and date has already been submitted. Do you want to overwrite it?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, overwrite',
          cancelButtonText: 'No, cancel',
        });

        if (!confirm.isConfirmed) {
          setLoading(false);
          return;
        }

        const deletePromises = existingRecordsSnapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }

      const attendanceRecords = students.map((student) => ({
        studentId: student.rfidUid,
        studentName: student.studentName,
        studentEmail: student.email,
        sectionId: selectedSection.id,
        sectionName: selectedSection.name,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        room: currentSchedule.room,
        status: student.attendanceStatus || 'absent',
        confirmed: student.confirmed,
        rfidAuthenticated: student.rfidAuthenticated,
        weightAuthenticated: student.weightAuthenticated,
        timestamp: Timestamp.fromDate(new Date(student.timestamp || new Date())),
        date: today,
        submittedBy: {
          id: currentUser.uid,
          name: instructorDetails.fullName,
          role: instructorDetails.role,
        },
      }));

      const writePromises = attendanceRecords.map((record) =>
        addDoc(collection(db, 'attendanceRecords'), record)
      );
      await Promise.all(writePromises);

      const resetPromises = students.map((student) =>
        set(ref(rtdb, `/Students/${student.rfidUid}/Attendance/${student.lastSession}/attendanceInfo`), {
          action: 'Not Confirmed',
          assignedSensorId: '',
          date: '',
          sensor: '',
          sensorConfirmed: false,
          sessionId: '',
          status: 'Not Confirmed',
          timeIn: '',
          timeOut: '',
          timestamp: '',
          weight: 0,
          weightUnit: 'kg',
        })
      );
      await Promise.all(resetPromises);

      toast.success('Attendance submitted successfully!');
      navigate('/instructor/attendance-management');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      toast.error('Failed to submit attendance');
    } finally {
      setLoading(false);
    }
  };

  const stats: AttendanceStats = useMemo(() => {
    const total = students.length;
    const presentCount = students.filter((s) => s.attendanceStatus === 'present').length;
    const lateCount = students.filter((s) => s.attendanceStatus === 'late').length;
    const absentCount = students.filter((s) => s.attendanceStatus === 'absent').length;

    return {
      totalStudents: total,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      attendanceRate: total ? ((presentCount + lateCount) / total) * 100 : 0,
      punctualityRate: total ? (presentCount / (presentCount + lateCount || 1)) * 100 : 0,
    };
  }, [students]);

  const filteredAndSortedStudents = useMemo(() => {
    let filtered = [...students];

    if (searchQuery) {
      filtered = filtered.filter((student) =>
        student.studentName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((student) => student.attendanceStatus === statusFilter);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.studentName.localeCompare(b.studentName)
          : b.studentName.localeCompare(a.studentName);
      }
      if (sortBy === 'status') {
        const statusOrder = { present: 1, late: 2, absent: 3 };
        const statusA = statusOrder[a.attendanceStatus as keyof typeof statusOrder] || 4;
        const statusB = statusOrder[b.attendanceStatus as keyof typeof statusOrder] || 4;
        return sortOrder === 'asc' ? statusA - statusB : statusB - statusA;
      }
      if (sortBy === 'time') {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : Infinity;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : Infinity;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });

    return filtered;
  }, [students, searchQuery, statusFilter, sortBy, sortOrder]);

  const exportAttendance = () => {
    const csvContent = [
      ['Name', 'Email', 'UID', 'Status', 'Time', 'Weight', 'Weight Verified', 'Department', 'Section', 'Mobile', 'Subject'],
      ...students.map((student) => [
        student.studentName,
        student.email,
        student.rfidUid,
        student.attendanceStatus,
        student.timestamp || '',
        student.weight ? student.weight.toFixed(1) : 'N/A',
        student.weightAuthenticated ? 'Yes' : 'No',
        student.department,
        student.section,
        student.mobileNumber,
        selectedSubject?.name || 'N/A',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedSection?.name || 'unnamed'}_${selectedSubject?.name || 'unnamed'}_${new Date().toLocaleDateString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusDisplay = (student: Student) => {
    const weightInfo = student.weight ? (
      <span className="ml-1 sm:ml-2 text-blue-600 text-xs sm:text-sm">
        ({student.weight.toFixed(1)} {student.weightUnit})
      </span>
    ) : null;
    const timeInfo = student.timeIn ? (
      <span className="ml-1 sm:ml-2 text-gray-500 text-xs">
        ({student.timeIn.split('_').pop()?.replace(/(\d{2})(\d{2})(\d{2})/, '$1:$2:$3')})
      </span>
    ) : null;

    if (student.rfidAuthenticated && !student.weightAuthenticated) {
      return (
        <span className="text-yellow-600 flex items-center gap-1 text-xs sm:text-sm">
          <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          Waiting for weight authentication... {weightInfo} {timeInfo}
        </span>
      );
    }

    switch (student.attendanceStatus) {
      case 'present':
        return (
          <span className="text-green-600 text-xs sm:text-sm">
            Present {weightInfo} {timeInfo}
          </span>
        );
      case 'late':
        return (
          <span className="text-yellow-600 text-xs sm:text-sm">
            Late {weightInfo} {timeInfo}
          </span>
        );
      case 'absent':
        return (
          <span className="text-red-600 text-xs sm:text-sm">
            Absent {weightInfo} {timeInfo}
          </span>
        );
      default:
        return (
          <span className="text-gray-600 text-xs sm:text-sm">
            Not marked {weightInfo} {timeInfo}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        currentTime={currentTime}
        user={{
          role: instructorDetails.role as 'instructor',
          fullName: instructorDetails.fullName,
          department: instructorDetails.department,
        }}
        classStatus={{
          status: currentSchedule ? 'Class In Session' : 'No Active Class',
          color: currentSchedule ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800',
          details: selectedSection?.name || 'No section selected',
          fullName: instructorDetails.fullName,
        }}
      />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 mt-14 sm:mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg sm:rounded-2xl shadow-md sm:shadow-lg p-4 sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Take Attendance</h1>
              {subjectsLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-t-2 border-indigo-600"></div>
                  <span className="text-gray-600 text-sm">Loading subjects...</span>
                </div>
              ) : (
                <select
                  value={selectedSubject?.id || ''}
                  onChange={(e) => {
                    const subject = subjects.find((s) => s.id === e.target.value) || null;
                    setSelectedSubject(subject);
                    if (subject) {
                      const instructorSections = subject.sections.filter(
                        (section: Section) => section.instructorId === currentUser?.uid
                      );
                      setSelectedSection(instructorSections[0] || null);
                    } else {
                      setSelectedSection(null);
                    }
                  }}
                  className="border rounded-lg p-2 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-44 text-sm sm:text-base"
                >
                  <option value="" disabled>
                    Select Subject
                  </option>
                  {subjects.length > 0 ? (
                    subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name.length > 20 ? `${subject.name.substring(0, 17)}...` : subject.name} ({subject.code})
                      </option>
                    ))
                  ) : (
                    <option disabled>No subjects available</option>
                  )}
                </select>
              )}
              {subjectsLoading || !selectedSubject ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-t-2 border-indigo-600"></div>
                  <span className="text-gray-600 text-sm">Loading sections...</span>
                </div>
              ) : (
                <select
                  value={selectedSection?.id || ''}
                  onChange={(e) => {
                    const section = selectedSubject?.sections.find((s) => s.id === e.target.value) || null;
                    setSelectedSection(section);
                  }}
                  className="border rounded-lg p-2 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-44 text-sm sm:text-base"
                >
                  <option value="" disabled>
                    Select Section
                  </option>
                  {selectedSubject?.sections.length > 0 ? (
                    selectedSubject.sections
                      .filter((section: Section) => section.instructorId === currentUser?.uid)
                      .map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name} ({section.code})
                        </option>
                      ))
                  ) : (
                    <option disabled>No sections available</option>
                  )}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-xs sm:text-sm text-gray-600">{formattedTime}</div>
              <button
                onClick={exportAttendance}
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-xs sm:text-sm"
                disabled={!selectedSection}
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {currentSchedule && selectedSection && selectedSubject && (
            <div className="mb-4 sm:mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white shadow-md sm:shadow-lg">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">
                    {selectedSubject.name.length > 25 ? `${selectedSubject.name.substring(0, 22)}...` : selectedSubject.name}
                  </h3>
                  <div className="mt-1 text-blue-100 text-xs sm:text-sm">
                    <p>Room {currentSchedule.room} • Section {selectedSection.name}</p>
                    <p>
                      {currentSchedule.startTime} - {currentSchedule.endTime} • {currentSchedule.day}
                    </p>
                  </div>
                </div>
                <div className="bg-white/20 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm backdrop-blur-sm">
                  Current Class
                </div>
              </div>
            </div>
          )}

          {selectedSection ? (
            filteredAndSortedStudents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredAndSortedStudents.map((student) => (
                  <motion.div
                    key={student.rfidUid}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 flex flex-col space-y-2 border border-gray-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-sm sm:text-base">
                          {student.studentName.length > 20 ? `${student.studentName.substring(0, 17)}...` : student.studentName}
                        </p>
                        <p className="text-xs text-gray-600">UID: {student.rfidUid.substring(0, 8)}...</p>
                        <p className="text-xs text-gray-600">ID: {student.idNumber}</p>
                      </div>
                      <div className="flex gap-1 sm:gap-2">
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'present')}
                          className={`
                            p-1.5 sm:p-2 rounded-full
                            ${student.attendanceStatus === 'present' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600 hover:bg-green-200'}
                          `}
                        >
                          <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'late')}
                          className={`
                            p-1.5 sm:p-2 rounded-full
                            ${student.attendanceStatus === 'late' ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'}
                          `}
                        >
                          <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'absent')}
                          className={`
                            p-1.5 sm:p-2 rounded-full
                            ${student.attendanceStatus === 'absent' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600 hover:bg-red-200'}
                          `}
                        >
                          <XCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p>
                        <span className="font-medium text-gray-700">Status:</span> {getStatusDisplay(student)}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Email:</span>{' '}
                        {student.email.length > 20 ? `${student.email.substring(0, 17)}...` : student.email || 'N/A'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Mobile:</span> {student.mobileNumber || 'N/A'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Dept:</span>{' '}
                        {student.department.length > 15 ? `${student.department.substring(0, 12)}...` : student.department || 'N/A'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Section:</span> {student.section || 'Unknown'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Subject:</span>{' '}
                        {selectedSubject && selectedSubject.name.length > 20 ? `${selectedSubject.name.substring(0, 17)}...` : selectedSubject?.name || 'N/A'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Weight:</span>{' '}
                        {student.weight ? `${student.weight.toFixed(1)} ${student.weightUnit}` : 'N/A'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Verified:</span>{' '}
                        {student.weightAuthenticated ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-red-600">No</span>
                        )}
                      </p>
                      {student.schedules.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Schedules:</span>
                          <ul className="list-disc pl-4">
                            {student.schedules.map((sched, index) => (
                              <li key={index} className="text-xs sm:text-sm">
                                {sched.day} {sched.startTime}-{sched.endTime} ({sched.subject}, Section {sched.section})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4 text-sm sm:text-base">No students found for this section.</p>
            )
          ) : (
            <p className="text-gray-600 text-center py-4 text-sm sm:text-base">Please select a subject and section to view students.</p>
          )}

          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            {selectedSection && (
              <div className="text-xs sm:text-sm text-gray-600">
                Attendance: {stats.attendanceRate.toFixed(1)}% | Punctuality: {stats.punctualityRate.toFixed(1)}%
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              <Link
                to="/instructor/attendance-management"
                className="bg-indigo-100 text-indigo-700 px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-indigo-200 transition flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                View Records
              </Link>
              <button
                onClick={submitAttendance}
                className="bg-indigo-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-xs sm:text-sm"
                disabled={!selectedSection || !selectedSubject || !currentSchedule}
              >
                <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                Submit Attendance
              </button>
            </div>
          </div>
        </motion.div>
      </main>

      {confirmationStudent && confirmationTapTime && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white p-4 sm:p-6 rounded-lg sm:rounded-xl shadow-xl w-full max-w-[90vw] sm:max-w-md mx-4"
          >
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Confirm Attendance</h2>
            <div className="space-y-2 text-sm sm:text-base">
              <p>
                <strong>Student:</strong>{' '}
                {confirmationStudent.studentName.length > 20
                  ? `${confirmationStudent.studentName.substring(0, 17)}...`
                  : confirmationStudent.studentName}
              </p>
              <p>
                <strong>Tap Time:</strong> {confirmationTapTime.toLocaleString()}
              </p>
              <p className="text-gray-600">Weight sensor confirmation pending...</p>
            </div>
            <div className="mt-4 sm:mt-6 flex justify-end gap-2 sm:gap-3">
              <button
                onClick={rejectAttendance}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs sm:text-sm"
              >
                Reject
              </button>
              <button
                onClick={confirmAttendance}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs sm:text-sm"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default TakeAttendance;