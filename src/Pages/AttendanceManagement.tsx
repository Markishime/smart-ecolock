import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import NavBar from '../components/NavBar';
import {
  CalendarIcon,
  FunnelIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SeatPlanLayout from '../components/SeatPlanLayout';

interface Student {
  id: string;
  fullName: string;
  email: string;
  idNumber: string;
  major: string;
  mobileNumber: string;
  role: string;
  schedule?: {
    day: string;
    startTime: string;
    endTime: string;
    room: string;
    section: string;
    subject: string;
  };
  section?: string;
  sections?: string[];
  yearLevel?: string;
  createdAt?: string;
  seatId?: string;
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
  punctualityRate: number;
}

const AttendanceManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [students, setStudents] = useState<Student[]>([]);
  const [studentMap, setStudentMap] = useState<{ [key: string]: Student }>({});

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
          ...doc.data()
        } as Section));
        setSections(fetchedSections);
      } catch (error) {
        console.error('Error fetching sections:', error);
      }
    };

    fetchSections();
  }, [currentUser]);

  // Fetch attendance records
  useEffect(() => {
    const fetchAttendanceRecords = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        const attendanceRef = collection(db, 'attendanceRecords');
        
        let q;
        if (selectedSection === 'all') {
          // Get all sections for this instructor
          const sectionIds = sections.map(section => section.id);
          q = query(
            attendanceRef,
            where('sectionId', 'in', sectionIds.length > 0 ? sectionIds : ['none']),
            orderBy('timestamp', 'desc')
          );
        } else {
          q = query(
            attendanceRef,
            where('sectionId', '==', selectedSection),
            orderBy('timestamp', 'desc')
          );
        }
        
        const recordsSnapshot = await getDocs(q);
        const fetchedRecords = recordsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AttendanceRecord));
        
        setAttendanceRecords(fetchedRecords);
      } catch (error) {
        console.error('Error fetching attendance records:', error);
      } finally {
        setLoading(false);
      }
    };

    if (sections.length > 0 || selectedSection !== 'all') {
      fetchAttendanceRecords();
    }
  }, [currentUser, sections, selectedSection]);

  // Fetch all students
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRef = collection(db, 'students');
        const studentsSnapshot = await getDocs(studentsRef);
        const fetchedStudents = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Student));
        
        setStudents(fetchedStudents);
        
        // Create a map of student IDs to student data for quick lookup
        const studentMapping = fetchedStudents.reduce((acc, student) => {
          acc[student.id] = student;
          return acc;
        }, {} as { [key: string]: Student });
        
        setStudentMap(studentMapping);
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load student data');
      }
    };

    fetchStudents();
  }, []);

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    let filtered = [...attendanceRecords];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(record =>
        record.studentName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter);
    }

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter(record => record.date === dateFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.studentName.localeCompare(b.studentName)
          : b.studentName.localeCompare(a.studentName);
      }
      if (sortBy === 'status') {
        const statusOrder = { present: 1, late: 2, absent: 3 };
        const statusA = statusOrder[a.status];
        const statusB = statusOrder[b.status];
        return sortOrder === 'asc' ? statusA - statusB : statusB - statusA;
      }
      if (sortBy === 'date') {
        const dateA = a.timestamp.toDate().getTime();
        const dateB = b.timestamp.toDate().getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });

    return filtered;
  }, [attendanceRecords, searchQuery, statusFilter, dateFilter, sortBy, sortOrder]);

  // Calculate attendance statistics
  const stats: AttendanceStats = useMemo(() => {
    const total = filteredAndSortedRecords.length;
    const presentCount = filteredAndSortedRecords.filter(r => r.status === 'present').length;
    const lateCount = filteredAndSortedRecords.filter(r => r.status === 'late').length;
    const absentCount = filteredAndSortedRecords.filter(r => r.status === 'absent').length;

    return {
      totalRecords: total,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      attendanceRate: total ? ((presentCount + lateCount) / total) * 100 : 0,
      punctualityRate: total ? (presentCount / (presentCount + lateCount || 1)) * 100 : 0
    };
  }, [filteredAndSortedRecords]);

  // Export attendance records to CSV
  const exportAttendance = () => {
    const csvContent = [
      ['Student Name', 'Section', 'Status', 'Date', 'Time', 'Confirmed by Sensor'],
      ...filteredAndSortedRecords.map(record => [
        record.studentName,
        record.sectionName,
        record.status,
        record.date,
        record.timestamp.toDate().toLocaleTimeString(),
        record.confirmed ? 'Yes' : 'No'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_records_${new Date().toLocaleDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Get unique dates from attendance records
  const uniqueDates = useMemo(() => {
    const dates = attendanceRecords.map(record => record.date);
    return [...new Set(dates)].sort().reverse();
  }, [attendanceRecords]);

  // Update room when section changes
  useEffect(() => {
    if (selectedSection !== 'all') {
      const section = sections.find(s => s.id === selectedSection);
      setSelectedRoom(section?.room || '');
    } else {
      setSelectedRoom('');
    }
  }, [selectedSection, sections]);

  const handleAttendanceChange = async (studentId: string, status: 'present' | 'late' | 'absent') => {
    if (!selectedSection || selectedSection === 'all') {
      toast.error('Please select a section first');
      return;
    }

    try {
      const section = sections.find(s => s.id === selectedSection);
      if (!section) {
        toast.error('Section not found');
        return;
      }

      const student = students.find(s => s.id === studentId);
      if (!student) {
        toast.error('Student not found');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Create new attendance record
      const newRecord = {
        studentId,
        studentName: student.fullName,
        studentEmail: student.email,
        sectionId: selectedSection,
        sectionName: section.name,
        status,
        confirmed: false, // Will be updated by sensors
        timestamp: Timestamp.now(),
        date: today,
        subject: section.name // You might want to get this from somewhere else
      };

      const attendanceRef = collection(db, 'attendanceRecords');
      await addDoc(attendanceRef, newRecord);

      // Update local state
      setAttendanceRecords(prev => [
        { id: Date.now().toString(), ...newRecord },
        ...prev.filter(r => 
          !(r.studentId === studentId && r.date === today)
        )
      ]);

      toast.success(`Marked ${student.fullName} as ${status}`);
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    }
  };

  if (loading && sections.length === 0) {
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
          department: currentUser?.department || 'Department'
        }}
        classStatus={{
          status: 'Attendance Management',
          color: 'bg-indigo-100 text-indigo-800',
          details: 'View and manage attendance records',
          fullName: currentUser?.fullName || 'Instructor'
        }}
      />

      <main className="container mx-auto px-6 py-8 mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Records</p>
                  <p className="text-2xl font-semibold">{stats.totalRecords}</p>
                </div>
                <ChartBarIcon className="w-8 h-8 text-indigo-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Present</p>
                  <p className="text-2xl font-semibold text-green-600">{stats.present}</p>
                </div>
                <CheckCircleIcon className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Late</p>
                  <p className="text-2xl font-semibold text-yellow-600">{stats.late}</p>
                </div>
                <ClockIcon className="w-8 h-8 text-yellow-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Absent</p>
                  <p className="text-2xl font-semibold text-red-600">{stats.absent}</p>
                </div>
                <XCircleIcon className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>

          {/* Seat Plan Layout */}
          {selectedSection !== 'all' && selectedRoom && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Real-time Seat Plan</h2>
              <SeatPlanLayout roomId={selectedRoom} sectionId={selectedSection} />
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              </div>
            </div>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Sections</option>
              {sections.map(section => (
                <option key={section.id} value={section.id}>
                  {section.name} {section.room ? `(Room ${section.room})` : ''}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Dates</option>
              {uniqueDates.map(date => (
                <option key={date} value={date}>{new Date(date).toLocaleDateString()}</option>
              ))}
            </select>
            <button
              onClick={exportAttendance}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-100"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Export
            </button>
          </div>

          {/* Students List Section */}
          <div className="mt-8 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Students Attendance</h2>
              <div className="flex gap-2">
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Sections</option>
                  {sections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDateFilter(today);
                  }}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                >
                  Today's Attendance
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students
                .filter(student => selectedSection === 'all' || student.sections?.includes(selectedSection))
                .map(student => {
                  // Find today's attendance record for this student
                  const todayRecord = attendanceRecords.find(
                    record => 
                      record.studentId === student.id && 
                      record.date === new Date().toISOString().split('T')[0]
                  );

                  return (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-lg border p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{student.fullName}</h3>
                          <p className="text-sm text-gray-500">{student.idNumber}</p>
                          <p className="text-sm text-gray-500">{student.major} - {student.yearLevel}</p>
                          
                          {/* Attendance Status */}
                          <div className="mt-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              todayRecord?.status === 'present' ? 'bg-green-100 text-green-800' :
                              todayRecord?.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                              todayRecord?.status === 'absent' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {todayRecord?.status ? 
                                todayRecord.status.charAt(0).toUpperCase() + todayRecord.status.slice(1) :
                                'Not Marked'
                              }
                            </span>
                          </div>

                          {/* Verification Status */}
                          {todayRecord && (
                            <div className="mt-1 flex items-center gap-2">
                              {todayRecord.confirmed ? (
                                <span className="text-xs text-green-600 flex items-center gap-1">
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Verified
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <XCircleIcon className="w-4 h-4" />
                                  Not Verified
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quick Attendance Buttons */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleAttendanceChange(student.id, 'present')}
                            className="p-1.5 rounded-full hover:bg-green-100 text-green-600"
                            title="Mark Present"
                          >
                            <CheckCircleIcon className="w-6 h-6" />
                          </button>
                          <button
                            onClick={() => handleAttendanceChange(student.id, 'late')}
                            className="p-1.5 rounded-full hover:bg-yellow-100 text-yellow-600"
                            title="Mark Late"
                          >
                            <ClockIcon className="w-6 h-6" />
                          </button>
                          <button
                            onClick={() => handleAttendanceChange(student.id, 'absent')}
                            className="p-1.5 rounded-full hover:bg-red-100 text-red-600"
                            title="Mark Absent"
                          >
                            <XCircleIcon className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </div>

          {/* Records Table */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Attendance Records</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ID Number</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Section</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Subject</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAndSortedRecords.map((record) => {
                    const student = studentMap[record.studentId];
                    return (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <div className="font-medium text-gray-900">{student?.fullName || record.studentName}</div>
                            <div className="text-xs text-gray-500">{student?.email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{student?.idNumber}</td>
                        <td className="px-4 py-3 text-sm">{record.sectionName}</td>
                        <td className="px-4 py-3 text-sm">{record.subject}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.status === 'present' ? 'bg-green-100 text-green-800' :
                            record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{new Date(record.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm">{record.timestamp.toDate().toLocaleTimeString()}</td>
                        <td className="px-4 py-3 text-sm">
                          {record.confirmed ? (
                            <CheckCircleIcon className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="w-5 h-5 text-red-500" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default AttendanceManagement; 