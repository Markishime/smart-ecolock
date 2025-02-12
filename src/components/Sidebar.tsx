import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  BookOpenIcon,
  CalendarIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserGroupIcon,
  AcademicCapIcon,
  CogIcon,
  ClockIcon,
  DocumentChartBarIcon,
  UserCircleIcon,
  MapIcon,
  PaperAirplaneIcon,
  ArrowLeftEndOnRectangleIcon,
  LockClosedIcon
} from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import { useAuth } from '../Pages/AuthContext';
import { theme } from '../styles/theme';

interface InstructorData {
  id: string;
  fullName: string;
  email: string;
  department: string;
  subjects: Subject[];
  schedules: Schedule[];
  sections: Section[];
}

interface Section {
  id: string;
  name: string;
  course: string;
  subjectCode: string;
  maxStudents: number;
  students: any[];
  schedule: {
    days: string[];
    startTime: string;
    endTime: string;
    roomNumber: string;
  };
}

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
  setIsCollapsed, 
  instructor, 
  userRole, 
  profileImage, 
  adminPermissions = {} 
}) => {
  const location = useLocation();
  const { logout, currentUser } = useAuth();

  const sidebarBackground = theme.colors.primary.main;
  const activeItemBackground = theme.colors.primary.dark;
  const hoverBackground = theme.colors.primary.light;

  // Enhanced admin menu items with granular permissions
  const getAdminSidebarItems = () => {
    const adminItems = [
      ...(adminPermissions.canManageUsers ? [
        { 
          icon: UserGroupIcon, 
          label: 'User Management', 
          path: '/users',
          requiredPermission: 'canManageUsers'
        }
      ] : []),
      ...(adminPermissions.canManageSubjects ? [
        { 
          icon: BookOpenIcon, 
          label: 'Subject Management', 
          path: '/admin/subjects',
          requiredPermission: 'canManageSubjects'
        }
      ] : []),
      ...(adminPermissions.canManageSchedules ? [
        { 
          icon: CalendarIcon, 
          label: 'Schedule Management', 
          path: '/admin/schedules',
          requiredPermission: 'canManageSchedules'
        }
      ] : []),
      ...(adminPermissions.canViewReports ? [
        { 
          icon: DocumentChartBarIcon, 
          label: 'Comprehensive Reports', 
          path: '/admin/reports',
          requiredPermission: 'canViewReports'
        }
      ] : []),
      ...(adminPermissions.canAccessSecurityLogs ? [
        { 
          icon: ShieldCheckIcon, 
          label: 'Security Logs', 
          path: '/admin/securitylogs',
          requiredPermission: 'canAccessSecurityLogs'
        }
      ] : []),
      ...(userRole === 'superadmin' ? [
        { 
          icon: CogIcon, 
          label: 'System Configuration', 
          path: '/superadmin/system-config'
        }
      ] : [])
    ];

    return adminItems;
  };

  // Combine base sidebar items with admin-specific items
  const sidebarItems = [
    { 
      icon: HomeIcon, 
      label: 'Dashboard', 
      path: userRole === 'admin' ? '/admin' : 
             userRole === 'instructor' ? '/dashboard' : '/dashboard'
    },
    ...(userRole === 'admin' || userRole === 'superadmin' ? getAdminSidebarItems() : []),
    { 
      icon: UserCircleIcon, 
      label: 'Profile', 
      path: '/profile' 
    },
    { 
      icon: CogIcon, 
      label: 'Settings', 
      path: '/settings' 
    }
  ];

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to login page will be handled by the logout function in AuthContext
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <motion.div 
      initial={{ width: isCollapsed ? '5rem' : '16rem' }}
      animate={{ width: isCollapsed ? '5rem' : '16rem' }}
      transition={{ duration: 0.3 }}
      className={`bg-[${sidebarBackground}] h-screen fixed left-0 top-0 bottom-0 z-50 shadow-xl border-r border-blue-200 overflow-hidden`}
    >
      <div className="flex items-center justify-between p-4 border-b border-blue-300">
        {!isCollapsed && (
          <div className="flex items-center">
            <LockClosedIcon className="h-8 w-8 mr-2 text-blue-600" />
            <span className="text-xl font-bold text-blue-800">Smart EcoLock</span>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-full hover:bg-blue-200 transition"
        >
          {isCollapsed ? <ChevronRightIcon className="h-6 w-6 text-blue-600" /> : <ChevronLeftIcon className="h-6 w-6 text-blue-600" />}
        </button>
      </div>

      {/* Profile Section */}
      <div className={`p-4 flex items-center border-b border-blue-300 ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
        {profileImage ? (
          <img 
            src={profileImage} 
            alt="Profile" 
            className={`rounded-full border-2 border-blue-300 ${isCollapsed ? 'w-10 h-10' : 'w-12 h-12 mr-4'}`} 
          />
        ) : (
          <UserCircleIcon className={`text-blue-600 ${isCollapsed ? 'w-10 h-10' : 'w-12 h-12 mr-4'}`} />
        )}
        {!isCollapsed && (
          <div>
            <p className="text-sm font-semibold text-blue-800">{currentUser?.fullName}</p>
            <p className="text-xs text-blue-600">{currentUser?.role}</p>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="mt-4">
        {sidebarItems.map((item, index) => (
          <Link 
            key={index} 
            to={item.path} 
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} py-3 hover:bg-[${hoverBackground}] transition 
              ${location.pathname === item.path ? `bg-[${activeItemBackground}] border-r-4 border-blue-600` : ''}`}
          >
            <item.icon className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5 mr-3'} text-blue-600`} />
            {!isCollapsed && <span className="text-sm text-blue-800">{item.label}</span>}
          </Link>
        ))}

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} py-3 w-full hover:bg-[${hoverBackground}] transition`}
        >
          <ArrowLeftEndOnRectangleIcon className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5 mr-3'} text-red-600`} />
          {!isCollapsed && <span className="text-sm text-red-600">Logout</span>}
        </button>
      </nav>
    </motion.div>
  );
};

export default Sidebar;
