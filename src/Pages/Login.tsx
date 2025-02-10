import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
  NumberedListIcon,
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';

const Login: React.FC = () => {
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inputFocus, setInputFocus] = useState({
    id: false,
    password: false
  });
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const collections = [
        { name: 'users', role: 'admin' },
        { name: 'students', role: 'student' },
        { name: 'teachers', role: 'instructor' }
      ];

      let userData = null;
      let userEmail = '';
      let userRole = '';

      for (const col of collections) {
        const collectionRef = collection(db, col.name);
        const userQuery = query(collectionRef, where("idNumber", "==", idNumber));
        const snapshot = await getDocs(userQuery);

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          userData = userDoc.data();
          userEmail = userData.email;
          userRole = col.role;
          break; // Important: Exit the loop once a match is found
        }
      }

      if (!userData) {
        throw new Error('No user found with this ID number');
      }

      await signInWithEmailAndPassword(auth, userEmail, password);

      // Store user details
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('userId', userData.uid);
      localStorage.setItem('userName', userData.fullName);
      localStorage.setItem('isAdmin', userRole === 'admin' ? 'true' : 'false');

      console.log(`Redirecting to ${userRole} dashboard...`);

      // Navigate based on role (using a switch for cleaner code)
      switch (userRole) {
        case 'admin':
          navigate('/admin', { replace: true });
          break;
        case 'student':
          navigate('/studentdashboard', { replace: true });
          break;
        case 'instructor':
          navigate('/dashboard', { replace: true });
          break;
        default:
          throw new Error('Invalid user role');
      }

      Swal.fire({
        icon: 'success',
        title: `Welcome, ${userData.fullName}!`,
        text: `Logged in as ${userRole}`,
        showConfirmButton: false,
        timer: 1500,
        background: '#f8fafc',
        iconColor: '#3b82f6'
      });

    } catch (error) {
      console.error("Login Error:", error);
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: error instanceof Error ? error.message : 'Invalid credentials', // More specific error message
        confirmButtonColor: '#3b82f6',
        background: '#f8fafc'
      });
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div 
        className="w-full max-w-lg"
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
                Secure Login
              </motion.h1>
              <p className="text-gray-500">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <AnimatePresence>
                {/* ID Number Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="relative">
                    <label 
                      className={`absolute left-4 transition-all duration-200 ${
                        inputFocus.id || idNumber 
                          ? 'top-1 text-sm text-indigo-600'
                          : 'top-4 text-gray-400'
                      }`}
                    >
                      ID Number
                    </label>
                    <input
                      type="text"
                      className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 pr-12"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
                      onFocus={() => setInputFocus(prev => ({ ...prev, id: true }))}
                      onBlur={() => setInputFocus(prev => ({ ...prev, id: false }))}
                      maxLength={12}
                      required
                    />
                    {idNumber.length === 12 && (
                      <CheckIcon className="w-5 h-5 text-green-500 absolute right-12 top-5" />
                    )}
                    <NumberedListIcon className="w-5 h-5 text-indigo-600 absolute right-4 top-5" />
                  </div>
                </motion.div>

                {/* Password Input */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="relative">
                    <label 
                      className={`absolute left-4 transition-all duration-200 ${
                        inputFocus.password || password 
                          ? 'top-1 text-sm text-indigo-600'
                          : 'top-4 text-gray-400'
                      }`}
                    >
                      Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full p-4 pt-6 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 pr-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  </div>
                </motion.div>

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold p-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <LockClosedIcon className="w-5 h-5" />
                        Login
                      </>
                    )}
                  </button>
                </motion.div>
              </AnimatePresence>
            </form>

            <motion.div 
              className="mt-8 text-center space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <Link 
                to="/reset-password" 
                className="text-indigo-600 hover:text-indigo-800 text-sm inline-block hover:underline"
              >
                Forgot Password?
              </Link>
              <p className="text-gray-500 text-sm">
                Don't have an account?{' '}
                <Link 
                  to="/register" 
                  className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                >
                  Create Account
                </Link>
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;