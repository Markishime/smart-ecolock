import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import Sidebar from '../components/Sidebar';
import { format } from 'date-fns';

interface Class {
  id: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  roomNumber: string;
  startTime: string;
  endTime: string;
  days: string[];
  instructorId: string;
  studentCount?: number;
}

const ClassesPage = () => {
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [departments, setDepartments] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!currentUser?.uid) return;

      try {
        // Get instructor's classes
        const classesQuery = query(
          collection(db, 'classes'),
          where('instructorId', '==', currentUser.uid)
        );
        const classesSnapshot = await getDocs(classesQuery);
        
        const classesData: Class[] = [];
        const uniqueDepartments = new Set<string>();

        // Process each class
        for (const doc of classesSnapshot.docs) {
          const classData = doc.data() as Class;
          
          // Get the subject details
          const subjectDoc = await getDocs(
            query(collection(db, 'subjects'), 
            where('code', '==', classData.subjectCode))
          );
          
          // Get student count for this class
          const studentsQuery = query(
            collection(db, 'enrollments'),
            where('classId', '==', doc.id)
          );
          const studentsSnapshot = await getDocs(studentsQuery);

          uniqueDepartments.add(classData.department);
          
          classesData.push({
            ...classData,
            id: doc.id,
            subjectName: subjectDoc.docs[0]?.data()?.name || 'Unknown Subject',
            studentCount: studentsSnapshot.size
          });
        }

        setClasses(classesData);
        setDepartments(Array.from(uniqueDepartments));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching classes:', error);
        setLoading(false);
      }
    };

    fetchClasses();
  }, [currentUser]);

  const getCurrentDayClasses = () => {
    const currentDay = format(selectedDate, 'EEEE').toLowerCase();
    return classes.filter(cls => cls.days.includes(currentDay));
  };

  const getDepartmentClasses = (department: string) => {
    return getCurrentDayClasses().filter(cls => cls.department === department);
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <div className="flex-1 p-8">
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">My Classes</h1>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-4 py-2 border rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {departments.map((department) => {
            const departmentClasses = getDepartmentClasses(department);
            if (departmentClasses.length === 0) return null;

            return (
              <div key={department} className="mb-8">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">
                  {department}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departmentClasses.map((cls) => (
                    <div
                      key={cls.id}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">
                            {cls.subjectName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {cls.subjectCode}
                          </p>
                        </div>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                          Room {cls.roomNumber}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Time:</span>
                          <span className="text-gray-800">
                            {cls.startTime} - {cls.endTime}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Students:</span>
                          <span className="text-gray-800">
                            {cls.studentCount || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Days:</span>
                          <span className="text-gray-800">
                            {cls.days.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {getCurrentDayClasses().length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                No classes scheduled for {format(selectedDate, 'EEEE, MMMM do, yyyy')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassesPage;
