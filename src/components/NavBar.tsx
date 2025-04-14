import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AcademicCapIcon, UserIcon, ClockIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../Pages/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Swal from 'sweetalert2';

interface Subject {
  id: string;
  name: string;
  department: string;
  details?: string;
  code?: string;
  credits?: number;
  prerequisites?: string[];
  learningObjectives?: string[];
  status: 'active' | 'inactive';
  teacherId?: string | null;
}

interface Schedule {
  id: string;
  subject: string;
  room: string;
  day: string;
  startTime: string;
  endTime: string;
  department: string;
  status: 'active' | 'inactive';
  instructor: string;
  instructorEmail: string;
  instructorDepartment: string;
  subjectDetails: Subject | null;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  subjects: Subject[];
  schedules: Schedule[];
  uid: string;
  fullName: string;
}

interface NavBarProps {
  currentTime?: Date;
  user: {
    role: 'admin' | 'instructor' | 'student';
    fullName: string;
    department: string;
  };
  classStatus: {
    status: string;
    color: string;
    details: string;
    fullName: string;
  };
}

const NavBar: React.FC<NavBarProps> = ({ currentTime = new Date(), user, classStatus }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [instructorFullName, setInstructorFullName] = useState<string>(user.fullName);

  useEffect(() => {
    const fetchInstructorDetails = async () => {
      if (!currentUser || !currentUser.uid || user.fullName) return;

      try {
        const teachersRef = collection(db, 'teachers');
        const q = query(teachersRef, where('uid', '==', currentUser.uid));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const teacherData = snapshot.docs[0].data() as Instructor;
          setInstructorFullName(teacherData.fullName || 'Unknown Instructor');
        } else {
          console.warn('No teacher found for UID:', currentUser.uid);
          setInstructorFullName('Unknown Instructor');
        }
      } catch (error) {
        console.error('Error fetching teacher details:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch teacher details.',
          confirmButtonColor: '#00b4d8',
          background: '#1e293b',
          customClass: {
            popup: 'rounded-xl border border-cyan-800',
            title: 'text-cyan-100',
            htmlContainer: 'text-cyan-300',
            confirmButton: 'bg-cyan-600 hover:bg-cyan-700',
          },
        });
      }
    };

    fetchInstructorDetails();
  }, [currentUser, user.fullName]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');

      Swal.fire({
        icon: 'success',
        title: 'Logged Out Successfully',
        text: 'You have been logged out of your account.',
        showConfirmButton: false,
        timer: 1500,
        background: '#1e293b',
        customClass: {
          popup: 'rounded-xl border border-cyan-800',
          title: 'text-cyan-100',
          htmlContainer: 'text-cyan-300',
        },
      });
    } catch (error) {
      console.error('Error logging out:', error);

      Swal.fire({
        icon: 'error',
        title: 'Logout Failed',
        text: 'There was an error logging out. Please try again.',
        confirmButtonColor: '#00b4d8',
        background: '#1e293b',
        customClass: {
          popup: 'rounded-xl border border-cyan-800',
          title: 'text-cyan-100',
          htmlContainer: 'text-cyan-300',
          confirmButton: 'bg-cyan-600 hover:bg-cyan-700',
        },
      });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white shadow-lg z-50 font-mono">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 sm:py-0 sm:h-16">
          {/* Logo and Brand */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AcademicCapIcon className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-400" />
              </div>
              <div className="ml-2 sm:ml-4">
                <h1 className="text-lg sm:text-xl font-semibold text-cyan-100">Smart EcoLock</h1>
                <p className="text-xs sm:text-sm text-cyan-300">{user.department}</p>
              </div>
            </div>
            {/* Mobile Profile Icon (Visible only on mobile) */}
            <div className="sm:hidden flex items-center">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 focus:outline-none hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full bg-gray-700/50 flex items-center justify-center border border-cyan-800">
                  <UserIcon className="h-5 w-5 text-cyan-400" />
                </div>
              </button>
            </div>
          </div>

          {/* Center Status Section */}
          <div className="flex-1 flex items-center justify-center px-2 sm:px-4 mt-2 sm:mt-0">
            <motion.div
              className={`
                px-4 py-1.5 sm:px-6 sm:py-2 rounded-xl backdrop-blur-lg bg-gray-800/80 border border-cyan-800 shadow-xl w-full sm:w-auto text-center
                ${classStatus.status === 'Class In Session'
                  ? 'border-l-green-500'
                  : classStatus.status === 'Starting Soon'
                  ? 'border-l-cyan-500'
                  : classStatus.status === 'Classes Ended'
                  ? 'border-l-amber-500'
                  : 'border-l-gray-500'
                }
              `}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                {classStatus.status === 'Class In Session' ? (
                  <div className="flex items-center">
                    <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-green-400 animate-pulse mr-1 sm:mr-2" />
                    <span className="font-medium text-green-300 text-xs sm:text-sm">Active</span>
                  </div>
                ) : classStatus.status === 'Starting Soon' ? (
                  <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                ) : (
                  <BookOpenIcon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                )}
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-medium text-cyan-100">{classStatus.status}</span>
                  <span className="text-[10px] sm:text-xs text-cyan-300 truncate max-w-[150px] sm:max-w-[200px]">{classStatus.details}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Section (Hidden on mobile, except for dropdown) */}
          <div className="hidden sm:flex items-center space-x-4 sm:space-x-6 mt-2 sm:mt-0">
            {/* Time */}
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-cyan-100">
                {currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
              <span className="text-xs text-cyan-300">Class Time</span>
            </div>

            {/* Profile with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-3 focus:outline-none hover:opacity-80 transition-opacity"
              >
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-cyan-100 truncate max-w-[120px]">{instructorFullName}</span>
                  <span className="text-xs text-cyan-300">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-700/50 flex items-center justify-center border border-cyan-800">
                  <UserIcon className="h-6 w-6 text-cyan-400" />
                </div>
              </button>
            </div>
          </div>

          {/* Dropdown Menu (Shared for both mobile and desktop) */}
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-2 sm:right-4 top-[4.5rem] sm:top-14 mt-2 w-40 sm:w-48 rounded-xl shadow-xl py-1 bg-gray-800/80 backdrop-blur-lg border border-cyan-800 z-50"
            >
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-cyan-100 hover:bg-gray-700 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-2 text-cyan-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
