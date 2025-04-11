import { Fragment, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  UserIcon,
  AcademicCapIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowLeftEndOnRectangleIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../Pages/AuthContext';
import { motion } from 'framer-motion';

// Particle Background Component (unchanged)
const ParticleBackground: React.FC = () => {
  const particles = Array.from({ length: 10 }, () => ({
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <AcademicCapIcon className="h-8 w-8 text-cyan-400" />
            <div className="ml-2">
              <span className="text-xl font-semibold text-cyan-100">Smart EcoLock</span>
              <p className="text-sm text-cyan-300">{student.department}</p>
            </div>
          </div>

          {/* Navigation Links and Profile */}
          <div className="flex items-center space-x-4">
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
              <BellIcon className="h-6 w-6" />
              <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-xs flex items-center justify-center border border-cyan-800">
                1
              </span>
            </motion.button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-3 focus:outline-none hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full bg-gray-700/50 flex items-center justify-center border border-cyan-800">
                  <UserIcon className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-cyan-100">{student.fullName}</p>
                  <p className="text-xs text-cyan-300">{student.section}</p>
                </div>
              </button>

              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl py-1 bg-gray-800/80 backdrop-blur-lg border border-cyan-800 z-50"
                  style={{ top: '100%' }}
                >
                  <Link
                    to="/student/profile"
                    className="flex items-center px-4 py-2 text-sm text-cyan-100 hover:bg-gray-700 transition-colors"
                  >
                    <UserIcon className="h-4 w-4 mr-2 text-cyan-400" />
                    Your Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    <ArrowLeftEndOnRectangleIcon className="h-4 w-4 mr-2 text-red-400" />
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

export default StudentNavbar;