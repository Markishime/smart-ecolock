// src/components/AssignStudentsModal.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { theme } from '../styles/theme';

interface AssignStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentIds: string[]) => void;
  students: any[]; // List of students to select from
}

const AssignStudentsModal: React.FC<AssignStudentsModalProps> = ({ isOpen, onClose, onSubmit, students }) => {
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId) 
        : [...prev, studentId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedStudents);
    resetForm();
  };

  const resetForm = () => {
    setSelectedStudents([]);
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
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden"
      >
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className={theme.typography.h3}>Assign Students</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            {students.map(student => (
              <div key={student.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.id)}
                  onChange={() => toggleStudentSelection(student.id)}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">{student.fullName}</label>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-4 pt-6 mt-6 border-t">
            <button
              type="button"
              onClick={() => {
                onClose();
                resetForm();
              }}
              className={theme.components.button.secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={theme.components.button.primary}
              disabled={selectedStudents.length === 0}
            >
              Assign Students
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AssignStudentsModal;