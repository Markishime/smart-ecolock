import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  collection, 
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from '../components/AdminSidebar';
import {
  ClockIcon,
  UserGroupIcon,
  BookOpenIcon,
  CalendarIcon,
  HomeIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/solid';

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
  department: string;
  status: 'active' | 'inactive';
  schedules: Schedule[];
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  section?: string;
  room?: string;
  subject?: string;
  teacherName?: string;
}

const AdminDashboard: React.FC = () => {
  const [teachers, setTeachers] = useState<Instructor[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Instructor | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Added state for sidebar

  useEffect(() => {
    const fetchTeachersData = async () => {
      try {
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        
        const teachersData = teachersSnapshot.docs.map((teacherDoc) => {
          const data = teacherDoc.data();
          
          const assignedSubjects = data.assignedSubjects || [];
          const subjectsWithSchedules: Subject[] = assignedSubjects.map((subject: any) => {
            // Extract schedules from sections
            const sectionSchedules = (subject.sections || []).flatMap((section: any) =>
              (section.schedules || []).map((schedule: any) => ({
                day: schedule.day || '',
                startTime: schedule.startTime || '',
                endTime: schedule.endTime || '',
                section: section.name || section.code || '',
                room: schedule.roomName || '',
                subject: subject.name || '',
                teacherName: data.fullName || data.name || 'Unknown Teacher',
              })) as Schedule[]
            );

            return {
              id: subject.id || '',
              name: subject.name || '',
              department: subject.department || 'Unassigned',
              status: subject.status || 'active' as 'active' | 'inactive',
              schedules: sectionSchedules,
            } as Subject;
          });

          const allSchedules = subjectsWithSchedules.flatMap(subject => subject.schedules);

          return {
            id: teacherDoc.id,
            name: data.fullName || data.name || 'Unknown Teacher',
            fullName: data.fullName || data.name || 'Unknown Teacher',
            email: data.email || '',
            department: data.department || 'Unassigned',
            role: 'instructor',
            uid: data.uid || teacherDoc.id,
            subjects: subjectsWithSchedules,
            schedules: allSchedules,
          } as Instructor;
        });

        setTeachers(teachersData);

        if (teachersData.length > 0) {
          setSelectedTeacher(teachersData[0]);
        }
      } catch (error) {
        console.error('Error fetching teachers data:', error);
      }
    };

    fetchTeachersData();
  }, []);

  const handleTeacherSelect = (teacher: Instructor) => {
    setSelectedTeacher(teacher);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
    <AdminSidebar />

    <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600">
              Admin Dashboard
            </h1>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl p-6 bg-white border border-gray-200 shadow-lg"
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
                    className="p-4 rounded-lg cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-200"
                    onClick={() => handleTeacherSelect(teacher)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold">{teacher.name}</h4>
                        <p className="text-sm text-gray-600">{teacher.department}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl p-6 bg-white border border-gray-200 shadow-lg min-h-[600px]"
            >
              {selectedTeacher ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center text-center border-b pb-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-4xl mb-4">
                      {selectedTeacher.name.charAt(0)}
                    </div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600">
                      {selectedTeacher.name}
                    </h2>
                    <p className="text-sm mt-2 text-gray-600">{selectedTeacher.department}</p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                      <BookOpenIcon className="w-6 h-6 mr-3 text-indigo-600" />
                      Assigned Subjects
                    </h3>
                    {selectedTeacher.subjects.length > 0 ? (
                      <div className="space-y-2">
                        {selectedTeacher.subjects.map((subject, index) => (
                          <div key={index} className="p-3 bg-gray-100 rounded-lg">
                            <p className="font-semibold">{subject.name}</p>
                            <p className="text-sm text-gray-600">Department: {subject.department}</p>
                            <p className="text-sm text-gray-600">Status: {subject.status}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No subjects assigned</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                      <ClockIcon className="w-6 h-6 mr-3 text-indigo-600" />
                      Schedules
                    </h3>
                    {selectedTeacher.schedules.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedTeacher.schedules.map((schedule, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-lg shadow-md p-4"
                          >
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center space-x-2">
                                <CalendarIcon className="w-5 h-5 text-indigo-500" />
                                <span className="font-semibold">{schedule.day}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <div className="flex items-center space-x-2">
                                  <ClockIcon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm">Start: {schedule.startTime}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <ClockIcon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm">End: {schedule.endTime}</span>
                                </div>
                              </div>
                              {schedule.section && (
                                <div className="flex items-center space-x-2">
                                  <ViewColumnsIcon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm">Section: {schedule.section}</span>
                                </div>
                              )}
                              {schedule.room && (
                                <div className="flex items-center space-x-2">
                                  <HomeIcon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm">Room: {schedule.room}</span>
                                </div>
                              )}
                              {schedule.subject && (
                                <div className="flex items-center space-x-2">
                                  <BookOpenIcon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm">Subject: {schedule.subject}</span>
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
                  <p className="text-gray-500 italic">Select a teacher to view details</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default AdminDashboard;