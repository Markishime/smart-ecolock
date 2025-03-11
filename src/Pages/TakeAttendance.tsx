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
} from 'firebase/firestore';
import { db, rtdb } from '../firebase';
import { useAuth } from '../Pages/AuthContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';
import NavBar from '../components/NavBar';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import SeatPlanLayout from '../components/SeatPlanLayout';
import { ref, onValue, off } from 'firebase/database';

// Define interfaces
interface Student {
  id: string;
  name: string;
  email: string;
  seatId: string;
  rfidUid: string;
  attendanceStatus: 'pending' | 'present' | 'late' | 'absent' | undefined;
  rfidAuthenticated: boolean;
  weightAuthenticated: boolean;
  timestamp?: Date;
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

const TakeAttendance: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [classStartTime, setClassStartTime] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'time'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [roomId, setRoomId] = useState<string>('');

  const formattedTime = useMemo(() => currentTime.toLocaleString(), [currentTime]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch instructor's sections
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
        if (fetchedSections.length > 0) {
          setSelectedSection(fetchedSections[0]);
        } else {
          setSelectedSection(null);
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

  // Fetch students for the selected section
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
        const studentsQuery = query(
          studentsRef,
          where('role', '==', 'student'),
          where(documentId(), 'in', studentIds)
        );

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

  // Listen for attendance updates from RTDB
  useEffect(() => {
    if (!selectedSection || !classStartTime) return;

    const studentsRef = ref(rtdb, 'Students');
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      setStudents(prev => {
        return prev.map(student => {
          const studentAttendance = data[student.rfidUid]?.AttendanceRecords;
          if (!studentAttendance) return student;

          const latestTimestamp = Object.keys(studentAttendance)
            .sort()
            .reverse()[0];
          const status = studentAttendance[latestTimestamp];
          const timestampParts = latestTimestamp.split(' ')[0].split('-');
          const timeParts = latestTimestamp.split(' ')[1].split(':');
          const timestamp = new Date(
            parseInt(timestampParts[2]), // Year
            parseInt(timestampParts[0]) - 1, // Month (0-based)
            parseInt(timestampParts[1]), // Day
            parseInt(timeParts[0]), // Hour
            parseInt(timeParts[1]), // Minute
            parseInt(timeParts[2]) // Second
          );

          const timeSinceTap = currentTime.getTime() - timestamp.getTime();
          const fifteenMinutes = 15 * 60 * 1000;
          const thirtyMinutes = 30 * 60 * 1000;

          let updatedStatus: 'pending' | 'present' | 'late' | 'absent' | undefined = status;
          if (status === 'Pending' && timeSinceTap >= thirtyMinutes) {
            updatedStatus = 'absent';
            logAttendance(student.rfidUid, 'Absent', timestamp);
          } else if (status === 'Pending' && timeSinceTap >= fifteenMinutes) {
            updatedStatus = 'late';
            logAttendance(student.rfidUid, 'Late', timestamp);
          }

          return {
            ...student,
            rfidAuthenticated: true,
            weightAuthenticated: status === 'Present',
            attendanceStatus: updatedStatus,
            timestamp,
          };
        });
      });
    });

    return () => off(studentsRef, 'value', unsubscribe);
  }, [selectedSection, classStartTime, currentTime]);

  // Log attendance to RTDB (for late/absent updates)
  const logAttendance = (rfidUid: string, status: string, timestamp: Date) => {
    const formattedTimestamp = timestamp.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(/,/, '').replace(/\//g, '-');
    const path = `/Students/${rfidUid}/AttendanceRecords/${formattedTimestamp}`;
    const registeredPath = `/RegisteredUIDs/${rfidUid}`;
    
    // This assumes Firebase JS SDK is configured for RTDB elsewhere
    import('firebase/database').then(({ set }) => {
      set(ref(rtdb, path), status);
      set(ref(rtdb, registeredPath), formattedTimestamp);
    });
  };

  // Fetch teacher's current schedule
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
        const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        const matchingSchedule = schedules.find((schedule: Schedule) => {
          return (
            schedule.day === currentDay &&
            schedule.startTime <= currentTimeStr &&
            schedule.endTime >= currentTimeStr
          );
        });

        if (matchingSchedule) {
          setCurrentSchedule(matchingSchedule);
          const roomsQuery = query(
            collection(db, 'rooms'),
            where('number', '==', matchingSchedule.room)
          );
          const roomSnapshot = await getDocs(roomsQuery);
          if (!roomSnapshot.empty) {
            setRoomId(roomSnapshot.docs[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching current schedule:', error);
      }
    };

    fetchCurrentSchedule();
  }, [currentUser]);

  // Handle manual attendance change
  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setStudents(prev =>
      prev.map(student => {
        if (student.id === studentId) {
          const timestamp = new Date();
          logAttendance(student.rfidUid, status, timestamp);
          return {
            ...student,
            attendanceStatus: status,
            rfidAuthenticated: true,
            weightAuthenticated: status === 'present',
            timestamp,
          };
        }
        return student;
      })
    );
  };

