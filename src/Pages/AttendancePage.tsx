import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserIcon,
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  BookOpenIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext';
import StudentNavbar from '../components/StudentNavbar'; // Ensure correct path

interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  semester?: string;
  instructor?: string;
}

interface Schedule {
  id: string;
  days: string[];
  startTime: string;
  endTime: string;
  roomNumber: string;
  semester?: string;
  subjectCode: string;
  instructor: string;
  section?: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  subjectCode: string;
  date: string;
  present: boolean;
}

interface Student {
  id: string;
  name: string;
  section: string;
  sectionId: string;
  attendanceRecords: AttendanceRecord[];
  studentId: string;
  course: string;
  year: string;
  enrolledSubjects: string[];
  email: string;
  mobileNumber: string;
  rfidUid: string;
  assignedSensorId: string;
}

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

const AttendancePage: React.FC<{ instructorName?: string }> = ({ instructorName }) => {
  const { currentUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);

        const studentQuery = query(
          collection(db, 'students'),
          where('uid', '==', currentUser.uid)
        );
        const studentSnapshot = await getDocs(studentQuery);

        if (studentSnapshot.docs.length > 0) {
          const studentData = studentSnapshot.docs[0].data();
          const studentObj: Student = {
            id: studentSnapshot.docs[0].id,
            name: studentData.fullName || '',
            section: studentData.section || '',
            sectionId: studentData.sectionId || '',
            attendanceRecords: [],
            studentId: studentData.idNumber || '',
            course: studentData.department || '',
            year: studentData.year || '',
            enrolledSubjects: Array.isArray(studentData.enrolledSubjects) ? studentData.enrolledSubjects : [],
            email: studentData.email || '',
            mobileNumber: studentData.mobileNumber || '',
            rfidUid: studentData.rfidUid || '',
            assignedSensorId: studentData.assignedSensorId || '',
          };
          setStudent(studentObj);

          if (studentObj.enrolledSubjects.length > 0) {
            const subjectsQuery = query(
              collection(db, 'subjects'),
              where('name', 'in', studentObj.enrolledSubjects)
            );
            const subjectsSnapshot = await getDocs(subjectsQuery);
            const subjectsData = subjectsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as Subject[];

            const schedulesQuery = instructorName
              ? query(
                  collection(db, 'schedules'),
                  where('subjectCode', 'in', subjectsData.map(s => s.code)),
                  where('instructor', '==', instructorName),
                  where('section', '==', studentObj.section)
                )
              : query(
                  collection(db, 'schedules'),
                  where('subjectCode', 'in', subjectsData.map(s => s.code)),
                  where('section', '==', studentObj.section)
                );
            const schedulesSnapshot = await getDocs(schedulesQuery);
            const schedulesData = schedulesSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as Schedule[];
            setSchedules(schedulesData);

            const enrichedSubjects = subjectsData.map(subject => {
              const schedule = schedulesData.find(s => s.subjectCode === subject.code);
              return {
                ...subject,
                instructor: schedule?.instructor || 'N/A',
              };
            });
            setSubjects(enrichedSubjects);
          } else {
            setSubjects([]);
            setSchedules([]);
          }

          const attendanceQuery = query(
            collection(db, 'attendance'),
            where('studentId', '==', studentObj.id)
          );
          const attendanceSnapshot = await getDocs(attendanceQuery);
          const attendanceData = attendanceSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as AttendanceRecord[];
          studentObj.attendanceRecords = attendanceData;
          setAttendanceRecords(attendanceData);

          setLoading(false);
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Student not found.',
            background: '#1e293b',
            iconColor: '#22d3ee',
            confirmButtonColor: '#0891b2',
          });
        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error instanceof Error ? error.message : 'Failed to load data',
          background: '#1e293b',
          iconColor: '#22d3ee',
          confirmButtonColor: '#0891b2',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [currentUser, instructorName]);

  const calculateAttendance = (subjectCode: string) => {
    const subjectRecords = attendanceRecords.filter(record => record.subjectCode === subjectCode);
    const totalSessions = subjectRecords.length;
    const presentSessions = subjectRecords.filter(record => record.present).length;
    return totalSessions > 0 ? (presentSessions / totalSessions) * 100 : 0;
  };

  // Prepare student data for StudentNavbar
  const navbarStudentData = student
    ? {
        fullName: student.name,
        department: student.course,
        section: student.section,
      }
    : { fullName: 'Loading...', department: '', section: '' }; // Fallback while loading

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono">
      <ParticleBackground />
      <StudentNavbar student={navbarStudentData} />

      <div className="pt-16 px-4 sm:px-6 lg:px-8"> {/* Adjust padding-top for navbar height */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
          <motion.div
            className="absolute -inset-2 bg-cyan-500/20 blur-xl"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-cyan-100 flex items-center gap-3">
              <ClipboardDocumentCheckIcon className="w-8 h-8 text-cyan-400" />
              My Attendance {instructorName ? `with ${instructorName}` : ''}
            </h1>
            <p className="mt-2 text-cyan-300">View your attendance records by subject</p>
          </div>
        </motion.header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full"
            />
          </div>
        ) : student ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
              <motion.div
                className="absolute -inset-2 bg-cyan-500/20 blur-xl"
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-cyan-100 mb-4 flex items-center gap-2">
                  <UserIcon className="w-6 h-6 text-cyan-400" />
                  Student Profile
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-cyan-300">
                  <p><span className="font-medium">Name:</span> {student.name}</p>
                  <p><span className="font-medium">Student ID:</span> {student.studentId}</p>
                  <p><span className="font-medium">Course:</span> {student.course}</p>
                  <p><span className="font-medium">Section:</span> {student.section}</p>
                  <p><span className="font-medium">Email:</span> {student.email}</p>
                  <p><span className="font-medium">Mobile Number:</span> {student.mobileNumber}</p>
                  <p><span className="font-medium">RFID UID:</span> {student.rfidUid}</p>
                  <p><span className="font-medium">Sensor ID:</span> {student.assignedSensorId}</p>
                </div>
              </div>
            </motion.div>

            {student.enrolledSubjects.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
                <motion.div
                  className="absolute -inset-2 bg-cyan-500/20 blur-xl"
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative z-10">
                  <label className="block text-sm font-medium text-cyan-300 mb-3">
                    <BookOpenIcon className="w-5 h-5 inline-block mr-2 text-cyan-400" />
                    Select Subject
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full rounded-lg bg-gray-700 text-cyan-100 border border-cyan-800 focus:ring-2 focus:ring-cyan-500 py-2.5"
                  >
                    <option value="">-- Select a Subject --</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.code}>
                        {subject.name} ({subject.code}) - {subject.instructor}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-cyan-300 py-12"
              >
                <BookOpenIcon className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
                <h2 className="text-xl font-semibold">No enrolled subjects available</h2>
              </motion.div>
            )}

            {selectedSubject && (
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
                  <h3 className="text-xl font-semibold text-cyan-100 mb-6 flex items-center gap-2">
                    <CalendarIcon className="w-6 h-6 text-cyan-400" />
                    Attendance for {subjects.find(s => s.code === selectedSubject)?.name}
                  </h3>
                  <div className="mb-6 text-cyan-300">
                    <p>
                      <span className="font-medium">Instructor:</span>{' '}
                      {subjects.find(s => s.code === selectedSubject)?.instructor || 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium">Schedule:</span>{' '}
                      {schedules.find(s => s.subjectCode === selectedSubject)?.days.join(', ') || 'N/A'}{' '}
                      {schedules.find(s => s.subjectCode === selectedSubject)?.startTime} -{' '}
                      {schedules.find(s => s.subjectCode === selectedSubject)?.endTime}
                    </p>
                    <p>
                      <span className="font-medium">Attendance Rate:</span>{' '}
                      {calculateAttendance(selectedSubject).toFixed(2)}%
                    </p>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-cyan-800">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cyan-300 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cyan-300 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-800">
                        {attendanceRecords
                          .filter(record => record.subjectCode === selectedSubject)
                          .map((record) => (
                            <tr key={record.id} className="hover:bg-gray-700/50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-100">
                                {new Date(record.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-100">
                                {record.present ? (
                                  <CheckIcon className="w-5 h-5 text-green-400" />
                                ) : (
                                  <XMarkIcon className="w-5 h-5 text-red-400" />
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-cyan-300 py-12"
          >
            <BookOpenIcon className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
            <h2 className="text-xl font-semibold">No student data available</h2>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Custom CSS for Scrollbar
const style = document.createElement('style');
style.innerHTML = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #1e293b;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #0891b2;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #0e7490;
  }
`;
document.head.appendChild(style);

export default AttendancePage;