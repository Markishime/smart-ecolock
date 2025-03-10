import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { BookOpenIcon, UserIcon, PlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import AdminSidebar from '../components/AdminSidebar';

interface Subject {
  id: string;
  name: string;
  department: string;
  status: 'active' | 'inactive';
  instructorId?: string;
}

interface Instructor {
  id: string;
  fullName: string;
  email: string;
  department: string;
  subjects?: string[];
}

const SubjectsManagement = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [newSubject, setNewSubject] = useState({ name: '', department: '', instructorId: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || localStorage.getItem('userRole') !== 'admin') {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch all subjects
        const subjectsRef = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        const subjectsData = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Subject));
        setSubjects(subjectsData);

        // Fetch all instructors
        const instructorsRef = collection(db, 'teachers');
        const instructorsSnapshot = await getDocs(instructorsRef);
        const instructorsData = instructorsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Instructor));
        setInstructors(instructorsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentUser, navigate]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.name || !newSubject.department) return;

    try {
      const subjectDoc = await addDoc(collection(db, 'subjects'), {
        name: newSubject.name,
        department: newSubject.department,
        status: 'active',
        instructorId: newSubject.instructorId || null,
      });

      if (newSubject.instructorId) {
        const instructorRef = doc(db, 'teachers', newSubject.instructorId);
        const instructorSnapshot = await getDocs(query(collection(db, 'teachers'), where('id', '==', newSubject.instructorId)));
        if (!instructorSnapshot.empty) {
          const instructorData = instructorSnapshot.docs[0].data() as Instructor;
          const updatedSubjects = [...(instructorData.subjects || []), newSubject.name].filter(
            (name, index, self) => name && self.indexOf(name) === index
          );
          await updateDoc(instructorRef, { subjects: updatedSubjects });
        }
      }

      setSubjects([
        ...subjects,
        {
          id: subjectDoc.id,
          name: newSubject.name,
          department: newSubject.department,
          status: 'active',
          instructorId: newSubject.instructorId || undefined,
        },
      ]);
      setNewSubject({ name: '', department: '', instructorId: '' });
      setSuccessMessage('Subject added successfully!');
      setTimeout(() => setSuccessMessage(null), 3000); // Clear message after 3 seconds
    } catch (error) {
      console.error('Error adding subject:', error);
    }
  };

  const handleAssignInstructor = async (subjectId: string, instructorId: string) => {
    if (!instructorId) return;

    try {
      const subjectRef = doc(db, 'subjects', subjectId);
      await updateDoc(subjectRef, { instructorId });

      const instructorRef = doc(db, 'teachers', instructorId);
      const subject = subjects.find((s) => s.id === subjectId);
      const instructorSnapshot = await getDocs(query(collection(db, 'teachers'), where('id', '==', instructorId)));
      if (!instructorSnapshot.empty) {
        const instructorData = instructorSnapshot.docs[0].data() as Instructor;
        const updatedSubjects = [...(instructorData.subjects || []), subject?.name].filter(
          (name, index, self) => name && self.indexOf(name) === index
        );
        await updateDoc(instructorRef, { subjects: updatedSubjects });
      }

      setSubjects(subjects.map((s) => (s.id === subjectId ? { ...s, instructorId } : s)));
      setSuccessMessage('Instructor assigned successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error assigning instructor:', error);
    }
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

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Admin Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <div className="flex-1 ml-64 p-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-extrabold text-gray-900 mb-10 flex items-center gap-3"
        >
          <BookOpenIcon className="h-10 w-10 text-indigo-600" />
          Subjects Management
        </motion.h1>

        {/* Success Message */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg flex items-center gap-2"
          >
            <CheckIcon className="h-6 w-6" />
            {successMessage}
          </motion.div>
        )}

        {/* Add Subject Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-8 mb-10 border border-gray-200"
        >
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <PlusIcon className="h-6 w-6 text-indigo-600" />
            Add New Subject
          </h2>
          <form onSubmit={handleAddSubject} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
              <input
                type="text"
                value={newSubject.name}
                onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="e.g., Mathematics"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                value={newSubject.department}
                onChange={(e) => setNewSubject({ ...newSubject, department: e.target.value })}
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="e.g., Science"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Instructor (Optional)</label>
              <select
                value={newSubject.instructorId}
                onChange={(e) => setNewSubject({ ...newSubject, instructorId: e.target.value })}
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <option value="">Select an instructor</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.fullName} ({instructor.department})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Add Subject
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* Subjects List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-8 border border-gray-200"
        >
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <BookOpenIcon className="h-6 w-6 text-indigo-600" />
            All Subjects
          </h2>
          {subjects.length > 0 ? (
            <div className="grid gap-6">
              {subjects.map((subject) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 rounded-lg bg-gray-50 border border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <p className="text-xl font-medium text-gray-900">{subject.name}</p>
                      <p className="text-sm text-gray-600">{subject.department}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Instructor:{' '}
                        <span className="font-medium">
                          {instructors.find((i) => i.id === subject.instructorId)?.fullName || 'Not assigned'}
                        </span>
                      </p>
                    </div>
                    <select
                      value={subject.instructorId || ''}
                      onChange={(e) => handleAssignInstructor(subject.id, e.target.value)}
                      className="w-full md:w-64 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    >
                      <option value="">Assign Instructor</option>
                      {instructors.map((instructor) => (
                        <option key={instructor.id} value={instructor.id}>
                          {instructor.fullName} ({instructor.department})
                        </option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-6">No subjects available.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default SubjectsManagement;