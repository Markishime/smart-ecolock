import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LockClosedIcon, CheckIcon, ArrowPathIcon, EnvelopeIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

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
        showConfirmButton: false,
        timer: 1500,
        background: '#F9FAFB',
        iconColor: '#22d3ee',
      });
      navigate('/login');
    } catch (error) {
      console.error('Error sending password reset email:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Failed to send reset email',
        confirmButtonColor: '#22d3ee',
        background: '#F9FAFB',
      });
    } finally {
      setIsLoading(false);
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
            Reset Password
          </motion.h1>
          <p className="text-cyan-300 text-center text-sm">Enter your email to reset your password</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, type: 'tween' }}
          >
            <label className="block text-sm font-medium text-cyan-200 mb-2">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <EnvelopeIcon className="w-5 h-5 text-cyan-500" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400"
                placeholder="Enter your email"
                required
              />
              {email && (
                <CheckIcon className="w-5 h-5 text-cyan-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
          >
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold p-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-cyan-500/50"
            >
              {isLoading ? (
                <span className="animate-spin">
                  <ArrowPathIcon className="w-5 h-5" />
                </span>
              ) : (
                <>
                  Reset Password
                  <CheckIcon className="w-5 h-5" />
                </>
              )}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-center mt-4"
          >
            <p className="text-gray-400 text-sm">
              Remembered your password?{' '}
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

export default ResetPassword;