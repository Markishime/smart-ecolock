import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ref, onValue } from 'firebase/database';
import { rtdb, listenForNewRFIDTag } from '../firebase'; // Adjust path to your firebase.js
import AdminSidebar from '../components/AdminSidebar'; // Import AdminSidebar
import {
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BellIcon,
  ChartBarIcon,
  HomeIcon,
  BoltIcon,
  TagIcon,
} from '@heroicons/react/24/solid';

// Interfaces reflecting the JSON structure
interface InstructorProfile {
  createdAt: string;
  department: string;
  email: string;
  fullName: string;
  idNumber: string;
  mobileNumber: string;
  role: string;
  schedules: Schedule[];
}

interface Instructor {
  Profile: InstructorProfile;
  AccessLogs?: Record<string, { action: string; timestamp: string }>;
  ClassStatus?: { Status: string; dateTime: string };
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  subject: string;
  section: string;
}

interface Student {
  fullName: string;
  email: string;
  department: string;
  status: string;
  timeIn: string;
  timeOut: string;
  role: string;
  schedules: Schedule[];
  section: string;
}

interface AccessLog {
  action: string;
  fullName: string;
  role: string;
  timestamp: string;
}

interface Alert {
  startTime: string;
  endTime?: string;
  status: string;
  resolvedByFullName?: string;
  resolvedByUID?: string;
}

interface Admin {
  createdAt: string;
  email: string;
  fullName: string;
  idNumber: string;
  lastTamperStop: string;
  rfidUid: string;
  role: string;
}

