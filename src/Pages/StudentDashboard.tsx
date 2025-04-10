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
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
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
  roomName: string; // Changed from 'room' to 'roomName' to match Firestore
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
  enrolledSubjects?: EnrolledSubject[];
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

              // Fetch schedules for enrolled subjects from sections collection
              if (studentData.enrolledSubjects && studentData.enrolledSubjects.length > 0) {
                const updatedEnrolledSubjects = await Promise.all(
                  studentData.enrolledSubjects.map(async (subject) => {
                    const sectionDocRef = doc(db, 'sections', subject.sectionId);
                    const sectionDoc = await getDoc(sectionDocRef);
                    if (sectionDoc.exists()) {
                      const sectionData = sectionDoc.data() as Section;
                      return {
                        ...subject,
                        schedules: sectionData.schedules || [], // Ensure schedules include roomName
                      };
                    }
                    return subject; // Fallback to original subject if section not found
                  })
                );
                setStudentData({ ...studentData, enrolledSubjects: updatedEnrolledSubjects });
              } else {
                setStudentData(studentData);
              }
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

        // Fetch additional data (attendance, notifications, section, instructor, subjects)
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

          // Fetch notifications
          const notificationsQuery = query(
            collection(db, 'notifications'),
            where('studentId', '==', studentId),
            orderBy('date', 'desc'),
            limit(5)
          );
          const notificationsSnapshot = await getDocs(notificationsQuery);
          setNotifications(notificationsSnapshot.docs.map((d) => d.data() as Notification));

          // Fetch section data
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

        return () => unsubscribeStudent();
      } catch (error) {
        console.error('Error fetching initial student data:', error);
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

  const COLORS = ['#4F46E5', '#F59E0B', '#EF4444'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!studentData) {
    return <div className="p-8 text-center text-gray-500">No student data found.</div>;
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
        }))
      )
      .filter((schedule) => {
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDay = daysOfWeek[new Date().getDay()];
        return schedule.day === todayDay;
      }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <StudentNavbar student={studentData} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-8 mb-10 text-white"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <motion.div whileHover={{ scale: 1.1 }} className="bg-white/20 p-4 rounded-full">
                <UserCircleIcon className="h-12 w-12 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                  Welcome, {studentData.fullName}!
                </h1>
                <p className="text-sm md:text-base opacity-90">
                  {studentData.department} • Year {studentData.yearLevel}
                </p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center">
              <p className="text-sm opacity-80">Student ID</p>
              <p className="text-xl font-semibold">{studentData.idNumber || 'N/A'}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            {
              title: 'Attendance Rate',
              value: `${overallAttendance}%`,
              icon: <ChartBarIcon className="h-6 w-6" />,
              color: 'bg-emerald-500',
            },
            {
              title: 'Total Subjects',
              value: totalSubjects,
              icon: <BookOpenIcon className="h-6 w-6" />,
              color: 'bg-indigo-500',
            },
            {
              title: 'Classes Today',
              value: todaySchedule.length,
              icon: <CalendarIcon className="h-6 w-6" />,
              color: 'bg-purple-500',
            },
            {
              title: 'Pending Notifications',
              value: notifications.length,
              icon: <BellIcon className="h-6 w-6" />,
              color: 'bg-orange-500',
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className={`${stat.color} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow duration-300`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className="bg-white/20 p-3 rounded-lg">{stat.icon}</div>
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
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <UserCircleIcon className="h-7 w-7 text-indigo-600" />
                Your Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="text-lg font-medium text-gray-900">{studentData.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-lg font-medium text-gray-900">{studentData.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Student ID</p>
                    <p className="text-lg font-medium text-gray-900">{studentData.idNumber || 'N/A'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="text-lg font-medium text-gray-900">{studentData.department}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Year Level</p>
                    <p className="text-lg font-medium text-gray-900">{studentData.yearLevel}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Enrolled Subjects with Schedules */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <BookOpenIcon className="h-7 w-7 text-indigo-600" />
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
                      className="p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-indigo-100 p-3 rounded-xl">
                            <BookOpenIcon className="h-6 w-6 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{subject.name}</p>
                            <p className="text-sm text-gray-500">Department: {subject.department}</p>
                            <p className="text-sm text-gray-500">Section: {subject.sectionName}</p>
                            {subject.instructorName && (
                              <p className="text-sm text-gray-500">Instructor: {subject.instructorName}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700">Schedules:</p>
                        {subject.schedules && subject.schedules.length > 0 ? (
                          subject.schedules.map((schedule, idx) => (
                            <p key={idx} className="text-sm text-gray-600">
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
                <p className="text-gray-500 text-center">No subjects enrolled yet.</p>
              )}
            </motion.div>

            {/* Manage Enrollment */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Manage Enrollment</h2>
              <p className="text-gray-600 mb-4">Choose the subjects you want to enroll in.</p>
              <Link
                to="/student/subject-selection"
                className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                Select Subjects
              </Link>
            </motion.div>
          </div>

          {/* Right Column: Attendance, Instructor, and Today's Schedule */}
          <div className="space-y-8">
            {/* Attendance Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <ChartBarIcon className="h-7 w-7 text-indigo-600" />
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
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                {getAttendanceStats().map((stat, index) => (
                  <div key={stat.name} className="text-center">
                    <p className="text-sm text-gray-500">{stat.name}</p>
                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Today's Schedule */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <CalendarIcon className="h-7 w-7 text-indigo-600" />
                Today's Schedule
              </h2>
              {todaySchedule.length > 0 ? (
                <div className="space-y-4">
                  {todaySchedule.map((schedule, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 rounded-xl bg-indigo-50 border-indigo-200 border hover:bg-indigo-100 transition-colors duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-indigo-100 p-3 rounded-xl">
                            <ClockIcon className="h-6 w-6 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{schedule.subject || 'N/A'}</p>
                            <p className="text-sm text-gray-500">
                              {schedule.startTime} - {schedule.endTime} • Room: {schedule.roomName}
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-sm font-medium">
                          Today
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center">No classes scheduled for today.</p>
              )}
            </motion.div>

            {/* Instructor Information */}
            {instructor && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <UserIcon className="h-7 w-7 text-indigo-600" />
                  Your Instructor
                </h2>
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-indigo-100 p-3 rounded-xl">
                    <UserIcon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">{instructor.fullName}</p>
                    <p className="text-sm text-gray-500">{instructor.email}</p>
                    <p className="text-sm text-gray-500">{instructor.department}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Assigned Subjects</p>
                  {instructor.subjects &&
                  instructor.subjects.filter((subject) => enrolledSubjects.some((s) => s.name === subject))
                    .length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {instructor.subjects
                        .filter((subject) => enrolledSubjects.some((s) => s.name === subject))
                        .map((subject, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                          >
                            {subject}
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

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 mt-8 hover:shadow-xl transition-shadow duration-300"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BellIcon className="h-7 w-7 text-indigo-600" />
            Recent Notifications
          </h2>
          {notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors duration-200"
                >
                  <p className="font-medium text-gray-900">{notification.title}</p>
                  <p className="text-sm text-gray-500">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(parseISO(notification.date), 'MMM d, yyyy')}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center">No notifications available.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default StudentDashboard;