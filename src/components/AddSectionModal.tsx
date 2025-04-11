import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string;
}

interface Room {
  id: string;
  name: string;
}

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    id?: string; // Optional for adding, required for editing
    name: string;
    code: string;
    instructorRfidUid: string;
    instructorId: string;
    subjectId: string;
    schedules: Schedule[];
  }) => void;
  instructors: { id: string; fullName: string; rfidUid: string }[];
  subjects: { id: string; name: string; code: string }[];
  initialData?: {
    id?: string;
    name: string;
    code: string;
    instructorRfidUid: string;
    instructorId: string;
    subjectId: string;
    schedules: Schedule[];
  };
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  instructors,
  subjects,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [selectedInstructorId, setSelectedInstructorId] = useState(initialData?.instructorId || '');
  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
  const [schedules, setSchedules] = useState<Schedule[]>(
    initialData?.schedules?.length
      ? initialData.schedules
      : [{ day: '', startTime: '', endTime: '', roomName: '' }]
  );
  const [rooms, setRooms] = useState<Room[]>([]);

  // Fetch rooms from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'rooms'),
      (snapshot) => {
        const roomsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || 'Unnamed Room',
        })) as Room[];
        setRooms(roomsData);
      },
      (error) => {
        console.error('Error fetching rooms:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sync form state with initialData or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Editing mode: Populate with initial data
        setName(initialData.name);
        setCode(initialData.code);
        setSelectedInstructorId(initialData.instructorId || '');
        setSubjectId(initialData.subjectId);
        setSchedules(
          initialData.schedules?.length
            ? initialData.schedules
            : [{ day: '', startTime: '', endTime: '', roomName: '' }]
        );
      } else {
        // Adding mode: Reset to defaults
        setName('');
        setCode('');
        setSelectedInstructorId('');
        setSubjectId('');
        setSchedules([{ day: '', startTime: '', endTime: '', roomName: '' }]);
      }
      // Log instructors for debugging
      console.log('Instructors available in modal:', instructors);
    }
  }, [isOpen, initialData, instructors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedInstructor = instructors.find((i) => i.id === selectedInstructorId);
    if (!selectedInstructor) {
      alert('Please select a valid instructor.');
      return;
    }

    const sectionData = {
      ...(initialData?.id && { id: initialData.id }), // Include id only if editing
      name,
      code,
      instructorRfidUid: selectedInstructor.rfidUid,
      instructorId: selectedInstructor.id,
      subjectId,
      schedules: schedules
        .map((s) => ({
          ...s,
          roomName: rooms.find((room) => room.name === s.roomName)?.name || s.roomName,
        }))
        .filter((s) => s.day && s.startTime && s.endTime && s.roomName),
    };

    console.log('Submitting section data:', sectionData);
    onSubmit(sectionData);
    onClose();
  };

  const addSchedule = () => {
    setSchedules([...schedules, { day: '', startTime: '', endTime: '', roomName: '' }]);
  };

  const handleScheduleChange = (index: number, field: keyof Schedule, value: string) => {
    const updatedSchedules = schedules.map((schedule, i) =>
      i === index ? { ...schedule, [field]: value } : schedule
    );
    setSchedules(updatedSchedules);
  };

  const removeSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Edit Section' : 'Add New Section'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Section Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
              required
              placeholder="e.g., Section A"
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
              placeholder="e.g., SEC001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Instructor</label>
            <select
              value={selectedInstructorId}
              onChange={(e) => {
                console.log('Selected instructor ID:', e.target.value);
                setSelectedInstructorId(e.target.value);
              }}
              className="mt-1 block w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="" disabled>
                Select an Instructor
              </option>
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
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
                Select a Subject
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Schedules</label>
              <button
                type="button"
                onClick={addSchedule}
                className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm"
              >
                <PlusIcon className="w-4 h-4 mr-1" /> Add Schedule
              </button>
            </div>
            {schedules.map((schedule, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-2 mb-2 items-center">
                <select
                  value={schedule.day}
                  onChange={(e) => handleScheduleChange(index, 'day', e.target.value)}
                  className="w-full md:w-1/4 p-2 border rounded-lg"
                >
                  <option value="">Day</option>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={schedule.startTime}
                  onChange={(e) => handleScheduleChange(index, 'startTime', e.target.value)}
                  className="w-full md:w-1/4 p-2 border rounded-lg"
                />
                <input
                  type="time"
                  value={schedule.endTime}
                  onChange={(e) => handleScheduleChange(index, 'endTime', e.target.value)}
                  className="w-full md:w-1/4 p-2 border rounded-lg"
                />
                <select
                  value={schedule.roomName}
                  onChange={(e) => handleScheduleChange(index, 'roomName', e.target.value)}
                  className="w-full md:w-1/4 p-2 border rounded-lg"
                >
                  <option value="">Select Room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.name}>
                      {room.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeSchedule(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {initialData ? 'Update Section' : 'Add Section'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AddSectionModal;