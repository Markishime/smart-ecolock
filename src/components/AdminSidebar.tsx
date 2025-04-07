import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserGroupIcon,
  AcademicCapIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BuildingOfficeIcon,
  ArrowLeftOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  CalendarDateRangeIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  ChartBarSquareIcon,
  LightBulbIcon
} from '@heroicons/react/24/solid';
import { useAuth } from '../Pages/AuthContext';
import { motion } from 'framer-motion';

const AdminSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();

  const navigationItems = [
    {
      name: 'Dashboard',
      icon: ChartBarIcon,
      path: '/admin/dashboard'
    },
    {
      name: 'Users',
      icon: UserGroupIcon,
      path: '/admin/users'
    },
    {
      name: 'Schedules',
      icon: CalendarDateRangeIcon,
      path: '/admin/schedules'
    },
    {
      name: 'Subjects',
      icon: BookOpenIcon,
      path: '/admin/subjects-management'
    },
    {
      name: 'Sections',
      icon: BuildingStorefrontIcon,
      path: '/admin/sections'
    },
    {
      name: 'Rooms',
      icon: BuildingOfficeIcon,
      path: '/admin/rooms'
    },
    {
      name: 'Insights',
      icon: ChartBarSquareIcon,
      path: '/admin/insights'
    },
    {
      name: 'Energy Usage',
      icon: LightBulbIcon,
      path: '/admin/energyusage'
    },
    {
      name: 'Settings',
      icon: Cog6ToothIcon,
      path: '/admin/settings'
    }
  ];

  return (
    <motion.div
      initial={{ width: isCollapsed ? 80 : 256 }}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-y-0 left-0 bg-gradient-to-b from-gray-900 to-blue-900 text-white font-mono border-r border-cyan-800 shadow-xl z-50"
    >
      <div className="flex flex-col h-full relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10 L90 90 M90 10 L10 90\' stroke=\'%2300b4d8\' stroke-width=\'1\' opacity=\'0.1\'/%3E%3C/svg%3E')] opacity-20"></div>
        <motion.div
          className="absolute -inset-2 bg-cyan-500/20 blur-xl"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Logo and Toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-cyan-800 relative z-10">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <AcademicCapIcon className="w-8 h-8 text-cyan-400" />
              <span className="text-xl font-bold text-cyan-100">Admin</span>
            </div>
          )}
          {isCollapsed && <AcademicCapIcon className="w-8 h-8 text-cyan-400 mx-auto" />}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {isCollapsed ? (
              <ChevronDoubleRightIcon className="w-5 h-5 text-cyan-400" />
            ) : (
              <ChevronDoubleLeftIcon className="w-5 h-5 text-cyan-400" />
            )}
          </motion.button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto relative z-10">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-cyan-800/50 text-cyan-100' 
                    : 'text-cyan-300 hover:bg-gray-700/50'
                }`}
                title={isCollapsed ? item.name : ''}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium truncate">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-cyan-800 relative z-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-700/50 rounded-lg transition-colors ${
              isCollapsed ? 'justify-center' : 'w-full'
            }`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            {!isCollapsed && <span>Logout</span>}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminSidebar;