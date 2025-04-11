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
import { auth, db, rtdb } from '../firebase';
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
  CreditCardIcon,
  CalendarIcon,
  ClockIcon,
  EnvelopeIcon,
  PhoneIcon,
  IdentificationIcon,
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
  isAdmin?: boolean;
  section?: string;
  sectionId?: string;
  schedules?: Array<{
    day: string;
    startTime: string;
    endTime: string;
    room?: string;
    subject?: string;
    section: string;
  }>;
  [key: string]: string | string[] | boolean | undefined | Array<{ day: string; startTime: string; endTime: string; room?: string; subject?: string; section: string; }>;
}

interface RFIDTag {
  uid: string;
  registered?: boolean;
  timestamp?: string;
}

interface Section {
  id: string;
  name: string;
  instructorId: string;
  schedule: {
    day: string;
    startTime: string;
    endTime: string;
    room: string;
    subject: string;
  };
}

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  department: string;
  subjects?: string[];
  schedules?: Array<{
    day: string;
    startTime: string;
    endTime: string;
    room?: string;
    subject?: string;
    section: string;
  }>;
}

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

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    role: 'student',
    fullName: '',
    idNumber: '',
    email: '',
    mobileNumber: '',
    department: '',
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
    rfidUid: '',
    isAdmin: false
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
    sections: false,
    scheduleDays: false,
    scheduleTime: false,
    section: false,
    subject: false,
    rfidUid: false
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
    sections: false,
    scheduleDays: false,
    scheduleTime: false,
    section: false,
    subject: false,
    rfidUid: false
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
    const fetchRealTimeData = () => {
      const studentsRef = collection(db, 'students');
      const unsubscribeStudents = onSnapshot(studentsRef, (snapshot) => {
        const sections = new Set<string>();
        snapshot.forEach((doc) => {
          const section = doc.data().section;
          if (section) sections.add(section);
        });
        setAvailableData(prev => ({ ...prev, sections: Array.from(sections).sort() }));
      });

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
  }, [formData.password]);

  useEffect(() => {
    // Fetch RegisteredUIDs and UnregisteredUIDs from RTDB
    const registeredUidsRef = ref(rtdb, 'RegisteredUIDs');
    const unregisteredUidsRef = ref(rtdb, 'UnregisteredUIDs');

    const unsubscribe = onValue(unregisteredUidsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const tags: RFIDTag[] = Object.entries(data).map(([key, value]: [string, any]) => ({
          uid: value.uid || key,
        }));
        setRfidTags(tags);
      } else {
        setRfidTags([]);
      }
    }, (error) => {
      console.error('Error fetching UnregisteredUIDs:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to fetch RFID tags.'
      });
    });

    return () => {
      off(unregisteredUidsRef, 'value', unsubscribe);
    };
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

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    if (!selectedUid) {
      Swal.fire({
        icon: 'warning',
        title: 'RFID Required',
        text: 'Please select an RFID tag to proceed.'
      });
      setIsLoading(false);
      return;
    }

    try {
      // Create auth user
      const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

      // Prepare user data
      const userData: UserData = {
        uid: user.uid,
        fullName: formData.fullName,
        email: formData.email,
        idNumber: formData.idNumber,
        department: formData.department,
        role: formData.role,
        mobileNumber: formData.mobileNumber,
        rfidUid: formData.rfidUid,
        createdAt: new Date().toISOString(),
      };

      // Store in Firestore
      const collectionRef = collection(db, formData.role === 'instructor' ? 'teachers' : 'students');
      await setDoc(doc(collectionRef, user.uid), userData);

      if (formData.rfidUid) {
        // Move UID from UnregisteredUIDs to RegisteredUIDs
        const uidRef = ref(rtdb, `/UnregisteredUIDs/${formData.rfidUid}`);
        await set(uidRef, null);

        // Store RFID data
        const rfidRef = ref(rtdb, `rfid/${formData.rfidUid}`);
        await set(rfidRef, {
          uid: user.uid,
          role: formData.role,
          timestamp: serverTimestamp()
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'Registration Successful',
        text: `Registered as ${formData.role === 'instructor' ? 'Instructor' : 'Student'}`,
        showConfirmButton: false,
        timer: 1500,
        background: '#F9FAFB',
        iconColor: '#22d3ee',
      });

      navigate('/login');

    } catch (error) {
      console.error('Registration error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Registration Failed',
        text: error instanceof Error ? error.message : 'Registration failed',
        confirmButtonColor: '#22d3ee',
        background: '#F9FAFB',
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
    icon: React.ReactNode
  ) => (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, type: 'tween' }}
    >
      <label className="block text-sm font-medium text-cyan-200 mb-2">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
          {icon}
        </div>
        <input
          type={type}
          value={formData[name as keyof typeof formData] as string}
          onChange={(e) => handleInputChange(name, e.target.value)}
          onFocus={() => setInputFocus({ ...inputFocus, [name]: true })}
          onBlur={() => setInputFocus({ ...inputFocus, [name]: false })}
          className="w-full pl-10 pr-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400"
          placeholder={placeholder}
          required
        />
        {formData[name as keyof typeof formData] && (
          <CheckIcon className="w-5 h-5 text-cyan-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
        )}
      </div>
    </motion.div>
  );

  const renderSelect = (
    name: string,
    label: string,
    options: { value: string; label: string }[],
    icon: React.ReactNode
  ) => (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, type: 'tween' }}
    >
      <label className="block text-sm font-medium text-cyan-200 mb-2">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
          {icon}
        </div>
        <select
          value={formData[name as keyof typeof formData] as string}
          onChange={(e) => handleInputChange(name, e.target.value)}
          className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white"
          required
        >
          <option value="" className="text-gray-500">Select {label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="text-white">
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </motion.div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold text-cyan-100 mb-2">Choose Your Role</h3>
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
                      ? 'bg-cyan-600 text-white shadow-lg'
                      : 'bg-gray-700 text-cyan-200 hover:bg-gray-600'
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
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-semibold text-cyan-100 mb-2">Personal Information</h3>
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">
                RFID Card
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <CreditCardIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <select
                  value={selectedUid}
                  onChange={(e) => setSelectedUid(e.target.value)}
                  className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white"
                  required
                >
                  <option value="" className="text-gray-500">Select RFID Tag</option>
                  {rfidTags.map((tag) => (
                    <option key={tag.uid} value={tag.uid} className="text-white">
                      {tag.uid}
                    </option>
                  ))}
                </select>
                {selectedUid && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm text-green-400">Card selected</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {selectedUid ? 'RFID card selected' : 'Select an RFID card from the dropdown above'}
              </p>
            </motion.div>
            <div className="grid grid-cols-1 gap-4">
              {renderInput('fullName', 'Full Name', 'text', 'Enter your full name', <UserIcon className="w-5 h-5 text-cyan-500" />)}
              {renderInput('idNumber', 'ID Number', 'text', 'Enter your ID number', <IdentificationIcon className="w-5 h-5 text-cyan-500" />)}
              {renderInput('email', 'Email', 'email', 'Enter your email', <EnvelopeIcon className="w-5 h-5 text-cyan-500" />)}
              {renderInput('mobileNumber', 'Mobile Number', 'tel', 'Enter your mobile number', <PhoneIcon className="w-5 h-5 text-cyan-500" />)}
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-semibold text-cyan-100 mb-2">Academic Details</h3>
            <div className="grid grid-cols-1 gap-4">
              {renderSelect('department', 'Department', availableData.departments.map(dept => ({
                value: dept,
                label: dept
              })), <UserIcon className="w-5 h-5 text-cyan-500" />)}
              
              {formData.role === 'student' && (
                renderSelect('yearLevel', 'Year Level', [
                  { value: '1st Year', label: '1st Year' },
                  { value: '2nd Year', label: '2nd Year' },
                  { value: '3rd Year', label: '3rd Year' },
                  { value: '4th Year', label: '4th Year' }
                ], <AcademicCapIcon className="w-5 h-5 text-cyan-500" />)
              )}
              {formData.role === 'instructor' && (
                renderInput('yearsOfExperience', 'Years of Experience', 'number', 'Years of teaching experience', <UserIcon className="w-5 h-5 text-cyan-500" />)
              )}
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-semibold text-cyan-100 mb-2">Set Your Password</h3>
            <div className="space-y-4">
              <div>
                <div className="relative">
                  {renderInput('password', 'Password', showPassword ? 'text' : 'password', 'Enter your password', <UserIcon className="w-5 h-5 text-cyan-500" />)}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasMinLength ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-xs ${passwordValidations.hasMinLength ? 'text-green-400' : 'text-gray-300'}`}>
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasUpper ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-xs ${passwordValidations.hasUpper ? 'text-green-400' : 'text-gray-300'}`}>
                      One uppercase letter
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasLower ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-xs ${passwordValidations.hasLower ? 'text-green-400' : 'text-gray-300'}`}>
                      One lowercase letter
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasNumber ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-xs ${passwordValidations.hasNumber ? 'text-green-400' : 'text-gray-300'}`}>
                      One number
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckIcon className={`w-4 h-4 ${passwordValidations.hasSpecial ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-xs ${passwordValidations.hasSpecial ? 'text-green-400' : 'text-gray-300'}`}>
                      One special character
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                {renderInput('confirmPassword', 'Confirm Password', showConfirmPassword ? 'text' : 'password', 'Confirm your password', <UserIcon className="w-5 h-5 text-cyan-500" />)}
              </div>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono relative overflow-hidden flex items-center justify-center">
      <ParticleBackground />
      {/* Main Form Section */}
      <motion.div
        className="max-w-lg w-full mx-auto bg-gray-800 rounded-xl shadow-2xl p-6 relative overflow-hidden border border-cyan-800"
        initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.8, type: 'spring', stiffness: 80 }}
      >
        {/* Glowing Circuit Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
        <motion.div
          className="absolute -inset-2 bg-cyan-500/20 blur-xl"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        <div className="flex flex-col items-center mb-4 relative z-10">
          <motion.div
            initial={{ scale: 0, rotate: 180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
          >
            <LockClosedIcon className="w-16 h-16 text-cyan-400 mb-2 animate-pulse" />
          </motion.div>
          <motion.h1
            className="text-3xl font-bold text-cyan-100 mb-1"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Register
          </motion.h1>
          <p className="text-cyan-300 text-center text-sm">Join the SmartEcoLock community</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-4"
        >
          <div className="flex justify-between mb-1">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`text-xs ${currentStep >= step.id ? 'text-cyan-200' : 'text-gray-400'}`}
              >
                {step.title}
              </div>
            ))}
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${formProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>

        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          {renderStepContent()}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
            className="flex justify-between mt-6 pt-4 border-t border-gray-700"
          >
            {currentStep > 1 && (
              <motion.button
                type="button"
                onClick={prevStep}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 rounded-lg bg-gray-700 text-cyan-200 hover:bg-gray-600 transition-all duration-300"
              >
                Back
              </motion.button>
            )}
            {currentStep < steps.length ? (
              <motion.button
                type="button"
                onClick={nextStep}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-all duration-300 ml-auto"
              >
                Continue
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold p-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-cyan-500/50"
              >
                {isLoading ? (
                  <span className="animate-spin">
                    <ArrowPathIcon className="w-5 h-5" />
                  </span>
                ) : (
                  <>
                    Complete Registration
                    <CheckIcon className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-center mt-4"
          >
            <p className="text-gray-400 text-sm">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline transition-all duration-300"
              >
                Sign in
              </Link>
            </p>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
};

export default Register;