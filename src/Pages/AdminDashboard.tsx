import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, 
  query, 
  getDocs, 
  where, 
  onSnapshot, 
  limit, 
  doc,
  getDoc,
  updateDoc,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Swal from 'sweetalert2';
import {
  AcademicCapIcon,
  ChartBarIcon,
  UserGroupIcon,
  BookOpenIcon,
  ClockIcon,
  SparklesIcon,
  TrophyIcon,
  LightBulbIcon,
  InformationCircleIcon,
  UserPlusIcon,
  HomeIcon,
  ViewColumnsIcon,
  CalendarIcon
} from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';

interface Instructor {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  subjects: Subject[];
  schedules: Schedule[];
  uid: string;
  fullName: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  department: string;
  credits: number;
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  section?: string;
  room?: string;
  teacherName: string;
  subject?: string | Subject;
}

interface RecentActivity {
  id: string;
  type: 'user_added' | 'class_created' | 'subject_updated' | 'teacher_assigned';
  title: string;
  description: string;
  timestamp: Date;
  icon?: React.ReactNode;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  subjects: Subject[];
  schedules: Schedule[];
  uid: string;
  fullName: string;
}

const AdminDashboard: React.FC = () => {
  const [teachers, setTeachers] = useState<Instructor[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Instructor | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [teacherSchedules, setTeacherSchedules] = useState<Schedule[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Dashboard stats and analytics
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    activeClasses: 0
  });

  // Recent activities
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [instructors, setInstructors] = useState<Teacher[]>([]);

  useEffect(() => {
    const fetchTeachersData = async () => {
      try {
        // Fetch subjects
        const subjectsCollection = collection(db, 'teachers');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Subject));

        // Fetch teachers with their subjects and schedules
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        
        const teachersWithDetails = await Promise.all(
          teachersSnapshot.docs.map(async (teacherDoc) => {
            const teacherData = teacherDoc.data();
            
            // Fetch subjects for this teacher
            const teacherSubjects = teacherData.subjects 
              ? await Promise.all(
                  teacherData.subjects.map(async (subjectId: string) => {
                    const subjectDoc = await getDoc(doc(db, 'teachers', subjectId));
                    return subjectDoc.exists() 
                      ? { id: subjectDoc.id, ...subjectDoc.data() } 
                      : null;
                  })
                )
              : [];

            // Fetch schedules for this teacher
            const teacherSchedules = teacherData.schedules 
              ? teacherData.schedules.map((schedule: Schedule) => ({
                  ...schedule,
                  subject: teacherData.subjects.find((s: Subject) => s.id === schedule.subject)?.name || schedule.subject
                }))
              : [];

            return {
              id: teacherDoc.id,
              ...teacherData,
              fullName: teacherData.fullName || teacherData.name || 'Unknown Teacher',
              name: teacherData.name || teacherData.fullName || 'Unknown Teacher',
              subjects: teacherSubjects.filter(Boolean),
              schedules: teacherSchedules
            } as Instructor;
          })
        );

        setTeachers(teachersWithDetails);
      } catch (error) {
        console.error('Error fetching teachers data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch teachers data'
        });
      }
    };

    fetchTeachersData();
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch total counts from respective collections
        const usersCollection = collection(db, 'users');
        const studentsCollection = collection(db, 'students');
        const teachersCollection = collection(db, 'teachers');
        const subjectsCollection = collection(db, 'subjects');
        const classesCollection = collection(db, 'classes');

        // Fetch total counts using aggregation queries
        const [
          usersSnapshot,
          studentsSnapshot, 
          teachersSnapshot, 
          subjectsSnapshot,
          activeClassesSnapshot
        ] = await Promise.all([
          getDocs(usersCollection),
          getDocs(studentsCollection),
          getDocs(teachersCollection),
          getDocs(subjectsCollection),
          query(classesCollection, where('status', '==', 'active'))
        ]);

        // Count active classes separately
        const activeClassesQuery = query(classesCollection, where('status', '==', 'active'));
        const activeClassesCountSnapshot = await getDocs(activeClassesQuery);

        // Update stats state
        setStats({
          totalUsers: usersSnapshot.size,
          totalStudents: studentsSnapshot.size,
          totalTeachers: teachersSnapshot.size,
          totalSubjects: subjectsSnapshot.size,
          activeClasses: activeClassesCountSnapshot.size
        });

        // Fetch recent activities
        const activitiesCollection = collection(db, 'recentactivities');
        const activitiesQuery = query(
          activitiesCollection, 
          orderBy('timestamp', 'desc'), 
          limit(10)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);
        
        const fetchedActivities: RecentActivity[] = activitiesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            title: data.title,
            description: data.description,
            timestamp: data.timestamp.toDate(),
            icon: undefined // Will be set dynamically
          };
        }).map(activity => ({
          ...activity,
          icon: getActivityIcon(activity.type)
        }));

        setRecentActivities(fetchedActivities);

        // Automatically select the first teacher if available
        if (teachers.length > 0) {
          await handleTeacherSelect(teachers[0]);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Fetch Error',
          text: 'Unable to load dashboard data. Please try again later.',
        });
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        
        const instructorsData = await Promise.all(
          teachersSnapshot.docs.map(async (doc) => {
            const teacherData = {
              id: doc.id,
              ...doc.data()
            } as Teacher;

            // Fetch user details from users collection
            const userQuery = query(
              collection(db, 'users'), 
              where('id', '==', doc.id)
            );
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
              const userData = userSnapshot.docs[0].data();
              return {
                ...teacherData,
                ...userData
              };
            }

            return teacherData;
          })
        );

        setInstructors(instructorsData.filter(instructor => 
          instructor.role === 'instructor'
        ));
      } catch (error) {
        console.error('Error fetching instructors:', error);
        Swal.fire({
          icon: 'error',
          title: 'Fetch Error',
          text: 'Failed to fetch instructor details'
        });
      }
    };

    fetchInstructors();
  }, []);

  useEffect(() => {
    const fetchTeacherDetails = async () => {
      try {
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);

        // Collect all unique subjects and schedules
        const allSubjects: string[] = [];
        const allSchedules: Schedule[] = [];
        const subjectDetailsMap: Map<string, Subject> = new Map();

        // First pass: Collect subjects
        for (const teacherDoc of teachersSnapshot.docs) {
          const teacherData = teacherDoc.data();
          
          // Collect subjects from teacher document
          if (teacherData.subjects && Array.isArray(teacherData.subjects)) {
            allSubjects.push(...teacherData.subjects);
          }
        }

        // Fetch subject details
        const subjectPromises = allSubjects.map(async (subjectId) => {
          try {
            const subjectDocRef = doc(db, 'teachers', subjectId);
            const subjectDoc = await getDoc(subjectDocRef);
            
            if (subjectDoc.exists()) {
              const { id: _, ...subjectData } = subjectDoc.data() as Subject;
              subjectDetailsMap.set(subjectId, {
                id: subjectDoc.id,
                ...subjectData
              });
            }
          } catch (error) {
            console.error(`Error fetching subject ${subjectId}:`, error);
          }
        });

        // Wait for all subject details to be fetched
        await Promise.all(subjectPromises);

        // Second pass: Collect schedules with subject details
        for (const teacherDoc of teachersSnapshot.docs) {
          const teacherData = teacherDoc.data();
          
          // Collect schedules
          if (teacherData.schedules && Array.isArray(teacherData.schedules)) {
            const teacherSchedules = teacherData.schedules.map(schedule => {
              // Try to get subject details
              const subjectDetails = schedule.subject 
                ? subjectDetailsMap.get(schedule.subject as string) 
                : undefined;

              return {
                day: schedule.day || 'N/A',
                startTime: schedule.startTime || 'N/A',
                endTime: schedule.endTime || 'N/A',
                section: schedule.section || 'N/A',
                room: schedule.room || '',
                teacherName: teacherData.name || 'Unknown Teacher',
                subject: subjectDetails || schedule.subject || 'N/A'
              };
            });

            allSchedules.push(...teacherSchedules);
          }
        }

        // Remove duplicates
        const uniqueSubjects = [...new Set(allSubjects)];
        const uniqueSchedules = allSchedules.reduce<Schedule[]>((acc, current) => {
          const x = acc.find(item => 
            item.day === current.day && 
            item.startTime === current.startTime && 
            item.endTime === current.endTime
          );
          if (!x) {
            return acc.concat([current]);
          }
          return acc;
        }, []);

        setTeacherSubjects(uniqueSubjects);
        setTeacherSchedules(uniqueSchedules);
      } catch (error) {
        console.error('Error fetching teacher details:', error);
        Swal.fire({
          icon: 'error',
          title: 'Fetch Error',
          text: 'Failed to fetch teacher subjects and schedules'
        });
      }
    };

    fetchTeacherDetails();
  }, []);

  // Teacher selection handler
 const handleTeacherSelect = async (teacher: Instructor) => {
    try {
      // Fetch full teacher details to ensure we have the most up-to-date information
      const teacherRef = doc(db, 'teachers', teacher.id);
      const teacherDoc = await getDoc(teacherRef);
      const teacherData = teacherDoc.data();

      if (!teacherData) {
        throw new Error('Teacher data not found');
      }

      // Fetch full subject details
      const subjectsPromise = teacherData.subjects?.length > 0
        ? Promise.all(
            teacherData.subjects.map(async (subjectId: string) => {
              try {
                const subjectDoc = await getDoc(doc(db, 'subjects', subjectId));
                return subjectDoc.exists() 
                  ? { id: subjectDoc.id, ...subjectDoc.data() } 
                  : null;
              } catch (subjectError) {
                console.error(`Error fetching subject ${subjectId}:`, subjectError);
                return null;
              }
            })
          ).then(subjects => subjects.filter((subject): subject is Subject => subject !== null))
        : Promise.resolve([]);

      // Fetch full schedule details
      const schedulesPromise = teacherData.schedules 
        ? teacherData.schedules.map((schedule: Schedule) => ({
            ...schedule,
            subject: teacherData.subjects?.find((s: Subject) => s.id === schedule.subject)?.name || schedule.subject
          }))
        : [];

      // Wait for both promises to resolve
      const [subjects, schedules] = await Promise.all([
        subjectsPromise, 
        schedulesPromise
      ]);

      // Create updated teacher object
      const updatedTeacher: Instructor = {
        id: teacher.id,
        fullName: teacherData.fullName || teacherData.name || 'Unknown Teacher',
        name: teacherData.name || teacherData.fullName || 'Unknown Teacher',
        email: teacherData.email,
        department: teacherData.department || 'Unassigned',
        role: 'instructor',
        subjects,
        schedules,
        uid: teacherData.uid
      };

      // Update state
      setSelectedTeacher(updatedTeacher);
      setTeacherSubjects(subjects.map(subject => subject.id));
      setTeacherSchedules(schedules);
    } catch (error) {
      console.error('Error fetching teacher details:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load teacher details',
      });
    }
  };

  // Render dashboard stats cards
  const renderStatCard = (title: string, value: number, icon: React.ReactNode, color: string) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`
        p-6 rounded-2xl shadow-lg 
        bg-white text-gray-800
        flex items-center space-x-4
        transform transition-all hover:scale-105
      `}
    >
      <div className={`p-4 rounded-full ${color} bg-opacity-20 text-opacity-80`}>
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </motion.div>
  );

  // Icons for different activity types
  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'user_added':
        return <UserPlusIcon className="w-5 h-5 text-blue-500" />;
      case 'class_created':
        return <AcademicCapIcon className="w-5 h-5 text-green-500" />;
      case 'subject_updated':
        return <BookOpenIcon className="w-5 h-5 text-purple-500" />;
      case 'teacher_assigned':
        return <UserGroupIcon className="w-5 h-5 text-indigo-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  // Render method for recent activities section
  const renderRecentActivities = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`
        bg-white 
        rounded-xl 
        shadow-md 
        p-6 
        mb-6
      `}
    >
      <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
      
      {recentActivities.length > 0 ? (
        <div className="space-y-4">
          <AnimatePresence>
            {recentActivities.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                whileHover={{ scale: 1.02 }}
                className={`
                  bg-gray-50 
                  p-4 
                  rounded-lg 
                  flex 
                  items-center 
                  justify-between
                  hover:bg-gray-100
                  transition
                `}
              >
                {/* Activity content */}
                <div className="flex items-center space-x-4">
                  {activity.icon}
                  <div>
                    <h3 className="font-medium">{activity.title}</h3>
                    <p className="text-sm text-gray-600">{activity.description}</p>
                  </div>
                </div>
                <div className="text-xs font-light text-gray-500">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          key="no-activities"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <p className="text-center text-gray-500">
            No recent activities
          </p>
        </motion.div>
      )}
    </motion.div>
  );

  return (
      <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100 transition-colors duration-300">

        {/* Sidebar */}
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
       
        <div className={`flex-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-20' : 'ml-64'} overflow-y-auto`}>
        
          {/* Scrollable Content */}
          <div className="overflow-y-auto max-h-screen p-8 space-y-8">
            {/* Dashboard Header */}
            <motion.div 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h1 className="text-4xl font-extrabold mb-4 
                bg-clip-text text-transparent 
                bg-gradient-to-r 
                from-blue-600 via-indigo-500 to-purple-600
              ">
                Admin Dashboard
              </h1>
              <p className="text-lg text-gray-600">
                Comprehensive overview of your institution's performance
              </p>
            </motion.div>

            {/* Quick Stats Grid */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-4 gap-6 mb-8"
            >
              {renderStatCard(
                'Total Users', 
                stats.totalUsers, 
                <UserGroupIcon className="w-8 h-8 text-blue-500" />,
                'bg-blue-100'
              )}
              {renderStatCard(
                'Total Students', 
                stats.totalStudents, 
                <AcademicCapIcon className="w-8 h-8 text-green-500" />,
                'bg-green-100'
              )}
              {renderStatCard(
                'Total Teachers', 
                stats.totalTeachers, 
                <BookOpenIcon className="w-8 h-8 text-purple-500" />,
                'bg-purple-100'
              )}
              {renderStatCard(
                'Active Classes', 
                stats.activeClasses, 
                <ChartBarIcon className="w-8 h-8 text-red-500" />,
                'bg-red-100'
              )}
            </motion.div>

            {/* Recent Activities */}
            {renderRecentActivities()}

            {/* Teachers and Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Teachers List */}
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                className={`
                  rounded-2xl p-6 
                  bg-white border border-gray-200
                  shadow-lg
                `}
              >
                <h2 className="text-2xl font-semibold mb-6 flex items-center justify-center">
                  <UserGroupIcon className="w-8 h-8 mr-3 text-indigo-600" />
                  Teachers
                </h2>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {teachers.map((teacher) => (
                    <motion.div
                      key={teacher.id}
                      whileHover={{ scale: 1.03 }}
                      className={`
                        p-4 rounded-lg cursor-pointer transition-all 
                        bg-gray-100 hover:bg-gray-200
                        border
                        border-gray-200
                      `}
                      onClick={() => handleTeacherSelect(teacher)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shadow-md">
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-semibold">{teacher.name}</h4>
                          <p className="text-sm text-gray-600">
                            {teacher.department}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Selected Teacher Details */}
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                className={`
                  rounded-2xl p-6 
                  bg-white border border-gray-200
                  shadow-lg
                  min-h-[600px]
                `}
              >
                {selectedTeacher ? (
                  <div className="space-y-6">
                    {/* Teacher Profile Header */}
                    <div className="flex flex-col items-center text-center border-b pb-6 
                      border-gray-200">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br 
                        from-indigo-500 to-purple-600 flex items-center 
                        justify-center text-white font-bold text-4xl 
                        shadow-2xl mb-4">
                        {selectedTeacher.name.charAt(0)}
                      </div>
                      <h2 className="text-2xl font-bold 
                        bg-clip-text text-transparent 
                        bg-gradient-to-r 
                        from-blue-600 via-indigo-500 to-purple-600">
                        {selectedTeacher.name}
                      </h2>
                      <p className="text-sm mt-2 text-gray-600">
                        {selectedTeacher.department}
                      </p>
                    </div>

                    {/* Schedules Section */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800 flex items-center">
                        <ClockIcon className="w-6 h-6 mr-3 text-indigo-600" />
                        Schedules
                      </h3>
                      {teacherSchedules.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {teacherSchedules.map((schedule, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-all"
                            >
                              <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center space-x-2">
                                  <CalendarIcon className="w-5 h-5 text-indigo-500" />
                                  <span className="font-semibold text-gray-700">
                                    {schedule.day}
                                  </span>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {schedule.teacherName}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <div className="flex items-center space-x-2">
                                    <ClockIcon className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm">
                                      Start: {schedule.startTime}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <ClockIcon className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm">
                                      End: {schedule.endTime}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <ViewColumnsIcon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm">
                                    Section: {schedule.section}
                                  </span>
                                </div>
                                {schedule.room && (
                                  <div className="flex items-center space-x-2">
                                    <HomeIcon className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm">
                                      Room: {schedule.room}
                                    </span>
                                  </div>
                                )}
                                {schedule.subject && (
                                  <div className="flex items-center space-x-2">
                                    <BookOpenIcon className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm">
                                      Subject: {typeof schedule.subject === 'object' 
                                        ? (schedule.subject as Subject).name 
                                        : schedule.subject}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          <p>No schedules found</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-center">
                    <p className="text-gray-500 italic">
                      Select a teacher to view details
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
        </div>
  );
};

export default AdminDashboard;