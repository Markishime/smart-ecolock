import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  onSnapshot,
  getDoc,
  doc,
  documentId,
  updateDoc,
} from 'firebase/firestore';
import { db, rtdb } from '../firebase';
import { useAuth } from '../Pages/AuthContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  CalendarIcon,
  UserIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/solid';
import NavBar from '../components/NavBar'; // Assuming this is the import path
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import SeatPlanLayout from '../components/SeatPlanLayout';
import { ref, onValue, off, set } from 'firebase/database';

// Particle Background Component
const ParticleBackground: React.FC = () => {
  const particles = Array.from({ length: 30 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle, index) => (
        <motion.div
          key={index}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full"
          initial={{ x: `${particle.x}vw`, y: `${particle.y}vh`, opacity: 0.6 }}
          animate={{
            x: `${particle.x + particle.speedX * 50}vw`,
            y: `${particle.y + particle.speedY * 50}vh`,
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      ))}
    </div>
  );
};

// Interfaces
interface Student {
  id: string;
  name: string;
  email: string;
  seatId: string;
  rfidUid?: string;
  attendanceStatus?: 'present' | 'absent' | 'late' | 'pending';
  rfidAuthenticated: boolean;
  weightAuthenticated: boolean;
  timestamp?: Date;
  confirmed?: boolean;
  assignedSensorId?: string;
  weight?: number;
}

interface Section {
  id: string;
  name: string;
  students: string[];
  instructorId?: string;
  startTime: Timestamp;
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

// NavBar Component (Assumed Implementation with Styling)
const StyledNavBar: React.FC<{
  user: { role: string; fullName: string; department: string };
  classStatus: { status: string; color: string; details: string; fullName: string };
}> = ({ user, classStatus }) => {
  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-cyan-800 shadow-lg z-20"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 80 }}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/instructor/dashboard" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-lg font-bold">SmartEcoLock</span>
          </Link>
          <div className="text-cyan-300">
            <span>{user.fullName}</span> • <span>{user.department}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`${classStatus.color} px-3 py-1 rounded-full text-sm text-gray-900 flex items-center gap-2`}>
            <UserGroupIcon className="w-4 h-4" />
            {classStatus.status}: {classStatus.details}
          </div>
          <UserIcon className="w-6 h-6 text-cyan-400" />
        </div>
      </div>
    </motion.nav>
  );
};

