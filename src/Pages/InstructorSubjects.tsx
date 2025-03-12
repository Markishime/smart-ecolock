import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import NavBar from '../components/NavBar';
import { motion } from 'framer-motion';
import {
  BookOpenIcon,
  UserGroupIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';

interface Subject {
  id: string;
  name: string;
  code: string;
  department?: string;
  teacherId?: string;
}

const InstructorSubjects = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime] = useState(new Date());

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Subscribe to subjects where teacherId matches currentUser.uid
    const subjectsQuery = query(
      collection(db, 'subjects'),
      where('teacherId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(subjectsQuery, (snapshot) => {
      const subjectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subject[];
      setSubjects(subjectsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        currentTime={currentTime}
        classStatus={{
          status: 'Active',
          color: 'bg-green-100 text-green-800',
          details: 'Viewing Subjects',
          fullName: currentUser?.displayName || 'Instructor'
        }}
        user={{
          role: 'instructor',
          fullName: currentUser?.displayName || 'Instructor',
          department: 'Department'
        }}
      />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
              <BookOpenIcon className="h-8 w-8 text-indigo-600 mr-3" />
              My Subjects
            </h1>

            {subjects.length === 0 ? (
              <div className="text-center py-12">
                <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Subjects Assigned</h3>
                <p className="text-gray-500 mt-2">
                  You don't have any subjects assigned to you yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subjects.map((subject) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {subject.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Code: {subject.code}
                        </p>
                      </div>
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <BookOpenIcon className="h-6 w-6 text-indigo-600" />
                      </div>
                    </div>

                    {subject.department && (
                      <div className="mt-4 flex items-center text-sm text-gray-600">
                        <UserGroupIcon className="h-4 w-4 mr-2" />
                        {subject.department}
                      </div>
                    )}

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => navigate(`/instructor/subjects/${subject.id}`)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        View Details →
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default InstructorSubjects; 