import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  BookOpenIcon,
  CalendarIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CogIcon,
  DocumentChartBarIcon,
  UserCircleIcon,
  ArrowLeftEndOnRectangleIcon,
  LockClosedIcon,
  UserGroupIcon,
  PaperAirplaneIcon,
  AcademicCapIcon,
  ClockIcon,
  UsersIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  UserIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import { useAuth } from '../Pages/AuthContext';
import { theme } from '../styles/theme';

interface Schedule {
  id: string;
  days: string[];
  startTime: string;
  endTime: string;
  roomNumber: string;
  subjectCode: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  instructor?: string;
  userRole?: 'admin' | 'instructor' | 'student' | 'superadmin';
  profileImage?: string;
  adminPermissions?: {
    canManageUsers?: boolean;
    canManageSubjects?: boolean;
    canViewReports?: boolean;
    canManageSchedules?: boolean;
    canAccessSecurityLogs?: boolean;
  };
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed, 
  setIsCollapsed 
}) => {
  const location = useLocation();
  const { logout, currentUser } = useAuth();

  const getAdminSidebarItems = () => [
    {
      title: 'Dashboard',
      path: '/admin/dashboard',
      icon: <HomeIcon className="w-6 h-6" />,
      description: 'Overview'
    },
    {
      title: 'Users',
      path: '/admin/users',
      icon: <UsersIcon className="w-6 h-6" />,
      description: 'Manage users'
    },
    {
      title: 'Departments',
      path: '/admin/departments',
      icon: <BuildingOfficeIcon className="w-6 h-6" />,
      description: 'Manage departments'
    },
    {
      title: 'Schedules',
      path: '/admin/schedules',
      icon: <ClockIcon className="w-6 h-6" />,
      description: 'Class schedules'
    },
    {
      title: 'Reports',
      path: '/admin/reports',
      icon: <ChartBarIcon className="w-6 h-6" />,
      description: 'Analytics & reports'
    },
    {
      title: 'Energy Usage',
      path: '/admin/energyusage',
      icon: <UserCircleIcon className="w-6 h-6" />,
      description: 'Classroom Energy usage'
    },
    {
      title: 'Settings',
      path: '/admin/settings',
      icon: <Cog6ToothIcon className="w-6 h-6" />,
      description: 'System settings'
    },
  
  ];

  const getInstructorSidebarItems = () => [
    {
      title: 'Dashboard',
      path: '/instructor/dashboard',
      icon: <HomeIcon className="w-6 h-6" />,
      description: 'Overview'
    },
    {
      title: 'My Classes',
      path: '/instructor/classes',
      icon: <UserGroupIcon className="w-6 h-6" />,
      description: 'Manage your classes'
    },
    {
      title: 'Schedule',
      path: '/instructor/schedules',
      icon: <ClockIcon className="w-6 h-6" />,
      description: 'Your timetable'
    },
    {
      title: 'Subjects',
      path: '/instructor/subjects',
      icon: <BookOpenIcon className="w-6 h-6" />,
      description: 'Your subjects'
    },
 
  ];

  const getStudentSidebarItems = () => [
    {
      title: 'Dashboard',
      path: '/students/dashboard',
      icon: <HomeIcon className="w-6 h-6" />,
      description: 'Overview'
    },
    {
      title: 'My Classes',
      path: '/students/classes',
      icon: <AcademicCapIcon className="w-6 h-6" />,
      description: 'View your classes'
    },
    {
      title: 'Schedule',
      path: '/students/schedule',
      icon: <ClockIcon className="w-6 h-6" />,
      description: 'Your timetable'
    },
    {
      title: 'Grades',
      path: '/students/grades',
      icon: <ChartBarIcon className="w-6 h-6" />,
      description: 'View your grades'
    },
    {
      title: 'Profile',
      path: '/students/profile',
      icon: <UserCircleIcon className="w-6 h-6" />,
      description: 'Personal info'
    }
  ];

  const getSidebarItems = () => {
    switch (currentUser?.role) {
      case 'admin':
        return getAdminSidebarItems();
      case 'instructor':
        return getInstructorSidebarItems();
      case 'student':
        return getStudentSidebarItems();
      default:
        return [];
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div
      className={`
        ${isCollapsed ? 'w-20' : 'w-64'}
        fixed left-0 h-screen bg-gradient-to-b from-indigo-600 to-indigo-800
        text-white transition-all duration-300 ease-in-out z-50
      `}
    >
      {/* Collapse Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-white rounded-full p-1 text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRightIcon className="w-4 h-4" />
        ) : (
          <ChevronLeftIcon className="w-4 h-4" />
        )}
      </button>

      {/* User Profile Section */}
      <div className="p-4">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <UserIcon className="w-6 h-6 text-white/70" />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">
                {currentUser?.fullName || 'User'}
              </h3>
              <p className="text-white/70 text-sm truncate">
                {currentUser?.email || ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="mt-8 px-4">
        <ul className="space-y-2">
          {getSidebarItems().map((item, index) => (
            <li key={index}>
              <Link
                to={item.path}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-xl
                  transition-all duration-200
                  ${location.pathname === item.path
                    ? 'bg-white text-indigo-600'
                    : 'text-white/80 hover:bg-white/10'
                  }
                `}
              >
                {item.icon}
                {!isCollapsed && (
                  <div className="flex-1">
                    <span className="block font-medium">{item.title}</span>
                    <span className="block text-sm opacity-70">
                      {item.description}
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout Button */}
      <div className="absolute bottom-8 w-full px-4">
        <button
          onClick={handleLogout}
          className={`
            flex items-center space-x-3 w-full px-4 py-3 rounded-xl
            text-white/80 hover:bg-white/10 transition-all duration-200
          `}
        >
          <ArrowLeftEndOnRectangleIcon className="w-6 h-6" />
          {!isCollapsed && (
            <span className="font-medium">Logout</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
