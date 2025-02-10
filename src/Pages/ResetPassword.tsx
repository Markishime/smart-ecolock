import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'framer-motion';
import { LockClosedIcon, EnvelopeIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email);
      Swal.fire({
        icon: 'success',
        title: 'Email Sent!',
        html: `
          <p>Password reset instructions sent to <strong>${email}</strong></p>
          <p class="text-sm mt-2">Check your spam folder if you don't see it.</p>
        `,
        confirmButtonColor: '#3b82f6',
      });
      setEmail('');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Reset Failed',
        text: error instanceof Error ? error.message : 'Failed to send reset email',
        confirmButtonColor: '#ef4444',
      });
    }
  };

  return (
    <motion.div 
      className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.form 
        onSubmit={handleResetPassword} 
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 sm:p-10"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="p-4 bg-indigo-100 rounded-full">
              <LockClosedIcon className="w-12 h-12 text-indigo-600" />
            </div>
          </motion.div>
          <motion.h1
            className="text-3xl font-bold mt-4 text-gray-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Reset Password
          </motion.h1>
          <motion.p
            className="text-gray-500 text-center mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Enter your email address to receive a password reset link.
          </motion.p>
        </div>

        {/* Email Input */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <label className="block text-sm font-medium mb-2">Email Address</label>
          <div className="relative">
            <EnvelopeIcon className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full pl-10 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </motion.div>

        {/* Reset Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            <LockClosedIcon className="w-5 h-5" />
            Send Reset Email
          </button>
        </motion.div>

        {/* Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-center space-y-2"
        >
          <p className="text-gray-500">
            Remember your password?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline">
              Login here
            </Link>
          </p>
          <p className="text-gray-500">
            Need an account?{' '}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline">
              Register here
            </Link>
          </p>
        </motion.div>
      </motion.form>
    </motion.div>
  );
};

export default ResetPassword;