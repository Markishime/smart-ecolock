import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LockClosedIcon,
  UserGroupIcon,
  CalendarIcon,
  BookmarkIcon,
  XMarkIcon,

} from '@heroicons/react/24/solid';

// Consistent Theme Color Palette
const colors = {
  primary: '#3949AB', // Indigo
  secondary: '#059669', // Emerald green
  background: '#F3F4F6', // Light gray
  card: '#FFFFFF', // White
  text: '#1F2937', // Dark gray
  textSecondary: '#4B5563', // Medium gray
  success: '#10B981', // Green
  warning: '#F59E0B', // Amber
  error: '#EF4444', // Red
  accent: '#6B7280', // DarkGray
};

// Framer Motion Variants
const cardTransition = {
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  department: string;
  subjects: Subject[];
  schedules: Schedule[];
  createdAt: string;
  sections: Section[];
}

interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  semester?: string;
}

interface Section {
  id: string;
  name: string;
  course: string;
  subjectCode: string;
  maxStudents: number;
  students: string[];
}

interface Schedule {
  id: string;
  days: string[];
  startTime: string;
  endTime: string;
  roomNumber: string;
  semester?: string;
  subjectCode: string;
}

const AdminPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('teachers');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [modalType, setModalType] = useState<'subjects' | 'schedules' | 'sections'>('subjects');

  const [formState, setFormState] = useState({
    subject: {
      code: '',
      name: '',
      description: '',
      credits: 3,
      semester: '',
    },
    schedule: {
      days: [] as string[],
      startTime: '',
      endTime: '',
      roomNumber: '',
      semester: '',
      subjectCode: '',
    },
    section: {
      name: '',
      course: '',
      subjectCode: '',
      maxStudents: 30,
      students: [],
    }
  });

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;

    const teachersQuery = query(collection(db, 'teachers'));
    const unsubscribe = onSnapshot(teachersQuery, (snapshot) => {
      const teachersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        subjects: doc.data().subjects || [],
        schedules: doc.data().schedules || [],
        sections: doc.data().sections || [],
      })) as Teacher[];
      setTeachers(teachersData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleRemoveSection = async (sectionId: string) => {
    if (!selectedTeacher) return;

    try {
      const teacherRef = doc(db, 'teachers', selectedTeacher.id);
      await updateDoc(teacherRef, {
        sections: selectedTeacher.sections.filter(section => section.id !== sectionId)
      });

      Swal.fire('Success', 'Section removed successfully!', 'success');
      setSelectedTeacher({
        ...selectedTeacher,
        sections: selectedTeacher.sections.filter(section => section.id !== sectionId)
      });
    } catch (error) {
      Swal.fire('Error', 'Failed to remove section', 'error');
    }
  };

  const handleFormSubmit = async () => {
    if (!selectedTeacher) return;

    try {
      const teacherRef = doc(db, 'teachers', selectedTeacher.id);
      
      switch(modalType) {
        case 'subjects':
          await updateDoc(teacherRef, {
            subjects: arrayUnion({ ...formState.subject, id: Date.now().toString() })
          });
          break;
        case 'schedules':
          await updateDoc(teacherRef, {
            schedules: arrayUnion({ ...formState.schedule, id: Date.now().toString() })
          });
          break;
        case 'sections':
          await updateDoc(teacherRef, {
            sections: arrayUnion({ ...formState.section, id: Date.now().toString() })
          });
          break;
      }

      Swal.fire('Success', `${modalType.slice(0, -1).toUpperCase()} added successfully!`, 'success');
      setSelectedTeacher(null);
    } catch (error) {
      Swal.fire('Error', `Failed to add ${modalType.slice(0, -1)}`, 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      Swal.fire('Logout Error', 'Failed to logout. Please try again.', 'error');
    }
  };

  const departments = Array.from(new Set(teachers.map(teacher => teacher.department)));

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-800 text-white shadow-lg fixed h-full z-20">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <LockClosedIcon className="w-8 h-8 text-indigo-200" />
            <h2 className="text-xl font-bold">Admin Panel</h2>
          </div>
        </div>
        <nav className="mt-8">
          <ul className="space-y-2 px-4">
            {['teachers', 'subjects', 'schedules'].map((tab) => (
              <li key={tab}>
                <button
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center space-x-3 w-full p-3 rounded-lg hover:bg-indigo-700 transition-colors ${
                    activeTab === tab ? 'bg-indigo-700' : ''
                  }`}
                >
                  {tab === 'teachers' && <UserGroupIcon className="w-6 h-6 text-indigo-200" />}
                  {tab === 'subjects' && <BookmarkIcon className="w-6 h-6 text-indigo-200" />}
                  {tab === 'schedules' && <CalendarIcon className="w-6 h-6 text-indigo-200" />}
                  <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

     {/* Main Content */}
     <div className="ml-64 p-6 flex-1">
        <header className="bg-white p-4 rounded-lg shadow-md mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Logout
          </button>
        </header>

    
 {/* Content Sections */}
 {activeTab === 'teachers' && (
          <div className="space-y-6">
            {departments.map(department => (
              <section key={department} className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">{department}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {teachers.filter(t => t.department === department).map(teacher => (
                    <motion.div
                      key={teacher.id}
                      whileHover={{ scale: 1.03 }}
                      className="p-6 bg-white rounded-lg shadow-md cursor-pointer"
                      onClick={() => setSelectedTeacher(teacher)}
                    >
                      <h3 className="text-lg font-semibold mb-2">{teacher.fullName}</h3>
                      <p className="text-sm text-gray-600">{teacher.email}</p>
                      <div className="mt-4 flex gap-2">
                        <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs">
                          📚 {teacher.subjects.length} Subjects
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-xs">
                          🕒 {teacher.schedules.length} Schedules
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded-full text-xs">
                          🏫 {teacher.sections.length} Sections
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        


{activeTab === 'subjects' && (
  <div className="space-y-6">
    {departments.map((department) => (
      <section 
        key={department} 
        className="p-6 rounded-lg shadow-md"
        style={{ 
          backgroundColor: colors.card,
          border: `2px solid ${colors.card}20`,
        }}
      >
        <h2 
          className="text-xl font-bold mb-4 p-3 rounded-lg"
          style={{ 
            backgroundColor: colors.card,
            color: 'black',
          }}
        >
          {department}
        </h2>
        {teachers
          .filter((teacher) => teacher.department === department)
          .map((teacher) => (
            <div key={teacher.id} className="mb-6">
              <h3 
                className="text-lg font-semibold mb-4"
                style={{ color: colors.secondary }}
              >
                {teacher.fullName}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teacher.subjects.map((subject) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: colors.background,
                      border: `2px solid ${colors.accent}20`,
                      ...cardTransition
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 
                          className="font-semibold mb-1"
                          style={{ color: colors.text }}
                        >
                          {subject.code} - {subject.name}
                        </h4>
                        <div className="flex gap-2 mb-2">
                          <span 
                            className="text-xs px-2 py-1 rounded-full"
                            style={{
                              backgroundColor: `${colors.warning}20`,
                              color: colors.warning,
                            }}
                          >
                            🎓 {subject.credits} Credits
                          </span>
                          {subject.semester && (
                            <span 
                              className="text-xs px-2 py-1 rounded-full"
                              style={{
                                backgroundColor: `${colors.success}20`,
                                color: colors.success,
                              }}
                            >
                              📅 {subject.semester}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {subject.description && (
                      <p 
                        className="text-sm mt-2"
                        style={{ color: colors.textSecondary }}
                      >
                        {subject.description}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
      </section>
    ))}
  </div>
)}

{activeTab === 'schedules' && (
  <div className="space-y-6">
    {departments.map((department) => (
      <section 
        key={department} 
        className="p-6 rounded-lg shadow-md"
        style={{ 
          backgroundColor: colors.card,
          border: `2px solid ${colors.primary}20`,
        }}
      >
        <h2 
          className="text-xl font-bold mb-4 p-3 rounded-lg"
          style={{ 
            backgroundColor: colors.card,
            color: 'black',
          }}
        >
          {department}
        </h2>
        {teachers
          .filter((teacher) => teacher.department === department)
          .map((teacher) => (
            <div key={teacher.id} className="mb-6">
              <h3 
                className="text-lg font-semibold mb-4"
                style={{ color: colors.secondary }}
              >
                {teacher.fullName}
              </h3>
              <div className="space-y-4">
                {Array.from(new Set(teacher.schedules.map((s) => s.subjectCode))).map((subjectCode) => {
                  const subject = teacher.subjects.find((s) => s.code === subjectCode);
                  const schedules = teacher.schedules.filter((s) => s.subjectCode === subjectCode);
                  
                  return (
                    <motion.div 
                      key={subjectCode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: colors.background,
                        border: `2px solid ${colors.accent}20`,
                        ...cardTransition
                      }}
                    >
                      <h4 
                        className="font-semibold text-lg mb-4"
                        style={{ color: colors.text }}
                      >
                        {subject ? `${subject.code} - ${subject.name}` : subjectCode}
                      </h4>
                      <div className="space-y-3">
                        {schedules.map((schedule) => (
                          <div 
                            key={schedule.id} 
                            className="p-3 rounded-md"
                            style={{
                              backgroundColor: colors.card,
                              border: `1px solid ${colors.primary}10`,
                            }}
                          >
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div className="flex items-center gap-1">
                                <span 
                                  className="font-medium"
                                  style={{ color: colors.textSecondary }}
                                >
                                  Days:
                                </span>
                                <div className="flex gap-1 flex-wrap">
                                  {schedule.days.map(day => (
                                    <span 
                                      key={day}
                                      className="px-2 py-1 rounded-full text-xs"
                                      style={{
                                        backgroundColor: `${colors.primary}20`,
                                        color: colors.primary,
                                      }}
                                    >
                                      {day}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span 
                                  className="font-medium"
                                  style={{ color: colors.textSecondary }}
                                >
                                  Time:
                                </span>
                                <span style={{ color: colors.text }}>
                                  {schedule.startTime} - {schedule.endTime}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span 
                                  className="font-medium"
                                  style={{ color: colors.textSecondary }}
                                >
                                  Room:
                                </span>
                                <span style={{ color: colors.text }}>
                                  {schedule.roomNumber}
                                </span>
                              </div>
                              {schedule.semester && (
                                <div className="flex items-center gap-1">
                                  <span 
                                    className="font-medium"
                                    style={{ color: colors.textSecondary }}
                                  >
                                    Semester:
                                  </span>
                                  <span 
                                    className="text-xs px-2 py-1 rounded-full"
                                    style={{
                                      backgroundColor: `${colors.success}20`,
                                      color: colors.success,
                                    }}
                                  >
                                    {schedule.semester}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
      </section>
    ))}
  </div>
)}
         {/* Management Modals */}
         {selectedTeacher && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-lg w-11/12 max-w-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Manage {selectedTeacher.fullName}</h2>
                <button
                  onClick={() => setSelectedTeacher(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="flex gap-4 mb-6">
                {['subjects', 'schedules', 'sections'].map(type => (
                  <button
                    key={type}
                    onClick={() => setModalType(type as any)}
                    className={`px-4 py-2 rounded-lg ${
                      modalType === type 
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {modalType === 'subjects' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Subject Code"
                      value={formState.subject.code}
                      onChange={e => setFormState({...formState, subject: {...formState.subject, code: e.target.value}})}
                      className="p-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Subject Name"
                      value={formState.subject.name}
                      onChange={e => setFormState({...formState, subject: {...formState.subject, name: e.target.value}})}
                      className="p-2 border rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="Credits"
                      value={formState.subject.credits}
                      onChange={e => setFormState({...formState, subject: {...formState.subject, credits: Number(e.target.value)}})}
                      className="p-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Semester"
                      value={formState.subject.semester}
                      onChange={e => setFormState({...formState, subject: {...formState.subject, semester: e.target.value}})}
                      className="p-2 border rounded-lg"
                    />
                  </div>
                  <textarea
                    placeholder="Description"
                    value={formState.subject.description}
                    onChange={e => setFormState({...formState, subject: {...formState.subject, description: e.target.value}})}
                    className="w-full p-2 border rounded-lg"
                    rows={3}
                  />
                </div>
              )}

              {modalType === 'schedules' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-wrap gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                        <button
                          key={day}
                          onClick={() => {
                            const days = formState.schedule.days.includes(day)
                              ? formState.schedule.days.filter(d => d !== day)
                              : [...formState.schedule.days, day];
                            setFormState({...formState, schedule: {...formState.schedule, days}});
                          }}
                          className={`px-3 py-1 rounded-lg ${
                            formState.schedule.days.includes(day)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <input
                      type="time"
                      value={formState.schedule.startTime}
                      onChange={e => setFormState({...formState, schedule: {...formState.schedule, startTime: e.target.value}})}
                      className="p-2 border rounded-lg"
                    />
                    <input
                      type="time"
                      value={formState.schedule.endTime}
                      onChange={e => setFormState({...formState, schedule: {...formState.schedule, endTime: e.target.value}})}
                      className="p-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Room Number"
                      value={formState.schedule.roomNumber}
                      onChange={e => setFormState({...formState, schedule: {...formState.schedule, roomNumber: e.target.value}})}
                      className="p-2 border rounded-lg"
                    />
                  </div>
                </div>
              )}

              {modalType === 'sections' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Section Name"
                      value={formState.section.name}
                      onChange={e => setFormState({...formState, section: {...formState.section, name: e.target.value}})}
                      className="p-2 border rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="Max Students"
                      value={formState.section.maxStudents}
                      onChange={e => setFormState({...formState, section: {...formState.section, maxStudents: Number(e.target.value)}})}
                      className="p-2 border rounded-lg"
                    />
                    <select
                      value={formState.section.course}
                      onChange={e => setFormState({...formState, section: {...formState.section, course: e.target.value}})}
                      className="p-2 border rounded-lg"
                    >
                      <option value="">Select Course</option>
                      {['BSIT', 'BSCS', 'BSIS', 'BSCE', 'BSCPE'].map(course => (
                        <option key={course} value={course}>{course}</option>
                      ))}
                    </select>
                    <select
                      value={formState.section.subjectCode}
                      onChange={e => setFormState({...formState, section: {...formState.section, subjectCode: e.target.value}})}
                      className="p-2 border rounded-lg"
                    >
                      <option value="">Select Subject</option>
                      {selectedTeacher.subjects.map(subject => (
                        <option key={subject.code} value={subject.code}>
                          {subject.code} - {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={handleFormSubmit}
                className="mt-6 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add {modalType.slice(0, -1).toUpperCase()}
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};


export default AdminPage;