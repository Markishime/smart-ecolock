import React, { useState, useEffect } from 'react';
import { useAuth } from '../Pages/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { 
  AcademicCapIcon,
  ClockIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import StudentNavbar from '../components/StudentNavbar'; // Import the StudentNavbar

// Define interfaces for the data
interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
}

interface Subject {
  subjectId: string;
  name: string;
  section: string;
  schedules: Schedule[];
}

interface StudentData {
  fullName: string;
  department: string;
  section: string;
  enrolledSubjects?: Subject[]; // Array of subjects with details
}

const StudentSchedules: React.FC = () => {
  const { currentUser } = useAuth();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [enrolledSubjects, setEnrolledSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!currentUser) return;

      setIsLoading(true);
      try {
        // Fetch student data
        const studentRef = doc(db, 'students', currentUser.uid);
        const studentSnap = await getDoc(studentRef);

        if (!studentSnap.exists()) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Student data not found.',
          });
          setIsLoading(false);
          return;
        }

        const student = studentSnap.data() as StudentData;
        setStudentData(student);

        // Fetch enrolled subjects from the enrolledSubjects field
        if (student.enrolledSubjects && student.enrolledSubjects.length > 0) {
          // If enrolledSubjects contains full subject details, use them directly
          if (student.enrolledSubjects[0]?.subjectId) {
            setEnrolledSubjects(student.enrolledSubjects);
          } else {
            // If enrolledSubjects contains only subject IDs, fetch details from subjects collection
            const subjectsRef = collection(db, 'subjects');
            const subjectsSnap = await getDocs(subjectsRef);
            const subjectsData = subjectsSnap.docs
              .filter(doc => (student.enrolledSubjects as unknown as string[])!.includes(doc.id))
              .map(doc => {
                const data = doc.data();
                return {
                  subjectId: doc.id,
                  name: data.name || 'Unknown Subject',
                  section: data.section || student.section || 'N/A',
                  schedules: data.schedules || [],
                } as Subject;
              });
            setEnrolledSubjects(subjectsData);
          }
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch your schedules.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [currentUser]);

  if (!studentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono">
      {/* Add StudentNavbar */}
      <StudentNavbar
        student={{
          fullName: studentData.fullName,
          department: studentData.department,
          section: studentData.section,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center mb-8"
        >
          <AcademicCapIcon className="h-8 w-8 text-cyan-400 mr-3" />
          <h1 className="text-3xl font-bold text-cyan-100">Your Enrolled Subjects & Schedules</h1>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : enrolledSubjects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-gray-400"
          >
            <p>You are not enrolled in any subjects yet.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolledSubjects.map(subject => (
              <motion.div
                key={subject.subjectId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg p-6 border border-cyan-800"
              >
                {/* Subject Name and Section */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-cyan-100">{subject.name}</h2>
                  <span className="text-sm text-cyan-300 bg-gray-700/50 px-3 py-1 rounded-full">
                    {subject.section}
                  </span>
                </div>

                {/* Schedules */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-400 flex items-center">
                    <ClockIcon className="h-5 w-5 mr-2 text-cyan-400" />
                    Schedules
                  </h3>
                  {subject.schedules.length > 0 ? (
                    subject.schedules.map((schedule, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg"
                      >
                        <div>
                          <p className="text-sm text-cyan-100">{schedule.day}</p>
                          <p className="text-xs text-gray-400">
                            {schedule.startTime} - {schedule.endTime}
                          </p>
                        </div>
                        <div className="flex items-center text-sm text-gray-300">
                          <BuildingOfficeIcon className="h-4 w-4 mr-1 text-cyan-400" />
                          {schedule.room}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">No schedules available.</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentSchedules;