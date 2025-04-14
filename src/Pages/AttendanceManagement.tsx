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
  email: string;
  idNumber: string;
  major: string;
  sections?: string[];
  attendance?: Record<string, AttendanceRecordRTDB>;
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
  Action: string;
  Sensor: string;
  Status: 'Present' | 'Absent' | 'Late';
  'Time In': string;
  'Time Out': string;
  assignedSensorId: number;
  date: string;
  department: string;
  email: string;
  fullName: string;
  idNumber: string;
  mobileNumber: string;
  role: string;
  schedules: ScheduleRTDB[];
  sessionId: string;
  timestamp: string;
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
        // Fetch student profiles from Firestore
        const studentsRef = collection(db, 'students');
        const studentsSnapshot = await getDocs(studentsRef);
        const fetchedStudents: Student[] = studentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          fullName: doc.data().fullName || '',
          email: doc.data().email || '',
          idNumber: doc.data().idNumber || '',
          major: doc.data().major || '',
          sections: doc.data().sections || [],
        }));

        // Fetch attendance data from RTDB
        const studentsWithAttendance: Student[] = [];
        for (const student of fetchedStudents) {
          const studentRef = ref(rtdb, `Students/${student.id}/Attendance`);
          await new Promise<void>((resolve) => {
            onValue(
              studentRef,
              (snapshot) => {
                const data = snapshot.val();
                studentsWithAttendance.push({
                  ...student,
                  attendance: data || {},
                });
                resolve();
              },
              (error) => {
                console.error(`Error fetching attendance for student ${student.id}:`, error);
                studentsWithAttendance.push({
                  ...student,
                  attendance: {},
                });
                resolve();
              },
              { onlyOnce: true }
            );
          });
        }

        setStudents(studentsWithAttendance);
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
    if (!record.date) return false;

    const recordDate = new Date(record.date.replace(/_/g, '-'));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const recordDay = dayNames[recordDate.getDay()];

    const schedule = schedules.find(
      (sched) =>
        sched.sectionId === record.schedules?.[0]?.sectionId &&
        sched.day === recordDay &&
        sched.subjectCode === record.schedules?.[0]?.subjectCode
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

  // Calculate attendance summaries from RTDB
  const getAttendanceSummary = (student: Student): AttendanceSummary => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const selectedSectionObj = sections.find((s) => s.id === selectedSection);
    const selectedSubject = subjects.find((s) => s.id === selectedSectionObj?.subjectId);
    if (!selectedSectionObj || !selectedSubject) {
      return {
        weekly: { present: 0, late: 0, absent: 0 },
        monthly: { present: 0, late: 0, absent: 0 },
      };
    }

    const studentRecords = Object.values(student.attendance || {})
      .filter((record) => {
        // Check if the record matches the instructor's section and subject
        const matchesSection = record.schedules?.some(
          (sched) => sched.sectionId === selectedSectionObj.id
        );
        const matchesSubject = record.schedules?.some(
          (sched) => sched.subjectCode === selectedSubject.code
        );

        // Check if the student is enrolled in the section
        const isEnrolledInSection =
          student.sections?.includes(selectedSectionObj.id) ||
          selectedSectionObj.students.includes(student.fullName);

        return matchesSection && matchesSubject && isEnrolledInSection && hasClassEnded(record);
      });

    const weeklyRecords = studentRecords.filter((record) => {
      const recordDate = parseRTDBTimestamp(record.timestamp);
      return recordDate >= weekStart;
    });

    const monthlyRecords = studentRecords.filter((record) => {
      const recordDate = parseRTDBTimestamp(record.timestamp);
      return recordDate >= monthStart;
    });

    return {
      weekly: {
        present: weeklyRecords.filter((r) => r.Status.toLowerCase() === 'present').length,
        late: weeklyRecords.filter((r) => r.Status.toLowerCase() === 'late').length,
        absent: weeklyRecords.filter((r) => r.Status.toLowerCase() === 'absent').length,
      },
      monthly: {
        present: monthlyRecords.filter((r) => r.Status.toLowerCase() === 'present').length,
        late: monthlyRecords.filter((r) => r.Status.toLowerCase() === 'late').length,
        absent: monthlyRecords.filter((r) => r.Status.toLowerCase() === 'absent').length,
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
                  <p className="text-center py-8 text-gray-500">No students found</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStudents.map((student) => {
                      const summary = getAttendanceSummary(student);
                      const latestRecord = attendanceRecords
                        .filter((r) => r.studentName === student.fullName)
                        .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)[0];
                      const section = sections.find((s) => s.id === selectedSection);
                      const subject = subjects.find((s) => s.id === section?.subjectId);

                      // Hide if no valid records
                      if (
                        summary.weekly.present + summary.weekly.late + summary.weekly.absent === 0 &&
                        summary.monthly.present + summary.monthly.late + summary.monthly.absent === 0
                      ) {
                        return null;
                      }

                      return (
                        <motion.div
                          key={student.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border rounded-lg p-4 hover:shadow-md"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-medium text-gray-900">{student.fullName}</h3>
                                <p className="text-sm text-gray-500">{student.idNumber}</p>
                              </div>
                              {latestRecord && (
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                              <p>Weekly: P:{summary.weekly.present} L:{summary.weekly.late} A:{summary.weekly.absent}</p>
                              <p>Monthly: P:{summary.monthly.present} L:{summary.monthly.late} A:{summary.monthly.absent}</p>
                            </div>
                            {latestRecord && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleEditAttendance(latestRecord.id, latestRecord.status)}
                                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteAttendance(latestRecord.id)}
                                  className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    }).filter((card): card is JSX.Element => card !== null)}
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
