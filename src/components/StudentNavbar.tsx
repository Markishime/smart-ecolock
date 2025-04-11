import { Fragment, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  UserIcon,
  AcademicCapIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowLeftEndOnRectangleIcon,
  BellIcon,
  Bars3Icon, // Hamburger icon
  XMarkIcon, // Close icon
} from '@heroicons/react/24/outline';
import { useAuth } from '../Pages/AuthContext';
import { motion } from 'framer-motion';

// Particle Background Component with Responsive Adjustments
const ParticleBackground: React.FC = () => {
  // Reduce the number of particles on mobile for performance
  const particleCount = window.innerWidth < 640 ? 5 : 10;
  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    speedX: (Math.random() - 0.5) * 0.2,
    speedY: (Math.random() - 0.5) * 0.2,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle, index) => (
        <motion.div
          key={index}
          className="absolute w-1 h-1 sm:w-1.5 sm:h-1.5 bg-cyan-400 rounded-full"
          initial={{ x: `${particle.x}vw`, y: `${particle.y}vh`, opacity: 0.6 }}
          animate={{
            x: `${particle.x + particle.speedX * 50}vw`,
            y: `${particle.y + particle.speedY * 50}vh`,
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{
            duration: window.innerWidth < 640 ? 10 : 15, // Faster animation on mobile
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      ))}
    </div>
  );
};

interface StudentNavbarProps {
  student: {
    fullName: string;
    department: string;
    section: string;
  };
}

const StudentNavbar: React.FC<StudentNavbarProps> = ({ student }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State for hamburger menu

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem('userRole');
      localStorage.removeItem('userData');
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white shadow-lg z-50 font-mono overflow-visible">
      <ParticleBackground />
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <AcademicCapIcon className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-400" />
            <div className="ml-2 sm:ml-3">
              <span className="text-lg sm:text-xl font-semibold text-cyan-100">Smart EcoLock</span>
              <p className="text-xs sm:text-sm text-cyan-300">{student.department}</p>
            </div>
          </div>

          {/* Navigation Links and Profile */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Hamburger Menu for Mobile */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="sm:hidden p-2 text-cyan-200 hover:text-cyan-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>

            {/* Navigation Links - Hidden on mobile, shown on sm and above */}
            <div className="hidden sm:flex items-center space-x-4">
              <Link
                to="/student/dashboard"
                className="text-cyan-200 hover:text-white hover:bg-gray-800/50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/student/student-schedules"
                className="text-cyan-200 hover:text-white hover:bg-gray-800/50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Student Schedules
              </Link>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="relative p-2 text-cyan-200 hover:text-cyan-100"
              >
                <BellIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="absolute top-0 right-0 h-3 w-3 sm:h-4 sm:w-4 bg-red-500 rounded-full text-[8px] sm:text-xs flex items-center justify-center border border-cyan-800">
                  1
                </span>
              </motion.button>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 sm:space-x-3 focus:outline-none hover:opacity-80 transition-opacity"
                aria-label="User profile menu"
              >
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-700/50 flex items-center justify-center border border-cyan-800">
                  <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs sm:text-sm font-medium text-cyan-100">
                    {student.fullName.length > 12 ? student.fullName.substring(0, 12) + '...' : student.fullName}
                  </p>
                  <p className="text-[10px] sm:text-xs text-cyan-300">{student.section}</p>
                </div>
              </button>

              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-40 sm:w-48 rounded-xl shadow-xl py-1 bg-gray-800/80 backdrop-blur-lg border border-cyan-800 z-50"
                  style={{ top: '100%' }}
                >
                  <Link
                    to="/student/profile"
                    className="flex items-center px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm text-cyan-100 hover:bg-gray-700 transition-colors"
                  >
                    <UserIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-cyan-400" />
                    Your Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    <ArrowLeftEndOnRectangleIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-red-400" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu - Shown when hamburger menu is open */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden bg-gray-800/90 backdrop-blur-lg border-t border-cyan-800"
          >
            <div className="flex flex-col space-y-2 px-4 py-3">
              <Link
                to="/student/dashboard"
                onClick={() => setIsMenuOpen(false)}
                className="text-cyan-200 hover:text-white hover:bg-gray-700/50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/student/student-schedules"
                onClick={() => setIsMenuOpen(false)}
                className="text-cyan-200 hover:text-white hover:bg-gray-700/50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Student Schedules
              </Link>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center text-cyan-200 hover:text-cyan-100 px-3 py-2 rounded-md text-sm font-medium"
              >
                <BellIcon className="h-5 w-5 mr-2" />
                Notifications
                <span className="ml-2 h-3 w-3 bg-red-500 rounded-full text-[8px] flex items-center justify-center border border-cyan-800">
                  1
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
};

export default StudentNavbar;