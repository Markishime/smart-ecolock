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
  roomName: string;
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

interface EnrolledSubject {
  subjectId: string;
  code: string;
  name: string;
  department: string;
  credits: number;
  details: string;
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
  section: Subject['sections'][number];
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

        // Fetch all active subjects
        const subjectsQuery = query(collection(db, 'subjects'), where('status', '==', 'active'));
        const subjectsSnapshot = await getDocs(subjectsQuery);
        const subjectsData = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          code: doc.data().code || '',
          credits: doc.data().credits || 0,
          department: doc.data().department || '',
          details: doc.data().details || '',
          name: doc.data().name || '',
          status: doc.data().status || 'inactive',
          sections: doc.data().sections?.map((sec: any) => ({
            id: sec.id || '',
            name: sec.name || '',
            code: sec.code || '',
            instructorId: sec.instructorId || '',
            instructorName: sec.instructorName || '',
            instructorRfidUid: sec.instructorRfidUid || '',
            schedules: sec.schedules || [],
            capacity: sec.capacity || 0,
            currentEnrollment: sec.currentEnrollment || 0,
          })) || [],
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

        // Prepare enrolled subjects with all subject details
        const enrolledSubjects: EnrolledSubject[] = allSubjectsWithSections
          .filter((item) => selectedSubjects.includes(`${item.subject.id}-${item.section.id}`))
          .map((item) => ({
            subjectId: item.subject.id,
            code: item.subject.code,
            name: item.subject.name,
            department: item.subject.department,
            credits: item.subject.credits,
            details: item.subject.details,
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

          // Update subjects collection with currentEnrollment
          const subjectDocRef = doc(db, 'subjects', subject.subjectId);
          const subjectSnapshot = await getDocs(
            query(collection(db, 'subjects'), where('__name__', '==', subject.subjectId))
          );
          if (!subjectSnapshot.empty) {
            const subjectDoc = subjectSnapshot.docs[0];
            const sections = subjectDoc.data().sections || [];
            const updatedSections = sections.map((sec: Subject['sections'][number]) =>
              sec.id === subject.sectionId
                ? { ...sec, currentEnrollment: (sec.currentEnrollment || 0) + 1 }
                : sec
            );
            await updateDoc(subjectDocRef, { sections: updatedSections });
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-400">
        No student data found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <StudentNavbar student={studentData} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Select Your Subjects
          </h1>
          <p className="mt-2 text-lg text-gray-300">
            Choose the subjects you want to enroll in for this semester. Your selections will be saved to your dashboard.
          </p>
        </motion.div>

        {/* Subjects Grid */}
        {allSubjectsWithSections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allSubjectsWithSections.map(({ subject, section }, index) => (
              <motion.div
                key={`${subject.id}-${section.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-6 rounded-3xl shadow-2xl border transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] ${
                  selectedSubjects.includes(`${subject.id}-${section.id}`)
                    ? 'bg-gray-700/50 border-blue-400/30'
                    : 'bg-gray-800 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">{subject.name}</h2>
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className={`p-2 rounded-full ${
                      selectedSubjects.includes(`${subject.id}-${section.id}`)
                        ? 'bg-blue-500/20'
                        : 'bg-gray-600/20'
                    }`}
                  >
                    <svg
                      className={`h-5 w-5 ${
                        selectedSubjects.includes(`${subject.id}-${section.id}`)
                          ? 'text-blue-400'
                          : 'text-gray-400'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </motion.div>
                </div>
                <p className="text-sm text-gray-400">Code: {subject.code}</p>
                <p className="text-sm text-gray-400">Department: {subject.department}</p>
                <p className="text-sm text-gray-400">Credits: {subject.credits}</p>
                <p className="text-sm text-gray-400">Details: {subject.details}</p>
                <p className="text-sm text-gray-400">Section: {section.name}</p>
                <p className="text-sm text-gray-400">Section Code: {section.code}</p>
                <p className="text-sm text-gray-400">Instructor: {section.instructorName}</p>
                <p className="text-sm text-gray-400">
                  Enrollment: {section.currentEnrollment}/{section.capacity}
                </p>
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-300">Schedules:</p>
                  {section.schedules && section.schedules.length > 0 ? (
                    section.schedules.map((slot, index) => (
                      <p key={index} className="text-sm text-gray-400">
                        {slot.day}: {slot.startTime} - {slot.endTime} (Room: {slot.roomName})
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">No schedules available</p>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const key = `${subject.id}-${section.id}`;
                    const isSelected = selectedSubjects.includes(key);
                    const selectedSubject = allSubjectsWithSections.find(
                      (item) => item.subject.id === subject.id && item.section.id === section.id
                    );
                    if (!isSelected && selectedSubject && selectedSubject.section.currentEnrollment >= selectedSubject.section.capacity) {
                      alert(`The section ${section.name} for ${subject.name} is already full.`);
                      return;
                    }
                    toggleSubject(subject.id, section.id);
                  }}
                  className={`mt-6 w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    selectedSubjects.includes(`${subject.id}-${section.id}`)
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {selectedSubjects.includes(`${subject.id}-${section.id}`) ? 'Deselect' : 'Select'}
                </motion.button>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center text-lg">No subjects available.</p>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 flex justify-end gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/student/dashboard')}
            className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all duration-200 font-medium shadow-md"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={selectedSubjects.length === 0}
            className={`px-6 py-3 rounded-lg font-medium shadow-md transition-all duration-200 ${
              selectedSubjects.length > 0
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Save Selection
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default SubjectSelection;