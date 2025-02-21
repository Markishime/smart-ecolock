import { useContext } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import React from "react";
import { useAuth } from '../Pages/AuthContext';

interface Subject{
    id: string;
    name: string;
    department: string;
    details?: string;
    code?: string;
    credits?: number;
    prerequisites?: string[];
    learningObjectives?: string[];
    status: 'active' | 'inactive';
    teacherId?: string | null;
}

interface Schedule {
    id: string;
    subject: string;
    room: string;
    day: string;
    startTime: string;
    endTime: string;
    department: string;
    status: 'active' | 'inactive';
    instructor: string;
    instructorEmail: string;
    instructorDepartment: string;
    subjectDetails: Subject | null;
}

interface Instructor {
    id: string;
    name: string;
    email: string;
    department: string;
    role: string;
    subjects: Subject[];
    schedules: Schedule[];
    uid: string;
    fullName: string;
}

interface NavBarProps {
  currentTime: Date;
  instructor: {
    fullName: string;
    department: string;
  };
  classStatus: {
    status: string;
    color: string;
    details: string;
    fullName?: string;
  };
}

const NavBar: React.FC<NavBarProps> = ({ 
  currentTime, 
  instructor, 
  classStatus 
}) => {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-md z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Instructor Info */}
        <div className="flex items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {instructor.fullName}
            </h2>
            <p className="text-sm text-gray-500">
              {instructor.department}
            </p>
          </div>
        </div>

        {/* Class Status */}
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className={`font-semibold ${classStatus.color}`}>
              {classStatus.status}
            </p>
            <p className="text-sm text-gray-600">
              {classStatus.details}
            </p>
          </div>

          {/* Time Display */}
          <div className="text-right">
            <p className="font-medium text-gray-800">
              {currentTime.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
            <p className="text-sm text-gray-500">
              {currentTime.toLocaleDateString([], { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;