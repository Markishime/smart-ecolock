import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import StudentNavbar from '../components/StudentNavbar';
import { motion } from 'framer-motion';
import { BookOpenIcon, UserGroupIcon } from '@heroicons/react/24/outline';

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
  subjectId: string;
  instructorId: string;
  students: string[];
}

interface SubjectWithSection {
  subject: Subject;
  section: Section | null;
}

const SubjectSelection = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allSubjectsWithSections, setAllSubjectsWithSections] = useState<SubjectWithSection[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentData, setStudentData] = useState<{
    fullName: string;
    department: string;
    section: string;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        setIsLoading(true);

        // Fetch student data
        const studentQuery = query(collection(db, 'students'), where('uid', '==', currentUser.uid));
        const studentSnapshot = await getDocs(studentQuery);
        if (!studentSnapshot.empty) {
          const studentDoc = studentSnapshot.docs[0];
          const studentData = studentDoc.data();
          setStudentData({
            fullName: studentData.fullName,
            department: studentData.department,
            section: studentData.section,
          });
          setSelectedSubjects(studentData.enrolledSubjects || []);
        }

        // Fetch all subjects
        const subjectsRef = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        const subjectsData = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Subject)).filter(subject => subject.status === 'active');

        // Fetch all sections
        const sectionsRef = collection(db, 'sections');
        const sectionsSnapshot = await getDocs(sectionsRef);
        const sectionsData = sectionsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Section));

        // Combine subjects with their sections
        const subjectsWithSections = subjectsData.map(subject => {
          const section = sectionsData.find(section => section.subjectId === subject.id) || null;
          return { subject, section };
        });

        setAllSubjectsWithSections(subjectsWithSections);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser) return;
    try {
      const studentQuery = query(collection(db, 'students'), where('uid', '==', currentUser.uid));
      const studentSnapshot = await getDocs(studentQuery);
      if (!studentSnapshot.empty) {
        const studentDoc = studentSnapshot.docs[0];
        await updateDoc(studentDoc.ref, { enrolledSubjects: selectedSubjects });
        const updatedStudentData = { ...studentDoc.data(), enrolledSubjects: selectedSubjects };
        localStorage.setItem('userData', JSON.stringify(updatedStudentData));
        navigate('/student/dashboard');
      }
    } catch (error) {
      console.error('Error saving selection:', error);
    }
  };

  const toggleSubject = (subjectName: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectName)
        ? prev.filter((s) => s !== subjectName)
        : [...prev, subjectName]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 p-8 text-center text-cyan-300">
        No student data found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800">
      <StudentNavbar student={studentData} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-cyan-800"
        >
          <h2 className="text-3xl font-bold text-cyan-100 mb-6 flex items-center gap-2 font-mono">
            <BookOpenIcon className="w-8 h-8 text-cyan-400" />
            Select Your Subjects
          </h2>
          <p className="text-cyan-300 mb-6 font-mono">
            Choose the subjects you want to enroll in for this semester. Your selections will be
            reflected in your dashboard.
          </p>

          {allSubjectsWithSections.length > 0 ? (
            <div className="space-y-4">
              {allSubjectsWithSections.map(({ subject, section }, index) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border ${
                    selectedSubjects.includes(subject.name)
                      ? 'border-cyan-400 bg-gray-700/50'
                      : 'border-gray-700 bg-gray-800'
                  } hover:shadow-lg transition-all duration-200`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedSubjects.includes(subject.name)}
                        onChange={() => toggleSubject(subject.name)}
                        className="h-5 w-5 text-cyan-400 rounded focus:ring-cyan-500 bg-gray-700 border-gray-600"
                      />
                      <div>
                        <p className="text-lg font-medium text-cyan-100 font-mono">{subject.name}</p>
                        <p className="text-sm text-cyan-300 font-mono">{subject.department}</p>
                        <div className="flex items-center gap-1">
                          <UserGroupIcon className="w-4 h-4 text-cyan-400" />
                          <p className="text-sm text-cyan-300 font-mono">
                            Section: {section ? section.name : 'Not assigned'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSubject(subject.name)}
                      className={`px-4 py-1 text-sm font-medium rounded-full font-mono ${
                        selectedSubjects.includes(subject.name)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-700 text-cyan-200'
                      }`}
                    >
                      {selectedSubjects.includes(subject.name) ? 'Selected' : 'Select'}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-cyan-300 text-center py-4 font-mono">No subjects available.</p>
          )}

          <div className="mt-8 flex justify-end gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/student/dashboard')}
              className="px-6 py-2 bg-gray-700 text-cyan-200 rounded-lg hover:bg-gray-600 transition-colors font-mono"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={selectedSubjects.length === 0}
              className={`px-6 py-2 rounded-lg transition-colors font-mono ${
                selectedSubjects.length > 0
                  ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                  : 'bg-gray-700 text-cyan-400 cursor-not-allowed'
              }`}
            >
              Save Selection
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SubjectSelection;