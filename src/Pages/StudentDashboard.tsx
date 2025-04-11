import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import StudentNavbar from '../components/StudentNavbar';
import { Student } from '../interfaces/Student';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  CalendarIcon,
  BookOpenIcon,
  ClockIcon,
  UserCircleIcon,
  UserIcon,
} from '@heroicons/react/24/solid';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, parseISO, isWithinInterval, parse } from 'date-fns';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

interface AttendanceRecord {
  id: string;
  studentId: string;
  sectionId: string;
  date: string;
  status: string;
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string;
}

interface EnrolledSubject {
  subjectId: string;
  name: string;
  department: string;
  sectionId: string;
  sectionName: string;
  schedules: Schedule[];
  instructorId?: string;
  instructorName?: string;
}

interface Section {
  id: string;
  name: string;
  code: string;
  instructorId: string;
  schedules: Schedule[];
}

interface Instructor {
  id: string;
  fullName: string;
  email: string;
  department: string;
}

interface EnhancedStudent extends Student {
  enrolledSubjects?: EnrolledSubject[];
}

const StudentDashboard = () => {
  const [studentData, setStudentData] = useState<EnhancedStudent | null>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [section, setSection] = useState<Section | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);

  useEffect(() => {
    if (!currentUser || localStorage.getItem('userRole') !== 'student') {
      navigate('/login');
      return;
    }

    const fetchStudentData = async () => {
      if (!currentUser) return;

      try {
        setIsLoading(true);

        // Real-time listener for student data
        const studentQuery = query(
          collection(db, 'students'),
          where('uid', '==', currentUser.uid)
        );
        const unsubscribeStudent = onSnapshot(
          studentQuery,
          async (studentSnapshot) => {
            if (!studentSnapshot.empty) {
              const studentDoc = studentSnapshot.docs[0];
              const studentData = { id: studentDoc.id, ...studentDoc.data() } as EnhancedStudent;
              setStudentData(studentData);
              localStorage.setItem('userData', JSON.stringify(studentData));
            } else {
              setStudentData(null);
            }
            setIsLoading(false);
          },
          (error) => {
            console.error('Error listening to student data:', error);
            setIsLoading(false);
          }
        );

        // Fetch additional data (attendance, section, instructor)
        const studentDocSnapshot = await getDocs(studentQuery);
        if (!studentDocSnapshot.empty) {
          const studentId = studentDocSnapshot.docs[0].id;

          // Fetch attendance
          const attendanceQuery = query(
            collection(db, 'attendance'),
            where('studentId', '==', studentId)
          );
          const attendanceSnapshot = await getDocs(attendanceQuery);
          setAttendance(attendanceSnapshot.docs.map((d) => d.data() as AttendanceRecord));

          // Fetch section and instructor data
          const studentData = studentDocSnapshot.docs[0].data() as EnhancedStudent;
          if (studentData.enrolledSubjects && studentData.enrolledSubjects.length > 0) {
            const sectionQuery = query(
              collection(db, 'sections'),
              where('id', '==', studentData.enrolledSubjects[0].sectionId)
            );
            const sectionSnapshot = await getDocs(sectionQuery);
            if (!sectionSnapshot.empty) {
              const sectionData = {
                id: sectionSnapshot.docs[0].id,
                ...sectionSnapshot.docs[0].data(),
                schedules: sectionSnapshot.docs[0].data().schedules || [],
              } as Section;
              setSection(sectionData);

              // Fetch instructor data
              if (sectionData.instructorId) {
                const instructorDoc = await getDoc(doc(db, 'teachers', sectionData.instructorId));
                if (instructorDoc.exists()) {
                  const instructorData = {
                    id: instructorDoc.id,
                    ...instructorDoc.data(),
                  } as Instructor;
                  setInstructor(instructorData);
                }
              }
            }
          }
        }

        return () => unsubscribeStudent();
      } catch (error) {
        console.error('Error fetching student data:', error);
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [currentUser, navigate]);

  const getFilteredAttendance = () => {
    if (!section) return [];
    const filtered = attendance.filter((a) => a.sectionId === section.id);
    const now = new Date();
    return filtered.filter((a) => format(parseISO(a.date), 'yyyy-MM') === format(now, 'yyyy-MM'));
  };

  const getAttendanceStats = () => {
    const filtered = getFilteredAttendance();
    const present = filtered.filter((a) => a.status === 'present').length;
    const late = filtered.filter((a) => a.status === 'late').length;
    const absent = filtered.filter((a) => a.status === 'absent').length;

    return [
      { name: 'Present', value: present },
      { name: 'Late', value: late },
      { name: 'Absent', value: absent },
    ];
  };

  const COLORS = ['#10B981', '#F59E0B', '#EF4444'];

  // Function to determine class status
  const getClassStatus = (schedule: Schedule, instructorName?: string) => {
    const now = new Date();
    const today = format(now, 'EEEE'); // Get current day (e.g., "Monday")
    if (schedule.day !== today) return null; // Only check today's classes

    const currentTime = now.getTime();
    const startTime = parse(schedule.startTime, 'HH:mm', now).getTime();
    const endTime = parse(schedule.endTime, 'HH:mm', now).getTime();

    if (isWithinInterval(currentTime, { start: startTime, end: endTime })) {
      return `Class in Session with ${instructorName || 'Instructor'}`;
    } else if (currentTime > endTime) {
      return 'Class Ended';
    }
    return null; // Class hasn't started yet
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-8 text-center text-gray-400 bg-gray-900 min-h-screen">
        No student data found.
      </div>
    );
  }

  const overallAttendance =
    attendance.length > 0
      ? ((attendance.filter((a) => a.status === 'present').length / attendance.length) * 100).toFixed(1)
      : '0';
  const enrolledSubjects = studentData.enrolledSubjects || [];
  const totalSubjects = enrolledSubjects.length;
  const todaySchedule =
    enrolledSubjects
      .flatMap((subject) =>
        (subject.schedules || []).map((schedule) => ({
          ...schedule,
          subject: subject.name,
          instructorName: subject.instructorName,
        }))
      )
      .filter((schedule) => {
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDay = daysOfWeek[new Date().getDay()];
        return schedule.day === todayDay;
      }) || [];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <StudentNavbar student={studentData} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl shadow-2xl p-8 mb-10 text-white overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-geometric.png')] opacity-10"></div>
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="bg-white/10 backdrop-blur-md p-4 rounded-full border border-white/20"
              >
                <UserCircleIcon className="h-12 w-12 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">
                  Welcome, {studentData.fullName}!
                </h1>
                <p className="text-base opacity-80 font-medium">
                  {studentData.department} • Year {studentData.yearLevel}
                </p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center border border-white/20">
              <p className="text-sm opacity-80">Student ID</p>
              <p className="text-xl font-semibold tracking-wide">{studentData.idNumber || 'N/A'}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {[
            {
              title: 'Attendance Rate',
              value: `${overallAttendance}%`,
              icon: <ChartBarIcon className="h-6 w-6" />,
              color: 'from-emerald-500 to-teal-500',
            },
            {
              title: 'Total Subjects',
              value: totalSubjects,
              icon: <BookOpenIcon className="h-6 w-6" />,
              color: 'from-blue-500 to-indigo-500',
            },
            {
              title: 'Classes Today',
              value: todaySchedule.length,
              icon: <CalendarIcon className="h-6 w-6" />,
              color: 'from-purple-500 to-pink-500',
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className={`bg-gradient-to-br ${stat.color} rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/10`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80 font-medium">{stat.title}</p>
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-lg backdrop-blur-md">{stat.icon}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Profile, Enrolled Subjects with Schedules, and Enrollment */}
          <div className="space-y-8 lg:col-span-2">
            {/* Student Profile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-3xl shadow-2xl p-6 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 border border-gray-700"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <UserCircleIcon className="h-7 w-7 text-blue-400" />
                Your Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400">Full Name</p>
                    <p className="text-lg font-medium text-white">{studentData.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="text-lg font-medium text-white">{studentData.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Student ID</p>
                    <p className="text-lg font-medium text-white">{studentData.idNumber || 'N/A'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400">Department</p>
                    <p className="text-lg font-medium text-white">{studentData.department}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Year Level</p>
                    <p className="text-lg font-medium text-white">{studentData.yearLevel}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Enrolled Subjects with Schedules */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-3xl shadow-2xl p-6 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 border border-gray-700"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <BookOpenIcon className="h-7 w-7 text-blue-400" />
                Enrolled Subjects & Schedules
              </h2>
              {enrolledSubjects.length > 0 ? (
                <div className="space-y-6">
                  {enrolledSubjects.map((subject, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-gray-700/50 rounded-xl hover:bg-blue-900/30 transition-all duration-200 backdrop-blur-sm border border-gray-600"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-400/30">
                            <BookOpenIcon className="h-6 w-6 text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white text-lg">{subject.name}</p>
                            <p className="text-sm text-gray-400">Department: {subject.department}</p>
                            <p className="text-sm text-gray-400">Section: {subject.sectionName}</p>
                            {subject.instructorName && (
                              <p className="text-sm text-gray-400">Instructor: {subject.instructorName}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-300">Schedules:</p>
                        {subject.schedules && subject.schedules.length > 0 ? (
                          subject.schedules.map((schedule, idx) => (
                            <p key={idx} className="text-sm text-gray-400">
                              {schedule.day}: {schedule.startTime} - {schedule.endTime} (Room: {schedule.roomName})
                            </p>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No schedules available.</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center text-lg">No subjects enrolled yet.</p>
              )}
            </motion.div>

            {/* Manage Enrollment */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-3xl shadow-2xl p-6 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 border border-gray-700"
            >
              <h2 className="text-2xl font-bold text-white mb-4">Manage Enrollment</h2>
              <p className="text-gray-300 mb-4">Choose the subjects you want to enroll in.</p>
              <Link
                to="/student/subject-selection"
                className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
              >
                Select Subjects
              </Link>
            </motion.div>
          </div>

          {/* Right Column: Attendance, Today's Schedule, and Instructor */}
          <div className="space-y-8">
            {/* Attendance Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-3xl shadow-2xl p-6 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 border border-gray-700"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <ChartBarIcon className="h-7 w-7 text-blue-400" />
                Attendance Overview
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getAttendanceStats()}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {getAttendanceStats().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                {getAttendanceStats().map((stat, index) => (
                  <div key={stat.name} className="text-center">
                    <p className="text-sm text-gray-400">{stat.name}</p>
                    <p className="text-lg font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Today's Schedule */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-3xl shadow-2xl p-6 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 border border-gray-700"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <CalendarIcon className="h-7 w-7 text-blue-400" />
                Today's Schedule
              </h2>
              {todaySchedule.length > 0 ? (
                <div className="space-y-4">
                  {todaySchedule.map((schedule, index) => {
                    const status = getClassStatus(schedule, schedule.instructorName);
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 rounded-xl bg-gray-700/50 border border-gray-600 hover:bg-blue-900/30 transition-all duration-200 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-400/30">
                              <ClockIcon className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium text-white text-lg">{schedule.subject || 'N/A'}</p>
                              <p className="text-sm text-gray-400">
                                {schedule.startTime} - {schedule.endTime} • Room: {schedule.roomName}
                              </p>
                              {status && (
                                <p
                                  className={`text-sm font-medium mt-1 ${
                                    status.includes('In Session') ? 'text-green-400' : 'text-red-400'
                                  }`}
                                >
                                  {status}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="px```jsx
px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-medium">
                            Today
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-center text-lg">No classes scheduled for today.</p>
              )}
            </motion.div>

            {/* Instructor Information */}
            {instructor && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-3xl shadow-2xl p-6 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 border border-gray-700"
              >
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <UserIcon className="h-7 w-7 text-blue-400" />
                  Your Instructor
                </h2>
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-400/30">
                    <UserIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-white">{instructor.fullName}</p>
                    <p className="text-sm text-gray-400">{instructor.email}</p>
                    <p className="text-sm text-gray-400">{instructor.department}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-300 mb-2">Assigned Subjects</p>
                  {enrolledSubjects.some((subject) => subject.instructorId === instructor.id) ? (
                    <div className="flex flex-wrap gap-2">
                      {enrolledSubjects
                        .filter((subject) => subject.instructorId === instructor.id)
                        .map((subject, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm border border-blue-400/30"
                          >
                            {subject.name}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No matching subjects assigned.</p>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;