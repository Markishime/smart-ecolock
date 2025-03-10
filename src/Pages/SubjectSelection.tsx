import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import StudentNavbar from '../components/StudentNavbar';
import { motion } from 'framer-motion';
import { BookOpenIcon } from '@heroicons/react/24/outline';

interface Subject {
  id: string;
  name: string;
  department: string;
  status: 'active' | 'inactive';
}

const SubjectSelection = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
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

        // Fetch all subjects from the 'subjects' collection
        const subjectsRef = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        const subjectsData = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Subject));
        setAllSubjects(subjectsData.filter((subject) => subject.status === 'active'));
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
        // Update local storage to reflect changes immediately
        const updatedStudentData = { ...studentDoc.data(), enrolledSubjects: selectedSubjects };
        localStorage.setItem('userData', JSON.stringify(updatedStudentData));
        navigate('/student/dashboard'); // Updated path to match StudentNavbar
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

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentNavbar student={studentData} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BookOpenIcon className="w-8 h-8 text-indigo-600" />
            Select Your Subjects
          </h2>
          <p className="text-gray-600 mb-6">
            Choose the subjects you want to enroll in for this semester. Your selections will be
            reflected in your dashboard.
          </p>

          {allSubjects.length > 0 ? (
            <div className="space-y-4">
              {allSubjects.map((subject, index) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border ${
                    selectedSubjects.includes(subject.name)
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 bg-white'
                  } hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedSubjects.includes(subject.name)}
                        onChange={() => toggleSubject(subject.name)}
                        className="h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div>
                        <p className="text-lg font-medium text-gray-900">{subject.name}</p>
                        <p className="text-sm text-gray-600">{subject.department}</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSubject(subject.name)}
                      className={`px-4 py-1 text-sm font-medium rounded-full ${
                        selectedSubjects.includes(subject.name)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {selectedSubjects.includes(subject.name) ? 'Selected' : 'Select'}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No subjects available.</p>
          )}

          <div className="mt-8 flex justify-end gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/student/dashboard')}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={selectedSubjects.length === 0}
              className={`px-6 py-2 rounded-lg transition-colors ${
                selectedSubjects.length > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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