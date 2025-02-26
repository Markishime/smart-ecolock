import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { theme } from '../styles/theme';

interface AddStudentToSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentIds: string[]) => void;
  currentStudentIds: string[];
  sectionName: string;
}

interface Student {
  id: string;
  fullName: string;
  email: string;
  idNumber: string;
  major: string;
  mobileNumber: string;
  role: string;
  schedule?: {
    days: string[];
    endTime: string;
    startTime: string;
  };
  section?: string;
  sections?: {
    uid: string;
    yearLevel: string;
  }[];
  yearLevel?: string;
  createdAt: string;
}

const AddStudentToSectionModal: React.FC<AddStudentToSectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentStudentIds,
  sectionName
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const majors = [...new Set(students.map(s => s.major))].sort();

  useEffect(() => {
    if (isOpen) {
      fetchAvailableStudents();
    }
  }, [isOpen]);

  const fetchAvailableStudents = async () => {
    try {
      setIsLoading(true);
      const studentsRef = collection(db, 'students');
      const studentsQuery = query(
        studentsRef,
        where('role', '==', 'student'),
        where('section', 'in', [null, '']),
      );
      
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentsData = studentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          fullName: data.fullName || '',
          email: data.email || '',
          idNumber: data.idNumber || '',
          major: data.major || '',
          mobileNumber: data.mobileNumber || '',
          role: data.role || 'student',
          schedule: data.schedule || { days: [], endTime: '', startTime: '' },
          section: data.section || null,
          sections: data.sections || [],
          yearLevel: data.yearLevel || '',
          createdAt: data.createdAt || ''
        } as Student;
      });

      const sortedStudents = studentsData.sort((a, b) => 
        a.fullName.localeCompare(b.fullName)
      );

      setStudents(sortedStudents);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching students:', error);
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(student => 
    !currentStudentIds.includes(student.id) &&
    (
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.idNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.major.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.yearLevel?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const finalFilteredStudents = filteredStudents.filter(student =>
    selectedDepartment === 'all' || student.major === selectedDepartment
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedStudents);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className={theme.typography.h3}>Add Students</h2>
            <p className="text-sm text-gray-600">to {sectionName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Search */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Program
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className={theme.components.input}
              >
                <option value="all">All Programs</option>
                {majors.map(major => (
                  <option key={major} value={major}>{major}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Students
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${theme.components.input} pl-10`}
                />
              </div>
            </div>
          </div>

          {/* Students List */}
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : finalFilteredStudents.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {finalFilteredStudents.map(student => (
                    <label
                      key={student.id}
                      className="flex items-center p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="mr-4 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">{student.fullName}</h4>
                          <span className="text-sm text-gray-500">{student.yearLevel}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{student.idNumber}</span>
                            <span>•</span>
                            <span>{student.major}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {student.email}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No available students found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 p-6 border-t">
          <button
            type="button"
            onClick={onClose}
            className={theme.components.button.secondary}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedStudents.length === 0}
            className={`${theme.components.button.primary} ${
              selectedStudents.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Add Selected Students
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AddStudentToSectionModal; 