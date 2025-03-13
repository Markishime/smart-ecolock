import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import {
  CalendarIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  UserIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SeatPlanLayout from '../components/SeatPlanLayout';
import { Link } from 'react-router-dom';

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
  fullName: string;
  email: string;
  idNumber: string;
  major: string;
  sections?: string[];
}

interface Section {
  id: string;
  name: string;
  students: string[];
  instructorId?: string;
  room?: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  status: 'present' | 'absent' | 'late';
  confirmed: boolean;
  timestamp: Timestamp;
  date: string;
  subject: string;
}

interface AttendanceStats {
  totalRecords: number;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
}

// Styled NavBar Component
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
            <ChartBarIcon className="w-4 h-4" />
            {classStatus.status}: {classStatus.details}
          </div>
          <UserIcon className="w-6 h-6 text-cyan-400" />
        </div>
      </div>
    </motion.nav>
  );
};

const AttendanceManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);

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
        if (fetchedSections.length > 0) setSelectedSection(fetchedSections[0].id);
      } catch (error) {
        console.error('Error fetching sections:', error);
      }
    };
    fetchSections();
  }, [currentUser]);

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRef = collection(db, 'students');
        const studentsSnapshot = await getDocs(studentsRef);
        const fetchedStudents = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Student));
        setStudents(fetchedStudents);
      } catch (error) {
        console.error('Error fetching students:', error);
      }
    };
    fetchStudents();
  }, []);

  // Fetch attendance records
  useEffect(() => {
    const fetchAttendanceRecords = async () => {
      if (!selectedSection) return;
      try {
        setLoading(true);
        const attendanceRef = collection(db, 'attendanceRecords');
        const q = query(attendanceRef, where('sectionId', '==', selectedSection), orderBy('timestamp', 'desc'));
        const recordsSnapshot = await getDocs(q);
        const fetchedRecords = recordsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as AttendanceRecord));
        setAttendanceRecords(fetchedRecords);
      } catch (error) {
        console.error('Error fetching attendance records:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendanceRecords();
  }, [selectedSection]);

  // Filter records
  const filteredRecords = useMemo(() => {
    let filtered = [...attendanceRecords];
    if (searchQuery) {
      filtered = filtered.filter(record => record.studentName.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (dateFilter) {
      filtered = filtered.filter(record => record.date === dateFilter);
    }
    return filtered;
  }, [attendanceRecords, searchQuery, dateFilter]);

  // Calculate stats
  const stats: AttendanceStats = useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === 'present').length;
    const late = filteredRecords.filter(r => r.status === 'late').length;
    const absent = filteredRecords.filter(r => r.status === 'absent').length;
    return {
      totalRecords: total,
      present,
      late,
      absent,
      attendanceRate: total ? ((present + late) / total) * 100 : 0,
    };
  }, [filteredRecords]);

  // Export to CSV
  const exportAttendance = () => {
    const csvContent = [
      ['Student Name', 'ID Number', 'Section', 'Status', 'Date', 'Time', 'Verified'],
      ...filteredRecords.map(record => [
        record.studentName,
        students.find(s => s.id === record.studentId)?.idNumber || '',
        record.sectionName,
        record.status,
        record.date,
        record.timestamp.toDate().toLocaleTimeString(),
        record.confirmed ? 'Yes' : 'No',
      ]),
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedSection}_${new Date().toLocaleDateString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get unique dates
  const uniqueDates = useMemo(() => {
    const dates = attendanceRecords.map(record => record.date);
    return [...new Set(dates)].sort().reverse();
  }, [attendanceRecords]);

  if (loading && !selectedSection) {
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
          status: 'Attendance Overview',
          color: 'bg-cyan-600',
          details: 'Monitor and review attendance records',
          fullName: currentUser?.fullName || 'Instructor',
        }}
      />

      <div className="relative z-10 px-6 py-8 pt-24">
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
            {/* Header */}
            <motion.div
              className="flex items-center justify-center mb-6"
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
            >
              <ChartBarIcon className="w-12 h-12 text-cyan-400 mr-4 animate-pulse" />
              <motion.h1
                className="text-3xl font-bold text-cyan-100"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Attendance Management
              </motion.h1>
            </motion.div>

            <div className="flex justify-between items-center mb-6">
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="bg-gray-700 text-white border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500"
              >
                {sections.map(section => (
                  <option key={section.id} value={section.id}>
                    {section.name} {section.room ? `(Room ${section.room})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              {[
                { label: 'Total', value: stats.totalRecords, icon: ChartBarIcon, color: 'text-cyan-400' },
                { label: 'Present', value: stats.present, icon: CheckCircleIcon, color: 'text-green-400' },
                { label: 'Late', value: stats.late, icon: ClockIcon, color: 'text-yellow-400' },
                { label: 'Absent', value: stats.absent, icon: XCircleIcon, color: 'text-red-400' },
                { label: 'Rate', value: `${stats.attendanceRate.toFixed(1)}%`, icon: ChartBarIcon, color: 'text-blue-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">{stat.label}</p>
                      <p className="text-lg font-semibold text-cyan-100">{stat.value}</p>
                    </div>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Filters */}
            <motion.div
              className="flex flex-col md:flex-row gap-4 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cyan-500" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 placeholder-gray-400"
                />
              </div>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="bg-gray-700 text-white border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All Dates</option>
                {uniqueDates.map(date => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <button
                onClick={exportAttendance}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Export CSV
              </button>
            </motion.div>

            {/* Attendance Records */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h2 className="text-lg font-semibold text-cyan-200 mb-4">Attendance Records</h2>
              {filteredRecords.length === 0 ? (
                <p className="text-cyan-300 text-center py-4">No attendance records found for this section</p>
              ) : (
                <div className="space-y-4">
                  {filteredRecords.map(record => {
                    const student = students.find(s => s.id === record.studentId);
                    return (
                      <motion.div
                        key={record.id}
                        className="bg-gray-700 rounded-lg p-4 hover:shadow-cyan-500/50 transition-all"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-cyan-100">{record.studentName}</h3>
                              <p className="text-sm text-gray-400">{student?.idNumber}</p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                record.status === 'present'
                                  ? 'bg-green-600 text-white'
                                  : record.status === 'late'
                                  ? 'bg-yellow-600 text-white'
                                  : 'bg-red-600 text-white'
                              }`}
                            >
                              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            <p>Date: {new Date(record.date).toLocaleDateString()}</p>
                            <p>Time: {record.timestamp.toDate().toLocaleTimeString()}</p>
                            <p>Subject: {record.subject}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {record.confirmed ? (
                              <span className="text-green-400 flex items-center gap-1">
                                <CheckCircleIcon className="w-4 h-4" />
                                Verified
                              </span>
                            ) : (
                              <span className="text-gray-400 flex items-center gap-1">
                                <XCircleIcon className="w-4 h-4" />
                                Unverified
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Seat Plan */}
            {selectedSection && sections.find(s => s.id === selectedSection)?.room && (
              <motion.div
                className="mt-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <h2 className="text-lg font-semibold text-cyan-200 mb-4">Classroom Layout</h2>
                <SeatPlanLayout roomId={sections.find(s => s.id === selectedSection)!.room!} sectionId={selectedSection} />
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-400">
          <p>© 2025 SmartEcoLock Tech System. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default AttendanceManagement;