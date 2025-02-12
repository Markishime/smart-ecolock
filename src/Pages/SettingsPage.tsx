import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { CogIcon, UserIcon, LockClosedIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { useAuth } from './AuthContext';
import { SettingsSection } from '../types';

const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const settingsSections: Record<string, SettingsSection> = {
    profile: {
      icon: UserIcon,
      title: 'Profile Settings',
      description: 'Manage your personal information',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">Full Name</label>
            <input 
              type="text" 
              defaultValue={currentUser?.fullName ?? undefined} 
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">Email</label>
            <input 
              type="email" 
              defaultValue={currentUser?.email ?? undefined} 
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )
    },
    security: {
      icon: LockClosedIcon,
      title: 'Security Settings',
      description: 'Update your password and security preferences',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">Current Password</label>
            <input 
              type="password" 
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">New Password</label>
            <input 
              type="password" 
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">Confirm New Password</label>
            <input 
              type="password" 
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )
    },
    notifications: {
      icon: PaperAirplaneIcon,
      title: 'Notification Settings',
      description: 'Manage your notification preferences',
      content: <div></div>
    },
    general: {
      icon: CogIcon,
      title: 'General Settings',
      description: 'Configure general application settings',
      content: <div></div>
    }
  };

  const [activeSection, setActiveSection] = useState(0);

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed} 
        userRole={currentUser?.role}
        profileImage={currentUser?.photoURL || undefined}
      />
      
      <div className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'} p-8 overflow-y-auto`}>
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-blue-800 flex items-center">
              <CogIcon className="h-10 w-10 mr-3 text-blue-600" />
              Settings
            </h1>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar Navigation */}
            <div className="col-span-3 bg-white rounded-xl shadow-md p-4">
              {Object.keys(settingsSections).map((section, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSection(index)}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition ${
                    activeSection === index 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'hover:bg-blue-50 text-blue-600'
                  }`}
                >
                  <div className="flex items-center">
                    <div>
                      <p className="font-semibold">{settingsSections[section].title}</p>
                      <p className="text-xs text-blue-400">{settingsSections[section].description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Settings Content */}
            <div className="col-span-9 bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-blue-800 mb-6 flex items-center">
                {Object.keys(settingsSections)[activeSection] === 'profile' ? 'Profile Settings' : Object.keys(settingsSections)[activeSection] === 'security' ? 'Security Settings' : Object.keys(settingsSections)[activeSection] === 'notifications' ? 'Notification Settings' : 'General Settings'}
              </h2>

              {Object.keys(settingsSections)[activeSection] === 'profile' ? settingsSections.profile.content : Object.keys(settingsSections)[activeSection] === 'security' ? settingsSections.security.content : Object.keys(settingsSections)[activeSection] === 'notifications' ? settingsSections.notifications.content : settingsSections.general.content}

              <div className="mt-6 flex justify-end">
                <button 
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
