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
  EyeSlashIcon,
  AcademicCapIcon,
  UserIcon 
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

  const [currentStep, setCurrentStep] = useState(1);
  const [formProgress, setFormProgress] = useState(0);

  const navigate = useNavigate();

  const steps = [
    { id: 1, title: 'Account Type', description: 'Choose your role' },
    { id: 2, title: 'Personal Info', description: 'Basic information' },
    { id: 3, title: 'Department', description: 'Academic details' },
    { id: 4, title: 'Security', description: 'Set up password' }
  ];

  const calculateProgress = () => {
    const progress = (currentStep / steps.length) * 100;
    setFormProgress(progress);
  };

  useEffect(() => {
    calculateProgress();
  }, [currentStep]);

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

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

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

  const renderInput = (
    name: string,
    label: string,
    type: string = 'text',
    placeholder: string = '',
    icon?: React.ReactNode
  ) => (
    <div>
      <label className="block text-white/90 text-sm font-medium mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={formData[name as keyof typeof formData] as string}
          onChange={(e) => handleInputChange(name, e.target.value)}
          onFocus={() => setInputFocus({ ...inputFocus, [name]: true })}
          onBlur={() => setInputFocus({ ...inputFocus, [name]: false })}
          className={`
            w-full px-4 py-3 rounded-xl
            bg-white/10 border border-white/20
            text-white placeholder-white/50
            focus:outline-none focus:ring-2 focus:ring-white/30
            transition-all duration-200
          `}
          placeholder={placeholder}
          required
        />
        {icon && (
          <div className="absolute right-3 top-3 text-white/50">
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  const renderSelect = (
    name: string,
    label: string,
    options: { value: string; label: string }[]
  ) => (
    <div>
      <label className="block text-white/90 text-sm font-medium mb-2">
        {label}
      </label>
      <select
        value={formData[name as keyof typeof formData] as string}
        onChange={(e) => handleInputChange(name, e.target.value)}
        className={`
          w-full px-4 py-3 rounded-xl
          bg-white/10 border border-white/20
          text-white
          focus:outline-none focus:ring-2 focus:ring-white/30
          transition-all duration-200
        `}
        required
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-gray-800">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4">Choose Your Role</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['student', 'instructor'].map((role) => (
                <motion.button
                  key={role}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, role });
                    nextStep();
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    p-6 rounded-xl text-center transition-all duration-200
                    ${formData.role === role
                      ? 'bg-white text-indigo-600 shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20'
                    }
                  `}
                >
                  <div className="flex flex-col items-center space-y-3">
                    {role === 'student' ? (
                      <AcademicCapIcon className="w-8 h-8" />
                    ) : (
                      <UserIcon className="w-8 h-8" />
                    )}
                    <span className="text-lg font-medium">
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                    <p className="text-sm opacity-80">
                      {role === 'student' 
                        ? 'Access your courses and track your progress'
                        : 'Manage your classes and student records'}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderInput('fullName', 'Full Name', 'text', 'Enter your full name')}
              {renderInput('idNumber', 'ID Number', 'text', 'Enter your ID number')}
              {renderInput('email', 'Email', 'email', 'Enter your email')}
              {renderInput('mobileNumber', 'Mobile Number', 'tel', 'Enter your mobile number')}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4">Academic Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderSelect('department', 'Department', availableData.departments.map(dept => ({
                value: dept,
                label: dept
              })))}
              
              {formData.role === 'student' ? (
                <>
                  {renderSelect('major', 'Major', availableData.courses.map(course => ({
                    value: course,
                    label: course
                  })))}
                  {renderSelect('yearLevel', 'Year Level', [
                    { value: '1', label: '1st Year' },
                    { value: '2', label: '2nd Year' },
                    { value: '3', label: '3rd Year' },
                    { value: '4', label: '4th Year' }
                  ])}
                </>
              ) : (
                renderInput('yearsOfExperience', 'Years of Experience', 'number', 'Years of teaching experience')
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4">Security Setup</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 relative">
                {renderInput('password', 'Password', showPassword ? 'text' : 'password', 'Create a strong password',
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-white/80 transition-colors"
                  >
                    {showPassword ? <EyeSlashIcon className="w-6 h-6" /> : <EyeIcon className="w-6 h-6" />}
                  </button>
                )}
                
                {/* Password Validation Indicators */}
                <div className="absolute -bottom-24 left-0 space-y-1">
                  {Object.entries(passwordValidations).map(([key, isValid]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <CheckIcon className={`w-4 h-4 ${isValid ? 'text-green-400' : 'text-white/30'}`} />
                      <span className={`text-xs ${isValid ? 'text-green-400' : 'text-white/50'}`}>
                        {key === 'hasUpper' && 'Uppercase letter'}
                        {key === 'hasLower' && 'Lowercase letter'}
                        {key === 'hasNumber' && 'Number'}
                        {key === 'hasMinLength' && 'Minimum 8 characters'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {renderInput('confirmPassword', 'Confirm Password', showConfirmPassword ? 'text' : 'password', 'Confirm your password',
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="hover:text-white/80 transition-colors"
                >
                  {showConfirmPassword ? <EyeSlashIcon className="w-6 h-6" /> : <EyeIcon className="w-6 h-6" />}
                </button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 py-12 px-4">
      <div className="absolute inset-0 bg-pattern opacity-10"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 pointer-events-none"></div>
        
        <div className="relative p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-16 h-16 bg-white rounded-2xl shadow-lg mx-auto mb-4 flex items-center justify-center"
            >
              <LockClosedIcon className="w-8 h-8 text-indigo-600" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
            <p className="text-white/80">Join our community today</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`text-sm ${
                    currentStep >= step.id ? 'text-white' : 'text-white/50'
                  }`}
                >
                  {step.title}
                </div>
              ))}
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${formProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleRegister} className="space-y-6">
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  Back
                </button>
              )}
              {currentStep < steps.length ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-3 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 transition-colors ml-auto"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`
                    px-6 py-3 rounded-xl bg-white text-indigo-600
                    hover:bg-indigo-50 transition-colors ml-auto
                    flex items-center space-x-2
                    ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}
                  `}
                >
                  {isLoading ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <CheckIcon className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          <p className="text-center text-white/80 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-white font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;