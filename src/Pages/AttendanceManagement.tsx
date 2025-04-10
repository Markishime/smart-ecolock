import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import NavBar from '../components/NavBar';
import {
  CalendarIcon,
  FunnelIcon,
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
  email: string;
  idNumber: string;
  major: string;
  sections?: string[];
}

interface Section {
  id: string;
  name: string;
  students: string[]; // Array of student fullNames
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
  subjectId: string; // Updated to subjectId for consistency
  room: string;
  status: 'present' | 'absent' | 'late';
  confirmed: boolean;
  rfidAuthenticated: boolean;
  weightAuthenticated: boolean;
  timestamp: any; // Changed from Timestamp to any to avoid type issues
  date: string;
  submittedBy: { id: string };
}

interface AttendanceSummary {
  weekly: { present: number; late: number; absent: number };
  monthly: { present: number; late: number; absent: number };
}

interface AttendanceStats {
  totalStudents: number;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
}

const AttendanceManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
        const fetchedSections = sectionsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Section));
        setSections(fetchedSections);
        if (fetchedSections.length > 0) {
          setSelectedSection(fetchedSections[0].id);
        }
      } catch (error) {
        console.error('Error fetching sections:', error);
        toast.error('Failed to load sections');
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
          ...doc.data(),
        } as Subject));
        setSubjects(fetchedSubjects);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        toast.error('Failed to load subjects');
      }
    };

    fetchSubjects();
  }, []);

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRef = collection(db, 'students');
        const studentsSnapshot = await getDocs(studentsRef);
        const fetchedStudents = studentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Student));
        setStudents(fetchedStudents);
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
      }
    };

    fetchStudents();
  }, []);

  // Fetch attendance records with real-time updates
  useEffect(() => {
    if (!selectedSection) return;

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
          ...doc.data(),
        } as AttendanceRecord));
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

  // Calculate attendance summaries
  const getAttendanceSummary = (studentName: string): AttendanceSummary => {
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay())); // Start of current week (Sunday)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month

    const studentRecords = attendanceRecords.filter((record) => record.studentName === studentName);
    const weeklyRecords = studentRecords.filter((record) => new Date(record.date) >= weekStart);
    const monthlyRecords = studentRecords.filter((record) => new Date(record.date) >= monthStart);

    return {
      weekly: {
        present: weeklyRecords.filter((r) => r.status === 'present').length,
        late: weeklyRecords.filter((r) => r.status === 'late').length,
        absent: weeklyRecords.filter((r) => r.status === 'absent').length,
      },
      monthly: {
        present: monthlyRecords.filter((r) => r.status === 'present').length,
        late: monthlyRecords.filter((r) => r.status === 'late').length,
        absent: monthlyRecords.filter((r) => r.status === 'absent').length,
      },
    };
  };

  // Handle editing an attendance record
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
      cancelButtonText: 'Cancel',
      inputValidator: (value) => {
        if (!value) {
          return 'You need to select a status!';
        }
        return null;
      },
    });

    if (newStatus && newStatus !== currentStatus) {
      try {
        const recordRef = doc(db, 'attendanceRecords', recordId);
        await updateDoc(recordRef, { status: newStatus });
        toast.success('Attendance status updated');
      } catch (error) {
        console.error('Error updating attendance record:', error);
        toast.error('Failed to update attendance status');
      }
    }
  };

  // Handle deleting an attendance record
  const handleDeleteAttendance = async (recordId: string) => {
    const result = await Swal.fire({
      title: 'Delete Attendance Record',
      text: 'Are you sure you want to delete this record? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete',
    });

    if (result.isConfirmed) {
      try {
        const recordRef = doc(db, 'attendanceRecords', recordId);
        await deleteDoc(recordRef);
        toast.success('Attendance record deleted');
      } catch (error) {
        console.error('Error deleting attendance record:', error);
        toast.error('Failed to delete attendance record');
      }
    }
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    const section = sections.find((s) => s.id === selectedSection);
    if (!section) return [];

    let filtered = students.filter((student) => section.students.includes(student.fullName));

    if (searchQuery) {
      filtered = filtered.filter((student) =>
        student.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [students, sections, selectedSection, searchQuery]);

  // Calculate overall stats
  const stats: AttendanceStats = useMemo(() => {
    const section = sections.find((s) => s.id === selectedSection);
    const totalStudents = section ? section.students.length : 0;
    const present = attendanceRecords.filter((r) => r.status === 'present').length;
    const late = attendanceRecords.filter((r) => r.status === 'late').length;
    const absent = attendanceRecords.filter((r) => r.status === 'absent').length;
    const attendanceRate = totalStudents ? ((present + late) / (present + late + absent)) * 100 : 0;

    return {
      totalStudents,
      present,
      late,
      absent,
      attendanceRate,
    };
  }, [attendanceRecords, sections, selectedSection]);

  // Export to CSV
  const exportAttendance = () => {
    const section = sections.find((s) => s.id === selectedSection);
    const subject = subjects.find((s) => s.id === section?.subjectId);
    const csvContent = [
      ['Student Name', 'ID Number', 'Section', 'Subject', 'Weekly Present', 'Weekly Late', 'Weekly Absent', 'Monthly Present', 'Monthly Late', 'Monthly Absent'],
      ...filteredStudents.map((student) => {
        const summary = getAttendanceSummary(student.fullName);
        return [
          student.fullName,
          student.idNumber,
          section?.name || '',
          subject?.name || '',
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
    a.download = `attendance_summary_${selectedSection}_${new Date().toLocaleDateString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && !selectedSection) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-gray-100">
      <NavBar
        user={{
          role: currentUser?.role || 'instructor',
          fullName: currentUser?.fullName || 'Instructor',
          department: currentUser?.department || 'Department',
        }}
        classStatus={{
          status: 'Attendance Overview',
          color: 'bg-indigo-600 text-white',
          details: 'Monitor and review attendance records',
          fullName: currentUser?.fullName || 'Instructor',
        }}
      />

      <main className="container mx-auto px-6 py-8 mt-20">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
                <p className="text-gray-600">Track and manage student attendance summaries</p>
              </div>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
              >
                {sections.map((section) => {
                  const subject = subjects.find((s) => s.id === section.subjectId);
                  return (
                    <option key={section.id} value={section.id}>
                      {section.name} {subject ? `(${subject.name})` : ''}{' '}
                      {section.room ? `(Room ${section.room})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Students', value: stats.totalStudents, icon: ChartBarIcon, color: 'text-indigo-600' },
              { label: 'Present', value: stats.present, icon: CheckCircleIcon, color: 'text-green-600' },
              { label: 'Late', value: stats.late, icon: ClockIcon, color: 'text-yellow-600' },
              { label: 'Absent', value: stats.absent, icon: XCircleIcon, color: 'text-red-600' },
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

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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

          {/* Student Attendance Summaries */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Student Attendance Summaries</h2>
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No students enrolled in this section
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStudents.map((student) => {
                    const summary = getAttendanceSummary(student.fullName);
                    const latestRecord = attendanceRecords
                      .filter((r) => r.studentName === student.fullName)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const section = sections.find((s) => s.id === selectedSection);
                    const subject = subjects.find((s) => s.id === section?.subjectId);

                    return (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border rounded-lg p-4 hover:shadow-md transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-gray-900">{student.fullName}</h3>
                              <p className="text-sm text-gray-500">{student.idNumber}</p>
                            </div>
                            {latestRecord && (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  latestRecord.status === 'present'
                                    ? 'bg-green-100 text-green-800'
                                    : latestRecord.status === 'late'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {latestRecord.status.charAt(0).toUpperCase() + latestRecord.status.slice(1)}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            <p>Subject: {subject?.name || 'N/A'}</p>
                            <p>Room: {section?.room || 'N/A'}</p>
                            <p>
                              Weekly: P:{summary.weekly.present} | L:{summary.weekly.late} | A:{summary.weekly.absent}
                            </p>
                            <p>
                              Monthly: P:{summary.monthly.present} | L:{summary.monthly.late} | A:{summary.monthly.absent}
                            </p>
                          </div>
                          {latestRecord && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleEditAttendance(latestRecord.id, latestRecord.status)}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                <PencilIcon className="w-4 h-4" />
                                Edit Latest
                              </button>
                              <button
                                onClick={() => handleDeleteAttendance(latestRecord.id)}
                                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                              >
                                <TrashIcon className="w-4 h-4" />
                                Delete Latest
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Seat Plan */}
          {selectedSection && sections.find((s) => s.id === selectedSection)?.room && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Classroom Layout</h2>
              <SeatPlanLayout
                roomId={sections.find((s) => s.id === selectedSection)!.room!}
                sectionId={selectedSection}
              />
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default AttendanceManagement;