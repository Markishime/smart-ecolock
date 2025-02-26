import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { theme } from '../styles/theme';
import { ClockIcon, CalendarIcon, BuildingOfficeIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (sectionData: any) => void;
}

interface Teacher {
  id: string;
  fullName: string;
  department: string;
}

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
  department: string;
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
  const [teachers, setTeachers] = useState<TeacherWithSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedInstructorSchedules, setSelectedInstructorSchedules] = useState<TeacherSchedule[]>([]);
  const [scheduleConflict, setScheduleConflict] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    instructorId: '',
    schedule: {
      days: [] as string[],
      startTime: '',
      endTime: ''
    }
  });

  useEffect(() => {
    fetchTeachersAndStudents();
  }, []);

  const fetchTeachersAndStudents = async () => {
    try {
      // Fetch teachers with their schedules
      const teachersSnapshot = await getDocs(collection(db, 'teachers'));
      const teachersData = await Promise.all(teachersSnapshot.docs.map(async doc => {
        const teacherData = doc.data();
        const schedules = teacherData.schedules || [];
        
        return {
          id: doc.id,
          ...teacherData,
          schedules: schedules.map((schedule: any) => ({
            id: schedule.id || '',
            days: Array.isArray(schedule.days) ? schedule.days : [],
            startTime: schedule.startTime || '',
            endTime: schedule.endTime || '',
            sectionCode: schedule.sectionCode || '',
            subject: schedule.subject || '',
            room: schedule.room || '',
            status: schedule.status || 'active',
            semester: schedule.semester || '',
            academicYear: schedule.academicYear || ''
          }))
        } as TeacherWithSchedule;
      }));
      
      setTeachers(teachersData);

      // Fetch students
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const studentsData = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      studentIds: selectedStudents
    });
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const checkScheduleConflict = (schedule: { days: string[]; startTime: string; endTime: string }) => {
    return selectedInstructorSchedules.some(existingSchedule => {
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
    if (formData.instructorId) {
      const selectedTeacher = teachers.find(t => t.id === formData.instructorId);
      setSelectedInstructorSchedules(selectedTeacher?.schedules || []);
    } else {
      setSelectedInstructorSchedules([]);
    }
  }, [formData.instructorId, teachers]);

  useEffect(() => {
    if (formData.schedule.days.length && formData.schedule.startTime && formData.schedule.endTime) {
      setScheduleConflict(checkScheduleConflict(formData.schedule));
    }
  }, [formData.schedule, selectedInstructorSchedules]);

  const formatScheduleTime = (schedule: TeacherSchedule) => {
    const days = schedule.days?.join(', ') || 'No days set';
    const time = schedule.startTime && schedule.endTime 
      ? `${schedule.startTime} - ${schedule.endTime}`
      : 'No time set';
    return `${days} | ${time}`;
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
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
      >
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className={theme.typography.h3}>Add New Section</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Basic Section Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={theme.components.input}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className={theme.components.input}
                required
              />
            </div>
          </div>

          {/* Instructor Selection with Schedule Display */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Instructor
              </label>
              <select
                value={formData.instructorId}
                onChange={(e) => setFormData({ ...formData, instructorId: e.target.value })}
                className={theme.components.input}
                required
              >
                <option value="">Select an instructor</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName} - {teacher.department}
                  </option>
                ))}
              </select>
            </div>

            {/* Enhanced Schedule Display */}
            {formData.instructorId && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">Current Teaching Load</h4>
                </div>
                
                {selectedInstructorSchedules.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {selectedInstructorSchedules.map((schedule, index) => (
                      <div 
                        key={index}
                        className="p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <h5 className="font-medium text-gray-900">
                                {schedule.subject || 'Untitled Subject'}
                              </h5>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                schedule.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {schedule.status || 'active'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              Section: {schedule.sectionCode || 'No Code'}
                            </p>
                            <div className="flex items-center text-sm text-gray-500 space-x-3">
                              <span className="flex items-center">
                                <ClockIcon className="w-4 h-4 mr-1" />
                                {schedule.startTime && schedule.endTime 
                                  ? `${schedule.startTime} - ${schedule.endTime}`
                                  : 'No time set'}
                              </span>
                              <span className="flex items-center">
                                <CalendarIcon className="w-4 h-4 mr-1" />
                                {Array.isArray(schedule.days) && schedule.days.length > 0
                                  ? schedule.days.join(', ')
                                  : 'No days set'}
                              </span>
                              {schedule.room && (
                                <span className="flex items-center">
                                  <BuildingOfficeIcon className="w-4 h-4 mr-1" />
                                  {schedule.room}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {[schedule.semester, schedule.academicYear]
                                .filter(Boolean)
                                .join(' | ') || 'No term info'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No current teaching schedules
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schedule Selection */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">Schedule Details</h4>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days
                  </label>
                  <select
                    multiple
                    value={formData.schedule.days}
                    onChange={(e) => setFormData({
                      ...formData,
                      schedule: {
                        ...formData.schedule,
                        days: Array.from(e.target.selectedOptions, option => option.value)
                      }
                    })}
                    className={`${theme.components.input} h-32`}
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.schedule.startTime}
                    onChange={(e) => setFormData({
                      ...formData,
                      schedule: { ...formData.schedule, startTime: e.target.value }
                    })}
                    className={theme.components.input}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.schedule.endTime}
                    onChange={(e) => setFormData({
                      ...formData,
                      schedule: { ...formData.schedule, endTime: e.target.value }
                    })}
                    className={theme.components.input}
                    required
                  />
                </div>
              </div>

              {scheduleConflict && (
                <div className="mt-4 flex items-center p-3 bg-red-50 text-red-700 rounded-lg">
                  <ExclamationCircleIcon className="w-5 h-5 mr-2" />
                  <span className="text-sm">
                    This schedule conflicts with the instructor's existing schedule
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Student Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Students
            </label>
            <div className="border rounded-lg max-h-48 overflow-y-auto p-2">
              {students.map(student => (
                <label
                  key={student.id}
                  className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="mr-3"
                  />
                  <span>{student.fullName} - {student.idNumber}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className={theme.components.button.secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={theme.components.button.primary}
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