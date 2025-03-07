import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AcademicCapIcon, UserIcon, ClockIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from '../Pages/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import Swal from 'sweetalert2';

interface Subject{
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
      
      // Show success message with correct property names
      Swal.fire({
        icon: 'success',
        title: 'Logged Out Successfully',
        text: 'You have been logged out of your account.',
        showConfirmButton: false,
        timer: 1500,
        background: '#F9FAFB',
        customClass: {
          popup: 'rounded-xl border border-indigo-100',
          title: 'text-indigo-900',
          htmlContainer: 'text-indigo-700'
        }
      });
    } catch (error) {
      console.error('Error logging out:', error);
      
      // Show error message with correct property names
      Swal.fire({
        icon: 'error',
        title: 'Logout Failed',
        text: 'There was an error logging out. Please try again.',
        confirmButtonColor: '#4F46E5',
        background: '#F9FAFB',
        customClass: {
          popup: 'rounded-xl border border-indigo-100',
          title: 'text-indigo-900',
          htmlContainer: 'text-indigo-700',
          confirmButton: 'bg-indigo-600 hover:bg-indigo-700'
        }
      });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AcademicCapIcon className="h-8 w-8 text-indigo-300" />
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-semibold">Smart EcoLock</h1>
              <p className="text-sm text-indigo-200">{user.department}</p>
            </div>
            <Link
              to={`/${user.role}/dashboard`}
              className="ml-6 flex items-center px-4 py-2 text-sm font-medium text-indigo-100 hover:text-white hover:bg-indigo-500/20 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Dashboard
            </Link>
          </div>

          {/* Center Status Section */}
          <div className="flex-1 flex items-center justify-center px-4">
            <div className={`
              px-6 py-2 rounded-full 
              ${classStatus.status === 'Class In Session' ? 'bg-green-500/20 border border-green-400/50' :
                classStatus.status === 'Starting Soon' ? 'bg-indigo-500/20 border border-indigo-400/50' :
                classStatus.status === 'Classes Ended' ? 'bg-amber-500/20 border border-amber-400/50' :
                'bg-gray-500/20 border border-gray-400/50'}
            `}>
              <div className="flex items-center space-x-3">
                {classStatus.status === 'Class In Session' ? (
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse mr-2" />
                    <span className="font-medium text-green-300">Active</span>
                  </div>
                ) : classStatus.status === 'Starting Soon' ? (
                  <ClockIcon className="h-5 w-5 text-indigo-300" />
                ) : (
                  <BookOpenIcon className="h-5 w-5 text-amber-300" />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {classStatus.status}
                  </span>
                  <span className="text-xs opacity-75">
                    {classStatus.details}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-6">
            {/* Time */}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium">{currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}</span>
              <span className="text-xs text-indigo-200">Class Time</span>
            </div>

            {/* Profile with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-3 focus:outline-none hover:opacity-80 transition-opacity"
              >
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium">{user.fullName}</span>
                  <span className="text-xs text-indigo-200">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-indigo-500/30 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-indigo-200" />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-50"
                >
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;