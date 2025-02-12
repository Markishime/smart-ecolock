import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { UserGroupIcon, PlusIcon } from '@heroicons/react/24/solid';
import { useAuth } from './AuthContext';

const TeachersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed} 
        userRole="admin"
        profileImage={currentUser?.photoURL || undefined}
      />
      
      <div className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'} p-8 overflow-y-auto`}>
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-blue-800 flex items-center">
              <UserGroupIcon className="h-10 w-10 mr-3 text-blue-600" />
              Teachers Management
            </h1>
            
            <button 
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Teacher
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Placeholder teacher rows */}
                {[1,2,3,4,5].map((_, index) => (
                  <tr key={index} className="border-b hover:bg-blue-50 transition">
                    <td className="py-3 px-4">John Doe</td>
                    <td className="py-3 px-4">Computer Science</td>
                    <td className="py-3 px-4">john.doe@example.com</td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800">Edit</button>
                        <button className="text-red-600 hover:text-red-800">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeachersPage;
