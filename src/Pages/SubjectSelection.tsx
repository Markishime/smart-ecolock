import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { collection, query, getDocs, updateDoc, doc, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import StudentNavbar from '../components/StudentNavbar';
import { motion } from 'framer-motion';

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  room: string; // Changed from roomName to room for consistency
}

interface Subject {
  id: string;
  code: string;
  credits: number;
  department: string;
  details: string;
  name: string;
  status: string;
  sections: {
    id: string;
    name: string;
    code: string;
    instructorId: string;
    instructorName: string;
    instructorRfidUid: string;
    schedules: Schedule[];
    capacity: number;
    currentEnrollment: number;
  }[];
}

interface Instructor {
  id: string;
  fullName: string;
  rfidUid: string;
}

interface EnrolledSubject {
  subjectId: string;
  name: string;
  department: string;
  sectionId: string;
  sectionName: string;
  instructorId: string;
  instructorName: string;
  schedules: Schedule[];
}

interface StudentData {
  uid: string;
  fullName: string;
  department: string;
  section: string;
  enrolledSubjects?: EnrolledSubject[];
}

interface SubjectWithSection {
  subject: Subject;
  section: Subject['sections'][number]; // Specific section from subject's sections array
}

const SubjectSelection = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allSubjectsWithSections, setAllSubjectsWithSections] = useState<SubjectWithSection[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]); // Store as "subjectId-sectionId"
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
            uid: studentData.uid,
            fullName: studentData.fullName,
            department: studentData.department,
            section: studentData.section,
            enrolledSubjects: studentData.enrolledSubjects || [],
          });
          setSelectedSubjects(
            studentData.enrolledSubjects?.map((s) => `${s.subjectId}-${s.sectionId}`) || []
          );
        }

        // Fetch all active subjects with sections
        const subjectsQuery = query(collection(db, 'subjects'), where('status', '==', 'active'));
        const subjectsSnapshot = await getDocs(subjectsQuery);
        const subjectsData = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          sections: doc.data().sections || [],
        })) as Subject[];

        // Flatten subjects with their sections
        const subjectsWithSections: SubjectWithSection[] = [];
        subjectsData.forEach((subject) => {
          subject.sections.forEach((section) => {
            subjectsWithSections.push({ subject, section });
          });
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
    if (!currentUser || !studentData) return;
    try {
      const studentQuery = query(collection(db, 'students'), where('uid', '==', currentUser.uid));
      const studentSnapshot = await getDocs(studentQuery);
      if (!studentSnapshot.empty) {
        const studentDoc = studentSnapshot.docs[0];

        // Prepare enrolled subjects with section and instructor details
        const enrolledSubjects: EnrolledSubject[] = allSubjectsWithSections
          .filter((item) => selectedSubjects.includes(`${item.subject.id}-${item.section.id}`))
          .map((item) => ({
            subjectId: item.subject.id,
            name: item.subject.name,
            department: item.subject.department,
            sectionId: item.section.id,
            sectionName: item.section.name,
            instructorId: item.section.instructorId,
            instructorName: item.section.instructorName,
            schedules: item.section.schedules || [],
          }));

        // Update student's enrolledSubjects in Firestore
        await updateDoc(studentDoc.ref, { enrolledSubjects });
        const updatedStudentData = { ...studentDoc.data(), enrolledSubjects };
        localStorage.setItem('userData', JSON.stringify(updatedStudentData));

        // Update sections with enrolled student
        for (const subject of enrolledSubjects) {
          const sectionDocRef = doc(db, 'sections', subject.sectionId);
          const sectionSnapshot = await getDocs(
            query(collection(db, 'sections'), where('__name__', '==', subject.sectionId))
          );
          if (!sectionSnapshot.empty) {
            const sectionDoc = sectionSnapshot.docs[0];
            const existingStudents = sectionDoc.data().students || [];
            if (!existingStudents.includes(studentData.fullName)) {
              await updateDoc(sectionDocRef, {
                students: [...existingStudents, studentData.fullName],
              });
            }
          }

          // Update teachers' assignedSubjects
          const teacherQuery = query(
            collection(db, 'teachers'),
            where('__name__', '==', subject.instructorId)
          );
          const teacherSnapshot = await getDocs(teacherQuery);
          for (const teacherDoc of teacherSnapshot.docs) {
            const assignedSubjectRef = doc(
              collection(teacherDoc.ref, 'assignedSubjects'),
              subject.subjectId
            );
            const assignedSubjectSnap = await getDocs(
              query(
                collection(teacherDoc.ref, 'assignedSubjects'),
                where('subjectId', '==', subject.subjectId)
              )
            );

            if (assignedSubjectSnap.empty) {
              await setDoc(assignedSubjectRef, {
                subjectId: subject.subjectId,
                subjectName: subject.name,
                sectionId: subject.sectionId,
                sectionName: subject.sectionName,
                studentNames: [studentData.fullName],
              });
            } else {
              const existingDoc = assignedSubjectSnap.docs[0];
              const existingStudentNames = existingDoc.data().studentNames || [];
              if (!existingStudentNames.includes(studentData.fullName)) {
                await updateDoc(existingDoc.ref, {
                  studentNames: [...existingStudentNames, studentData.fullName],
                });
              }
            }
          }
        }

        navigate('/student/dashboard');
      }
    } catch (error) {
      console.error('Error saving selection:', error);
    }
  };

  const toggleSubject = (subjectId: string, sectionId: string) => {
    const key = `${subjectId}-${sectionId}`;
    setSelectedSubjects((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
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
                key={`${subject.id}-${section.id}`}
                className={`p-6 rounded-lg shadow-lg border transition-transform transform hover:scale-105 ${
                  selectedSubjects.includes(`${subject.id}-${section.id}`)
                    ? 'bg-blue-100 border-blue-400'
                    : 'bg-white border-gray-300'
                }`}
              >
                <h2 className="text-xl font-semibold text-gray-800">{subject.name}</h2>
                <p className="text-sm text-gray-600">Code: {subject.code}</p>
                <p className="text-sm text-gray-600">Department: {subject.department}</p>
                <p className="text-sm text-gray-500">Credits: {subject.credits}</p>
                <p className="text-sm text-gray-500">Details: {subject.details}</p>
                <p className="text-sm text-gray-500">Section: {section.name}</p>
                <p className="text-sm text-gray-500">Section Code: {section.code}</p>
                <p className="text-sm text-gray-500">Instructor: {section.instructorName}</p>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700">Schedules:</p>
                  {section.schedules && section.schedules.length > 0 ? (
                    section.schedules.map((slot, index) => (
                      <p key={index} className="text-sm text-gray-600">
                        {slot.day}: {slot.startTime} - {slot.endTime} ({slot.room})
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-gray-600">No schedules available</p>
                  )}
                </div>
                <button
                  onClick={() => toggleSubject(subject.id, section.id)}
                  className={`mt-4 w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedSubjects.includes(`${subject.id}-${section.id}`)
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {selectedSubjects.includes(`${subject.id}-${section.id}`) ? 'Deselect' : 'Select'}
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