import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from '../components/AdminSidebar';
import Modal from '../components/Modal';
import { UserGroupIcon, PlusIcon, AcademicCapIcon, FunnelIcon } from '@heroicons/react/24/solid';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  department: string;
  subjects: string[];
  schedules: any[];
  photoURL?: string;
  status: 'active' | 'inactive';
  dateJoined: string;
}

interface Subject {
  id: string;
  name: string;
}

const TeachersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  

  useEffect(() => {
    const fetchSubjectsAndTeachers = async () => {
      try {
        // Fetch subjects
        const subjectsCollection = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Subject));

        // Fetch teachers
        const teachersCollection = collection(db, 'teachers');
        const teachersSnapshot = await getDocs(teachersCollection);
        
        const teachersData = teachersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Teacher));

        // Extract unique departments
        const uniqueDepartments = Array.from(
          new Set(teachersData.map(teacher => teacher.department))
        ).filter(Boolean);

        setSubjects(subjectsData);
        setTeachers(teachersData);
        setDepartments(uniqueDepartments);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load teachers');
        setIsLoading(false);
      }
    };

    fetchSubjectsAndTeachers();
  }, []);

  useEffect(() => {
    filterTeachers();
  }, [selectedDepartment, teachers, searchQuery]);

  const filterTeachers = () => {
    let filtered = [...teachers];

    // Apply department filter
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(teacher => teacher.department === selectedDepartment);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        teacher =>
          teacher.fullName.toLowerCase().includes(query) ||
          teacher.email.toLowerCase().includes(query) ||
          teacher.department.toLowerCase().includes(query)
      );
    }

    setFilteredTeachers(filtered);
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (window.confirm('Are you sure you want to delete this teacher?')) {
      try {
        await deleteDoc(doc(db, 'teachers', teacherId));
        setTeachers(prev => prev.filter(teacher => teacher.id !== teacherId));
        toast.success('Teacher deleted successfully');
      } catch (error) {
        console.error('Error deleting teacher:', error);
        toast.error('Failed to delete teacher');
      }
    }
  };

  const getSubjectNames = (subjectIds: string[] = []): string[] => {
    return subjectIds.map(id => {
      const subject = subjects.find(s => s.id === id);
      return subject ? subject.name : id;
    });
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <AdminSidebar />
      
      <div className="flex-1 transition-all duration-300 ml-[80px] lg:ml-64 p-8 overflow-y-auto">
        <div className="container mx-auto">
          {/* Header Section */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-blue-800 flex items-center">
                <UserGroupIcon className="h-10 w-10 mr-3 text-blue-600" />
                Teachers Management
              </h1>
              <p className="text-gray-600 mt-2">
                Manage and view all registered instructors
              </p>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Teacher
            </button>
          </div>

          {/* Filters Section */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Teachers
                </label>
                <input
                  type="text"
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <div className="bg-blue-50 rounded-lg p-4 w-full">
                  <div className="text-sm font-medium text-gray-700">
                    Total Teachers
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredTeachers.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Teachers Table */}
          <div className="bg-white rounded-xl shadow-md p-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="border-b hover:bg-blue-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            {teacher.photoURL ? (
                              <img 
                                src={teacher.photoURL} 
                                alt={teacher.fullName}
                                className="h-8 w-8 rounded-full mr-3"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                <UserGroupIcon className="h-4 w-4 text-blue-600" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{teacher.fullName}</div>
                              <div className="text-sm text-gray-500">
                                Joined {new Date(teacher.dateJoined).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            <AcademicCapIcon className="h-4 w-4 mr-1" />
                            {teacher.department}
                          </span>
                        </td>
                        <td className="py-3 px-4">{teacher.email}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            teacher.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {teacher.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {getSubjectNames(teacher.subjects).map((subjectName, index) => (
                              <span 
                                key={index}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {subjectName}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredTeachers.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-gray-500">No teachers found</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Teacher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Teacher"
      >
        {/* Add teacher form will be implemented here */}
        <div className="p-6">
          <p>Teacher form coming soon...</p>
        </div>
      </Modal>
    </div>
  );
};

export default TeachersPage;