  // Submit attendance records
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
        rfidAuthenticated: student.rfidAuthenticated,
        weightAuthenticated: student.weightAuthenticated,
        timestamp: Timestamp.fromDate(student.timestamp || new Date()),
        date: new Date().toISOString().split('T')[0],
        submittedBy: {
          id: currentUser?.uid,
          name: currentUser?.fullName,
          role: currentUser?.role,
        },
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
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(student => student.attendanceStatus === statusFilter);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortBy === 'status') {
        const statusOrder = { present: 1, late: 2, absent: 3, pending: 4, undefined: 5 };
        const statusA = statusOrder[a.attendanceStatus || 'undefined'];
        const statusB = statusOrder[b.attendanceStatus || 'undefined'];
        return sortOrder === 'asc' ? statusA - statusB : statusB - statusA;
      }
      if (sortBy === 'time' && a.timestamp && b.timestamp) {
        return sortOrder === 'asc'
          ? a.timestamp.getTime() - b.timestamp.getTime()
          : b.timestamp.getTime() - a.timestamp.getTime();
      }
      return 0;
    });

    return filtered;
  }, [students, searchQuery, statusFilter, sortBy, sortOrder]);

  const exportAttendance = () => {
    const csvContent = [
      ['Name', 'Email', 'Status', 'Timestamp', 'RFID Authenticated', 'Weight Authenticated'],
      ...students.map(student => [
        student.name,
        student.email,
        student.attendanceStatus || 'Not marked',
        student.timestamp ? student.timestamp.toLocaleString() : '',
        student.rfidAuthenticated ? 'Yes' : 'No',
        student.weightAuthenticated ? 'Yes' : 'No',
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

  const getStatusDisplay = (student: Student) => {
    if (student.attendanceStatus === 'pending') {
      return (
        <span className="text-yellow-600 flex items-center gap-1">
          <ClockIcon className="w-4 h-4" />
          Waiting for weight authentication...
        </span>
      );
    }
    switch (student.attendanceStatus) {
      case 'present':
        return (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            Present
          </span>
        );
      case 'late':
        return (
          <span className="text-yellow-600 flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            Late
          </span>
        );
      case 'absent':
        return (
          <span className="text-red-600 flex items-center gap-1">
            <XCircleIcon className="w-4 h-4" />
            Absent
          </span>
        );
      default:
        return <span className="text-gray-600">Not marked</span>;
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
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-800">Take Attendance</h1>
              <select
                value={selectedSection?.id || ''}
                onChange={e => {
                  const section = sections.find(s => s.id === e.target.value) || null;
                  setSelectedSection(section);
                }}
                className="border rounded-lg p-2 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Section</option>
                {sections.map(section => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
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

          {/* Current Schedule Card */}
          {currentSchedule && selectedSection && (
            <div className="mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{currentSchedule.subject}</h3>
                  <div className="mt-1 text-blue-100">
                    <p>Room {currentSchedule.room} • Section {currentSchedule.section}</p>
                    <p>{currentSchedule.startTime} - {currentSchedule.endTime} • {currentSchedule.day}</p>
                  </div>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                  Current Class
                </div>
              </div>
            </div>
          )}

          {/* Seat Plan Layout */}
          {roomId && selectedSection && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Room Seat Plan</h2>
              <SeatPlanLayout roomId={roomId} sectionId={selectedSection.id} />
            </div>
          )}

          {/* Statistics Cards */}
          {selectedSection && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div whileHover={{ scale: 1.02 }} className="bg-blue-50 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm">Total Students</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.totalStudents}</p>
                  </div>
                  <UserGroupIcon className="w-8 h-8 text-blue-500" />
                </div>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="bg-green-50 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm">Present</p>
                    <p className="text-2xl font-bold text-green-900">{stats.present}</p>
                  </div>
                  <CheckCircleIcon className="w-8 h-8 text-green-500" />
                </div>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="bg-yellow-50 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-600 text-sm">Late</p>
                    <p className="text-2xl font-bold text-yellow-900">{stats.late}</p>
                  </div>
                  <ClockIcon className="w-8 h-8 text-yellow-500" />
                </div>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="bg-red-50 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-600 text-sm">Absent</p>
                    <p className="text-2xl font-bold text-red-900">{stats.absent}</p>
                  </div>
                  <XCircleIcon className="w-8 h-8 text-red-500" />
                </div>
              </motion.div>
            </div>
          )}

          {/* Filters and Search */}
          {selectedSection && (
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="border rounded-lg p-2"
                >
                  <option value="all">All Status</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="border rounded-lg p-2"
                >
                  <option value="name">Sort by Name</option>
                  <option value="status">Sort by Status</option>
                  <option value="time">Sort by Time</option>
                </select>
                <button
                  onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Students Grid */}
          {selectedSection ? (
            filteredAndSortedStudents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedStudents.map(student => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    className="bg-gray-50 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{student.name}</p>
                      <p className="text-sm text-gray-600">{student.email}</p>
                      <p className="text-sm">{getStatusDisplay(student)}</p>
                      {student.timestamp && (
                        <p className="text-xs text-gray-500">
                          Last Update: {student.timestamp.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAttendanceChange(student.id, 'present')}
                        className={`
                          p-2 rounded-full
                          ${student.attendanceStatus === 'present'
                            ? 'bg-green-500 text-white'
                            : 'bg-green-100 text-green-600 hover:bg-green-200'}
                        `}
                      >
                        <CheckCircleIcon className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => handleAttendanceChange(student.id, 'late')}
                        className={`
                          p-2 rounded-full
                          ${student.attendanceStatus === 'late'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'}
                        `}
                      >
                        <ClockIcon className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => handleAttendanceChange(student.id, 'absent')}
                        className={`
                          p-2 rounded-full
                          ${student.attendanceStatus === 'absent'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-100 text-red-600 hover:bg-red-200'}
                        `}
                      >
                        <XCircleIcon className="w-6 h-6" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No students found for this section.</p>
            )
          ) : (
            <p className="text-gray-600 text-center py-4">Please select a section to view students.</p>
          )}

          {/* Submit Button */}
          <div className="mt-6 flex justify-between items-center">
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
                disabled={!selectedSection || students.length === 0}
              >
                <CheckCircleIcon className="w-5 h-5" />
                Submit Attendance
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default TakeAttendance;