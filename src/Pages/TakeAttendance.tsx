import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../Pages/AuthContext';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon 
} from '@heroicons/react/24/solid';
import AdminSidebar from '../components/AdminSidebar';  

interface Student {
  id: string;
  name: string;
  email: string;
  attendanceStatus?: 'present' | 'absent' | 'late';
}

interface Section {
  id: string;
  name: string;
  students: string[];
  instructorId?: string;
}

const TakeAttendance: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [section, setSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const formattedTime = useMemo(() => currentTime, [currentTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchSectionsAndStudents = async () => {
      if (!currentUser) return;

      try {
        // Fetch instructor's sections
        const sectionsRef = collection(db, 'sections');
        const q = query(
          sectionsRef, 
          where('instructorId', '==', currentUser.uid)
        );
        const sectionsSnapshot = await getDocs(q);
        
        if (!sectionsSnapshot.empty) {
          const firstSection = sectionsSnapshot.docs[0];
          const sectionData = { 
            id: firstSection.id, 
            ...firstSection.data() 
          } as Section;
          setSection(sectionData);

          // Fetch students for this section
          const studentsRef = collection(db, 'users');
          const studentsQuery = query(
            studentsRef, 
            where('id', 'in', sectionData.students)
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          
          const fetchedStudents = studentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Student));
          
          setStudents(fetchedStudents);
        }
      } catch (error) {
        console.error('Error fetching sections and students:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSectionsAndStudents();
  }, [currentUser]);

  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setStudents(students.map(student => 
      student.id === studentId 
        ? { ...student, attendanceStatus: status } 
        : student
    ));
  };

  const submitAttendance = async () => {
    if (!section) return;

    try {
      const attendanceRecords = students.map(student => ({
        studentId: student.id,
        studentName: student.name,
        sectionId: section.id,
        sectionName: section.name,
        status: student.attendanceStatus || 'absent',
        timestamp: Timestamp.now(),
        date: new Date().toISOString().split('T')[0]
      }));

      // Batch write attendance records
      const attendanceRef = collection(db, 'attendanceRecords');
      const batch = attendanceRecords.map(record => 
        addDoc(attendanceRef, record)
      );
      
      await Promise.all(batch);

      // Show success message
      alert('Attendance submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('Failed to submit attendance. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />
        <main className="container mx-auto px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">
                Take Attendance - {section?.name || 'Section'}
              </h1>
              <div className="text-sm text-gray-600">
                {formattedTime.toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(student => (
                <div 
                  key={student.id} 
                  className="bg-gray-100 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-800">{student.name}</p>
                    <p className="text-sm text-gray-600">{student.email}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAttendanceChange(student.id, 'present')}
                      className={`
                        p-2 rounded-full 
                        ${student.attendanceStatus === 'present' 
                          ? 'bg-green-500 text-white' 
                          : 'bg-green-100 text-green-600 hover:bg-green-200'}
                      `}
                    >
                      <CheckCircleIcon className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => handleAttendanceChange(student.id, 'late')}
                      className={`
                        p-2 rounded-full 
                        ${student.attendanceStatus === 'late' 
                          ? 'bg-yellow-500 text-white' 
                          : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'}
                      `}
                    >
                      <ClockIcon className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => handleAttendanceChange(student.id, 'absent')}
                      className={`
                        p-2 rounded-full 
                        ${student.attendanceStatus === 'absent' 
                          ? 'bg-red-500 text-white' 
                          : 'bg-red-100 text-red-600 hover:bg-red-200'}
                      `}
                    >
                      <XCircleIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total Students: {students.length}
                <span className="ml-4">
                  Present: {students.filter(s => s.attendanceStatus === 'present').length}
                </span>
                <span className="ml-4">
                  Late: {students.filter(s => s.attendanceStatus === 'late').length}
                </span>
                <span className="ml-4">
                  Absent: {students.filter(s => s.attendanceStatus === 'absent').length}
                </span>
              </div>
              <button
                onClick={submitAttendance}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
              >
                Submit Attendance
              </button>
            </div>
          </div>
        </main>
      </div>
  );
};

export default TakeAttendance;
