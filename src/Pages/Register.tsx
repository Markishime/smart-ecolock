import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { auth, db, rtdb, listenForNewRFIDTag } from '../firebase';
import { getDatabase, ref, get, set, remove, onValue, off, DataSnapshot, update } from 'firebase/database';
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
import { serverTimestamp } from 'firebase/firestore';

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

// Update the RFID tag interface
interface RFIDTag {
  uid: string;
  timestamp: string;
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

  const [rfidTags, setRfidTags] = useState<RFIDTag[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>('');

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
    const rfidRef = ref(rtdb, '/UnregisteredUIDs');
    
    const handleRFIDUpdate = (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (data) {
        const firstKey = Object.keys(data)[0];
        const uidData = data[firstKey];
        if (uidData && uidData.uid) {
        setFormData(prev => ({
          ...prev,
            rfidUid: uidData.uid
        }));
        }
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
        } else {
        }
      } else {
      }
    };

    if (formData.rfidUid) {
      registerUID(formData.rfidUid);
    }
  }, [formData.rfidUid, isRegistered]);

  useEffect(() => {
    const fetchUnregisteredTags = async () => {
      try {
        const tagsRef = collection(db, 'rfidTags');
        const q = query(tagsRef, where('isRegistered', '==', false));
        
        // Set up real-time listener
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const tags = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
          })) as RFIDTag[];
          setRfidTags(tags);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching RFID tags:', error);
      }
    };

    fetchUnregisteredTags();
  }, []);

  useEffect(() => {
    const unregisteredUidsRef = ref(rtdb, 'UnregisteredUIDs');
    
    const unsubscribe = onValue(unregisteredUidsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const tags: RFIDTag[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            uid: value.uid,
            timestamp: value.timestamp
          }))
          // Filter out UIDs that are already in RegisteredUIDs
          .filter(tag => !data.RegisteredUIDs?.[tag.uid]?.registered);

        setRfidTags(tags);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      rfidUid: selectedUid
    }));
  }, [selectedUid]);

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

  const [isAdmin, setIsAdmin] = useState(false);
  const [rfidTag, setRfidTag] = useState('');

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Create auth user
      const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

      // Prepare user data
      const userData = {
        fullName: formData.fullName,
        email: formData.email,
        idNumber: formData.idNumber,
        department: formData.department,
        role: isAdmin ? 'admin' : 'instructor',
        rfidUid: rfidTag,
        createdAt: new Date().toISOString()
      };

      // Store in Firestore
      const collectionRef = collection(db, isAdmin ? 'users' : 'teachers');
      await setDoc(doc(collectionRef, user.uid), userData);

      // Store RFID data in RTDB
      if (rfidTag) {
        const rfidRef = ref(rtdb, `rfid/${rfidTag}`);
        await set(rfidRef, {
          uid: user.uid,
          role: isAdmin ? 'admin' : 'instructor',
          timestamp: serverTimestamp()
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'Registration Successful',
        text: `Registered as ${isAdmin ? 'Admin' : 'Instructor'}`,
        showConfirmButton: false,
        timer: 1500
      });

      navigate('/login');

    } catch (error) {
      console.error('Registration error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Registration Failed',
        text: error instanceof Error ? error.message : 'Registration failed'
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
                    value={selectedUid}
                  readOnly
                    className={`
                      w-full px-4 py-3 pl-12
                      bg-white/10 border border-white/20 rounded-xl
                      text-white placeholder-white/50
                      focus:outline-none focus:ring-2 focus:ring-white/30
                      transition-all duration-200
                      ${selectedUid ? 'border-green-400' : 'border-white/20'}
                    `}
                    placeholder="Select RFID from dropdown..."
                  />
                  <CreditCardIcon 
                    className={`
                      absolute left-3 top-3.5 w-5 h-5
                      transition-colors duration-200
                      ${selectedUid ? 'text-green-400' : 'text-white/50'}
                    `}
                  />
                  {selectedUid && (
                    <div className="absolute right-3 top-3.5 flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-sm text-green-400">Card selected</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-white/60 mt-1">
                  {selectedUid ? 'RFID card selected' : 'Select an RFID card from the dropdown above'}
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
            {/* Add RFID UID selection before other fields */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RFID Tag
              </label>
              <select
                value={selectedUid}
                onChange={(e) => setSelectedUid(e.target.value)}
                className={`
                  w-full px-4 py-3 rounded-xl
                  bg-white border border-gray-200
                  text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  transition-all duration-200
                `}
                required
              >
                <option value="" className="text-gray-900">Select RFID Tag</option>
                {rfidTags.map(tag => (
                  <option key={tag.uid} value={tag.uid} className="text-gray-900">
                    {tag.uid} - Scanned at {tag.timestamp}
                  </option>
                ))}
              </select>
            </div>

            {/* Add role selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Register as</label>
              <select
                value={isAdmin ? 'admin' : 'instructor'}
                onChange={(e) => setIsAdmin(e.target.value === 'admin')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              >
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Add RFID input field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">RFID Tag</label>
              <input
                type="text"
                value={rfidTag}
                onChange={(e) => setRfidTag(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder="Enter RFID tag"
              />
            </div>

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