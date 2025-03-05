import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import {
  LockClosedIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  NumberedListIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { useAuth } from '../Pages/AuthContext';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface UserData {
  id: string;
  fullName: string;
  email: string;
  idNumber: string;
  role?: string;
  department?: string;
}

interface TeacherData {
  idNumber: string;
  fullName: string;
  department: string;
  email: string;
}

const Login: React.FC = () => {
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inputFocus, setInputFocus] = useState({
      
    id: false,
    password: false
  });
  const { login, setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First find the user by ID number
      let userEmail = '';
      let userRole = '';
      let userData = null;

      // Check users collection for admin
      const usersRef = collection(db, 'users');
      const adminQuery = query(usersRef, where("idNumber", "==", idNumber));
      const adminSnapshot = await getDocs(adminQuery);

      if (!adminSnapshot.empty) {
        const userDoc = adminSnapshot.docs[0];
        userData = { id: userDoc.id, ...userDoc.data() } as UserData;
        userEmail = userData.email;
        userRole = 'admin';
      } else {
        // Check teachers collection
        const teachersRef = collection(db, 'teachers');
        const teacherQuery = query(teachersRef, where("idNumber", "==", idNumber));
        const teacherSnapshot = await getDocs(teacherQuery);

        if (!teacherSnapshot.empty) {
          const userDoc = teacherSnapshot.docs[0];
          userData = { id: userDoc.id, ...userDoc.data() } as UserData;
          userEmail = userData.email;
          userRole = 'instructor';
        } else {
          // Check students collection
          const studentsRef = collection(db, 'students');
          const studentQuery = query(studentsRef, where("idNumber", "==", idNumber));
          const studentSnapshot = await getDocs(studentQuery);

          if (!studentSnapshot.empty) {
            const userDoc = studentSnapshot.docs[0];
            userData = { id: userDoc.id, ...userDoc.data() } as UserData;
            userEmail = userData.email;
            userRole = 'student';
          }
        }
      }

      if (!userData) {
        throw new Error('No user found with this ID number');
      }

      // Login with email/password
      await signInWithEmailAndPassword(auth, userEmail, password);

      // Store user role and data
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('userData', JSON.stringify(userData));

      if (userRole === 'instructor') {
        localStorage.setItem('teacherData', JSON.stringify({
          idNumber: userData.idNumber,
          fullName: userData.fullName,
          department: userData.department,
          email: userData.email
        }));
      }

      Swal.fire({
        icon: 'success',
        title: 'Login Successful',
        text: `Welcome back, ${userData.fullName}!`,
        showConfirmButton: false,
        timer: 1500
      });

      // Navigate based on role
      const routes = {
        admin: '/admin/dashboard',
        instructor: '/instructor/dashboard',
        student: '/student/dashboard'
      };

      navigate(routes[userRole as keyof typeof routes], { replace: true });

    } catch (error) {
      console.error('Login error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: error instanceof Error ? error.message : 'Invalid credentials'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600">
      <div className="absolute inset-0 bg-pattern opacity-10"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-8 py-10 bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 pointer-events-none"></div>
        
        <div className="relative">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-16 h-16 bg-white rounded-2xl shadow-lg mx-auto mb-4 flex items-center justify-center"
            >
              <LockClosedIcon className="w-8 h-8 text-indigo-600" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-white/80">Sign in to your account</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="mb-8">
              <div className="flex items-center justify-center space-x-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white">
                  Student
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white">
                  Instructor
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white">
                  Admin
                </span>
              </div>
            </div>

            <div>
              <label className="block text-white/90 text-sm font-medium mb-2">
                ID Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  onFocus={() => setInputFocus({ ...inputFocus, id: true })}
                  onBlur={() => setInputFocus({ ...inputFocus, id: false })}
                  className={`
                    w-full px-4 py-3 rounded-xl
                    bg-white/10 border border-white/20
                    text-white placeholder-white/50
                    focus:outline-none focus:ring-2 focus:ring-white/30
                    transition-all duration-200
                  `}
                  placeholder="Enter your ID number"
                  required
                />
                <div className="absolute left-3 top-3">
                </div>
              </div>
            </div>

            <div>
              <label className="block text-white/90 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setInputFocus({ ...inputFocus, password: true })}
                  onBlur={() => setInputFocus({ ...inputFocus, password: false })}
                  className={`
                    w-full px-4 py-3 rounded-xl
                    bg-white/10 border border-white/20
                    text-white placeholder-white/50
                    focus:outline-none focus:ring-2 focus:ring-white/30
                    transition-all duration-200
                  `}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-white/50 hover:text-white/80 transition-colors"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-6 h-6" />
                  ) : (
                    <EyeIcon className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center text-white/80">
                <input type="checkbox" className="rounded border-white/20 bg-white/10 text-indigo-600 focus:ring-indigo-500" />
                <span className="ml-2">Remember me</span>
              </label>
              <Link to="/reset-password" className="text-white/80 hover:text-white transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full py-3 px-4 rounded-xl
                bg-white text-indigo-600 font-medium
                hover:bg-indigo-50 
                focus:outline-none focus:ring-2 focus:ring-white/50
                transition-all duration-200
                flex items-center justify-center
                ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}
              `}
            >
              {isLoading ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In
                  <CheckIcon className="w-5 h-5 ml-2" />
                </>
              )}
            </button>

            <p className="text-center text-white/80">
              Don't have an account?{' '}
              <Link to="/rfid-registration" className="text-white font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;