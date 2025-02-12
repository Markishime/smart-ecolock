import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import Sidebar from '../components/Sidebar';
import {
  ClockIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

interface Schedule {
  id: string;
  subject: string;
  instructor: string;
  room: string;
  day: string;
  startTime: string;
  endTime: string;
  section: string;
  department: string;
}

const Schedule = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<{ id: string; name: string }[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState({
    subject: '',
    instructor: '',
    room: '',
    day: 'Monday',
    startTime: '',
    endTime: '',
    section: '',
    department: ''
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  useEffect(() => {
    fetchSchedules();
    fetchDepartments();
    fetchInstructors();
  }, []);

  const fetchSchedules = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'teachers'));
      const schedulesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Schedule[];
      setSchedules(schedulesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'teachers'));
      const departmentsData = querySnapshot.docs.map(doc => doc.data().name);
      setDepartments(departmentsData);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchInstructors = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'teachers'));
      const instructorsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().fullName
      }));
      setInstructors(instructorsData);
    } catch (error) {
      console.error('Error fetching instructors:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate time slots
      const start = parseInt(formData.startTime.split(':')[0]);
      const end = parseInt(formData.endTime.split(':')[0]);
      
      if (start >= end) {
        Swal.fire('Error', 'End time must be after start time', 'error');
        return;
      }

      // Check for schedule conflicts
      const conflicts = schedules.filter(schedule => {
        if (schedule.day !== formData.day) return false;
        if (editingSchedule && schedule.id === editingSchedule.id) return false;

        const scheduleStart = parseInt(schedule.startTime.split(':')[0]);
        const scheduleEnd = parseInt(schedule.endTime.split(':')[0]);

        return (
          (start >= scheduleStart && start < scheduleEnd) ||
          (end > scheduleStart && end <= scheduleEnd) ||
          (start <= scheduleStart && end >= scheduleEnd)
        );
      });

      if (conflicts.length > 0) {
        Swal.fire('Error', 'There is a schedule conflict with existing classes', 'error');
        return;
      }

      if (editingSchedule) {
        await updateDoc(doc(db, 'schedules', editingSchedule.id), formData);
        Swal.fire({
          icon: 'success',
          title: 'Schedule Updated',
          text: 'The schedule has been updated successfully.',
          background: '#f8fafc',
          iconColor: '#3b82f6',
          confirmButtonColor: '#3b82f6'
        });
      } else {
        await addDoc(collection(db, 'schedules'), formData);
        Swal.fire({
          icon: 'success',
          title: 'Schedule Added',
          text: 'New schedule has been created successfully.',
          background: '#f8fafc',
          iconColor: '#3b82f6',
          confirmButtonColor: '#3b82f6'
        });
      }
      setShowAddModal(false);
      setEditingSchedule(null);
      setFormData({
        subject: '',
        instructor: '',
        room: '',
        day: 'Monday',
        startTime: '',
        endTime: '',
        section: '',
        department: ''
      });
      fetchSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      Swal.fire('Error', 'Failed to save schedule', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        await deleteDoc(doc(db, 'schedules', id));
        setSchedules(prev => prev.filter(schedule => schedule.id !== id));
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Schedule has been deleted.',
          background: '#f8fafc',
          iconColor: '#3b82f6',
          confirmButtonColor: '#3b82f6'
        });
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      Swal.fire('Error', 'Failed to delete schedule', 'error');
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      subject: schedule.subject,
      instructor: schedule.instructor,
      room: schedule.room,
      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      section: schedule.section,
      department: schedule.department
    });
    setShowAddModal(true);
  };

  const filteredSchedules = schedules.filter(schedule => {
    const dayMatch = selectedDay === 'all' || schedule.day === selectedDay;
    const departmentMatch = selectedDepartment === 'all' || schedule.department === selectedDepartment;
    return dayMatch && departmentMatch;
  });

  // Group schedules by day for the calendar view
  const schedulesByDay = days.reduce((acc, day) => {
    acc[day] = filteredSchedules.filter(schedule => schedule.day === day);
    return acc;
  }, {} as { [key: string]: Schedule[] });

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'instructor')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="mt-2 text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      
      <div className={`flex-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-20' : 'ml-64'} overflow-y-auto`}>
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Class Schedule</h1>
              <p className="mt-2 text-gray-600">
                Manage and view class schedules
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Days</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>

              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              {(currentUser.role === 'admin' || currentUser.role === 'instructor') && (
                <button
                  onClick={() => {
                    setEditingSchedule(null);
                    setFormData({
                      subject: '',
                      instructor: '',
                      room: '',
                      day: 'Monday',
                      startTime: '',
                      endTime: '',
                      section: '',
                      department: ''
                    });
                    setShowAddModal(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Add Schedule</span>
                </button>
              )}
            </div>
          </div>

          {/* Calendar View */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {days.map(day => (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                >
                  <div className="bg-indigo-600 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white">{day}</h3>
                  </div>
                  
                  <div className="p-6">
                    {schedulesByDay[day]?.length > 0 ? (
                      <div className="space-y-4">
                        {schedulesByDay[day].map((schedule) => (
                          <div
                            key={schedule.id}
                            className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {schedule.subject}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {schedule.instructor}
                                </p>
                                <div className="mt-2 flex items-center text-sm text-gray-500">
                                  <ClockIcon className="w-4 h-4 mr-1" />
                                  {schedule.startTime} - {schedule.endTime}
                                </div>
                                <div className="mt-1 text-sm text-gray-500">
                                  Room: {schedule.room}
                                </div>
                                <div className="mt-1 text-sm text-gray-500">
                                  Section: {schedule.section}
                                </div>
                              </div>
                              
                              {(currentUser.role === 'admin' || currentUser.role === 'instructor') && (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleDelete(schedule.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEdit(schedule)}
                                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                  >
                                    <PencilIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No classes scheduled
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructor
                </label>
                <select
                  value={formData.instructor}
                  onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Instructor</option>
                  {instructors.map(instructor => (
                    <option key={instructor.id} value={instructor.name}>
                      {instructor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room
                </label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day
                </label>
                <select
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  {days.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Time</option>
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Time</option>
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Section
                </label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSchedule(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingSchedule ? 'Update Schedule' : 'Add Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
