import { useEffect, useState } from 'react';
import { useAuth } from '../Pages/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  CalendarIcon,
  UserGroupIcon,
  BookOpenIcon,
  ClockIcon,
  BuildingOfficeIcon,
  UserCircleIcon
} from '@heroicons/react/24/solid';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

interface Student {
  uid: string;
  fullName: string;
  email: string;
  idNumber: string;
  major: string;
  mobileNumber: string;
  role: string;
  yearLevel: string;
  sections: string[];
  schedule: {
    days: string[];
    startTime: string;
    endTime: string;
  };
}

interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'late';
  sectionId: string;
}

const StudentDashboard = () => {
  const { currentUser } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!currentUser) return;

      try {
        // Fetch student document
        const studentQuery = query(
          collection(db, 'students'), 
          where('uid', '==', currentUser.uid)
        );
        const studentSnapshot = await getDocs(studentQuery);

        if (!studentSnapshot.empty) {
          const studentData = studentSnapshot.docs[0].data() as Student;
          setStudent(studentData);

           // Set first section as default if sections exist
           const sections = studentData.sections || [];
           setSelectedSection(sections[0] || '');

           const attendanceQuery = query(
            collection(db, 'attendance'), 
            where('studentId', '==', studentData.uid)
          );
          const attendanceSnapshot = await getDocs(attendanceQuery);
          setAttendance(attendanceSnapshot.docs.map(d => d.data() as AttendanceRecord));
        } else {
          console.error('Student record not found');
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [currentUser]);

  const getFilteredAttendance = () => {
    if (!selectedSection) return [];
    
    const filtered = attendance.filter(a => a.sectionId === selectedSection);
    const now = new Date();

    switch (reportRange) {
      case 'daily':
        return filtered.filter(a => 
          format(parseISO(a.date), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
        );

      case 'weekly':
        const weekStart = startOfWeek(now);
        const weekEnd = endOfWeek(now);
        return filtered.filter(a => {
          const date = parseISO(a.date);
          return date >= weekStart && date <= weekEnd;
        });

      case 'monthly':
        return filtered.filter(a => 
          format(parseISO(a.date), 'yyyy-MM') === format(now, 'yyyy-MM')
        );

      default:
        return filtered;
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading student data...</div>;
  }

  if (!student) {
    return <div className="p-8 text-center">No student data found.</div>;
  }

  const attendanceRecords = attendance || [];
  const overallAttendance = attendanceRecords.length > 0
    ? ((attendanceRecords.filter(a => a.status === 'present').length / attendanceRecords.length) * 100 || 0).toFixed(1)
    : 0;

    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
              <UserCircleIcon className="w-8 h-8 text-indigo-600" />
              {student.fullName}'s Dashboard
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Enrolled Sections</p>
                <p className="font-semibold">{student.sections?.length || 0}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Course</p>
                <p className="font-semibold">{student.major}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Overall Attendance</p>
                <p className="font-semibold">{overallAttendance}%</p>
              </div>
            </div>
          </div>
  
          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Section Selector */}
            <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <UserGroupIcon className="w-6 h-6 text-indigo-600" />
                Your Sections
              </h2>
              
              <div className="space-y-3">
                {student.sections?.map(sectionId => (
                  <button
                    key={sectionId}
                    onClick={() => setSelectedSection(sectionId)}
                    className={`w-full p-3 text-left rounded-lg transition-colors ${
                      selectedSection === sectionId ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-semibold">{sectionId}</p>
                  </button>
                ))}
              </div>
            </div>
  
            {/* Attendance Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ChartBarIcon className="w-6 h-6 text-indigo-600" />
                  Attendance Overview
                </h2>
                <select
                  value={reportRange}
                  onChange={(e) => setReportRange(e.target.value as any)}
                  className="bg-gray-50 p-2 rounded-lg"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
  
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getFilteredAttendance()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(str) => format(parseISO(str), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="status"
                      stroke="#4f46e5" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
  
            {/* Schedule Timetable */}
            <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <CalendarIcon className="w-6 h-6 text-indigo-600" />
                Class Schedule
              </h2>
  
              {student.schedule ? (
                <div className="grid grid-cols-7 gap-2">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                    <div 
                      key={day}
                      className={`p-3 rounded-lg text-center ${
                        student.schedule.days.includes(day) ? 'bg-indigo-50 border-indigo-500' : 'bg-gray-50'
                      }`}
                    >
                      <p className="font-medium">{day}</p>
                      {student.schedule.days.includes(day) && (
                        <div className="mt-2 text-sm">
                          <p>{student.schedule.startTime} - {student.schedule.endTime}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No schedule information available
                </div>
              )}
            </div>
          </div>
        </div>  
      </div>
    );
  };

export default StudentDashboard;