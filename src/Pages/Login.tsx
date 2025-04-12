import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  LockClosedIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  UserIcon,
  KeyIcon,
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

// Particle Background Component
const ParticleBackground: React.FC = () => {
  const particles = Array.from({ length: 20 }, () => ({
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

const Login: React.FC = () => {
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inputFocus, setInputFocus] = useState({
    id: false,
    password: false,
  });
  const { login, setUser } = useAuth();
  const navigate = useNavigate();
  let userRole = '';

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First find the user by ID number
      let userEmail = '';
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

      // Set user role
      userRole = userRole;

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
          email: userData.email,
        }));
      }

      Swal.fire({
        icon: 'success',
        title: 'Login Successful',
        text: `Welcome back, ${userData.fullName}!`,
        showConfirmButton: false,
        timer: 1500,
        background: '#F9FAFB',
        iconColor: '#22d3ee',
      });

      // Navigate based on role
      const routes = {
        admin: '/admin/dashboard',
        instructor: '/instructor/dashboard',
        student: '/student/dashboard',
      };

      navigate(routes[userRole as keyof typeof routes], { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: error instanceof Error ? error.message : 'Invalid credentials',
        confirmButtonColor: '#22d3ee',
        background: '#F9FAFB',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono relative overflow-hidden flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <ParticleBackground />
      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md sm:max-w-lg">
        {/* Main Form Section */}
        <motion.div
          className="bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 relative overflow-hidden border border-cyan-800"
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

          <div className="flex flex-col items-center mb-6 relative z-10">
            <motion.div
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
            >
              <LockClosedIcon className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-400 mb-4 animate-pulse" />
            </motion.div>
            <motion.h1
              className="text-2xl sm:text-3xl font-bold text-cyan-100 mb-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Login
            </motion.h1>
            <p className="text-cyan-300 text-center text-sm sm:text-base">Access your SmartEcoLock account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            {/* ID Number */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">ID Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <UserIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  onFocus={() => setInputFocus({ ...inputFocus, id: true })}
                  onBlur={() => setInputFocus({ ...inputFocus, id: false })}
                  className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base"
                  placeholder="Enter your ID number"
                  required
                />
                {idNumber && (
                  <CheckIcon className="w-5 h-5 text-cyan-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <KeyIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setInputFocus({ ...inputFocus, password: true })}
                  onBlur={() => setInputFocus({ ...inputFocus, password: false })}
                  className="w-full pl-10 pr-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-500 hover:text-cyan-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </motion.div>

            {/* Remember Me and Forgot Password */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, type: 'tween' }}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-400 space-y-2 sm:space-y-0"
            >
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-700 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="ml-2">Remember me</span>
              </label>
              <Link to="/reset-password" className="text-cyan-400 hover:text-cyan-300 transition-all duration-300">
                Forgot password?
              </Link>
            </motion.div>

            {/* Sign In Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, type: 'spring', stiffness: 100 }}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold p-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-cyan-500/50 text-sm sm:text-base"
              >
                {isLoading ? (
                  <span className="animate-spin">
                    <ArrowPathIcon className="w-5 h-5" />
                  </span>
                ) : (
                  <>
                    Sign In
                    <LockClosedIcon className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>

            {/* Link to Sign Up */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="text-center mt-4"
            >
              <p className="text-gray-400 text-sm sm:text-base">
                Don't have an account?{' '}
                <Link
                  to="/rfid-registration"
                  className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline transition-all duration-300"
                >
                  Sign up
                </Link>
              </p>
            </motion.div>
          </form>
        </motion.div>

        {/* Footer */}
        <footer className="mt-6 sm:mt-8 text-center text-gray-400 text-xs sm:text-sm">
          <p>© 2025 SmartEcoLock Tech System. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default Login;