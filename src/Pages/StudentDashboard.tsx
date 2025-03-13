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
    BellIcon,
    UserIcon,
  } from '@heroicons/react/24/solid';
  import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
  import { format, parseISO, isToday } from 'date-fns';
  import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
  import { db } from '../firebase';

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

  interface AttendanceRecord {
    id: string;
    studentId: string;
    sectionId: string;
    date: string;
    status: string;
  }

  interface Notification {
    id: string;
    title: string;
    message: string;
    date: string;
  }

  interface Schedule {
    day: string;
    startTime: string;
    endTime: string;
    room?: string;
    subject?: string;
  }

  interface Subject {
    id: string;
    name: string;
    department: string;
    status: 'active' | 'inactive';
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
    subjects?: string[];
    schedules?: Schedule[];
  }

  interface EnhancedStudent extends Student {
    section: string;
    enrolledSubjects?: string[];
  }

  const StudentDashboard = () => {
    const [studentData, setStudentData] = useState<EnhancedStudent | null>(null);
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [section, setSection] = useState<Section | null>(null);
    const [instructor, setInstructor] = useState<Instructor | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);

    useEffect(() => {
      const storedData = localStorage.getItem('userData');
      if (storedData) {
        setStudentData(JSON.parse(storedData));
      }

      if (!currentUser || localStorage.getItem('userRole') !== 'student') {
        navigate('/login');
      }

      const fetchStudentData = async () => {
        if (!currentUser) return;
        try {
          setIsLoading(true);
          const studentQuery = query(
            collection(db, 'students'),
            where('uid', '==', currentUser.uid)
          );
          const studentSnapshot = await getDocs(studentQuery);

          if (!studentSnapshot.empty) {
            const studentDoc = studentSnapshot.docs[0];
            const studentData = { id: studentDoc.id, ...studentDoc.data() } as EnhancedStudent;
            setStudentData(studentData);

            const attendanceQuery = query(
              collection(db, 'attendance'),
              where('studentId', '==', studentData.id)
            );
            const attendanceSnapshot = await getDocs(attendanceQuery);
            setAttendance(attendanceSnapshot.docs.map((d) => d.data() as AttendanceRecord));

            const notificationsQuery = query(
              collection(db, 'notifications'),
              where('studentId', '==', studentData.id),
              orderBy('date', 'desc'),
              limit(5)
            );
            const notificationsSnapshot = await getDocs(notificationsQuery);
            setNotifications(notificationsSnapshot.docs.map((d) => d.data() as Notification));

            if (studentData.section) {
              const sectionQuery = query(
                collection(db, 'sections'),
                where('code', '==', studentData.section)
              );
              const sectionSnapshot = await getDocs(sectionQuery);

              if (!sectionSnapshot.empty) {
                const sectionData = {
                  id: sectionSnapshot.docs[0].id,
                  ...sectionSnapshot.docs[0].data(),
                  schedules: sectionSnapshot.docs[0].data().schedules || [],
                } as Section;
                setSection(sectionData);

                if (sectionData.instructorId) {
                  const instructorDoc = await getDoc(doc(db, 'teachers', sectionData.instructorId));
                  if (instructorDoc.exists()) {
                    const instructorData = {
                      id: instructorDoc.id,
                      ...instructorDoc.data(),
                    } as Instructor;
                    setInstructor(instructorData);

                    const subjectsRef = collection(db, 'subjects');
                    const subjectsSnapshot = await getDocs(subjectsRef);
                    const allSubjects = subjectsSnapshot.docs.map((doc) => ({
                      id: doc.id,
                      ...doc.data(),
                    } as Subject));

                    const instructorSubjects = allSubjects.filter((subject) =>
                      instructorData.subjects?.includes(subject.name)
                    );
                    setSubjects(instructorSubjects);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching student data:', error);
        } finally {
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

    const COLORS = ['#00b4d8', '#22d3ee', '#ff6b6b'];

    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"
          />
        </div>
      );
    }

    if (!studentData) {
      return (
        <div className="p-8 text-center text-cyan-300 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 min-h-screen">
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
      instructor?.schedules?.filter(
        (s) => enrolledSubjects.includes(s.subject || '') && isToday(new Date(s.day))
      ) || [];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono relative overflow-hidden">
        <ParticleBackground />
        <StudentNavbar student={studentData} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12">
          {/* Welcome Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-8 mb-10 border border-cyan-800 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
            <motion.div
              className="absolute -inset-2 bg-cyan-500/20 blur-xl"
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <motion.div whileHover={{ scale: 1.1 }} className="bg-gray-700 p-4 rounded-full border border-cyan-800">
                  <UserCircleIcon className="h-12 w-12 text-cyan-400" />
                </motion.div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-cyan-100 mb-2">
                    Welcome, {studentData.fullName}!
                  </h1>
                  <p className="text-sm md:text-base text-cyan-300">
                    {studentData.department} • Year {studentData.yearLevel} • {studentData.section}
                  </p>
                </div>
              </div>
              <div className="bg-gray-700 rounded-xl p-4 text-center border border-cyan-800">
                <p className="text-sm text-cyan-300">Student ID</p>
                <p className="text-xl font-semibold text-cyan-100">{studentData.idNumber || 'N/A'}</p>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              {
                title: 'Attendance Rate',
                value: `${overallAttendance}%`,
                icon: <ChartBarIcon className="h-6 w-6 text-cyan-400" />,
                color: 'bg-gray-700',
              },
              {
                title: 'Total Subjects',
                value: totalSubjects,
                icon: <BookOpenIcon className="h-6 w-6 text-cyan-400" />,
                color: 'bg-gray-700',
              },
              {
                title: 'Classes Today',
                value: todaySchedule.length,
                icon: <CalendarIcon className="h-6 w-6 text-cyan-400" />,
                color: 'bg-gray-700',
              },
              {
                title: 'Pending Notifications',
                value: notifications.length,
                icon: <BellIcon className="h-6 w-6 text-cyan-400" />,
                color: 'bg-gray-700',
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className={`${stat.color} rounded-xl p-6 shadow-lg border border-cyan-800 hover:shadow-2xl transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-cyan-300">{stat.title}</p>
                    <p className="text-2xl font-bold text-cyan-100">{stat.value}</p>
                  </div>
                  <div className="bg-gray-600 p-3 rounded-lg">{stat.icon}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Profile, Schedule, Enrolled Subjects, and Enrollment */}
            <div className="space-y-8 lg:col-span-2">
              {/* Student Profile */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
                <motion.div
                  className="absolute -inset-2 bg-cyan-500/20 blur-xl"
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold text-cyan-100 mb-6 flex items-center gap-2">
                    <UserCircleIcon className="h-7 w-7 text-cyan-400" />
                    Your Profile
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-cyan-300">Full Name</p>
                        <p className="text-lg font-medium text-cyan-100">{studentData.fullName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-cyan-300">Email</p>
                        <p className="text-lg font-medium text-cyan-100">{studentData.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-cyan-300">Student ID</p>
                        <p className="text-lg font-medium text-cyan-100">{studentData.idNumber || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-cyan-300">Department</p>
                        <p className="text-lg font-medium text-cyan-100">{studentData.department}</p>
                      </div>
                      <div>
                        <p className="text-sm text-cyan-300">Year Level</p>
                        <p className="text-lg font-medium text-cyan-100">{studentData.yearLevel}</p>
                      </div>
                      <div>
                        <p className="text-sm text-cyan-300">Section</p>
                        <p className="text-lg font-medium text-cyan-100">{studentData.section}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Enrolled Subjects */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
                <motion.div
                  className="absolute -inset-2 bg-cyan-500/20 blur-xl"
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold text-cyan-100 mb-6 flex items-center gap-2">
                    <BookOpenIcon className="h-7 w-7 text-cyan-400" />
                    Enrolled Subjects
                  </h2>
                  {enrolledSubjects.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {enrolledSubjects.map((subject, index) => (
                        <motion.span
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="px-3 py-1 bg-cyan-700 text-cyan-100 rounded-full text-sm"
                        >
                          {subject}
                        </motion.span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-cyan-300 text-center">No subjects enrolled yet.</p>
                  )}
                </div>
              </motion.div>

              {/* Current Schedule */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
                <motion.div
                  className="absolute -inset-2 bg-cyan-500/20 blur-xl"
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold text-cyan-100 mb-6 flex items-center gap-2">
                    <CalendarIcon className="h-7 w-7 text-cyan-400" />
                    Your Schedule
                  </h2>
                  {enrolledSubjects.length > 0 && instructor?.schedules && instructor.schedules.length > 0 ? (
                    <div className="space-y-4">
                      {instructor.schedules
                        .filter((s) => enrolledSubjects.includes(s.subject || ''))
                        .map((schedule, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`p-4 rounded-xl border border-cyan-800 ${
                              isToday(new Date(schedule.day))
                                ? 'bg-gray-700 border-l-4 border-l-cyan-500'
                                : 'bg-gray-800'
                            } hover:bg-gray-700 transition-colors`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="bg-gray-600 p-3 rounded-xl">
                                  <ClockIcon className="h-6 w-6 text-cyan-400" />
                                </div>
                                <div>
                                  <p className="font-medium text-cyan-100">
                                    {schedule.day} • {schedule.subject || 'N/A'}
                                  </p>
                                  <p className="text-sm text-cyan-300">
                                    {schedule.startTime} - {schedule.endTime} • Room: {schedule.room || 'TBD'}
                                  </p>
                                </div>
                              </div>
                              {isToday(new Date(schedule.day)) && (
                                <span className="px-3 py-1 bg-cyan-700 text-cyan-100 rounded-full text-sm font-medium">
                                  Today
                                </span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-cyan-300 text-center">
                      {enrolledSubjects.length === 0
                        ? 'Please select subjects to view your schedule.'
                        : 'No schedule available.'}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Manage Enrollment */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
                <motion.div
                  className="absolute -inset-2 bg-cyan-500/20 blur-xl"
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold text-cyan-100 mb-4">Manage Enrollment</h2>
                  <p className="text-cyan-300 mb-4">Choose the subjects you want to enroll in.</p>
                  <Link
                    to="/student/subject-selection"
                    className="inline-block px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                  >
                    Select Subjects
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* Right Column: Attendance and Instructor */}
            <div className="space-y-8">
              {/* Attendance Overview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
                <motion.div
                  className="absolute -inset-2 bg-cyan-500/20 blur-xl"
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold text-cyan-100 mb-6 flex items-center gap-2">
                    <ChartBarIcon className="h-7 w-7 text-cyan-400" />
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
                            backgroundColor: '#1e293b',
                            border: '1px solid #22d3ee',
                            borderRadius: '8px',
                            color: '#e0f7fa',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    {getAttendanceStats().map((stat, index) => (
                      <div key={stat.name} className="text-center">
                        <p className="text-sm text-cyan-300">{stat.name}</p>
                        <p className="text-lg font-bold text-cyan-100">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {instructor && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
                  <motion.div
                    className="absolute -inset-2 bg-cyan-500/20 blur-xl"
                    animate={{ opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-cyan-100 mb-6 flex items-center gap-2">
                      <UserIcon className="h-7 w-7 text-cyan-400" />
                      Your Instructor
                    </h2>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="bg-gray-600 p-3 rounded-xl">
                        <UserIcon className="h-6 w-6 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-cyan-100">{instructor.fullName}</p>
                        <p className="text-sm text-cyan-300">{instructor.email}</p>
                        <p className="text-sm text-cyan-300">{instructor.department}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-medium text-cyan-200 mb-2">Assigned Subjects</p>
                      {instructor.subjects && instructor.subjects.filter((subject) => enrolledSubjects.includes(subject)).length > 0 ? (
                        instructor.subjects
                          .filter((subject) => enrolledSubjects.includes(subject))
                          .map((subject, index) => (
                            <span
                              key={index}
                              className="inline-block px-3 py-1 bg-cyan-700 text-cyan-100 rounded-full text-sm mr-2 mb-2"
                            >
                              {subject}
                            </span>
                          ))
                      ) : (
                        <p className="text-sm text-cyan-300">No matching subjects assigned.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 mt-8 border border-cyan-800 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
            <motion.div
              className="absolute -inset-2 bg-cyan-500/20 blur-xl"
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-cyan-100 mb-6 flex items-center gap-2">
                <BellIcon className="h-7 w-7 text-cyan-400" />
                Recent Notifications
              </h2>
              {notifications.length > 0 ? (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 bg-gray-700 rounded-xl border border-cyan-800 hover:bg-gray-600 transition-colors"
                    >
                      <p className="font-medium text-cyan-100">{notification.title}</p>
                      <p className="text-sm text-cyan-300">{notification.message}</p>
                      <p className="text-xs text-cyan-400 mt-1">
                        {format(parseISO(notification.date), 'MMM d, yyyy')}
                      </p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-cyan-300 text-center">No notifications available.</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  export default StudentDashboard;