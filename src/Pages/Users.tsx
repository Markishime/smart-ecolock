import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, addDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserIcon,
  TrashIcon,
  PencilIcon,
  AcademicCapIcon,
  PlusIcon,
  ClockIcon,
  CheckIcon
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import AdminSidebar from '../components/AdminSidebar';


 // Particle Background Component
 const ParticleBackground: React.FC = () => {
  const particles = Array.from({ length: 30 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle, index) => (
        <motion.div
          key={index}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full"
          initial={{ x: `${particle.x}vw`, y: `${particle.y}vh`, opacity: 0.6 }}
          animate={{
            x: `${particle.x + particle.speedX * 50}vw`,
            y: `${particle.y + particle.speedY * 50}vh`,
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      ))}
    </div>
  );
};

interface User {
  id: string;
  fullName: string;
  email: string;
  role?: 'admin' | 'instructor' | 'student';
  department?: string;
  studentId?: string;
  uid?: string;
}

interface Subject {
  id: string;
  name: string;
  department: string;
  status: 'active' | 'inactive';
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  section: string;
  room?: string;
  subject?: string;
  instructorUid?: string;
}

interface InstructorDetails {
  subjects?: string[];
  schedules?: Schedule[];
}

interface Room {
  id: string;
  name: string;
  status?: 'available' | 'occupied';
}

interface Section {
  id: string;
  name: string;
  code: string;
  teacherId?: string;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'all' | 'admin' | 'instructor' | 'student'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'department'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<User | null>(null);
  const [instructorDetails, setInstructorDetails] = useState<InstructorDetails>({
    subjects: [],
    schedules: []
  });
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  // Fetch Users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const usersCollection = collection(db, 'users');
        const teachersCollection = collection(db, 'teachers');
        const studentsCollection = collection(db, 'students');

