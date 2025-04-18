import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, onValue, off, set } from 'firebase/database';
import { auth, db, rtdb } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { LockClosedIcon, CheckIcon, UserIcon, IdentificationIcon, EnvelopeIcon, KeyIcon, RssIcon, BellIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { useNavigate, Link } from 'react-router-dom';

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

const AdminRegister: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    rfidUid: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [unregisteredUids, setUnregisteredUids] = useState<string[]>([]);
  const navigate = useNavigate();

  // Fetch unregistered UIDs from Realtime Database
  useEffect(() => {
    const unregisteredUidsRef = ref(rtdb, '/Unregistered');
    
    const handleSnapshot = (snapshot: any) => {
      const uids = snapshot.val();
      if (uids) {
        // Convert object to array properly
        if (typeof uids === 'object' && uids !== null) {
          const uidArray = Object.entries(uids).map(([key, value]) => {
            // Handle both cases where value might be the UID or key might be the UID
            return (typeof value === 'string') ? value : key;
          });
          setUnregisteredUids(uidArray);
        } else {
          setUnregisteredUids([]);
        }
      } else {
        setUnregisteredUids([]);
      }
    };
    
    onValue(unregisteredUidsRef, handleSnapshot);

    return () => {
      off(unregisteredUidsRef, 'value', handleSnapshot);
    };
  }, []);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (!formData.rfidUid && unregisteredUids.length > 0) {
        throw new Error('Please select an RFID UID');
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
        role: 'admin',
        rfidUid: formData.rfidUid,
        createdAt: new Date().toISOString(),
      });

      if (formData.rfidUid) {
        const uidRef = ref(rtdb, `/Unregistered/${formData.rfidUid}`);
        await set(uidRef, null);
      }

      Swal.fire({
        icon: 'success',
        title: 'Admin Registration Successful!',
        text: 'Welcome to SmartEcoLock System',
        showConfirmButton: false,
        timer: 2000,
        background: '#1e293b',
        iconColor: '#22d3ee',
      });

      navigate('/login');
    } catch (error) {
      console.error('Admin Registration error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Admin Registration Failed',
        text: error instanceof Error ? error.message : 'An error occurred',
        confirmButtonColor: '#22d3ee',
        background: '#1e293b',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono relative overflow-hidden">
      <ParticleBackground />
      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 relative z-10">

        {/* Main Form Section */}
        <motion.div
          className="max-w-lg mx-auto bg-gray-800 rounded-xl shadow-2xl p-8 relative overflow-hidden border border-cyan-800"
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
              <LockClosedIcon className="w-16 h-16 text-cyan-400 mb-4 animate-pulse" />
            </motion.div>
            <motion.h1
              className="text-3xl font-bold text-cyan-100 mb-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Admin Registration
            </motion.h1>
            <p className="text-cyan-300 text-center">Secure your access to SmartEcoLock</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6 relative z-10">
            {/* Full Name */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <UserIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <input
                  type="text"
                  className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  required
                  placeholder="Enter your full name"
                />
                {formData.fullName && (
                  <CheckIcon className="w-5 h-5 text-cyan-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* ID Number */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">ID Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <IdentificationIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <input
                  type="text"
                  className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400"
                  value={formData.idNumber}
                  onChange={(e) => handleInputChange('idNumber', e.target.value)}
                  required
                  placeholder="Enter your ID number"
                />
                {formData.idNumber && (
                  <CheckIcon className="w-5 h-5 text-cyan-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* Email */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <EnvelopeIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <input
                  type="email"
                  className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  placeholder="Enter your email"
                />
                {formData.email.includes('@') && (
                  <CheckIcon className="w-5 h-5 text-cyan-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* RFID UID */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">RFID UID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <RssIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <select
                  className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white"
                  value={formData.rfidUid}
                  onChange={(e) => handleInputChange('rfidUid', e.target.value)}
                  required={unregisteredUids.length > 0}
                >
                  <option value="" className="text-gray-500">Select RFID UID</option>
                  {unregisteredUids.map((uid, index) => (
                    <option key={index} value={uid} className="text-white">
                      {uid}
                    </option>
                  ))}
                </select>
                {formData.rfidUid && (
                  <CheckIcon className="w-5 h-5 text-cyan-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <KeyIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <input
                  type="password"
                  className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </div>
            </motion.div>

            {/* Confirm Password */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, type: 'tween' }}
            >
              <label className="block text-sm font-medium text-cyan-200 mb-2">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <KeyIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <input
                  type="password"
                  className="w-full pl-10 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 bg-gray-700 text-white placeholder-gray-400"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  required
                  placeholder="Confirm your password"
                />
                {formData.confirmPassword === formData.password && formData.confirmPassword && (
                  <CheckIcon className="w-5 h-5 text-cyan-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                )}
              </div>
            </motion.div>

            {/* Register Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, type: 'spring', stiffness: 100 }}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold p-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-cyan-500/50"
              >
                {isLoading ? (
                  <span className="animate-spin">
                    <LockClosedIcon className="w-5 h-5" />
                  </span>
                ) : (
                  <LockClosedIcon className="w-5 h-5" />
                )}
                Register as Admin
              </button>
            </motion.div>

            {/* Link to Login Page */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="text-center mt-4"
            >
              <p className="text-gray-400">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline transition-all duration-300"
                >
                  Login Here
                </Link>
              </p>
            </motion.div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminRegister;