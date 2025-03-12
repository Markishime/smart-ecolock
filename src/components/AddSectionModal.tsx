// src/components/AddSectionModal.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { theme } from '../styles/theme';
import Modal from './Modal';

// Define interfaces for type safety
interface Instructor {
  id: string;
  fullName: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; instructorId: string; subjectId: string }) => void;
  instructors: Instructor[];
  subjects: Subject[];
}

const AddSectionModal = ({ isOpen, onClose, onSubmit, instructors, subjects }: AddSectionModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    instructorId: '',
    subjectId: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ name: '', code: '', instructorId: '', subjectId: '' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Section">
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Section Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter section name"
            required
          />
        </div>

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
            Section Code
          </label>
          <input
            type="text"
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter section code"
            required
          />
        </div>

        <div>
          <label htmlFor="instructor" className="block text-sm font-medium text-gray-700 mb-2">
            Instructor
          </label>
          <select
            id="instructor"
            value={formData.instructorId}
            onChange={(e) => setFormData({ ...formData, instructorId: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          >
            <option value="">Select an instructor</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.fullName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
            Subject
          </label>
          <select
            id="subject"
            value={formData.subjectId}
            onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          >
            <option value="">Select a subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} ({subject.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create Section
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddSectionModal;