import React, { useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { 
  BookOpenIcon, 
  UserIcon, 
  ScaleIcon, 
  BoltIcon, 
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns'; // Date adapter for Chart.js
import { format, parse, subDays } from 'date-fns';
import AdminSidebar from '../components/AdminSidebar'; // Import the new AdminSidebar component

// Register Chart.js components
ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend);

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQIMqO4bJ-k4-pjjGnHGwCbCYUFUQe7Hw",
  databaseURL: "https://smartecolock-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

// Initialize Firebase only if it hasn't been initialized yet
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}

const database = getDatabase();

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

interface LogEntryProps {
  uid: string;
  timestamp: string;
  weight?: string; // Optional, as not all logs have weight
  type: 'Instructor' | 'Student'; // Union type for specific values
}

interface PowerLogEntryProps {
  instructorUid: string;
  totalConsumption: string;
  timestamp: string;
}

// Interfaces for Data Structure
interface InstructorLog {
  AccessLogs: string; // Timestamp
}

interface StudentLog {
  AttendanceRecords: string; // Timestamp
  Weight?: string; // Weight in kg
}

interface PowerLog {
  instructorUid: string;
  totalConsumption: string; // Energy in Wh
  timestamp: string;
}

// Main Dashboard Component
const SmartEcoLockDashboard: React.FC = () => {
  const [instructorLogs, setInstructorLogs] = useState<Record<string, InstructorLog>>({});
  const [studentLogs, setStudentLogs] = useState<Record<string, StudentLog>>({});
  const [offlineLogs, setOfflineLogs] = useState<PowerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('');
  const [uidFilter, setUidFilter] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch Data from Firebase
  useEffect(() => {
    const instructorsRef = ref(database, '/Instructors');
    const studentsRef = ref(database, '/Students');
    const offlineLogsRef = ref(database, '/OfflineLogsSynced');

    const handleError = (err: any) => {
      setError('Failed to connect to Firebase: ' + err.message);
      setLoading(false);
    };

    const instructorsListener = onValue(instructorsRef, (snapshot) => {
      setInstructorLogs(snapshot.val() || {});
    }, handleError);

    const studentsListener = onValue(studentsRef, (snapshot) => {
      setStudentLogs(snapshot.val() || {});
      setLoading(false);
    }, handleError);

    const offlineLogsListener = onValue(offlineLogsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const logsArray = Object.values(data).map((log: any) => {
          const parts = log.split(' | ');
          const uidPart = parts[0]?.split(': ')[1] || '';
          const consumptionPart = parts[1]?.split(': ')[1]?.replace(' Wh', '') || '0';
          const timestampPart = log.split(' Time:')[1]?.split(' Weight:')[0]?.trim() || log.split(' Time:')[1]?.trim() || 'Unknown';
          return { instructorUid: uidPart, totalConsumption: consumptionPart, timestamp: timestampPart };
        });
        setOfflineLogs(logsArray);
      }
    }, handleError);

    return () => {
      off(instructorsRef, 'value', instructorsListener);
      off(studentsRef, 'value', studentsListener);
      off(offlineLogsRef, 'value', offlineLogsListener);
    };
  }, []);

  // Metrics and Filters
  const totalInstructors = Object.keys(instructorLogs).length;
  const totalStudents = Object.keys(studentLogs).length;
  const averageWeight = Object.values(studentLogs)
    .filter((log) => log.Weight)
    .reduce((sum, log) => sum + parseFloat(log.Weight || '0'), 0) / (totalStudents || 1);
  const totalPowerConsumption = offlineLogs.reduce((sum, log) => sum + parseFloat(log.totalConsumption || '0'), 0);

  const filteredInstructorLogs = Object.entries(instructorLogs).filter(([uid, log]) => {
    const matchesDate = !dateFilter || log.AccessLogs.includes(dateFilter);
    const matchesUid = !uidFilter || uid.toLowerCase().includes(uidFilter.toLowerCase());
    return matchesDate && matchesUid;
  });

  const filteredStudentLogs = Object.entries(studentLogs).filter(([uid, log]) => {
    const matchesDate = !dateFilter || log.AttendanceRecords.includes(dateFilter);
    const matchesUid = !uidFilter || uid.toLowerCase().includes(uidFilter.toLowerCase());
    return matchesDate && matchesUid;
  });

  const filteredPowerLogs = offlineLogs.filter((log) => {
    const matchesDate = !dateFilter || log.timestamp.includes(dateFilter);
    const matchesUid = !uidFilter || log.instructorUid.toLowerCase().includes(uidFilter.toLowerCase());
    return matchesDate && matchesUid;
  });

  // Chart Data
  const powerChartData = {
    labels: filteredPowerLogs.map((log) => new Date(log.timestamp)),
    datasets: [
      {
        label: 'Power Consumption (Wh)',
        data: filteredPowerLogs.map((log) => parseFloat(log.totalConsumption)),
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const weightChartData = {
    labels: filteredStudentLogs.map(([, log]) => new Date(log.AttendanceRecords)),
    datasets: [
      {
        label: 'Student Weight (kg)',
        data: filteredStudentLogs.map(([, log]) => parseFloat(log.Weight || '0')),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    scales: {
      x: { type: 'time' as const, time: { unit: 'day' as const }, title: { display: true, text: 'Time' } },
      y: { title: { display: true, text: 'Value' } },
    },
    plugins: { legend: { position: 'top' as const }, tooltip: { mode: 'index' as const, intersect: false } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 flex flex-col md:flex-row animate-fade-in">
      {/* Sidebar */}
      <AdminSidebar />
       
     

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-500 transition-colors"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>

      {/* Main Content */}
      <main className="flex-1 ml-0 md:ml-64 p-6 transition-all duration-300">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent animate-pulse-once">
            <BoltIcon className="h-9 w-9 text-indigo-600" />
             Smart Ecolock Insights
          </h1>
          <p className="text-gray-700 mt-2 text-lg animate-fade-in-delay">Real-time insights into RFID, attendance, weight, and power metrics.</p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-xl flex items-center gap-3 shadow-md animate-slide-in">
            <ExclamationCircleIcon className="h-6 w-6" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative w-full md:w-auto">
            <input
              type="date"
              value={dateFilter ? format(new Date(dateFilter), 'yyyy-MM-dd') : ''}
              onChange={(e) => setDateFilter(e.target.value ? format(new Date(e.target.value), 'MM-dd-yyyy') : '')}
              className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all duration-200 hover:shadow-md"
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">📅</span>
          </div>
          <div className="relative w-full md:w-auto">
            <input
              type="text"
              value={uidFilter}
              onChange={(e) => setUidFilter(e.target.value)}
              className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all duration-200 hover:shadow-md"
              placeholder="Filter by UID"
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">🔍</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Quick Stats */}
            <StatCard title="Total Instructors" value={totalInstructors} icon={<UserIcon className="h-6 w-6 text-indigo-600" />} />
            <StatCard title="Total Students" value={totalStudents} icon={<BookOpenIcon className="h-6 w-6 text-indigo-600" />} />
            <StatCard title="Avg. Student Weight" value={`${averageWeight.toFixed(2)} kg`} icon={<ScaleIcon className="h-6 w-6 text-indigo-600" />} />
            <StatCard title="Total Power Usage" value={`${totalPowerConsumption.toFixed(2)} Wh`} icon={<BoltIcon className="h-6 w-6 text-indigo-600" />} />

            {/* Instructor Logs */}
            <div className="col-span-1 sm:col-span-2 bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 animate-fade-in">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UserIcon className="h-6 w-6 text-indigo-600" />
                Instructor Logs
              </h2>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {filteredInstructorLogs.length > 0 ? (
                  filteredInstructorLogs.map(([uid, log]) => (
                    <LogEntry key={uid} uid={uid} timestamp={log.AccessLogs} type="Instructor" />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No matching logs found.</p>
                )}
              </div>
            </div>

            {/* Student Attendance */}
            <div className="col-span-1 sm:col-span-2 bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 animate-fade-in">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BookOpenIcon className="h-6 w-6 text-indigo-600" />
                Student Attendance
              </h2>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {filteredStudentLogs.length > 0 ? (
                  filteredStudentLogs.map(([uid, log]) => (
                    <LogEntry key={uid} uid={uid} timestamp={log.AttendanceRecords} weight={log.Weight} type="Student" />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No matching logs found.</p>
                )}
              </div>
            </div>

            {/* Power Consumption Chart */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 animate-fade-in">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BoltIcon className="h-6 w-6 text-indigo-600" />
                Power Consumption Trend
              </h2>
              <Line data={powerChartData} options={{ ...chartOptions, scales: { ...chartOptions.scales, y: { title: { display: true, text: 'Power (Wh)' } } } }} />
            </div>

            {/* Weight Trend Chart */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 animate-fade-in">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ScaleIcon className="h-6 w-6 text-indigo-600" />
                Student Weight Trend
              </h2>
              <Line data={weightChartData} options={{ ...chartOptions, scales: { ...chartOptions.scales, y: { title: { display: true, text: 'Weight (kg)' } } } }} />
            </div>

            {/* Power Consumption Logs */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 animate-fade-in">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BoltIcon className="h-6 w-6 text-indigo-600" />
                Power Consumption Logs
              </h2>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {filteredPowerLogs.length > 0 ? (
                  filteredPowerLogs.map((log, index) => (
                    <PowerLogEntry key={index} instructorUid={log.instructorUid} totalConsumption={log.totalConsumption} timestamp={log.timestamp} />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No matching logs found.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => (
  <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-md p-6 flex items-center gap-4 hover:shadow-lg hover:scale-105 transition-all duration-300 animate-fade-in-delay">
    <div className="bg-indigo-100 p-3 rounded-full">{icon}</div>
    <div>
      <p className="text-sm text-gray-600 font-medium">{title}</p>
      <p className="text-2xl font-extrabold text-gray-900">{value}</p>
    </div>
  </div>
);

// Log Entry Component
const LogEntry: React.FC<LogEntryProps> = ({ uid, timestamp, weight, type }) => (
  <div className="p-4 border-b border-gray-200 hover:bg-indigo-50 transition-colors duration-200 animate-fade-in">
    <p className="text-sm font-semibold text-gray-900">{type} UID: <span className="text-indigo-600">{uid}</span></p>
    <p className="text-sm text-gray-600">Time: {timestamp}</p>
    {weight && <p className="text-sm text-gray-600">Weight: <span className="font-medium">{weight} kg</span></p>}
  </div>
);

// Power Log Entry Component
const PowerLogEntry: React.FC<PowerLogEntryProps> = ({ instructorUid, totalConsumption, timestamp }) => (
  <div className="p-4 border-b border-gray-200 hover:bg-indigo-50 transition-colors duration-200 animate-fade-in">
    <p className="text-sm font-semibold text-gray-900">Instructor UID: <span className="text-indigo-600">{instructorUid}</span></p>
    <p className="text-sm text-gray-600">Power Consumed: <span className="font-medium">{totalConsumption} Wh</span></p>
    <p className="text-sm text-gray-600">Time: {timestamp}</p>
  </div>
);

// Custom CSS for Scrollbar and Animations
const style = document.createElement('style');
style.innerHTML = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fade-in-delay {
    0% { opacity: 0; transform: translateY(20px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-in {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
  @keyframes pulse-once {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .animate-fade-in { animation: fade-in 0.5s ease-in-out; }
  .animate-fade-in-delay { animation: fade-in-delay 0.7s ease-in-out; }
  .animate-slide-in { animation: slide-in 0.5s ease-out; }
  .animate-pulse-once { animation: pulse-once 1.5s ease-in-out 1; }
`;
document.head.appendChild(style);

export default SmartEcoLockDashboard;