// src/components/AddSectionModal.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { theme } from '../styles/theme';

// Define interfaces for type safety
interface Instructor {
  id: string;
  fullName: string;
}

interface Subject {
  id: string; // Assuming subjects have an ID; adjust if it's just a name
  name: string;
}

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; instructorId: string; subjectId: string }) => void; // Updated to include subjectId
  instructors: Instructor[];
  subjects: Subject[]; // New prop for subjects
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({ isOpen, onClose, onSubmit, instructors, subjects }) => {
  const [sectionName, setSectionName] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(''); // New state for subject

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName || !selectedInstructor || !selectedSubject) return; // Guard clause for required fields

    onSubmit({
      name: sectionName,
      instructorId: selectedInstructor,
      subjectId: selectedSubject, // Include selected subject
    });

    resetForm();
  };

  // Reset form fields
  const resetForm = () => {
    setSectionName('');
    setSelectedInstructor('');
    setSelectedSubject('');
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
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className={theme.typography.h3}>Add New Section</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section Name
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className={theme.components.input}
              placeholder="e.g., BSIT-3A"
              required
              autoFocus
            />
          </div>

          {/* Instructor Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instructor
            </label>
            {instructors.length === 0 ? (
              <p className="text-red-500">No instructors available. Please add instructors first.</p>
            ) : (
              <select
                value={selectedInstructor}
                onChange={(e) => setSelectedInstructor(e.target.value)}
                className={theme.components.input}
                required
              >
                <option value="">Select Instructor</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Subject Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            {subjects.length === 0 ? (
              <p className="text-red-500">No subjects available.</p>
            ) : (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className={theme.components.input}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Buttons */}
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
              disabled={!sectionName || !selectedInstructor || !selectedSubject || instructors.length === 0 || subjects.length === 0}
            >
              Create Section
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AddSectionModal;