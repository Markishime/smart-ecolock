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
  ChevronDoubleRightIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../Pages/AuthContext';

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
      icon: UserGroupIcon,
      path: '/admin/schedules'
    },
    {
      name: 'Sections',
      icon: UserGroupIcon,
      path: '/admin/sections'
    },
    {
      name: 'Instructors',
      icon: AcademicCapIcon,
      path: '/admin/teachers'
    },
    {
      name: 'Students',
      icon: UserGroupIcon,
      path: '/admin/students'
    },
    {
      name: 'Rooms',
      icon: BuildingOfficeIcon,
      path: '/admin/rooms'
    },
    {
      name: 'Reports',
      icon: UserGroupIcon,
      path: '/admin/reports'
    },
    {
      name: 'Energy Usage',
      icon: UserGroupIcon,
      path: '/admin/energyusage'
    },
    {
      name: 'Settings',
      icon: Cog6ToothIcon,
      path: '/admin/settings'
    }
  ];

  return (
    <div 
      className={`fixed inset-y-0 left-0 bg-white border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Logo and Toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <AcademicCapIcon className="w-8 h-8 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">Admin</span>
            </div>
          )}
          {isCollapsed && <AcademicCapIcon className="w-8 h-8 text-indigo-600 mx-auto" />}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isCollapsed ? (
              <ChevronDoubleRightIcon className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDoubleLeftIcon className="w-5 h-5 text-gray-500" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-gray-700 hover:bg-gray-50'
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
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
              isCollapsed ? 'justify-center' : 'w-full'
            }`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar; 