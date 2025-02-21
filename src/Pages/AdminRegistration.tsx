import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'framer-motion';
import { LockClosedIcon, CheckIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { useNavigate, Link } from 'react-router-dom';


const AdminRegister: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        fullName: formData.fullName,
        idNumber: formData.idNumber,
        email: formData.email,
        role: 'admin', // Set the role to 'admin'
        createdAt: new Date().toISOString()
      });

      Swal.fire({
        icon: 'success',
        title: 'Admin Registration Successful!',
        text: 'Welcome to Smart EcoLock System',
        showConfirmButton: false,
        timer: 2000,
        background: '#f8fafc',
        iconColor: '#3b82f6'
      });

      navigate('/login'); // Redirect to login page after registration
    } catch (error) {
      console.error('Admin Registration error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Admin Registration Failed',
        text: error instanceof Error ? error.message : 'An error occurred',
        confirmButtonColor: '#3b82f6',
        background: '#f8fafc'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12">
          <div className="flex flex-col items-center mb-8">
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
              Admin Registration
            </motion.h1>
            <p className="text-gray-500">Create an admin account</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            {/* Full Name */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-lg font-medium mb-2">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  required
                />
                {formData.fullName && (
                  <CheckIcon className="w-5 h-5 text-green-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* ID Number */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-lg font-medium mb-2">ID Number</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  value={formData.idNumber}
                  onChange={(e) => handleInputChange('idNumber', e.target.value)}
                  required
                />
                {formData.idNumber && (
                  <CheckIcon className="w-5 h-5 text-green-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* Email */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <label className="block text-lg font-medium mb-2">Email</label>
              <div className="relative">
                <input
                  type="email"
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
                {formData.email.includes('@') && (
                  <CheckIcon className="w-5 h-5 text-green-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <label className="block text-lg font-medium mb-2">Password</label>
              <input
                type="password"
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
              />
            </motion.div>

            {/* Confirm Password */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <label className="block text-lg font-medium mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type="password"
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  required
                />
                {formData.confirmPassword === formData.password && formData.confirmPassword && (
                  <CheckIcon className="w-5 h-5 text-green-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* Register Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold p-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="animate-spin">
                    <LockClosedIcon className="w-5 h-5" />
                  </span>
                ) : (
                  <LockClosedIcon className="w-5 h-5" />
                )}
                Register Admin
              </button>
            </motion.div>

            {/* Link to Login Page */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              className="text-center mt-4"
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
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminRegister;