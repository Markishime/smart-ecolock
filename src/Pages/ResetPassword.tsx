import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LockClosedIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase'; // Ensure you have your Firebase config and auth initialized
import { sendPasswordResetEmail } from 'firebase/auth';

const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await sendPasswordResetEmail(auth, email);
      Swal.fire({
        icon: 'success',
        title: 'Email Sent',
        text: 'Check your inbox for a password reset link.',
      });
      navigate('/login'); // Redirect to login after sending the email
    } catch (error) {
      console.error('Error sending password reset email:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Failed to send reset email',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl relative overflow-hidden"
      >
        <div className="relative p-8">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-16 h-16 bg-white rounded-2xl shadow-lg mx-auto mb-4 flex items-center justify-center"
            >
              <LockClosedIcon className="w-8 h-8 text-indigo-600" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2">Reset Password</h2>
            <p className="text-white/80">Enter your email to reset your password</p>
          </div>

          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-white/90 text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200"
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="flex justify-between mt-8">
              <button
                type="submit"
                disabled={isLoading}
                className={`px-6 py-3 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 transition-colors ml-auto flex items-center space-x-2 ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <CheckIcon className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Additional Links */}
          <div className="mt-6 text-center">
            <p className="text-white/80">
              Remembered your password?{' '}
              <Link to="/login" className="text-white font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;