interface AdminPZEM {
  Current: string;
  Energy: string;
  Frequency: string;
  Power: string;
  PowerFactor: string;
  Voltage: string;
  roomDetails: {
    building: string;
    floor: string;
    name: string;
    status: string;
    type: string;
  };
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const [instructors, setInstructors] = useState<Record<string, Instructor>>({});
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [admins, setAdmins] = useState<Record<string, Admin>>({});
  const [accessLogs, setAccessLogs] = useState<Record<string, Record<string, AccessLog>>>({});
  const [alerts, setAlerts] = useState<Record<string, Alert>>({});
  const [adminPZEM, setAdminPZEM] = useState<Record<string, Record<string, AdminPZEM>>>({});
  const [newRFIDTag, setNewRFIDTag] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalInstructors: 0,
    totalStudents: 0,
    totalAdmins: 0,
    activeAlerts: 0,
    totalAccessToday: 0,
  });

  useEffect(() => {
    const instructorsRef = ref(rtdb, 'Instructors');
    const studentsRef = ref(rtdb, 'Students');
    const adminsRef = ref(rtdb, 'Admin');
    const accessLogsRef = ref(rtdb, 'AccessLogs');
    const alertsRef = ref(rtdb, 'Alerts/Tamper');
    const adminPZEMRef = ref(rtdb, 'AdminPZEM');

    onValue(instructorsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setInstructors(data);
      setStats(prev => ({ ...prev, totalInstructors: Object.keys(data).length }));
    });

    onValue(studentsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setStudents(data);
      setStats(prev => ({ ...prev, totalStudents: Object.keys(data).length }));
    });

    onValue(adminsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setAdmins(data);
      setStats(prev => ({ ...prev, totalAdmins: Object.keys(data).length }));
    });

    onValue(accessLogsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setAccessLogs(data);
      const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const todayLogs = Object.values(data).flatMap(userLogs => 
        Array.isArray(userLogs) 
          ? userLogs.filter(log => log.timestamp.includes(today)) 
          : Object.values(userLogs || {}).filter((log: any) => log.timestamp.includes(today))
      );
      setStats(prev => ({ ...prev, totalAccessToday: todayLogs.length }));
    });

    onValue(alertsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setAlerts(data);
      const activeAlerts = Object.values(data as Record<string, Alert>).filter(alert => alert.status === 'active').length;
      setStats(prev => ({ ...prev, activeAlerts }));
    });

    onValue(adminPZEMRef, (snapshot) => {
      const data = snapshot.val() || {};
      setAdminPZEM(data);
    });

    const unsubscribe: () => void = listenForNewRFIDTag((uid: string) => {
      setNewRFIDTag(uid);
      setTimeout(() => setNewRFIDTag(null), 5000);
    });

    return () => unsubscribe();
  }, []);

  const StatCard = ({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 bg-white rounded-xl shadow-lg flex items-center space-x-4 hover:shadow-xl transition-all ${color}`}
    >
      <div className="p-3 bg-opacity-20 rounded-full">{icon}</div>
      <div>
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </motion.div>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      {/* Add AdminSidebar */}
      <AdminSidebar />

      {/* Main content with adjusted margin */}
      <div className="flex-1 transition-all duration-300 ml-[80px] lg:ml-64 p-8 overflow-y-auto">
        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-extrabold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600"
        >
          Smart Eco Lock Dashboard
        </motion.h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard title="Total Instructors" value={stats.totalInstructors} icon={<UserGroupIcon className="w-8 h-8 text-blue-500" />} color="border-blue-100" />
          <StatCard title="Total Students" value={stats.totalStudents} icon={<AcademicCapIcon className="w-8 h-8 text-green-500" />} color="border-green-100" />
          <StatCard title="Total Admins" value={stats.totalAdmins} icon={<UserGroupIcon className="w-8 h-8 text-purple-500" />} color="border-purple-100" />
          <StatCard title="Active Alerts" value={stats.activeAlerts} icon={<BellIcon className="w-8 h-8 text-red-500" />} color="border-red-100" />
          <StatCard title="Access Today" value={stats.totalAccessToday} icon={<ChartBarIcon className="w-8 h-8 text-indigo-500" />} color="border-indigo-100" />
        </div>

        {newRFIDTag && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-green-100 border border-green-300 text-green-800 p-4 rounded-lg shadow-lg flex items-center"
          >
            <TagIcon className="w-6 h-6 mr-2" />
            <p>New RFID Tag Detected: <span className="font-bold">{newRFIDTag}</span></p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl shadow-lg p-6 col-span-1"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <UserGroupIcon className="w-6 h-6 mr-2 text-indigo-600" />
              Personnel
            </h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {Object.entries(admins).map(([id, admin]) => (
                <motion.div
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                >
                  <h3 className="font-medium text-gray-800">{admin.fullName}</h3>
                  <p className="text-sm text-gray-600">Role: {admin.role}</p>
                  <p className="text-xs text-gray-500">Email: {admin.email}</p>
                </motion.div>
              ))}
              {Object.entries(instructors).map(([id, instructor]) => (
                <motion.div
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                >
                  <h3 className="font-medium text-gray-800">{instructor.Profile?.fullName || 'Unknown'}</h3>
                  <p className="text-sm text-gray-600">{instructor.Profile?.department || 'N/A'}</p>
                  <p className="text-xs text-gray-500">Email: {instructor.Profile?.email || 'N/A'}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-2 space-y-8"
          >
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <ClockIcon className="w-6 h-6 mr-2 text-indigo-600" />
                Instructor Schedules
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto">
                {Object.values(instructors).flatMap(instructor =>
                  instructor.Profile?.schedules && Array.isArray(instructor.Profile.schedules)
                    ? instructor.Profile.schedules.map((schedule, index) => (
                        <motion.div
                          key={`${instructor.Profile.fullName}-${index}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <p className="font-medium">{schedule.subject || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{instructor.Profile.fullName || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{schedule.day}: {schedule.startTime} - {schedule.endTime}</p>
                          <p className="text-sm text-gray-600">Room: {schedule.room || 'N/A'}</p>
                        </motion.div>
                      ))
                    : []
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <BellIcon className="w-6 h-6 mr-2 text-red-600" />
                Alerts
              </h2>
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {Object.entries(alerts).map(([id, alert]) => (
                  <motion.div
                    key={id}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-lg border ${alert.status === 'active' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <p className="font-medium">Tamper Alert</p>
                    <p className="text-sm text-gray-600">Started: {alert.startTime}</p>
                    {alert.endTime && <p className="text-sm text-gray-600">Ended: {alert.endTime}</p>}
                    <p className="text-sm text-gray-600">Status: {alert.status}</p>
                    {alert.resolvedByFullName && (
                      <p className="text-sm text-gray-600">Resolved by: {alert.resolvedByFullName}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <HomeIcon className="w-6 h-6 mr-2 text-indigo-600" />
              Access Logs
            </h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {Object.entries(accessLogs).flatMap(([uid, logs]) =>
                Object.entries(logs).map(([timestamp, log]) => (
                  <motion.div
                    key={`${uid}-${timestamp}`}
                    whileHover={{ scale: 1.02 }}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                  >
                    <p className="font-medium">{log.fullName}</p>
                    <p className="text-sm text-gray-600">Action: {log.action}</p>
                    <p className="text-sm text-gray-600">Role: {log.role}</p>
                    <p className="text-sm text-gray-600">Time: {log.timestamp}</p>
                  </motion.div>
                ))
              )}
              {Object.entries(instructors).flatMap(([uid, instructor]) =>
                instructor.AccessLogs
                  ? Object.entries(instructor.AccessLogs).map(([key, log]) => (
                      <motion.div
                        key={`${uid}-${key}`}
                        whileHover={{ scale: 1.02 }}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                      >
                        <p className="font-medium">{instructor.Profile?.fullName || 'Unknown'}</p>
                        <p className="text-sm text-gray-600">Action: {log.action}</p>
                        <p className="text-sm text-gray-600">Role: {instructor.Profile?.role || 'N/A'}</p>
                        <p className="text-sm text-gray-600">Time: {log.timestamp}</p>
                      </motion.div>
                    ))
                  : []
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BoltIcon className="w-6 h-6 mr-2 text-yellow-600" />
              Power Monitoring
            </h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {Object.entries(adminPZEM).flatMap(([uid, logs]) =>
                Object.entries(logs).map(([timestamp, log]) => (
                  <motion.div
                    key={`${uid}-${timestamp}`}
                    whileHover={{ scale: 1.02 }}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                  >
                    <p className="font-medium">Room: {log.roomDetails.name} ({log.roomDetails.building})</p>
                    <p className="text-sm text-gray-600">Voltage: {log.Voltage}V</p>
                    <p className="text-sm text-gray-600">Power: {log.Power}W</p>
                    <p className="text-sm text-gray-600">Energy: {log.Energy}kWh</p>
                    <p className="text-sm text-gray-600">Time: {log.timestamp}</p>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;