        const [usersSnapshot, teachersSnapshot, studentsSnapshot] = await Promise.all([
          getDocs(usersCollection),
          getDocs(teachersCollection),
          getDocs(studentsCollection)
        ]);

        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        const teachersData = teachersSnapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().fullName,
          email: doc.data().email,
          role: 'instructor',
          department: doc.data().department,
          uid: doc.data().uid
        } as User));
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          fullName: doc.data().fullName,
          email: doc.data().email,
          role: 'student',
          department: doc.data().department,
          studentId: doc.data().studentId,
          uid: doc.data().uid
        } as User));

        const combinedUsers = [
          ...usersData,
          ...teachersData.filter(teacher => !usersData.some(user => user.uid === teacher.uid)),
          ...studentsData.filter(student => !usersData.some(user => user.uid === student.uid))
        ];

        setUsers(combinedUsers);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching users:", error);
        Swal.fire('Error', 'Failed to fetch users', 'error');
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch Rooms
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomsCollection = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsCollection);
        const roomsData = roomsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          status: doc.data().status || 'available',
        } as Room));
        setRooms(roomsData.filter(room => room.status === 'available'));
      } catch (error) {
        console.error('Error fetching rooms:', error);
        Swal.fire({ icon: 'error', title: 'Fetch Error', text: 'Failed to fetch rooms' });
      }
    };

    fetchRooms();
  }, []);

  // Fetch Subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectsCollection = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Subject));
        setSubjects(subjectsData.filter(subject => subject.status === 'active'));
      } catch (error) {
        console.error('Error fetching subjects:', error);
        Swal.fire({ icon: 'error', title: 'Fetch Error', text: 'Failed to fetch subjects' });
      }
    };

    fetchSubjects();
  }, []);

  // Fetch Sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const sectionsCollection = collection(db, 'sections');
        const sectionsSnapshot = await getDocs(sectionsCollection);
        const sectionsData = sectionsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          code: doc.data().code,
          teacherId: doc.data().teacherId
        } as Section));
        setSections(sectionsData);
      } catch (error) {
        console.error('Error fetching sections:', error);
        Swal.fire({ icon: 'error', title: 'Fetch Error', text: 'Failed to fetch sections' });
      }
    };

    fetchSections();
  }, []);

  // Handle Delete User
  const handleDeleteUser = async (userId: string, userRole?: string) => {
    try {
      const collectionName = userRole === 'instructor' ? 'teachers' : userRole === 'student' ? 'students' : 'users';
      await deleteDoc(doc(db, collectionName, userId));
      Swal.fire({
        icon: 'success',
        title: 'User Deleted',
        text: 'The user has been successfully removed.',
        background: '#1e293b',
        iconColor: '#22d3ee',
        confirmButtonColor: '#0891b2'
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      Swal.fire('Error', 'Failed to delete user', 'error');
    }
  };

  // Handle Sort
  const handleSort = (field: 'name' | 'role' | 'department') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Handle Bulk Delete
  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedUsers.map(userId => {
          const user = users.find(u => u.id === userId);
          if (user) {
            const collectionName = user.role === 'instructor' ? 'teachers' : user.role === 'student' ? 'students' : 'users';
            return deleteDoc(doc(db, collectionName, userId));
          }
        })
      );
      setSelectedUsers([]);
      setShowDeleteModal(false);
      Swal.fire({
        icon: 'success',
        title: 'Users Deleted',
        text: 'Selected users have been removed successfully.',
        background: '#1e293b',
        iconColor: '#22d3ee',
        confirmButtonColor: '#0891b2'
      });
    } catch (error) {
      console.error("Error deleting users:", error);
      Swal.fire('Error', 'Failed to delete users', 'error');
    }
  };

  // Handle Assignment Modal
  const handleAssignmentModal = async (user: User) => {
    try {
      const teacherDoc = await getDoc(doc(db, 'teachers', user.id));
      const existingDetails = teacherDoc.data() as InstructorDetails || {};

      setSelectedInstructor(user);
      setSelectedTeacherId(user.id);
      setInstructorDetails({
        subjects: existingDetails.subjects || [],
        schedules: existingDetails.schedules?.map(schedule => ({
          ...schedule,
          instructorUid: user.uid
        })) || []
      });
      setIsAssignmentModalOpen(true);
    } catch (error) {
      console.error('Error fetching instructor details:', error);
      Swal.fire('Error', 'Failed to load instructor details', 'error');
    }
  };

  // Add New Schedule
  const addNewSchedule = () => {
    setInstructorDetails(prev => ({
      ...prev,
      schedules: [
        ...(prev.schedules || []),
        {
          day: '',
          startTime: '',
          endTime: '',
          section: '',
          room: '',
          subject: '',
          instructorUid: selectedInstructor?.uid
        }
      ]
    }));
  };

  // Handle Save Assignments
  const handleSaveAssignments = async () => {
    try {
      if (!selectedTeacherId) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Please select a teacher first' });
        return;
      }

      const subjectNames = (instructorDetails.subjects || [])
        .map(subjectId => {
          const subject = subjects.find(s => s.id === subjectId);
          return subject ? subject.name : '';
        })
        .filter(name => name !== '');

      const validSchedules = (instructorDetails.schedules || []).filter(
        schedule => schedule.startTime && schedule.endTime && schedule.section && schedule.day
      ).map(schedule => ({
        ...schedule,
        instructorUid: selectedInstructor?.uid
      }));

      const updateData = {
        subjects: subjectNames,
        schedules: validSchedules
      };

      const teacherDocRef = doc(db, 'teachers', selectedTeacherId);
      const teacherDoc = await getDoc(teacherDocRef);
      const teacherData = teacherDoc.data();

      await updateDoc(teacherDocRef, updateData);

      const subjectsRef = collection(db, 'subjects');
      const allSubjects = [
        ...subjectNames,
        ...(validSchedules.map(schedule => schedule.subject || '').filter(Boolean))
      ];

      for (const subjectName of allSubjects) {
        const subjectQuery = query(
          subjectsRef,
          where('name', '==', subjectName),
          where('department', '==', teacherData?.department)
        );
        const existingSubjects = await getDocs(subjectQuery);
        if (existingSubjects.empty) {
          await addDoc(subjectsRef, {
            name: subjectName,
            department: teacherData?.department || 'Unassigned',
            status: 'active',
            createdAt: new Date()
          });
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Assignments Saved',
        text: 'Teacher assignments and subjects have been successfully updated',
        timer: 2000,
        showConfirmButton: false,
        background: '#1e293b',
        iconColor: '#22d3ee',
        confirmButtonColor: '#0891b2'
      });
      setIsAssignmentModalOpen(false);
    } catch (error) {
      console.error('Error saving assignments:', error);
      Swal.fire({ icon: 'error', title: 'Save Error', text: error instanceof Error ? error.message : 'Failed to save teacher assignments' });
    }
  };

  // Update Schedule Subject
  const updateScheduleSubject = (index: number, subject: string) => {
    setInstructorDetails(prev => {
      const updatedSchedules = [...(prev.schedules || [])];
      updatedSchedules[index] = { ...updatedSchedules[index], subject };
      return { ...prev, schedules: updatedSchedules };
    });
  };

  const renderScheduleInputs = () => {
    return (instructorDetails.schedules || []).map((schedule, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="grid grid-cols-1 md:grid-cols-7 gap-6 mb-8 items-center bg-gray-700/50 p-4 rounded-lg border border-cyan-800"
      >
        <select
          value={schedule.day}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = { ...updatedSchedules[index], day: e.target.value };
            setInstructorDetails(prev => ({ ...prev, schedules: updatedSchedules }));
          }}
          className="col-span-1 w-full px-4 py-3 rounded-md bg-gray-600 text-cyan-100 border border-cyan-700 focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Select Day</option>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
        <input
          type="time"
          value={schedule.startTime}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = { ...updatedSchedules[index], startTime: e.target.value };
            setInstructorDetails(prev => ({ ...prev, schedules: updatedSchedules }));
          }}
          className="col-span-1 px-4 py-3 rounded-md bg-gray-600 text-cyan-100 border border-cyan-700 focus:ring-2 focus:ring-cyan-500"
        />
        <input
          type="time"
          value={schedule.endTime}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = { ...updatedSchedules[index], endTime: e.target.value };
            setInstructorDetails(prev => ({ ...prev, schedules: updatedSchedules }));
          }}
          className="col-span-1 px-4 py-3 rounded-md bg-gray-600 text-cyan-100 border border-cyan-700 focus:ring-2 focus:ring-cyan-500"
        />
        <select
          value={schedule.section}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = { ...updatedSchedules[index], section: e.target.value };
            setInstructorDetails(prev => ({ ...prev, schedules: updatedSchedules }));
          }}
          className="col-span-1 w-full px-4 py-3 rounded-md bg-gray-600 text-cyan-100 border border-cyan-700 focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Select Section</option>
          {sections.map(section => (
            <option key={section.id} value={section.name}>{section.name}</option>
          ))}
        </select>
        <select
          value={schedule.room || ''}
          onChange={(e) => {
            const updatedSchedules = [...(instructorDetails.schedules || [])];
            updatedSchedules[index] = { ...updatedSchedules[index], room: e.target.value };
            setInstructorDetails(prev => ({ ...prev, schedules: updatedSchedules }));
          }}
          className="col-span-1 w-full px-4 py-3 rounded-md bg-gray-600 text-cyan-100 border border-cyan-700 focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Select Room</option>
          {rooms.map(room => (
            <option key={room.id} value={room.name}>{room.name}</option>
          ))}
        </select>
        <select
          value={schedule.subject || ''}
          onChange={(e) => updateScheduleSubject(index, e.target.value)}
          className="col-span-1 w-full px-4 py-3 rounded-md bg-gray-600 text-cyan-100 border border-cyan-700 focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Select Subject</option>
          {subjects.map(subject => (
            <option key={subject.id} value={subject.name}>{subject.name}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setInstructorDetails(prev => ({
              ...prev,
              schedules: (prev.schedules || []).filter((_, i) => i !== index)
            }));
          }}
          className="col-span-1 flex items-center justify-center text-red-400 hover:text-red-500"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </motion.div>
    ));
  };

  // Filtered Users
  const filteredUsers = users
    .filter(user => 
      (selectedRole === 'all' || user.role === selectedRole) &&
      (selectedDepartment === 'all' || user.department?.toLowerCase() === selectedDepartment.toLowerCase()) &&
      (searchQuery === '' || 
        user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
    .sort((a, b) => {
      let valueA, valueB;
      switch (sortBy) {
        case 'name': valueA = a.fullName?.toLowerCase() || ''; valueB = b.fullName?.toLowerCase() || ''; break;
        case 'role': valueA = a.role?.toLowerCase() || ''; valueB = b.role?.toLowerCase() || ''; break;
        case 'department': valueA = a.department?.toLowerCase() || ''; valueB = b.department?.toLowerCase() || ''; break;
        default: valueA = ''; valueB = '';
      }
      return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    });

  const renderUserCard = (user: User) => (
    <motion.div
      key={user.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border ${selectedUsers.includes(user.id) ? 'border-cyan-400' : 'border-cyan-800'} hover:shadow-2xl transition-all relative overflow-hidden`}
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
      <motion.div
        className="absolute -inset-2 bg-cyan-500/20 blur-xl"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="checkbox"
              checked={selectedUsers.includes(user.id)}
              onChange={(e) => {
                if (e.target.checked) setSelectedUsers([...selectedUsers, user.id]);
                else setSelectedUsers(selectedUsers.filter(id => id !== user.id));
              }}
              className="rounded border-gray-600 text-cyan-400 focus:ring-cyan-500 bg-gray-700"
            />
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-blue-900/50' : user.role === 'instructor' ? 'bg-purple-900/50' : 'bg-green-900/50'}`}>
              {user.role === 'student' ? (
                <AcademicCapIcon className="w-6 h-6 text-cyan-400" />
              ) : (
                <UserIcon className={`w-6 h-6 text-cyan-400`} />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-cyan-100">{user.fullName || 'Unknown'}</h3>
              <p className="text-sm text-cyan-300">{user.email || 'No email'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {user.role === 'instructor' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAssignmentModal(user)}
                className="p-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center space-x-2"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Assign</span>
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleDeleteUser(user.id, user.role)}
              className="p-2 text-red-400 hover:text-red-500"
            >
              <TrashIcon className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-blue-700 text-cyan-100' : user.role === 'instructor' ? 'bg-purple-700 text-cyan-100' : user.role === 'student' ? 'bg-green-700 text-cyan-100' : 'bg-gray-700 text-cyan-300'}`}>
            {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}
          </span>
          {user.department && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-cyan-100">
              {user.department}
            </span>
          )}
          {user.studentId && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-700 text-cyan-100">
              ID: {user.studentId}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderAssignmentModal = () => {
    if (!isAssignmentModalOpen || !selectedInstructor) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-xl max-w-6xl w-full max-h-[80vh] overflow-y-auto border border-cyan-800"
        >
          <div className="p-8">
            <h3 className="text-2xl font-bold text-cyan-100 mb-6 flex items-center">
              <ClockIcon className="w-7 h-7 text-cyan-400 mr-3" />
              Assign Schedule for {selectedInstructor.fullName}
            </h3>
            <div className="space-y-6">
              {renderScheduleInputs()}
              <div className="flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={addNewSchedule}
                  className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center space-x-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Add New Schedule</span>
                </motion.button>
              </div>
            </div>
            <div className="mt-8 flex justify-end space-x-4 border-t border-cyan-800 pt-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsAssignmentModalOpen(false)}
                className="px-6 py-2 bg-gray-700 text-cyan-200 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSaveAssignments}
                className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 flex items-center"
              >
                <CheckIcon className="w-5 h-5 mr-2" />
                <span>Save Assignments</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const departments = Array.from(new Set(users.map(user => user.department || 'Unknown')));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono">
      <ParticleBackground />
      <AdminSidebar />
      <div className="ml-64 p-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-lg bg-gray-800/80 rounded-xl shadow-xl p-6 border border-cyan-800"
        >
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-cyan-100">Users Management</h1>
              <p className="mt-2 text-cyan-300">
                {filteredUsers.length} users found
              </p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-64 px-4 py-2 rounded-lg bg-gray-700 text-cyan-100 border border-cyan-800 focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4 mt-6">
            <div className="flex flex-wrap gap-4">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-cyan-100 border border-cyan-800 focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="instructor">Instructor</option>
                <option value="student">Student</option>
              </select>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-cyan-100 border border-cyan-800 focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept || 'Unknown'}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-4">
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value as typeof sortBy)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-cyan-100 border border-cyan-800 focus:ring-2 focus:ring-cyan-500"
              >
                <option value="name">Sort by Name</option>
                <option value="role">Sort by Role</option>
                <option value="department">Sort by Department</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 bg-gray-700 border border-cyan-800 hover:bg-gray-600 text-cyan-100 rounded-lg"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div className="mt-6 bg-cyan-900/30 p-4 rounded-lg flex items-center justify-between border border-cyan-800">
              <span className="text-cyan-100">
                {selectedUsers.length} users selected
              </span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Selected
              </motion.button>
            </div>
          )}
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map(renderUserCard)}
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-cyan-800"
            >
              <h3 className="text-xl font-semibold text-cyan-100 mb-4">
                Delete Selected Users
              </h3>
              <p className="text-cyan-300 mb-6">
                Are you sure you want to delete {selectedUsers.length} selected users? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-gray-700 text-cyan-200 rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Users
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {renderAssignmentModal()}
      </div>
    </div>
  );
};

export default Users;