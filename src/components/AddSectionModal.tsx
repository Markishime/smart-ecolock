import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { theme } from '../styles/theme';
import { ClockIcon, CalendarIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  schedule?: {
    day: string;
    startTime: string;
    endTime: string;
    room: string;
    section: string;
    subject: string;
  }[];
}

interface TeacherSchedule {
  id: string;
  days?: string[];
  startTime: string;
  endTime: string;
  sectionCode: string;
  subject: string;
  room?: string;
  status: 'active' | 'inactive';
  semester?: string;
  academicYear?: string;
}

interface TeacherWithSchedule extends Teacher {
  schedules?: TeacherSchedule[];
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [sectionName, setSectionName] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [instructors, setInstructors] = useState<Teacher[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [scheduleConflict, setScheduleConflict] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchInstructors();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedInstructor) {
      const instructor = instructors.find(i => i.id === selectedInstructor);
      setAvailableSchedules(instructor?.schedule || []);
      setSelectedSchedule(null);
    } else {
      setAvailableSchedules([]);
      setSelectedSchedule(null);
    }
  }, [selectedInstructor, instructors]);

  const fetchInstructors = async () => {
    try {
      setIsLoading(true);
      const instructorsRef = collection(db, 'teachers');
      const instructorsSnapshot = await getDocs(instructorsRef);
      
      if (instructorsSnapshot.empty) {
        console.log('No instructors found in the database');
        setInstructors([]);
        setIsLoading(false);
        return;
      }
      
      console.log(`Found ${instructorsSnapshot.docs.length} instructors in the database`);
      
      const instructorsWithSchedules = await Promise.all(
        instructorsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          const instructorId = doc.id;
          
          const schedulesRef = collection(db, 'schedules');
          const schedulesQuery = query(
            schedulesRef,
            where('instructorId', '==', instructorId)
          );
          
          const schedulesSnapshot = await getDocs(schedulesQuery);
          const schedules = schedulesSnapshot.docs.map(scheduleDoc => ({
            id: scheduleDoc.id,
            ...scheduleDoc.data()
          })) as TeacherSchedule[];
          
          console.log(`Instructor ${data.fullName || 'Unknown'} has ${schedules.length} schedules`);
          
          return {
            id: instructorId,
            fullName: data.fullName || 'Unknown',
            email: data.email || '',
            schedule: data.schedule || [],
            schedules: schedules
          } as TeacherWithSchedule;
        })
      );
      
      setInstructors(instructorsWithSchedules);
    } catch (error) {
      console.error('Error fetching instructors:', error);
      toast.error('Failed to load instructors. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) {
      alert('Please select a schedule');
      return;
    }
    onSubmit({
      name: sectionName,
      instructorId: selectedInstructor,
      schedule: selectedSchedule
    });
    resetForm();
  };

  const resetForm = () => {
    setSectionName('');
    setSelectedInstructor('');
    setSelectedSchedule(null);
  };

  const checkScheduleConflict = (schedule: { days: string[]; startTime: string; endTime: string }) => {
    return availableSchedules.some(existingSchedule => {
      if (!existingSchedule.days || !schedule.days) return false;
      
      const hasCommonDays = schedule.days.some(day => 
        existingSchedule.days?.includes(day)
      );
      if (!hasCommonDays) return false;

      const newStart = new Date(`2000/01/01 ${schedule.startTime}`);
      const newEnd = new Date(`2000/01/01 ${schedule.endTime}`);
      const existingStart = new Date(`2000/01/01 ${existingSchedule.startTime || '00:00'}`);
      const existingEnd = new Date(`2000/01/01 ${existingSchedule.endTime || '23:59'}`);

      return (
        (newStart >= existingStart && newStart < existingEnd) ||
        (newEnd > existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      );
    });
  };

  useEffect(() => {
    if (selectedSchedule) {
      setScheduleConflict(checkScheduleConflict(selectedSchedule));
    }
  }, [selectedSchedule, availableSchedules]);

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
          <h2 className={theme.typography.h3}>Add New Section</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section Name
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className={theme.components.input}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instructor
            </label>
            <select
              value={selectedInstructor}
              onChange={(e) => setSelectedInstructor(e.target.value)}
              className={theme.components.input}
              required
            >
              <option value="">Select Instructor</option>
              {instructors.map(instructor => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.fullName}
                </option>
              ))}
            </select>
          </div>

          {selectedInstructor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule
              </label>
              <select
                value={selectedSchedule ? JSON.stringify(selectedSchedule) : ''}
                onChange={(e) => setSelectedSchedule(e.target.value ? JSON.parse(e.target.value) : null)}
                className={theme.components.input}
                required
              >
                <option value="">Select Schedule</option>
                {availableSchedules.map((schedule, index) => (
                  <option key={index} value={JSON.stringify(schedule)}>
                    {schedule.subject} - {schedule.day} ({schedule.startTime} - {schedule.endTime})
                  </option>
                ))}
              </select>
            </div>
          )}

          {scheduleConflict && (
            <div className="mt-4 flex items-center p-3 bg-red-50 text-red-700 rounded-lg">
              <ExclamationCircleIcon className="w-5 h-5 mr-2" />
              <span className="text-sm">
                This schedule conflicts with the instructor's existing schedule
              </span>
            </div>
          )}

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
              disabled={!sectionName || !selectedInstructor || !selectedSchedule || scheduleConflict}
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