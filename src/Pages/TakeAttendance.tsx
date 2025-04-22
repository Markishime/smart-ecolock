import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { ref, onValue, off, set, get } from 'firebase/database';
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

              // Check profile data exists
              if (!studentData.Profile) {
                console.warn(`No Profile data for student ${rfidUid}`);
                return null;
              }

              // Check if student has Attendance data
              if (!studentData.Attendance) {
                console.warn(`No Attendance data for student ${rfidUid}`);
                return null;
              }

              // Get profile data
              const profile = studentData.Profile;

              // Find the attendance record for the specific session
              let attendanceKey: string | undefined = Object.keys(studentData.Attendance).find((key) =>
                key.includes(sessionKeyPattern)
              );
              
              // Use lastSession as fallback if no matching key found
              if (!attendanceKey && studentData.lastSession) {
                attendanceKey = studentData.lastSession;
              }
              
              // If still no key found, skip this student
              if (!attendanceKey) {
                console.warn(`No attendance key matching ${sessionKeyPattern} for ${rfidUid}`);
                return null;
              }

              // Get the session data - attendanceKey is guaranteed to be a string at this point
              const sessionData = studentData.Attendance[attendanceKey as string];
              if (!sessionData) {
                console.warn(`Session data not found for ${attendanceKey}`);
                return null;
              }
              
              // Extract attendance info and personal info
              const attendanceInfo = sessionData.attendanceInfo || sessionData;
              const personalInfo = sessionData.personalInfo || profile;
              
              // Check if the student has the correct schedule
              // Look in allSchedules in attendance data first
              let schedules = sessionData.allSchedules || [];
              
              // If not in attendance data, check profile schedules
              if ((!schedules || schedules.length === 0) && profile.schedules) {
                schedules = profile.schedules;
              }

              // Verify the schedule matches the subject, section, and instructor
              const hasMatchingSchedule = schedules.some(
                (schedule: any) =>
                  schedule.subjectCode === selectedSubject.code &&
                  schedule.section === selectedSection.name &&
                  schedule.instructorName === instructorDetails.fullName
              );

              if (!hasMatchingSchedule) {
                console.warn(
                  `No schedule match for ${rfidUid}. Expected: subjectCode=${selectedSubject.code}, section=${selectedSection.name}, instructor=${instructorDetails.fullName}`
                );
                return null;
              }

              console.log(`Student ${rfidUid} matched criteria`);

              // Create the student object with all available data
              return {
                rfidUid,
                idNumber: personalInfo.idNumber || profile.idNumber || '',
                studentName: personalInfo.fullName || profile.fullName || 'Unknown',
                email: personalInfo.email || profile.email || '',
                mobileNumber: personalInfo.mobileNumber || profile.mobileNumber || '',
                department: personalInfo.department || profile.department || '',
                section: selectedSection.name,
                sectionId: selectedSection.id,
                classStatus: attendanceInfo.status || 'Unknown',
                timestamp: attendanceInfo.timestamp || '',
                timeIn: attendanceInfo.timeIn || '',
                timeOut: attendanceInfo.timeOut || '',
                weight: attendanceInfo.weight || 0,
                weightUnit: attendanceInfo.weightUnit || 'kg',
                sensor: attendanceInfo.sensor || '',
                role: personalInfo.role || profile.role || 'student',
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

      // Get student's schedules from RTDB
      const studentRef = ref(rtdb, `/Students/${rfidUid}`);
      const snapshot = await get(studentRef);
      const studentData = snapshot.val();
      const schedules = studentData?.Profile?.schedules || [];

      // Filter schedules that match the current subject and section
      const relevantSchedules = schedules.filter(
        (schedule: any) => 
          schedule.subjectCode === selectedSubject.code && 
          schedule.section === selectedSection.name
      );

      // Get weight from existing record or use default
      const weightValue = student?.weight || 0;
      const weightUnit = student?.weightUnit || 'kg';
      const sensorConfirmed = student?.weightAuthenticated || false;
      const sensor = student?.sensor || 'Weight Sensor';

      // Get personal info
      const personalInfo = {
        department: studentData?.Profile?.department || '',
        email: studentData?.Profile?.email || '',
        fullName: studentData?.Profile?.fullName || '',
        idNumber: studentData?.Profile?.idNumber || '',
        mobileNumber: studentData?.Profile?.mobileNumber || '',
        role: studentData?.Profile?.role || 'student'
      };

      // Update the attendance data with the new structure
      await set(ref(rtdb, `/Students/${rfidUid}/Attendance/${sessionId}`), {
        allSchedules: relevantSchedules,
        attendanceInfo: {
          action: isPresentOrLate ? 'Confirmed RFID' : 'Not Confirmed',
          assignedSensorId: student?.assignedSensorId || '',
          date: dateStr,
          sensor: sensor,
          sensorConfirmed: sensorConfirmed,
          sessionId: sessionId,
          status: dbStatus,
          timeIn: isPresentOrLate ? timeStr : '',
          timeOut: '',
          timestamp: timeStr,
          weight: weightValue,
          weightUnit: weightUnit
        },
        personalInfo: personalInfo
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

        // Get student's schedules from RTDB
        const studentRef = ref(rtdb, `/Students/${confirmationStudent.rfidUid}`);
        const snapshot = await get(studentRef);
        const studentData = snapshot.val();
        const schedules = studentData?.Profile?.schedules || [];

        // Filter schedules that match the current subject and section
        const relevantSchedules = schedules.filter(
          (schedule: any) => 
            schedule.subjectCode === selectedSubject.code && 
            schedule.section === selectedSection.name
        );

        // Get weight from existing record or use default
        const weightValue = confirmationStudent?.weight || 0;
        const weightUnit = confirmationStudent?.weightUnit || 'kg';
        const sensorConfirmed = confirmationStudent?.weightAuthenticated || false;
        const sensor = confirmationStudent?.sensor || 'Weight Sensor';

        // Get personal info
        const personalInfo = {
          department: studentData?.Profile?.department || '',
          email: studentData?.Profile?.email || '',
          fullName: studentData?.Profile?.fullName || '',
          idNumber: studentData?.Profile?.idNumber || '',
          mobileNumber: studentData?.Profile?.mobileNumber || '',
          role: studentData?.Profile?.role || 'student'
        };

        // Update the attendance data with the new structure
        await set(ref(rtdb, `/Students/${confirmationStudent.rfidUid}/Attendance/${sessionId}`), {
          allSchedules: relevantSchedules,
          attendanceInfo: {
            action: 'Confirmed RFID',
            assignedSensorId: confirmationStudent.assignedSensorId || '',
            date: dateStr,
            sensor: sensor,
            sensorConfirmed: sensorConfirmed,
            sessionId: sessionId,
            status: dbStatus,
            timeIn: timeStr,
            timeOut: '',
            timestamp: timeStr,
            weight: weightValue,
            weightUnit: weightUnit
          },
          personalInfo: personalInfo
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
        weight: student.weight || 0,
        weightUnit: student.weightUnit || 'kg',
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

      // Reset the student's attendance status in RTDB
      const resetPromises = students.map((student) => {
        const personalInfo = {
          department: student.department || '',
          email: student.email || '',
          fullName: student.studentName || '',
          idNumber: student.idNumber || '',
          mobileNumber: student.mobileNumber || '',
          role: student.role || 'student'
        };
        
        return set(ref(rtdb, `/Students/${student.rfidUid}/Attendance/${student.lastSession}`), {
          allSchedules: student.schedules,
          attendanceInfo: {
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
            weightUnit: 'kg'
          },
          personalInfo: personalInfo
        });
      });
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
          className="bg-white rounded-lg sm:rounded-2xl shadow-md sm:shadow-lg p-4 sm:p-6 border border-gray-100"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5 sm:mb-6 border-b border-gray-100 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                <span className="w-8 h-8 mr-2 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full">
                  <CheckCircleIcon className="w-5 h-5" />
                </span>
                Take Attendance
              </h1>
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
            <div className="mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg sm:rounded-xl p-4 sm:p-5 text-white shadow-md sm:shadow-lg border border-blue-700/20">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold flex items-center">
                    <CalendarIcon className="w-5 h-5 mr-2 text-blue-200" />
                    {selectedSubject.name.length > 25 ? `${selectedSubject.name.substring(0, 22)}...` : selectedSubject.name}
                  </h3>
                  <div className="mt-1 text-blue-100 text-xs sm:text-sm">
                    <p className="flex items-center gap-1.5">
                      <span className="bg-white/20 px-2 py-0.5 rounded-full">Room {currentSchedule.room}</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded-full">Section {selectedSection.name}</span>
                    </p>
                    <p className="mt-1 flex items-center">
                      <ClockIcon className="w-4 h-4 mr-1 text-blue-200" />
                      {currentSchedule.startTime} - {currentSchedule.endTime} • {currentSchedule.day}
                    </p>
                  </div>
                </div>
                <div className="bg-white/20 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm backdrop-blur-sm font-medium shadow-sm">
                  Current Class
                </div>
              </div>
            </div>
          )}

          {selectedSection ? (
            <>
              <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center bg-gray-50 p-3 sm:p-4 rounded-lg">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by student name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border border-gray-300 bg-white py-2 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                  />
                </div>
                
                <div className="flex gap-2 sm:gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'present' | 'absent' | 'late')}
                    className="border border-gray-300 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="present">Present Only</option>
                    <option value="late">Late Only</option>
                    <option value="absent">Absent Only</option>
                  </select>
                  
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [newSortBy, newSortOrder] = e.target.value.split('-');
                      setSortBy(newSortBy as 'name' | 'status' | 'time');
                      setSortOrder(newSortOrder as 'asc' | 'desc');
                    }}
                    className="border border-gray-300 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="status-asc">Status (Present First)</option>
                    <option value="status-desc">Status (Absent First)</option>
                    <option value="time-asc">Time (Earliest First)</option>
                    <option value="time-desc">Time (Latest First)</option>
                  </select>
                </div>
              </div>

              <div className="mb-3 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Showing <span className="font-medium text-gray-700">{filteredAndSortedStudents.length}</span> of <span className="font-medium text-gray-700">{students.length}</span> students
                </div>
                <div className="flex gap-2">
                  <div className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                    Present: {stats.present}
                  </div>
                  <div className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                    Late: {stats.late}
                  </div>
                  <div className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                    Absent: {stats.absent}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {selectedSection ? (
            filteredAndSortedStudents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredAndSortedStudents.map((student) => (
                  <motion.div
                    key={student.rfidUid}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 flex flex-col space-y-3 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm sm:text-base">
                          {student.studentName.length > 20 ? `${student.studentName.substring(0, 17)}...` : student.studentName}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            UID: {student.rfidUid.substring(0, 8)}...
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            ID: {student.idNumber}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 sm:gap-2">
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'present')}
                          className={`
                            p-1.5 sm:p-2 rounded-full transition-colors duration-200
                            ${student.attendanceStatus === 'present' ? 'bg-green-500 text-white shadow-sm' : 'bg-green-100 text-green-600 hover:bg-green-200'}
                          `}
                          title="Mark as Present"
                        >
                          <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'late')}
                          className={`
                            p-1.5 sm:p-2 rounded-full transition-colors duration-200
                            ${student.attendanceStatus === 'late' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'}
                          `}
                          title="Mark as Late"
                        >
                          <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'absent')}
                          className={`
                            p-1.5 sm:p-2 rounded-full transition-colors duration-200
                            ${student.attendanceStatus === 'absent' ? 'bg-red-500 text-white shadow-sm' : 'bg-red-100 text-red-600 hover:bg-red-200'}
                          `}
                          title="Mark as Absent"
                        >
                          <XCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center px-3 py-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg text-xs sm:text-sm">
                      <span className="font-medium text-gray-700 mr-2">Status:</span> {getStatusDisplay(student)}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Email:</span>
                        <p className="text-gray-600 truncate">
                          {student.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Mobile:</span>
                        <p className="text-gray-600">
                          {student.mobileNumber || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Department:</span>
                        <p className="text-gray-600 truncate">
                          {student.department || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Section:</span>
                        <p className="text-gray-600">
                          {student.section || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <div className="px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
                        <span className="font-semibold">Weight:</span>
                        {student.weight ? `${student.weight.toFixed(1)} ${student.weightUnit}` : 'N/A'}
                      </div>
                      <div className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1 ${student.weightAuthenticated ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        <span className="font-semibold">Verified:</span>
                        {student.weightAuthenticated ? 'Yes' : 'No'}
                      </div>
                    </div>

                    {student.schedules.length > 0 && (
                      <div className="mt-1">
                        <p className="font-medium text-gray-700 text-xs sm:text-sm mb-1">Schedules:</p>
                        <div className="max-h-20 overflow-y-auto bg-gray-50 rounded-md p-2">
                          <ul className="space-y-1">
                            {student.schedules.map((sched, index) => (
                              <li key={index} className="text-xs text-gray-600 flex flex-wrap">
                                <span className="font-medium mr-1">{sched.day}:</span>
                                {sched.startTime}-{sched.endTime} • {sched.subject.substring(0, 15)}{sched.subject.length > 15 ? '...' : ''} 
                                <span className="text-gray-500 ml-1">({sched.section})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4 text-sm sm:text-base">No students found for this section.</p>
            )
          ) : (
            <p className="text-gray-600 text-center py-4 text-sm sm:text-base">Please select a subject and section to view students.</p>
          )}

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 pt-4 border-t border-gray-100">
            {selectedSection && (
              <div className="text-xs sm:text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                <span className="font-medium">Attendance:</span> {stats.attendanceRate.toFixed(1)}% | <span className="font-medium">Punctuality:</span> {stats.punctualityRate.toFixed(1)}%
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              <Link
                to="/instructor/attendance-management"
                className="bg-indigo-100 text-indigo-700 px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-indigo-200 transition flex items-center justify-center gap-2 text-xs sm:text-sm font-medium shadow-sm"
              >
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                View Records
              </Link>
              <button
                onClick={submitAttendance}
                className="bg-indigo-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-xs sm:text-sm font-medium shadow-sm"
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white p-5 sm:p-6 rounded-xl shadow-xl w-full max-w-md mx-4 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Confirm Attendance</h2>
              <button
                onClick={rejectAttendance}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-4">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {confirmationStudent.studentName.length > 20
                      ? `${confirmationStudent.studentName.substring(0, 17)}...`
                      : confirmationStudent.studentName}
                  </h3>
                  <p className="text-sm text-gray-600">ID: {confirmationStudent.idNumber}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Tap Time</p>
                  <p className="font-medium text-gray-800">{confirmationTapTime.toLocaleTimeString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Tap Date</p>
                  <p className="font-medium text-gray-800">{confirmationTapTime.toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded flex items-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-yellow-700">Weight sensor confirmation pending...</p>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={rejectAttendance}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Reject
              </button>
              <button
                onClick={confirmAttendance}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center"
              >
                <CheckCircleIcon className="w-4 h-4 mr-1.5" />
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