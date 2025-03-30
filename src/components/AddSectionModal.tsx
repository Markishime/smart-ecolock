// AddSectionModal.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    code: string;
    instructorRfidUid: string;
    instructorId: string;
    subjectId: string;
    studentNames: string[];
  }) => void;
  instructors: { id: string; fullName: string; rfidUid: string }[];
  subjects: { id: string; name: string; code: string }[];
  students: { id: string; fullName: string }[];
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  instructors,
  subjects,
  students,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [instructorRfidUid, setInstructorRfidUid] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedInstructor = instructors.find((i) => i.rfidUid === instructorRfidUid);
    onSubmit({
      name,
      code,
      instructorRfidUid,
      instructorId: selectedInstructor?.id || '', // Pass the instructor's UID
      subjectId,
      studentNames: selectedStudentIds.map(
        (id) => students.find((s) => s.id === id)?.fullName || ''
      ),
    });
    setName('');
    setCode('');
    setInstructorRfidUid('');
    setSubjectId('');
    setSelectedStudentIds([]);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full mx-4"
      >
        <h2 className="text-xl font-bold mb-4">Add New Section</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Section Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Section Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Instructor</label>
            <select
              value={instructorRfidUid}
              onChange={(e) => setInstructorRfidUid(e.target.value)}
              className="mt-1 block w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="" disabled>
                Select Instructor
              </option>
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.rfidUid}>
                  {instructor.fullName} (RFID: {instructor.rfidUid})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="mt-1 block w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="" disabled>
                Select Subject
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Add Section
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AddSectionModal;