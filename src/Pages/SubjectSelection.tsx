import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import StudentNavbar from '../components/StudentNavbar';
import { motion } from 'framer-motion';

// Define types for better type safety
interface Subject {
  id: string;
  name: string;
  department: string;
  status: string;
}

interface Section {
  id: string;
  name: string;
  subjectId: string;
}

interface SubjectWithSection {
  subject: Subject;
  section: Section | null;
}

interface StudentData {
  fullName: string;
  department: string;
  section: string;
  enrolledSubjects?: string[];
}

const SubjectSelection = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allSubjectsWithSections, setAllSubjectsWithSections] = useState<SubjectWithSection[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentData, setStudentData] = useState<StudentData | null>(null);

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
          const studentData = studentDoc.data() as StudentData;
          setStudentData({
            fullName: studentData.fullName,
            department: studentData.department,
            section: studentData.section,
            enrolledSubjects: studentData.enrolledSubjects || [],
          });
          setSelectedSubjects(studentData.enrolledSubjects || []);
        }

        // Fetch subjects
        const subjectsRef = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        const subjectsData = subjectsSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Subject))
          .filter((subject) => subject.status === 'active');

        // Fetch sections
        const sectionsRef = collection(db, 'sections');
        const sectionsSnapshot = await getDocs(sectionsRef);
        const sectionsData = sectionsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Section[];

        // Combine subjects with their sections
        const subjectsWithSections = subjectsData.map((subject) => {
          const section = sectionsData.find((section) => section.subjectId === subject.id) || null;
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
        No student data found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentNavbar student={studentData} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Select Your Subjects</h1>
        <p className="text-gray-600 mb-4">
          Choose the subjects you want to enroll in for this semester. Your selections will be saved to your dashboard.
        </p>

        {allSubjectsWithSections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allSubjectsWithSections.map(({ subject, section }) => (
              <div
                key={subject.id}
                className={`p-6 rounded-lg shadow-lg border transition-transform transform hover:scale-105 ${
                  selectedSubjects.includes(subject.name)
                    ? 'bg-blue-100 border-blue-400'
                    : 'bg-white border-gray-300'
                }`}
              >
                <h2 className="text-xl font-semibold text-gray-800">{subject.name}</h2>
                <p className="text-sm text-gray-600">{subject.department}</p>
                <p className="text-sm text-gray-500">
                  Section: {section ? section.name : 'Not assigned'}
                </p>
                <button
                  onClick={() => toggleSubject(subject.name)}
                  className={`mt-4 w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedSubjects.includes(subject.name)
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {selectedSubjects.includes(subject.name) ? 'Deselect' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center">No subjects available.</p>
        )}

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={selectedSubjects.length === 0}
            className={`px-6 py-2 rounded-md transition-colors ${
              selectedSubjects.length > 0
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Save Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubjectSelection;