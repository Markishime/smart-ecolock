import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { db, rtdb } from '../firebase';
import { useAuth } from '../Pages/AuthContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/solid';
import NavBar from '../components/NavBar';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import SeatPlanLayout from '../components/SeatPlanLayout';
import { ref, onValue, off, set } from 'firebase/database';
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
  weight: number;
  sensor: string;
  role: string;
  date: string;
  action: string;
  attendanceStatus: string;
  rfidAuthenticated: boolean;
  weightAuthenticated: boolean;
  confirmed: boolean;
  assignedSensorId: string;
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
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionsLoading, setSectionsLoading] = useState(true);
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
  const [availableSensors, setAvailableSensors] = useState<string[]>([]);

  const formattedTime = useMemo(() => currentTime.toLocaleString(), [currentTime]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // Fetch subjects from Firestore 'subjects' collection
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!currentUser) return;

      try {
        setSubjectsLoading(true);
        const subjectsRef = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        const fetchedSubjects = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          code: doc.data().code || '',
          name: doc.data().name || '',
          credits: doc.data().credits || 0,
          department: doc.data().department || '',
          details: doc.data().details || '',
          learningObjectives: doc.data().learningObjectives || [],
          prerequisites: doc.data().prerequisites || [],
          sections: doc.data().sections || [],
        })) as Subject[];

        setSubjects(fetchedSubjects);
        if (fetchedSubjects.length > 0) {
          setSelectedSubject(fetchedSubjects[0]); // Default to first subject
        }
      } catch (error) {
        console.error('Error fetching subjects from Firestore:', error);
        toast.error('Failed to load subjects');
      } finally {
        setSubjectsLoading(false);
      }
    };

    fetchSubjects();
  }, [currentUser]);

  // Fetch instructor's sections from Firestore using instructorId
  useEffect(() => {
    const fetchSections = async () => {
      if (!currentUser) {
        toast.error('User not authenticated. Please log in.');
        setSections([]);
        setSectionsLoading(false);
        setLoading(false);
        return;
      }

      try {
        setSectionsLoading(true);
        const sectionsRef = collection(db, 'sections');
        const q = query(sectionsRef, where('instructorId', '==', currentUser.uid));
        const sectionsSnapshot = await getDocs(q);
        const fetchedSections = sectionsSnapshot.docs.map((doc) => ({
          id: doc.id,
          code: doc.data().code || '',
          createdAt: doc.data().createdAt || '',
          instructorRfidUid: doc.data().instructorRfidUid || '',
          name: doc.data().name || '',
          students: doc.data().students || [],
          subjectId: doc.data().subjectId || '',
          instructorId: doc.data().instructorId || '',
        })) as Section[];
        setSections(fetchedSections);
        if (fetchedSections.length > 0) {
          setSelectedSection(fetchedSections[0]); // Default to first section
        }
      } catch (error) {
        console.error('Error fetching sections from Firestore:', error);
        toast.error('Failed to load sections');
      } finally {
        setSectionsLoading(false);
        setLoading(false);
      }
    };

    fetchSections();
  }, [currentUser]);

  // Fetch students for the selected section from RTDB
  useEffect(() => {
    if (!selectedSection) {
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
        const studentsData = snapshot.val();
        if (!studentsData) {
          setStudents([]);
          setClassStartTime(new Date(selectedSection.createdAt));
          setLoading(false);
          return;
        }

        const fetchedStudents: Student[] = Object.keys(studentsData)
          .filter((rfidUid) => studentsData[rfidUid].sectionId === selectedSection.id)
          .map((rfidUid) => {
            const studentData = studentsData[rfidUid];
            return {
              rfidUid,
              idNumber: studentData.idNumber || '',
              studentName: studentData.studentName || '',
              email: studentData.email || '',
              mobileNumber: studentData.mobileNumber || '',
              department: studentData.department || '',
              section: studentData.section || 'Unknown',
              sectionId: studentData.sectionId || '',
              classStatus: studentData.classStatus || '',
              timestamp: studentData.timestamp || '',
              weight: studentData.weight || 0,
              sensor: studentData.sensor || '',
              role: studentData.role || '',
              date: studentData.date || '',
              action: studentData.action || '',
              attendanceStatus: studentData.attendanceStatus || 'absent',
              rfidAuthenticated: studentData.rfidAuthenticated || false,
              weightAuthenticated: studentData.weightAuthenticated || false,
              confirmed: studentData.confirmed || false,
              assignedSensorId: studentData.assignedSensorId || studentData.sensor || '',
            };
          });

        setStudents(fetchedStudents);
        setClassStartTime(new Date(selectedSection.createdAt));
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching students from RTDB:', error);
        toast.error('Failed to load students');
        setStudents([]);
        setLoading(false);
      }
    );

    return () => off(studentsRef, 'value', unsubscribe);
  }, [selectedSection]);

  // Fetch available weight sensors
  useEffect(() => {
    setAvailableSensors(['Sensor1', 'Sensor2', 'Sensor3']);
  }, []);

  // Fetch teacher's current schedule from RTDB
  useEffect(() => {
    if (!currentUser?.uid) return;

    const instructorRef = ref(rtdb, `/Instructors/${currentUser.uid}`);
    const unsubscribe = onValue(
      instructorRef,
      (snapshot) => {
        const instructorData = snapshot.val();
        if (!instructorData || !instructorData.schedule) {
          setCurrentSchedule(null);
          setRoomId('');
          return;
        }

        const schedules = instructorData.schedule;
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        const matchingSchedule = schedules.find((schedule: Schedule) => {
          return (
            schedule.day === currentDay &&
            schedule.startTime <= currentTime &&
            schedule.endTime >= currentTime
          );
        });

        if (matchingSchedule) {
          setCurrentSchedule(matchingSchedule);
          setRoomId(matchingSchedule.room);
        } else {
          setCurrentSchedule(null);
          setRoomId('');
        }
      },
      (error) => {
        console.error('Error fetching instructor schedule from RTDB:', error);
        setCurrentSchedule(null);
        setRoomId('');
      }
    );

    return () => off(instructorRef, 'value', unsubscribe);
  }, [currentUser]);

  const handleAttendanceChange = (rfidUid: string, status: 'present' | 'absent' | 'late') => {
    const now = new Date();
    setStudents((prev) =>
      prev.map((student) =>
        student.rfidUid === rfidUid
          ? { ...student, attendanceStatus: status, timestamp: now.toISOString(), confirmed: true }
          : student
      )
    );
    toast.success(`Marked ${status} for ${students.find((s) => s.rfidUid === rfidUid)?.studentName} at ${now.toLocaleTimeString()}`);
  };

  const confirmAttendance = () => {
    if (confirmationStudent && confirmationTapTime && classStartTime) {
      const startTimeMs = classStartTime.getTime();
      const tapTimeMs = confirmationTapTime.getTime();
      const gracePeriod = 15 * 60 * 1000;
      const status = tapTimeMs <= startTimeMs + gracePeriod ? 'present' : 'late';
      const now = new Date();
      setStudents((prev) =>
        prev.map((s) =>
          s.rfidUid === confirmationStudent.rfidUid
            ? { ...s, attendanceStatus: status, rfidAuthenticated: true, timestamp: now.toISOString() }
            : s
        )
      );
    }
    setConfirmationStudent(null);
    setConfirmationTapTime(null);
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
          name: currentUser.fullName || 'Instructor',
          role: currentUser.role || 'instructor',
        },
      }));

      const writePromises = attendanceRecords.map((record) =>
        addDoc(collection(db, 'attendanceRecords'), record)
      );
      await Promise.all(writePromises);

      setStudents((prev) =>
        prev.map((student) => ({
          ...student,
          attendanceStatus: 'absent',
          timestamp: '',
          confirmed: false,
          rfidAuthenticated: false,
          weightAuthenticated: false,
        }))
      );

      toast.success('Attendance submitted successfully!');
      navigate('/instructor/attendance-management');
    } catch (error) {
      console.error('Error submitting attendance to Firestore:', error);
      toast.error('Failed to submit attendance. Please try again.');
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
        const statusOrder = { present: 1, late: 2, absent: 3, pending: 4, undefined: 5 };
        const statusA = statusOrder[a.attendanceStatus as keyof typeof statusOrder || 'undefined'];
        const statusB = statusOrder[b.attendanceStatus as keyof typeof statusOrder || 'undefined'];
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleRFIDTap = (rfidUid: string) => {
    const now = new Date();
    setStudents((prev) =>
      prev.map((student) =>
        student.rfidUid === rfidUid
          ? { ...student, rfidAuthenticated: true, attendanceStatus: 'pending', timestamp: now.toISOString() }
          : student
      )
    );
  };

  const assignToSensor = async (rfidUid: string, sensorId: string) => {
    const student = students.find((s) => s.rfidUid === rfidUid);
    if (!student || !sensorId) {
      toast.error('Invalid student or sensor selection');
      return;
    }

    try {
      const studentRef = ref(rtdb, `/Students/${rfidUid}`);
      await set(studentRef, { ...student, sensor: sensorId, assignedSensorId: sensorId });

      const sensorRef = ref(rtdb, `weightSensors/${roomId}/${sensorId}`);
      await set(sensorRef, {
        rfidUid: student.rfidUid,
        weight: 0,
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.rfidUid === rfidUid ? { ...s, assignedSensorId: sensorId, sensor: sensorId } : s
        )
      );
      toast.success(`Student assigned to sensor ${sensorId}`);
    } catch (error) {
      console.error('Error assigning sensor:', error);
      toast.error('Failed to assign sensor');
    }
  };

  const getStatusDisplay = (student: Student) => {
    const weightInfo = student.weight ? (
      <span className="ml-2 text-blue-600">({student.weight.toFixed(1)} kg)</span>
    ) : null;
    const timeInfo = student.timestamp ? (
      <span className="ml-2 text-gray-500 text-xs">({new Date(student.timestamp).toLocaleTimeString()})</span>
    ) : null;

    if (student.rfidAuthenticated && !student.weightAuthenticated) {
      return (
        <span className="text-yellow-600 flex items-center gap-1">
          <ClockIcon className="w-4 h-4" />
          Waiting for weight authentication... {weightInfo} {timeInfo}
        </span>
      );
    }

    switch (student.attendanceStatus) {
      case 'present':
        return (
          <span className="text-green-600">
            Present {weightInfo} {timeInfo}
          </span>
        );
      case 'late':
        return (
          <span className="text-yellow-600">
            Late {weightInfo} {timeInfo}
          </span>
        );
      case 'absent':
        return (
          <span className="text-red-600">
            Absent {weightInfo} {timeInfo}
          </span>
        );
      default:
        return (
          <span className="text-gray-600">
            Not marked {weightInfo} {timeInfo}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        user={{
          role: currentUser?.role || 'instructor',
          fullName: currentUser?.fullName || 'Instructor',
          department: currentUser?.department || 'Department',
        }}
        classStatus={{
          status: 'Taking Attendance',
          color: 'bg-indigo-100 text-indigo-800',
          details: selectedSection?.name || 'No section selected',
          fullName: currentUser?.fullName || 'Instructor',
        }}
      />

      <main className="container mx-auto px-6 py-8 mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-800">Take Attendance</h1>
              {/* Subject Dropdown */}
              {subjectsLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-indigo-600"></div>
                  <span className="text-gray-600">Loading subjects...</span>
                </div>
              ) : (
                <select
                  value={selectedSubject?.id || ''}
                  onChange={(e) => {
                    const subject = subjects.find((s) => s.id === e.target.value) || null;
                    setSelectedSubject(subject);
                    if (subject && subject.sections.length > 0) {
                      setSelectedSection(subject.sections[0]); // Default to first section of selected subject
                    }
                  }}
                  className="border rounded-lg p-2 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 w-48"
                >
                  <option value="" disabled>
                    Select Subject
                  </option>
                  {subjects.length > 0 ? (
                    subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </option>
                    ))
                  ) : (
                    <option disabled>No subjects available</option>
                  )}
                </select>
              )}
              {/* Section Dropdown */}
              {sectionsLoading || !selectedSubject ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-indigo-600"></div>
                  <span className="text-gray-600">Loading sections...</span>
                </div>
              ) : (
                <select
                  value={selectedSection?.id || ''}
                  onChange={(e) => {
                    const section = selectedSubject?.sections.find((s) => s.id === e.target.value) || sections.find((s) => s.id === e.target.value) || null;
                    setSelectedSection(section);
                  }}
                  className="border rounded-lg p-2 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 w-48"
                >
                  <option value="" disabled>
                    Select Section
                  </option>
                  {selectedSubject?.sections.length > 0 ? (
                    selectedSubject.sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name} ({section.code})
                      </option>
                    ))
                  ) : sections.length > 0 ? (
                    sections.map((section) => (
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
            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-600">{formattedTime}</div>
              <button
                onClick={exportAttendance}
                className="flex items-center space-x-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
                disabled={!selectedSection}
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {currentSchedule && selectedSection && selectedSubject && (
            <div className="mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{selectedSubject.name}</h3>
                  <div className="mt-1 text-blue-100">
                    <p>Room {currentSchedule.room} • Section {selectedSection.name}</p>
                    <p>
                      {currentSchedule.startTime} - {currentSchedule.endTime} • {currentSchedule.day}
                    </p>
                  </div>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                  Current Class
                </div>
              </div>
            </div>
          )}

          {roomId && selectedSection && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Room Seat Plan</h2>
              <SeatPlanLayout roomId={roomId} sectionId={selectedSection.id} />
            </div>
          )}

          {selectedSection && (
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="relative flex-1 sm:flex-none">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Filter by status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'present' | 'absent' | 'late')}
                  className="border rounded-lg p-2 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'status' | 'time')}
                  className="border rounded-lg p-2 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                  <option value="time">Time</option>
                </select>
              </div>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                {sortOrder === 'asc' ? (
                  <ArrowUpIcon className="w-5 h-5" />
                ) : (
                  <ArrowDownIcon className="w-5 h-5" />
                )}
                <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
              </button>
            </div>
          )}

          {selectedSection ? (
            filteredAndSortedStudents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedStudents.map((student) => (
                  <motion.div
                    key={student.rfidUid}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    className="bg-gray-50 rounded-xl p-4 flex flex-col space-y-2 border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{student.studentName}</p>
                        <p className="text-sm text-gray-600">UID: {student.rfidUid}</p>
                        <p className="text-sm text-gray-600">ID: {student.idNumber}</p>
                      </div>
                      <div className="flex space-x-2">
                        <select
                          value={student.assignedSensorId || ''}
                          onChange={(e) => assignToSensor(student.rfidUid, e.target.value)}
                          className="border rounded-lg p-1 text-sm"
                        >
                          <option value="">Assign Sensor</option>
                          {availableSensors.map((sensor) => (
                            <option key={sensor} value={sensor}>
                              {sensor}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'present')}
                          className={`
                            p-2 rounded-full
                            ${student.attendanceStatus === 'present' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600 hover:bg-green-200'}
                          `}
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'late')}
                          className={`
                            p-2 rounded-full
                            ${student.attendanceStatus === 'late' ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'}
                          `}
                        >
                          <ClockIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.rfidUid, 'absent')}
                          className={`
                            p-2 rounded-full
                            ${student.attendanceStatus === 'absent' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600 hover:bg-red-200'}
                          `}
                        >
                          <XCircleIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Status:</span> {getStatusDisplay(student)}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Email:</span> {student.email || 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Mobile:</span> {student.mobileNumber || 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Department:</span> {student.department || 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Section:</span> {student.section || 'Unknown'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Subject:</span> {selectedSubject?.name || 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Weight:</span>{' '}
                        {student.weight ? `${student.weight.toFixed(1)} kg` : 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Weight Verified:</span>{' '}
                        {student.weightAuthenticated ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-red-600">No</span>
                        )}
                      </p>
                      {student.assignedSensorId && (
                        <p className="text-sm">
                          <span className="font-medium text-gray-700">Sensor:</span> {student.assignedSensorId}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No students found for this section.</p>
            )
          ) : (
            <p className="text-gray-600 text-center py-4">Please select a subject and section to view students.</p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            {selectedSection && (
              <div className="text-sm text-gray-600">
                Attendance Rate: {stats.attendanceRate.toFixed(1)}% | Punctuality Rate:{' '}
                {stats.punctualityRate.toFixed(1)}%
              </div>
            )}
            <div className="flex space-x-4">
              <Link
                to="/instructor/attendance-management"
                className="bg-indigo-100 text-indigo-700 px-6 py-3 rounded-lg hover:bg-indigo-200 transition flex items-center gap-2"
              >
                <CalendarIcon className="w-5 h-5" />
                View All Records
              </Link>
              <button
                onClick={submitAttendance}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                disabled={!selectedSection || !selectedSubject || students.length === 0}
              >
                <CheckCircleIcon className="w-5 h-5" />
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
            className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full mx-4"
          >
            <h2 className="text-xl font-bold mb-4">Confirm Attendance</h2>
            <div className="space-y-2">
              <p>
                <strong>Student:</strong> {confirmationStudent.studentName}
              </p>
              <p>
                <strong>Tap Time:</strong> {confirmationTapTime.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Weight sensor confirmation pending...</p>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={rejectAttendance}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Reject
              </button>
              <button
                onClick={confirmAttendance}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
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