const TakeAttendance: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [studentWeights, setStudentWeights] = useState<Record<string, number>>({});

  const formattedTime = useMemo(() => currentTime.toLocaleString(), [currentTime]);

  // Logic remains unchanged
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchSections = async () => {
      if (!currentUser) return;
      try {
        const sectionsRef = collection(db, 'sections');
        const q = query(sectionsRef, where('instructorId', '==', currentUser.uid));
        const sectionsSnapshot = await getDocs(q);
        const fetchedSections = sectionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Section));
        setSections(fetchedSections);
        if (fetchedSections.length > 0) setSelectedSection(fetchedSections[0]);
      } catch (error) {
        console.error('Error fetching sections:', error);
        toast.error('Failed to load sections');
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, [currentUser]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedSection) {
        setStudents([]);
        setClassStartTime(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const sectionDoc = await getDoc(doc(db, 'sections', selectedSection.id));
        if (!sectionDoc.exists()) {
          console.error('Section not found');
          setStudents([]);
          return;
        }
        const sectionData = sectionDoc.data();
        const studentIds = sectionData.students || [];
        if (studentIds.length === 0) {
          setStudents([]);
          setClassStartTime(selectedSection.startTime.toDate());
          setLoading(false);
          return;
        }
        const studentsRef = collection(db, 'students');
        const studentsQuery = query(studentsRef, where('role', '==', 'student'), where(documentId(), 'in', studentIds));
        const studentsSnapshot = await getDocs(studentsQuery);
        const fetchedStudents = studentsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.fullName || '',
            email: data.email || '',
            seatId: data.seatId || '',
            rfidUid: data.rfidUid || '',
            attendanceStatus: undefined,
            rfidAuthenticated: false,
            weightAuthenticated: false,
            timestamp: undefined,
            confirmed: false,
            assignedSensorId: data.assignedSensorId || '',
            weight: undefined,
          } as Student;
        });
        setStudents(fetchedStudents);
        setClassStartTime(selectedSection.startTime.toDate());
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedSection]);

  useEffect(() => {
    setAvailableSensors(['Sensor1', 'Sensor2', 'Sensor3']);
  }, []);

  useEffect(() => {
    if (!selectedSection) return;
    const studentsRef = ref(rtdb, '/Students');
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const studentsData = snapshot.val();
      if (!studentsData) return;
      setStudents(prev => {
        const updatedStudents = prev.map(student => {
          const rfidUid = student.rfidUid;
          if (!rfidUid) return student;
          const studentData = studentsData[rfidUid];
          if (!studentData || studentData.sectionId !== selectedSection.id) return student;
          const timestamp = new Date(studentData.timestamp);
          const weight = studentData.weight || 0;
          const classStatus = studentData['Class Status'];
          let status: 'present' | 'late' | 'absent' = 'absent';
          if (classStatus === 'Present') status = 'present';
          else if (classStatus === 'Late') status = 'late';
          return {
            ...student,
            attendanceStatus: status,
            timestamp,
            confirmed: weight > 20,
            weight,
            weightAuthenticated: weight > 20,
            rfidAuthenticated: true,
            assignedSensorId: studentData.sensor || student.assignedSensorId,
          };
        });
        return updatedStudents;
      });
      const newWeights: Record<string, number> = {};
      Object.keys(studentsData).forEach(rfidUid => {
        const studentData = studentsData[rfidUid];
        const student = students.find(s => s.rfidUid === rfidUid);
        if (student && studentData.sectionId === selectedSection.id) {
          newWeights[student.id] = studentData.weight || 0;
        }
      });
      setStudentWeights(newWeights);
    });
    return () => off(studentsRef, 'value', unsubscribe);
  }, [selectedSection, students]);

  useEffect(() => {
    const fetchCurrentSchedule = async () => {
      if (!currentUser?.uid) return;
      try {
        const teacherDoc = await getDoc(doc(db, 'teachers', currentUser.uid));
        if (!teacherDoc.exists()) return;
        const teacherData = teacherDoc.data();
        const schedules = teacherData.schedule || [];
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
          const roomsQuery = query(collection(db, 'rooms'), where('number', '==', matchingSchedule.room));
          const roomSnapshot = await getDocs(roomsQuery);
          if (!roomSnapshot.empty) setRoomId(roomSnapshot.docs[0].id);
        }
      } catch (error) {
        console.error('Error fetching current schedule:', error);
      }
    };
    fetchCurrentSchedule();
  }, [currentUser]);

  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    const now = new Date();
    setStudents(prev =>
      prev.map(student =>
        student.id === studentId ? { ...student, attendanceStatus: status, timestamp: now, confirmed: true } : student
      )
    );
    toast.success(`Marked ${status} for ${students.find(s => s.id === studentId)?.name} at ${now.toLocaleTimeString()}`);
  };

  const confirmAttendance = () => {
    if (confirmationStudent && confirmationTapTime && classStartTime) {
      const startTimeMs = classStartTime.getTime();
      const tapTimeMs = confirmationTapTime.getTime();
      const gracePeriod = 15 * 60 * 1000;
      const status = tapTimeMs <= startTimeMs + gracePeriod ? 'present' : 'late';
      const now = new Date();
      setStudents(prev =>
        prev.map(s =>
          s.id === confirmationStudent.id ? { ...s, attendanceStatus: status, rfidAuthenticated: true, timestamp: now } : s
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
    if (!selectedSection || !currentSchedule) {
      toast.error('Please select a section and ensure schedule is loaded');
      return;
    }
    try {
      setLoading(true);
      const attendanceRecords = students.map(student => ({
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        sectionId: selectedSection.id,
        sectionName: selectedSection.name,
        subject: currentSchedule.subject,
        room: currentSchedule.room,
        status: student.attendanceStatus || 'absent',
        confirmed: student.confirmed || false,
        rfidAuthenticated: student.rfidAuthenticated || false,
        weightAuthenticated: student.weightAuthenticated || false,
        timestamp: student.timestamp ? Timestamp.fromDate(student.timestamp) : Timestamp.now(),
        date: new Date().toISOString().split('T')[0],
        submittedBy: { id: currentUser?.uid, name: currentUser?.fullName, role: currentUser?.role },
      }));
      const attendanceRef = collection(db, 'attendanceRecords');
      await Promise.all(attendanceRecords.map(record => addDoc(attendanceRef, record)));
      toast.success('Attendance submitted successfully!');
      navigate('/instructor/attendance-management');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      toast.error('Failed to submit attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stats: AttendanceStats = useMemo(() => {
    const total = students.length;
    const presentCount = students.filter(s => s.attendanceStatus === 'present').length;
    const lateCount = students.filter(s => s.attendanceStatus === 'late').length;
    const absentCount = students.filter(s => s.attendanceStatus === 'absent').length;
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
      filtered = filtered.filter(student => student.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(student => student.attendanceStatus === statusFilter);
    }
    filtered.sort((a, b) => {
      if (sortBy === 'name') return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      if (sortBy === 'status') {
        const statusOrder = { present: 1, late: 2, absent: 3, pending: 4, undefined: 5 };
        const statusA = statusOrder[a.attendanceStatus || 'undefined'];
        const statusB = statusOrder[b.attendanceStatus || 'undefined'];
        return sortOrder === 'asc' ? statusA - statusB : statusB - statusA;
      }
      if (sortBy === 'time') {
        const timeA = a.timestamp ? a.timestamp.getTime() : Infinity;
        const timeB = b.timestamp ? b.timestamp.getTime() : Infinity;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });
    return filtered;
  }, [students, searchQuery, statusFilter, sortBy, sortOrder]);

  const exportAttendance = () => {
    const csvContent = [
      ['Name', 'Email', 'UID', 'Status', 'Time', 'Weight', 'Confirmed by Sensor'],
      ...students.map(student => [
        student.name,
        student.email,
        student.rfidUid || 'N/A',
        student.attendanceStatus || 'Not marked',
        student.timestamp ? student.timestamp.toLocaleTimeString() : '',
        student.weight ? student.weight.toFixed(1) : 'N/A',
        student.confirmed ? 'Yes' : 'No',
      ]),
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedSection?.name || 'unnamed'}_${new Date().toLocaleDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const assignToSensor = async (studentId: string, sensorId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !sensorId) {
      toast.error('Invalid student or sensor selection');
      return;
    }
    try {
      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, { assignedSensorId: sensorId });
      const sensorRef = ref(rtdb, `weightSensors/${roomId}/${sensorId}`);
      await set(sensorRef, { rfidUid: student.rfidUid, weight: 0 });
      setStudents(prev => prev.map(s => (s.id === studentId ? { ...s, assignedSensorId: sensorId } : s)));
      toast.success(`Student assigned to sensor ${sensorId}`);
    } catch (error) {
      console.error('Error assigning sensor:', error);
      toast.error('Failed to assign sensor');
    }
  };

  const getStatusDisplay = (student: Student) => {
    const weightInfo = student.weight !== undefined ? (
      <span className="ml-2 text-cyan-400">({student.weight.toFixed(1)} kg)</span>
    ) : null;
    const timeInfo = student.timestamp ? (
      <span className="ml-2 text-gray-400 text-xs">({student.timestamp.toLocaleTimeString()})</span>
    ) : null;

    if (student.rfidAuthenticated && !student.weightAuthenticated) {
      return (
        <span className="text-yellow-400 flex items-center gap-1">
          <ClockIcon className="w-4 h-4" />
          Awaiting Weight Auth... {weightInfo} {timeInfo}
        </span>
      );
    }

    switch (student.attendanceStatus) {
      case 'present':
        return (
          <span className="text-green-400">
            Present {weightInfo} {timeInfo}
          </span>
        );
      case 'late':
        return (
          <span className="text-yellow-400">
            Late {weightInfo} {timeInfo}
          </span>
        );
      case 'absent':
        return (
          <span className="text-red-400">
            Absent {weightInfo} {timeInfo}
          </span>
        );
      default:
        return (
          <span className="text-gray-400">
            Not Marked {weightInfo} {timeInfo}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-t-cyan-500 border-gray-700 rounded-full"
        ></motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono relative overflow-hidden">
      <ParticleBackground />
      
      {/* NavBar */}
      <StyledNavBar
        user={{
          role: currentUser?.role || 'instructor',
          fullName: currentUser?.fullName || 'Instructor',
          department: currentUser?.department || 'Department',
        }}
        classStatus={{
          status: 'Taking Attendance',
          color: 'bg-cyan-600',
          details: selectedSection?.name || 'No section selected',
          fullName: currentUser?.fullName || 'Instructor',
        }}
      />

      <div className="relative z-10 px-6 py-8 pt-24">
        {/* Main Content */}
        <motion.div
          className="max-w-4xl mx-auto bg-gray-800 rounded-xl shadow-2xl p-8 border border-cyan-800 relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: 'spring', stiffness: 80 }}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
          <motion.div
            className="absolute -inset-2 bg-cyan-500/20 blur-xl"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <div className="relative z-10">
            <motion.div
              className="flex items-center justify-center mb-6"
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
            >
              <UserGroupIcon className="w-12 h-12 text-cyan-400 mr-4 animate-pulse" />
              <motion.h1
                className="text-3xl font-bold text-cyan-100"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Take Attendance
              </motion.h1>
            </motion.div>

            <div className="flex justify-between items-center mb-6">
              <select
                value={selectedSection?.id || ''}
                onChange={e => setSelectedSection(sections.find(s => s.id === e.target.value) || null)}
                className="bg-gray-700 text-white border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select Section</option>
                {sections.map(section => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              <div className="text-cyan-300 text-sm">{formattedTime}</div>
            </div>

            {/* Current Schedule */}
            {currentSchedule && selectedSection && (
              <motion.div
                className="bg-gray-700 p-4 rounded-lg mb-6"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="text-lg font-semibold text-cyan-200">{currentSchedule.subject}</h3>
                <p className="text-cyan-300">
                  Room {currentSchedule.room} • Section {currentSchedule.section} • {currentSchedule.startTime} -{' '}
                  {currentSchedule.endTime} • {currentSchedule.day}
                </p>
              </motion.div>
            )}

            {/* Students List */}
            {selectedSection ? (
              filteredAndSortedStudents.length > 0 ? (
                <div className="space-y-4">
                  {filteredAndSortedStudents.map(student => (
                    <motion.div
                      key={student.id}
                      className="bg-gray-700 p-4 rounded-lg flex items-center justify-between"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div>
                        <p className="text-cyan-100 font-medium">{student.name}</p>
                        <p className="text-gray-400 text-sm">UID: {student.rfidUid || 'N/A'}</p>
                        <div className="flex items-center text-sm">{getStatusDisplay(student)}</div>
                        {student.assignedSensorId && (
                          <p className="text-xs text-gray-400 mt-1">Sensor: {student.assignedSensorId}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <select
                          value={student.assignedSensorId || ''}
                          onChange={e => assignToSensor(student.id, e.target.value)}
                          className="bg-gray-600 text-white border border-gray-500 rounded-lg p-1 text-sm"
                        >
                          <option value="">Assign Sensor</option>
                          {availableSensors.map(sensor => (
                            <option key={sensor} value={sensor}>
                              {sensor}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAttendanceChange(student.id, 'present')}
                          className={`p-2 rounded-full ${
                            student.attendanceStatus === 'present'
                              ? 'bg-green-600'
                              : 'bg-green-800 hover:bg-green-700'
                          }`}
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.id, 'late')}
                          className={`p-2 rounded-full ${
                            student.attendanceStatus === 'late'
                              ? 'bg-yellow-600'
                              : 'bg-yellow-800 hover:bg-yellow-700'
                          }`}
                        >
                          <ClockIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleAttendanceChange(student.id, 'absent')}
                          className={`p-2 rounded-full ${
                            student.attendanceStatus === 'absent' ? 'bg-red-600' : 'bg-red-800 hover:bg-red-700'
                          }`}
                        >
                          <XCircleIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-cyan-300 text-center py-4">No students found for this section.</p>
              )
            ) : (
              <p className="text-cyan-300 text-center py-4">Please select a section to view students.</p>
            )}

            {/* Actions */}
            <motion.div
              className="mt-6 flex justify-between items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              {selectedSection && (
                <div className="text-sm text-cyan-300">
                  Attendance: {stats.attendanceRate.toFixed(1)}% | Punctuality: {stats.punctualityRate.toFixed(1)}%
                </div>
              )}
              <div className="flex space-x-4">
                <button
                  onClick={exportAttendance}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white p-3 rounded-lg flex items-center gap-2"
                  disabled={!selectedSection}
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Export
                </button>
                <Link
                  to="/instructor/attendance-management"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white p-3 rounded-lg flex items-center gap-2"
                >
                  <CalendarIcon className="w-5 h-5" />
                  View Records
                </Link>
                <button
                  onClick={submitAttendance}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white p-3 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  disabled={!selectedSection || students.length === 0}
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  Submit
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-400">
          <p>© 2025 SmartEcoLock Tech System. All rights reserved.</p>
        </footer>

        {/* Confirmation Modal */}
        {confirmationStudent && confirmationTapTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-cyan-800 max-w-md w-full"
            >
              <h2 className="text-xl font-bold text-cyan-100 mb-4">Confirm Attendance</h2>
              <div className="space-y-2 text-cyan-200">
                <p><strong>Student:</strong> {confirmationStudent.name}</p>
                <p><strong>Tap Time:</strong> {confirmationTapTime.toLocaleString()}</p>
                <p className="text-sm text-gray-400">Weight sensor confirmation pending...</p>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={rejectAttendance}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Reject
                </button>
                <button
                  onClick={confirmAttendance}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TakeAttendance;