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
import { auth, db, rtdb, listenForNewRFIDTag } from '../firebase';
import { getDatabase, ref, get, set, remove, onValue, off } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LockClosedIcon, 
  CheckIcon, 
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  AcademicCapIcon,
  UserIcon,
  CreditCardIcon
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { Link, useNavigate } from 'react-router-dom';

interface Subject {
  id: string;
  name: string;
  details: string;
  department: string;
  teacherId: string | null;
  status: 'active' | 'inactive';
  schedules: Array<{
    day: string;
    startTime: string;
    endTime: string;
    section: string;
  }>;
}

interface UserData {
  uid: string;
  fullName: string;
  idNumber: string;
  email: string;
  mobileNumber: string;
  role: string;
  createdAt: string;
  rfidUid?: string;
  [key: string]: string | string[] | undefined; // Allow additional dynamic properties
}

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    role: 'student',
    fullName: '',
    idNumber: '',
    email: '',
    mobileNumber: '',
    department: '',
    major: '',
    yearLevel: '',
    yearsOfExperience: '',
    password: '',
    confirmPassword: '',
    sections: [] as string[],
    schedule: {
      days: [] as string[],
      startTime: '',
      endTime: ''
    },
    section: '',
    subject: '',
    selectedSchedule: null as any,
    rfidUid: '' // New field for RFID UID
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
    scheduleTime: false,
    section: false,
    subject: false,
    rfidUid: false // New field for RFID UID
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidations, setPasswordValidations] = useState({
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasMinLength: false,
    hasSpecial: false
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [formProgress, setFormProgress] = useState(0);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
    mobileNumber: false,
    department: false,
    yearLevel: false,
    role: false,
    major: false,
    sections: false,
    scheduleDays: false,
    scheduleTime: false,
    section: false,
    subject: false,
    rfidUid: false // New field for RFID UID
  });

  const [isRegistered, setIsRegistered] = useState(false);

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
      // Fetch sections from students collection
      const studentsRef = collection(db, 'students');
      const unsubscribeStudents = onSnapshot(studentsRef, (snapshot) => {
        const sections = new Set<string>();
        snapshot.forEach((doc) => {
          const section = doc.data().section;
          if (section) sections.add(section);
        });
        setAvailableData(prev => ({ ...prev, sections: Array.from(sections).sort() }));
      });

      // Predefined Departments
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

      setAvailableData(prev => ({
        ...prev,
        departments,
        courses: departments
      }));

      return () => {
        unsubscribeStudents();
      };
    };

    fetchRealTimeData();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectsCollection = collection(db, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Subject[];
        setSubjects(subjectsData.filter(subject => subject.status === 'active'));
      } catch (error) {
        console.error('Error fetching subjects:', error);
      }
    };

    fetchSubjects();
  }, []);

  useEffect(() => {
    // Password validation effect
    const validatePassword = () => {
      const validations = {
        hasUpper: /[A-Z]/.test(formData.password),
        hasLower: /[a-z]/.test(formData.password),
        hasNumber: /\d/.test(formData.password),
        hasMinLength: formData.password.length >= 8,
        hasSpecial: /[^A-Za-z0-9]/.test(formData.password)
      };
      setPasswordValidations(validations);
    };

    validatePassword();

    // Cleanup
    return () => {};
  }, [formData.password]);

  useEffect(() => {
    // Listen for RFID tag updates from Firebase
    const rfidRef = ref(rtdb, '/NewRFIDTag');
    
    const handleRFIDUpdate = (snapshot: any) => {
      const newUid = snapshot.val();
      if (newUid) {
        setFormData(prev => ({
          ...prev,
          rfidUid: newUid
        }));
      }
    };

    onValue(rfidRef, handleRFIDUpdate);

    // Cleanup subscription
    return () => {
      off(rfidRef);
    };
  }, []);

  useEffect(() => {
    const registerUID = async (newUid: string) => {
      if (!isRegistered) {
        const database = getDatabase();
        const uidRef = ref(database, '/RegisteredUIDs/' + newUid);
        const snapshot = await get(uidRef);
        if (!snapshot.exists()) {
          await set(uidRef, { registered: true });
          setIsRegistered(true);
          alert('UID registered successfully!');
        } else {
          alert('This UID is already registered.');
        }
      } else {
        alert('This UID has already been registered.');
      }
    };

    if (formData.rfidUid) {
      registerUID(formData.rfidUid);
    }
  }, [formData.rfidUid, isRegistered]);

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

  const handleSubjectChange = (subjectId: string) => {
    const selectedSubject = subjects.find(s => s.id === subjectId);
    setFormData(prev => ({
      ...prev,
      subject: subjectId,
      selectedSchedule: null
    }));

    if (selectedSubject) {
      setAvailableSchedules(selectedSubject.schedules || []);
    } else {
      setAvailableSchedules([]);
    }
  };

  const sections = [
    { value: 'H1', label: 'Section H1' },
    { value: 'H2', label: 'Section H2' },
    { value: 'H3', label: 'Section H3' },
    { value: 'G1', label: 'Section G1' },
    { value: 'G2', label: 'Section G2' },
    { value: 'G3', label: 'Section G3' }
  ];

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate form data
    if (formData.password !== formData.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Passwords do not match',
        text: 'Please ensure your passwords are the same.'
      });
      setIsLoading(false);
      return;
    }

    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      const user = userCredential.user;

      // Prepare user data with a more flexible type
      const userData: UserData = {
        uid: user.uid,
        fullName: formData.fullName,
        idNumber: formData.idNumber,
        email: formData.email,
        mobileNumber: formData.mobileNumber,
        role: formData.role,
        createdAt: new Date().toISOString(),
        rfidUid: formData.rfidUid
      };

      // Add role-specific data dynamically
      if (formData.role === 'student') {
        userData.department = formData.department;
        userData.major = formData.major;
        userData.yearLevel = formData.yearLevel;
        userData.section = formData.section;
      } else if (formData.role === 'instructor') {
        userData.department = formData.department;
        userData.yearsOfExperience = formData.yearsOfExperience;
        userData.subject = formData.subject;
      }

      // Store user data in Firestore
      const userRef = doc(db, formData.role + 's', user.uid);
      await setDoc(userRef, userData);

      // If RFID UID is provided, store it in the UIDs collection
      if (formData.rfidUid) {
        const uidRef = doc(db, 'UIDs', formData.rfidUid);
        await setDoc(uidRef, {
          uid: user.uid,
          role: formData.role,
          fullName: formData.fullName
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'Registration Successful!',
        text: 'Your account has been created.'
      });

      // Navigate to login or dashboard
      navigate('/login');
    } catch (error: any) {
      console.error('Registration Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Registration Failed',
        text: error.message || 'An error occurred during registration.'
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
              {/* RFID Card Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90">
                  RFID Card
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="rfidUid"
                    value={formData.rfidUid}
                    readOnly
                    className={`
                      w-full px-4 py-3 pl-12
                      bg-white/10 border border-white/20 rounded-xl
                      text-white placeholder-white/50
                      focus:outline-none focus:ring-2 focus:ring-white/30
                      transition-all duration-200
                      ${formData.rfidUid ? 'border-green-400' : 'border-white/20'}
                    `}
                    placeholder="Tap your RFID card..."
                  />
                  <CreditCardIcon 
                    className={`
                      absolute left-3 top-3.5 w-5 h-5
                      transition-colors duration-200
                      ${formData.rfidUid ? 'text-green-400' : 'text-white/50'}
                    `}
                  />
                  {formData.rfidUid && (
                    <div className="absolute right-3 top-3.5 flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-sm text-green-400">Card detected</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-white/60 mt-1">
                  Place your RFID card near the reader
                </p>
              </div>
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
              
              {formData.role === 'student' && (
                <>
                  {renderSelect('yearLevel', 'Year Level', [
                    { value: '1st Year', label: '1st Year' },
                    { value: '2nd Year', label: '2nd Year' },
                    { value: '3rd Year', label: '3rd Year' },
                    { value: '4th Year', label: '4th Year' }
                  ])}
                  
                  {renderSelect('section', 'Section', [
                    { value: '', label: 'Select a section' },
                    { value: 'H1', label: 'Section H1' },
                    { value: 'H2', label: 'Section H2' },
                    { value: 'H3', label: 'Section H3' },
                    { value: 'G1', label: 'Section G1' },
                    { value: 'G2', label: 'Section G2' },
                    { value: 'G3', label: 'Section G3' }
                  ])}
                  
            

                  {/* Schedule Selection - Only show if subject is selected */}
                  {formData.subject && availableSchedules.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Available Schedules
                      </label>
                      <div className="space-y-2">
                        {availableSchedules.map((schedule, index) => (
                          <div
                            key={index}
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              selectedSchedule: schedule,
                              schedule: {
                                days: [schedule.day],
                                startTime: schedule.startTime,
                                endTime: schedule.endTime
                              },
                              section: schedule.section
                            }))}
                            className={`cursor-pointer p-3 rounded-lg border ${
                              formData.selectedSchedule === schedule
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-300 hover:border-indigo-300'
                            }`}
                          >
                            <p className="font-medium">{schedule.day}</p>
                            <p className="text-sm text-gray-600">
                              {schedule.startTime} - {schedule.endTime}
                            </p>
                            <p className="text-sm text-gray-600">
                              Section: {schedule.section}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {renderSelect('major', 'Major', availableData.courses.map(course => ({
                    value: course,
                    label: course
                  })))}
                </>
              )}
              {formData.role === 'instructor' && (
                renderInput('yearsOfExperience', 'Years of Experience', 'number', 'Years of teaching experience')
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4">Set Your Password</h3>
            <div className="space-y-4">
              <div>
                <div className="relative">
                  {renderInput('password', 'Password', showPassword ? 'text' : 'password', 'Enter your password',
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-[38px] hover:text-white/80 transition-colors"
                    >
                      {showPassword ? <EyeSlashIcon className="absolute right-1 bottom-[12px] w-6 h-6" /> : <EyeIcon className="absolute right-1 bottom-[12px] w-6 h-6" />}
                    </button>
                  )}
                </div>
                
                {/* Password Requirements */}
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasMinLength ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-sm ${passwordValidations.hasMinLength ? 'text-green-400' : 'text-gray-300'}`}>
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasUpper ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-sm ${passwordValidations.hasUpper ? 'text-green-400' : 'text-gray-300'}`}>
                      One uppercase letter
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasLower ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-sm ${passwordValidations.hasLower ? 'text-green-400' : 'text-gray-300'}`}>
                      One lowercase letter
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasNumber ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-sm ${passwordValidations.hasNumber ? 'text-green-400' : 'text-gray-300'}`}>
                      One number
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasSpecial ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-sm ${passwordValidations.hasSpecial ? 'text-green-400' : 'text-gray-300'}`}>
                      One special character
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                {renderInput('confirmPassword', 'Confirm Password', showConfirmPassword ? 'text' : 'password', 'Confirm your password',
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-[38px] hover:text-white/80 transition-colors"
                  >
                    {showConfirmPassword ? <EyeSlashIcon className="absolute right-1 bottom-[12px]  w-6 h-6" /> : <EyeIcon className="absolute right-1 bottom-[12px]  w-6 h-6" />}
                  </button>
                )}
                {formData.confirmPassword && (
                  <div className="mt-2 flex items-center space-x-2">
                    <CheckIcon 
                      className={`w-4 h-4 ${formData.password === formData.confirmPassword ? 'text-green-400' : 'text-red-400'}`} 
                    />
                    <span 
                      className={`text-sm ${formData.password === formData.confirmPassword ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </span>
                  </div>
                )}
              </div>
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