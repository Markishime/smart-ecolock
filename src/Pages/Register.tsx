import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot 
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LockClosedIcon, 
  CheckIcon, 
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon 
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { Link, useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    role: 'student',
    fullName: '',
    idNumber: '',
    email: '',
    mobileNumber: '',
    department: '',
    major: '',
    yearLevel: '1',
    yearsOfExperience: '',
    password: '',
    confirmPassword: '',
    sections: [] as string[],
    schedule: {
      days: [] as string[],
      startTime: '',
      endTime: ''
    }
  });

  const [availableData, setAvailableData] = useState({
    subjects: [] as string[],
    sections: [] as string[],
    departments: [] as string[],
    courses: [] as string[]
  });

  const [inputFocus, setInputFocus] = useState({
    fullName: false,
    idNumber: false,
    email: false,
    mobileNumber: false,
    department: false,
    yearsOfExperience: false,
    password: false,
    confirmPassword: false,
    yearLevel: false,
    role: false,
    major: false,
    sections: false,
    scheduleDays: false,
    scheduleTime: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidations, setPasswordValidations] = useState({
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasMinLength: false
  });

  const navigate = useNavigate();

  useEffect(() => {
    // Real-time listeners for available data
    const fetchRealTimeData = () => {
      // Subjects (Teachers) Listener
      const subjectsQuery = collection(db, 'teachers');
      const unsubscribeSubjects = onSnapshot(subjectsQuery, (snapshot) => {
        const subjects = snapshot.docs
          .map(doc => doc.data().name)
          .filter(name => name); // Filter out empty names
        setAvailableData(prev => ({ ...prev, subjects }));
      });

      // Sections Listener
      const sectionsQuery = collection(db, 'sections');
      const unsubscribeSections = onSnapshot(sectionsQuery, (snapshot) => {
        const sections = snapshot.docs
          .map(doc => doc.data().name)
          .filter(name => name); // Filter out empty names
        setAvailableData(prev => ({ ...prev, sections }));
      });

      // Predefined Departments and Courses
      const departments = [
        'Computer Science',
        'Information Technology',
        'Electrical Engineering',
        'Computer Engineering',
        'Civil Engineering',
        'Industrial Engineering',
        'Mechanical Engineering',
        'Chemical Engineering'
      ];

      const courses = [
        'Computer Science',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Architecture',
        'Computer Engineering',
        'Industrial Engineering',
        'Nursing',
        'Hospitality Management',
        'Information Technology',
        'Accountancy'
      ];

      setAvailableData(prev => ({
        ...prev,
        departments,
        courses
      }));

      // Cleanup function
      return () => {
        unsubscribeSubjects();
        unsubscribeSections();
      };
    };

    const cleanupListener = fetchRealTimeData();

    // Password validation effect
    const validatePassword = () => {
      const validations = {
        hasUpper: /[A-Z]/.test(formData.password),
        hasLower: /[a-z]/.test(formData.password),
        hasNumber: /\d/.test(formData.password),
        hasMinLength: formData.password.length >= 8
      };
      setPasswordValidations(validations);
    };

    validatePassword();

    // Cleanup
    return () => {
      if (typeof cleanupListener === 'function') {
        cleanupListener();
      }
    };
  }, [formData.password]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'idNumber' || field === 'mobileNumber' 
        ? value.replace(/\D/g, '') 
        : value
    }));
  };

  const handleSectionSelect = (section: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.includes(section)
        ? prev.sections.filter(s => s !== section)
        : [...prev.sections, section]
    }));
  };

  const handleScheduleChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [field]: value
      }
    }));
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Validation for role-specific fields
    if (formData.role === 'student') {
      if (formData.sections.length === 0) {
        Swal.fire('Error', 'Please select at least one section', 'error');
        setIsLoading(false);
        return;
      }
      if (formData.schedule.days.length === 0) {
        Swal.fire('Error', 'Please select at least one class day', 'error');
        setIsLoading(false);
        return;
      }
    }

    try {
      // Validate password requirements
      const unmetRequirements = [];
      if (!passwordValidations.hasUpper) unmetRequirements.push('1 uppercase letter');
      if (!passwordValidations.hasLower) unmetRequirements.push('1 lowercase letter');
      if (!passwordValidations.hasNumber) unmetRequirements.push('1 number');
      if (!passwordValidations.hasMinLength) unmetRequirements.push('8 characters minimum');

      if (unmetRequirements.length > 0) {
        throw new Error(
          `Password must contain at least:\n${unmetRequirements
            .map(req => `- ${req}`)
            .join('\n')}`
        );
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (formData.role === 'instructor' && (isNaN(Number(formData.yearsOfExperience)) || Number(formData.yearsOfExperience) < 0)) {
        throw new Error('Years of experience must be a valid number');
      }

      // Check if ID number is already registered in both collections
      const collections = ['students', 'teachers'];
      for (const coll of collections) {
        const idQuery = query(
          collection(db, coll), 
          where('idNumber', '==', formData.idNumber)
        );
        const idSnapshot = await getDocs(idQuery);

        if (!idSnapshot.empty) {
          throw new Error('ID number already registered');
        }
      }

      // Create user authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Prepare base user data
      const userData = {
        uid: userCredential.user.uid,
        fullName: formData.fullName,
        idNumber: formData.idNumber,
        email: formData.email,
        mobileNumber: formData.mobileNumber,
        role: formData.role,
        createdAt: new Date().toISOString()
      };

      // Add role-specific data
      if (formData.role === 'instructor') {
        const instructorData = {
          ...userData,
          department: formData.department,
          yearsOfExperience: Number(formData.yearsOfExperience)
        };
        await setDoc(doc(db, 'teachers', userCredential.user.uid), instructorData);
      } else {
        const studentData = {
          ...userData,
          major: formData.major,
          yearLevel: formData.yearLevel,
          sections: formData.sections,
          schedule: formData.schedule
        };
        await setDoc(doc(db, 'students', userCredential.user.uid), studentData);
      }

      // Success handling
      Swal.fire({
        icon: 'success',
        title: 'Registration Successful!',
        text: `Welcome ${formData.role === 'student' ? 'Student' : 'Instructor'}`,
        showConfirmButton: false,
        timer: 2000,
        background: '#f8fafc',
        iconColor: '#3b82f6'
      });

      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Registration Failed',
        text: error instanceof Error ? error.message : 'An error occurred',
        confirmButtonColor: '#3b82f6',
        background: '#f8fafc',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderRoleSpecificFields = () => {
    if (formData.role === 'instructor') {
      return (
        <>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="relative">
              <label className={`absolute left-4 transition-all duration-200 ${
                inputFocus.department || formData.department ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
              }`}>
                Department
              </label>
              <select
                className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                onFocus={() => setInputFocus(prev => ({ ...prev, department: true }))}
                onBlur={() => setInputFocus(prev => ({ ...prev, department: false }))}
                required
              >
                <option value="" disabled></option>
                {availableData.departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 }}
          >
            <div className="relative">
              <label className={`absolute left-4 transition-all duration-200 ${
                inputFocus.yearsOfExperience || formData.yearsOfExperience ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
              }`}>
                Years of Experience
              </label>
              <input
                type="number"
                className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500"
                value={formData.yearsOfExperience}
                onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)}
                onFocus={() => setInputFocus(prev => ({ ...prev, yearsOfExperience: true }))}
                onBlur={() => setInputFocus(prev => ({ ...prev, yearsOfExperience: false }))}
                min="0"
                required
              />
            </div>
          </motion.div>
        </>
      );
    }

    return (
      <>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="relative">
            <label className={`absolute left-4 transition-all duration-200 ${
              inputFocus.major || formData.major ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
            }`}>
              Course
            </label>
            <select
              className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              value={formData.major}
              onChange={(e) => handleInputChange('major', e.target.value)}
              onFocus={() => setInputFocus(prev => ({ ...prev, major: true }))}
              onBlur={() => setInputFocus(prev => ({ ...prev, major: false }))}
              required
            >
              <option value="" disabled></option>
              {availableData.courses.map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="relative">
            <label className={`absolute left-4 transition-all duration-200 ${
              inputFocus.yearLevel || formData.yearLevel ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
            }`}>
              Year Level
            </label>
            <select
              className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              value={formData.yearLevel}
              onChange={(e) => handleInputChange('yearLevel', e.target.value)}
              onFocus={() => setInputFocus(prev => ({ ...prev, yearLevel: true }))}
              onBlur={() => setInputFocus(prev => ({ ...prev, yearLevel: false }))}
              required
            >
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>
        </motion.div>
              
        {/* Sections Selection */}  
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.1 }}
          className="md:col-span-2"
        >
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Sections
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableData.sections.map(section => (
                <button
                  type="button"
                  key={section}
                  onClick={() => handleSectionSelect(section)}
                  className={`p-2 rounded-lg border ${
                    formData.sections.includes(section)
                      ? 'bg-indigo-100 border-indigo-500'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {section}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2 }}
          className="md:col-span-2"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class Days
              </label>
              <div className="flex gap-2 flex-wrap">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => handleScheduleChange(
                      'days',
                      formData.schedule.days.includes(day)
                        ? formData.schedule.days.filter(d => d !== day)
                        : [...formData.schedule.days, day]
                    )}
                    className={`p-2 rounded-lg border ${
                      formData.schedule.days.includes(day)
                        ? 'bg-indigo-100 border-indigo-500'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  className="w-full p-2 bg-gray-50 rounded-lg border focus:ring-indigo-500"
                  value={formData.schedule.startTime}
                  onChange={(e) => handleScheduleChange('startTime', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  className="w-full p-2 bg-gray-50 rounded-lg border focus:ring-indigo-500"
                  value={formData.schedule.endTime}
                  onChange={(e) => handleScheduleChange('endTime', e.target.value)}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </>
    );
  };

  


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div 
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 relative overflow-hidden">
          <motion.div
            className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-100 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 8, repeat: Infinity }}
          />

          <div className="relative z-10">
            <div className="flex flex-col items-center mb-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <LockClosedIcon className="w-14 h-14 text-indigo-600 mb-4" />
              </motion.div>
              <motion.h1 
                className="text-3xl font-bold text-gray-900 mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Registration
              </motion.h1>
              <p className="text-gray-500">Join our smart security system</p>
            </div>

            <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Role Selection */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="relative">
              <label className={`absolute left-4 transition-all duration-200 ${
                inputFocus.role || formData.role ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
              }`}>
                Register As
              </label>
              <select
                className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                required
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>
          </motion.div>


              <AnimatePresence>
                {/* Full Name Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="relative">
                    <label className={`absolute left-4 transition-all duration-200 ${
                      inputFocus.fullName || formData.fullName ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
                    }`}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      onFocus={() => setInputFocus(prev => ({ ...prev, fullName: true }))}
                      onBlur={() => setInputFocus(prev => ({ ...prev, fullName: false }))}
                      required
                    />
                    {formData.fullName && (
                      <CheckIcon className="w-5 h-5 text-green-500 absolute right-4 top-5" />
                    )}
                  </div>
                </motion.div>

                {/* ID Number Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="relative">
                    <label className={`absolute left-4 transition-all duration-200 ${
                      inputFocus.idNumber || formData.idNumber ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
                    }`}>
                      ID Number
                    </label>
                    <input
                      type="text"
                      className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.idNumber}
                      onChange={(e) => handleInputChange('idNumber', e.target.value)}
                      onFocus={() => setInputFocus(prev => ({ ...prev, idNumber: true }))}
                      onBlur={() => setInputFocus(prev => ({ ...prev, idNumber: false }))}
                      maxLength={12}
                      required
                    />
                    {formData.idNumber.length === 12 && (
                      <CheckIcon className="w-5 h-5 text-green-500 absolute right-4 top-5" />
                    )}
                  </div>
                </motion.div>

                {/* Email Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="relative">
                    <label className={`absolute left-4 transition-all duration-200 ${
                      inputFocus.email || formData.email ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
                    }`}>
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      onFocus={() => setInputFocus(prev => ({ ...prev, email: true }))}
                      onBlur={() => setInputFocus(prev => ({ ...prev, email: false }))}
                      required
                    />
                    {formData.email.includes('@') && (
                      <CheckIcon className="w-5 h-5 text-green-500 absolute right-4 top-5" />
                    )}
                  </div>
                </motion.div>

                {/* Mobile Number Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <div className="relative">
                    <label className={`absolute left-4 transition-all duration-200 ${
                      inputFocus.mobileNumber || formData.mobileNumber ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
                    }`}>
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.mobileNumber}
                      onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                      onFocus={() => setInputFocus(prev => ({ ...prev, mobileNumber: true }))}
                      onBlur={() => setInputFocus(prev => ({ ...prev, mobileNumber: false }))}
                      maxLength={11}
                      required
                    />
                    {formData.mobileNumber.length === 11 && (
                      <CheckIcon className="w-5 h-5 text-green-500 absolute right-4 top-5" />
                    )}
                  </div>
                </motion.div>

               

                {/* Password Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <div className="relative">
                    <label className={`absolute left-4 transition-all duration-200 ${
                      inputFocus.password || formData.password ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
                    }`}>
                      Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 pr-12"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      onFocus={() => setInputFocus(prev => ({ ...prev, password: true }))}
                      onBlur={() => setInputFocus(prev => ({ ...prev, password: false }))}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-5 text-gray-400 hover:text-indigo-600"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                    {passwordValidations.hasUpper &&
                    passwordValidations.hasLower &&
                    passwordValidations.hasNumber &&
                    passwordValidations.hasMinLength && (
                      <CheckIcon className="w-5 h-5 text-green-500 absolute right-12 top-5" />
                    )}
                   <div className="mt-2 text-sm text-gray-500 space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckIcon className={`w-4 h-4 ${
                          passwordValidations.hasMinLength ? 'text-green-500' : 'text-gray-300'
                        }`} />
                        <span className={passwordValidations.hasMinLength ? 'text-green-500' : ''}>
                          At least 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                      <CheckIcon className={`w-4 h-4 ${
                          passwordValidations.hasUpper ? 'text-green-500' : 'text-gray-300'
                        }`} />
                        <span className={passwordValidations.hasUpper ? 'text-green-500' : ''}>
                          1 uppercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckIcon className={`w-4 h-4 ${
                          passwordValidations.hasLower ? 'text-green-500' : 'text-gray-300'
                        }`} />
                        <span className={passwordValidations.hasLower ? 'text-green-500' : ''}>
                          1 lowercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckIcon className={`w-4 h-4 ${
                          passwordValidations.hasNumber ? 'text-green-500' : 'text-gray-300'
                        }`} />
                        <span className={passwordValidations.hasNumber ? 'text-green-500' : ''}>
                          1 number
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Confirm Password Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <div className="relative">
                    <label className={`absolute left-4 transition-all duration-200 ${
                      inputFocus.confirmPassword || formData.confirmPassword ? 'top-1 text-sm text-indigo-600' : 'top-4 text-gray-400'
                    }`}>
                      Confirm Password
                    </label>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 pr-12"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      onFocus={() => setInputFocus(prev => ({ ...prev, confirmPassword: true }))}
                      onBlur={() => setInputFocus(prev => ({ ...prev, confirmPassword: false }))}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-5 text-gray-400 hover:text-indigo-600"
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                    {formData.confirmPassword === formData.password && formData.confirmPassword && (
                      <CheckIcon className="w-5 h-5 text-green-500 absolute right-12 top-5" />
                    )}
                  </div>
      
                </motion.div>
                {renderRoleSpecificFields()}


                <motion.div
                  className="md:col-span-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0 }}
                >
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold p-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <LockClosedIcon className="w-5 h-5" />
                        Register Now
                      </>
                    )}
                  </button>
                </motion.div>
              </AnimatePresence>
            </form>

            <motion.div 
              className="mt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
            >
              <p className="text-gray-500">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                >
                  Login Here
                </Link>
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;