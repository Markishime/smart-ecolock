import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ref, onValue, off } from 'firebase/database';
import { rtdb, listenForNewRFIDTag } from '../firebase';
import AdminSidebar from '../components/AdminSidebar';
import {
  ClockIcon,
  UserGroupIcon,
  BellIcon,
  ChartBarIcon,
  HomeIcon,
  TagIcon,
  DocumentTextIcon,
  BoltIcon,
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';

// Interfaces reflecting the JSON structure
interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string | { name: string };
  section: string;
  subject: string;
  subjectCode: string;
  instructorName?: string;
  sectionId?: string;
}

interface InstructorProfile {
  createdAt: string;
  department: string;
  email: string;
  fullName: string;
  idNumber: string;
  mobileNumber: string;
  role: string;
}

interface Instructor {
  AccessLogs?: Record<string, { action: string; status: string; timestamp: string }>;
  ClassStatus?: {
    Status: string;
    dateTime: string;
    schedule?: Schedule;
  };
  Profile: InstructorProfile;
  rooms?: {
    [roomName: string]: {
      facilities: {
        fans: boolean;
        lights: boolean;
        tampering: boolean;
        lastUpdated: string;
      };
    };
  };
}

interface Student {
  Action: string;
  Sensor: string;
  Status: string;
  TimeIn: string;
  TimeOut: string;
  assignedSensorId: number;
  date: string;
  department: string;
  email: string;
  fullName: string;
  idNumber: string;
  mobileNumber: string;
  role: string;
  schedules: Schedule[];
  sessionId: string;
  timestamp: string;
  weight: number;
}

interface AccessLog {
  action: string;
  fullName: string;
  role: string;
  timestamp: string;
  AdminPZEM?: {
    current: string;
    energy: string;
    frequency: string;
    power: string;
    powerFactor: string;
    voltage: string;
    timestamp: string;
    roomDetails: {
      building: string;
      floor: string;
      name: string;
      status: string;
      type: string;
    };
  };
}

interface Alert {
  startTime: string;
  endTime?: string;
  status: string;
  resolvedByFullName?: string;
  resolvedByUID?: string;
}

interface OfflineTamper {
  action: string;
  name: string;
  role: string;
  status: string;
  timestamp: string;
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

interface RegisteredUID {
  timestamp: string;
}

interface UnregisteredUID {
  AccessLogs: string;
}

interface RFID {
  role: string;
  timestamp: { _methodName: string };
  uid: string;
}

interface RoomPowerConsumption {
  roomName: string;
  building: string;
  floor: string;
  energy: string;
  power: string;
  timestamp: string;
}

const ITEMS_PER_PAGE = 10;

const Dashboard: React.FC = () => {
  const [instructors, setInstructors] = useState<Record<string, Instructor>>({});
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [admins, setAdmins] = useState<Record<string, Admin>>({});
  const [accessLogs, setAccessLogs] = useState<Record<string, Record<string, AccessLog>>>({});
  const [alerts, setAlerts] = useState<Record<string, Alert>>({});
  const [offlineDataLogging, setOfflineDataLogging] = useState<Record<string, OfflineTamper>>({});
  const [systemLogs, setSystemLogs] = useState<Record<string, string>>({});
  const [registeredUIDs, setRegisteredUIDs] = useState<Record<string, RegisteredUID>>({});
  const [unregisteredUIDs, setUnregisteredUIDs] = useState<Record<string, UnregisteredUID>>({});
  const [rfid, setRFID] = useState<Record<string, RFID>>({});
  const [newRFIDTag, setNewRFIDTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState({
    accessLogs: 1,
    systemLogs: 1,
    rfid: 1,
    powerConsumption: 1,
  });

  const [stats, setStats] = useState({
    totalInstructors: 0,
    totalStudents: 0,
    totalAdmins: 0,
    activeAlerts: 0,
    totalAccessToday: 0,
    totalSystemLogs: 0,
    totalRFIDs: 0,
    totalRoomsMonitored: 0,
  });

  useEffect(() => {
    setLoading(true);
    const refs = {
      instructors: ref(rtdb, 'Instructors'),
      students: ref(rtdb, 'Students'),
      admins: ref(rtdb, 'Admin'),
      accessLogs: ref(rtdb, 'AccessLogs'),
      alerts: ref(rtdb, 'Alerts/Tamper'),
      offlineDataLogging: ref(rtdb, 'OfflineDataLogging'),
      systemLogs: ref(rtdb, 'SystemLogs'),
      registeredUIDs: ref(rtdb, 'RegisteredUIDs'),
      unregisteredUIDs: ref(rtdb, 'UnregisteredUIDs'),
      rfid: ref(rtdb, 'rfid'),
    };

    const listeners = [
      { path: 'instructors', ref: refs.instructors },
      { path: 'students', ref: refs.students },
      { path: 'admins', ref: refs.admins },
      { path: 'accessLogs', ref: refs.accessLogs },
      { path: 'alerts', ref: refs.alerts },
      { path: 'offlineDataLogging', ref: refs.offlineDataLogging },
      { path: 'systemLogs', ref: refs.systemLogs },
      { path: 'registeredUIDs', ref: refs.registeredUIDs },
      { path: 'unregisteredUIDs', ref: refs.unregisteredUIDs },
      { path: 'rfid', ref: refs.rfid },
    ];

    listeners.forEach(({ ref, path }) => {
      onValue(
        ref,
        (snapshot) => {
          const data = snapshot.val() || {};
          switch (path) {
            case 'instructors':
              setInstructors(data);
              setStats((prev) => ({ ...prev, totalInstructors: Object.keys(data).length }));
              break;
            case 'students':
              setStudents(data);
              setStats((prev) => ({ ...prev, totalStudents: Object.keys(data).length }));
              break;
            case 'admins':
              setAdmins(data);
              setStats((prev) => ({ ...prev, totalAdmins: Object.keys(data).length }));
              break;
            case 'accessLogs':
              setAccessLogs(data);
              const today = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).replace(/\//g, '_');
              const todayLogs = Object.values(data)
                .flatMap((userLogs) =>
                  Object.values(userLogs as Record<string, any>).filter((log) =>
                    log.timestamp?.startsWith(today)
                  )
                )
                .filter((log): log is AccessLog => log !== undefined && log.timestamp !== undefined);
              const roomsMonitored = new Set(
                Object.values(data)
                  .flatMap((userLogs) =>
                    Object.values(userLogs as Record<string, any>)
                      .filter((log) => log.AdminPZEM?.roomDetails)
                      .map((log) => log.AdminPZEM.roomDetails.name)
                  )
              ).size;
              setStats((prev) => ({
                ...prev,
                totalAccessToday: todayLogs.length,
                totalRoomsMonitored: roomsMonitored,
              }));
              break;
            case 'alerts':
              setAlerts(data);
              const activeAlerts = Object.values(data as Record<string, Alert>).filter(
                (alert): alert is Alert => alert !== null && alert !== undefined && alert.status === 'active'
              ).length;
              setStats((prev) => ({ ...prev, activeAlerts }));
              break;
            case 'offlineDataLogging':
              setOfflineDataLogging(data);
              break;
            case 'systemLogs':
              setSystemLogs(data);
              setStats((prev) => ({ ...prev, totalSystemLogs: Object.keys(data).length }));
              break;
            case 'registeredUIDs':
              setRegisteredUIDs(data);
              break;
            case 'unregisteredUIDs':
              setUnregisteredUIDs(data);
              break;
            case 'rfid':
              setRFID(data);
              setStats((prev) => ({ ...prev, totalRFIDs: Object.keys(data).length }));
              break;
          }
        },
        handleError(path)
      );
    });

    const unsubscribe = listenForNewRFIDTag((uid: string) => {
      setNewRFIDTag(uid);
      setTimeout(() => setNewRFIDTag(null), 5000);
    });

    setLoading(false);

    return () => {
      listeners.forEach(({ ref }) => off(ref));
      unsubscribe();
    };
  }, []);

  const handleError = (context: string) => (error: Error) => {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Failed to fetch ${context}: ${error.message}`,
      customClass: {
        popup: 'rounded-lg',
        title: 'text-blue-900',
        htmlContainer: 'text-blue-700',
        confirmButton: 'bg-blue-600 hover:bg-blue-700',
      },
    });
  };

  const formatTimestamp = (timestamp: string): string => {
    if (!timestamp) return 'N/A';
    try {
      const [date, time] = timestamp.split('_');
      const [year, month, day] = date.split('_');
      const [hour, minute, second] = time.split('_');
      const dateObj = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      return dateObj.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return timestamp.replace(/_/g, ':');
    }
  };

  const filteredPersonnel = useMemo(
    () => ({
      instructors: Object.entries(instructors).filter(([_, instructor]) =>
        [
          instructor.Profile.fullName,
          instructor.Profile.email,
          instructor.Profile.department,
          instructor.Profile.idNumber,
        ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
      students: Object.entries(students).filter(([_, student]) =>
        [student.fullName, student.email, student.department, student.idNumber].some((field) =>
          field?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
      admins: Object.entries(admins).filter(([_, admin]) =>
        [admin.fullName, admin.email, admin.idNumber].some((field) =>
          field?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
    }),
    [instructors, students, admins, searchQuery]
  );

  const filteredAccessLogs = useMemo(() => {
    const logs = Object.entries(accessLogs)
      .flatMap(([uid, logs]) =>
        Object.entries(logs).map(([timestamp, log]) => ({ uid, timestamp, log }))
      )
      .filter(({ log }) =>
        [log.fullName, log.role, log.action, log.timestamp].some((field) =>
          field?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    const instructorLogs = Object.entries(instructors)
      .flatMap(([uid, instructor]) =>
        instructor.AccessLogs
          ? Object.entries(instructor.AccessLogs).map(([key, log]) => ({
              uid,
              timestamp: key,
              log: { ...log, fullName: instructor.Profile.fullName, role: instructor.Profile.role },
            }))
          : []
      )
      .filter(({ log }) =>
        [log.fullName, log.role, log.action, log.timestamp].some((field) =>
          field?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    return [...logs, ...instructorLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [accessLogs, instructors, searchQuery]);

  const filteredAlerts = useMemo(() => {
    const alertEntries = Object.entries(alerts).filter(([_, alert]) =>
      [
        alert.startTime,
        alert.endTime,
        alert.status,
        alert.resolvedByFullName,
        alert.resolvedByUID,
      ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const offlineTamperEntries = Object.entries(offlineDataLogging)
      .filter(([key, tamper]) => tamper.action === 'TamperDetected' && tamper.status === 'Active')
      .map(([key, tamper]) => [
        key,
        {
          startTime: tamper.timestamp,
          status: tamper.status,
          resolvedByFullName: tamper.name,
          resolvedByUID: null,
        },
      ]);
    return [...alertEntries, ...offlineTamperEntries].sort((a, b) =>
      (typeof b[1] === 'object' && 'startTime' in b[1] ? b[1].startTime : '').localeCompare(
        typeof a[1] === 'object' && 'startTime' in a[1] ? a[1].startTime : ''
      )
    );
  }, [alerts, offlineDataLogging, searchQuery]);

  const filteredSystemLogs = useMemo(
    () =>
      Object.entries(systemLogs)
        .filter(([_, log]) => log.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => b[0].localeCompare(a[0])),
    [systemLogs, searchQuery]
  );

  const filteredRFIDs = useMemo(
    () => ({
      registered: Object.entries(registeredUIDs).filter(([uid, data]) =>
        [uid, data.timestamp].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
      unregistered: Object.entries(unregisteredUIDs).filter(([uid, data]) =>
        [uid, data.AccessLogs].some((field) =>
          field?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
      rfid: Object.entries(rfid).filter(([uid, data]) =>
        [uid, data.role, data.uid].some((field) =>
          field?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
    }),
    [registeredUIDs, unregisteredUIDs, rfid, searchQuery]
  );

  const roomPowerConsumption = useMemo(() => {
    const rooms: RoomPowerConsumption[] = [];
    Object.entries(accessLogs).forEach(([_, logs]) => {
      Object.values(logs).forEach((log) => {
        if (log.action === 'exit' && log.AdminPZEM?.roomDetails) {
          const { roomDetails, energy, power, timestamp } = log.AdminPZEM;
          rooms.push({
            roomName: roomDetails.name,
            building: roomDetails.building,
            floor: roomDetails.floor,
            energy,
            power,
            timestamp,
          });
        }
      });
    });
    return rooms.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [accessLogs]);

  const paginatedAccessLogs = filteredAccessLogs.slice(
    (currentPage.accessLogs - 1) * ITEMS_PER_PAGE,
    currentPage.accessLogs * ITEMS_PER_PAGE
  );

  const paginatedSystemLogs = filteredSystemLogs.slice(
    (currentPage.systemLogs - 1) * ITEMS_PER_PAGE,
    currentPage.systemLogs * ITEMS_PER_PAGE
  );

  const paginatedRFIDs = {
    registered: filteredRFIDs.registered.slice(
      (currentPage.rfid - 1) * ITEMS_PER_PAGE,
      currentPage.rfid * ITEMS_PER_PAGE
    ),
    unregistered: filteredRFIDs.unregistered.slice(
      (currentPage.rfid - 1) * ITEMS_PER_PAGE,
      currentPage.rfid * ITEMS_PER_PAGE
    ),
    rfid: filteredRFIDs.rfid.slice(
      (currentPage.rfid - 1) * ITEMS_PER_PAGE,
      currentPage.rfid * ITEMS_PER_PAGE
    ),
  };

  const paginatedPowerConsumption = roomPowerConsumption.slice(
    (currentPage.powerConsumption - 1) * ITEMS_PER_PAGE,
    currentPage.powerConsumption * ITEMS_PER_PAGE
  );

  const StatCard = ({
    title,
    value,
    icon,
    color,
  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      className={`p-4 sm:p-6 bg-white rounded-2xl shadow-lg flex items-center space-x-3 sm:space-x-4 ${color} transition-all`}
    >
      <div className="p-2 sm:p-3 bg-opacity-20 rounded-full">{icon}</div>
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-gray-700">{title}</h3>
        <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </motion.div>
  );

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/20 to-purple-50/20">
      <div
        className={`fixed top-0 left-0 h-full bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 w-[80px] lg:w-64 z-50`}
      >
        <AdminSidebar />
      </div>

      <div
        className={`flex-1 transition-all duration-300 p-4 sm:p-6 lg:p-8 overflow-y-auto ${
          isSidebarOpen ? 'ml-[80px] lg:ml-64' : 'ml-0 md:ml-[80px] lg:ml-64'
        }`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden fixed top-4 left-4 z-50 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>

        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-indigo-900 mb-6 sm:mb-8 flex items-center"
        >
          <HomeIcon className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-indigo-600" />
          Smart Eco Lock Dashboard
        </motion.h1>

        {loading && (
          <div className="text-center text-indigo-600/80 text-lg sm:text-xl animate-pulse">
            Loading insights...
          </div>
        )}

        <div className="mb-6 sm:mb-8">
          <input
            type="text"
            placeholder="Search personnel, logs, alerts, power data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-96 rounded-lg border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300 py-2 sm:py-3 px-4 text-sm sm:text-base shadow-sm transition-all"
            aria-label="Search dashboard data"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatCard
            title="Total Personnel"
            value={stats.totalInstructors + stats.totalStudents + stats.totalAdmins}
            icon={<UserGroupIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />}
            color="border-blue-100"
          />
          <StatCard
            title="Active Alerts"
            value={stats.activeAlerts + Object.values(offlineDataLogging).filter(t => t.status === 'Active').length}
            icon={<BellIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />}
            color="border-red-100"
          />
          <StatCard
            title="Access Today"
            value={stats.totalAccessToday}
            icon={<ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />}
            color="border-indigo-100"
          />
          <StatCard
            title="Rooms Monitored"
            value={stats.totalRoomsMonitored}
            icon={<BoltIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />}
            color="border-green-100"
          />
        </div>

        {newRFIDTag && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-900 p-3 sm:p-4 rounded-xl shadow-lg flex items-center text-sm sm:text-base z-50"
            aria-live="polite"
          >
            <TagIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
            <p>
              New RFID Tag Detected: <span className="font-semibold">{newRFIDTag}</span>
            </p>
          </motion.div>
        )}

        <div className="space-y-6 sm:space-y-8">
          {/* Power Consumption */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center">
              <BoltIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-green-600" />
              Room Power Consumption
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {paginatedPowerConsumption.length > 0 ? (
                paginatedPowerConsumption.map((room, index) => (
                  <motion.div
                    key={`${room.roomName}-${room.timestamp}-${index}`}
                    whileHover={{ scale: 1.02 }}
                    className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-sm sm:text-base"
                  >
                    <h3 className="font-medium text-gray-800">Room {room.roomName}</h3>
                    <p className="text-gray-600">Building: {room.building}</p>
                    <p className="text-gray-600">Floor: {room.floor}</p>
                    <p className="text-gray-600">Energy: {room.energy}</p>
                    <p className="text-gray-600">Power: {room.power}</p>
                    <p className="text-gray-600">Last Updated: {formatTimestamp(room.timestamp)}</p>
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-500 text-center">No power consumption data available.</p>
              )}
            </div>
            <div className="mt-4 sm:mt-6 flex justify-between text-sm sm:text-base">
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({
                    ...prev,
                    powerConsumption: Math.max(prev.powerConsumption - 1, 1),
                  }))
                }
                disabled={currentPage.powerConsumption === 1}
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition"
              >
                Previous
              </button>
              <span>
                Page {currentPage.powerConsumption} of{' '}
                {Math.ceil(roomPowerConsumption.length / ITEMS_PER_PAGE)}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({ ...prev, powerConsumption: prev.powerConsumption + 1 }))
                }
                disabled={
                  currentPage.powerConsumption >=
                  Math.ceil(roomPowerConsumption.length / ITEMS_PER_PAGE)
                }
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition"
              >
                Next
              </button>
            </div>
          </motion.div>

          {/* Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center">
              <BellIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-red-600" />
              Alerts
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map(([id, alert]) => (
                  <motion.div
                    key={typeof id === 'string' ? id : JSON.stringify(id)}
                    whileHover={{ scale: 1.02 }}
                    className={`p-3 sm:p-4 rounded-lg border text-sm sm:text-base ${
                      typeof alert === 'object' && 'status' in alert && alert.status === 'active'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    } hover:bg-opacity-80 transition`}
                  >
                    <p className="font-medium">{typeof id === 'string' && id.includes('Tamper') ? 'Offline Tamper Detection' : 'Tamper Alert'}</p>
                    {typeof alert !== 'string' && (
                      <p className="text-gray-600">Started: {formatTimestamp(alert.startTime)}</p>
                    )}
                    {typeof alert === 'object' && 'endTime' in alert && alert.endTime && (
                      <p className="text-gray-600">Ended: {formatTimestamp(alert.endTime)}</p>
                    )}
                    {typeof alert === 'object' && 'status' in alert && (
                      <p className="text-gray-600">Status: {alert.status}</p>
                    )}
                    {typeof alert === 'object' && 'resolvedByFullName' in alert && alert.resolvedByFullName && (
                      <p className="text-gray-600">Resolved by: {alert.resolvedByFullName}</p>
                    )}
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-500 text-center">No alerts available.</p>
              )}
            </div>
          </motion.div>

          {/* Personnel */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center">
              <UserGroupIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-indigo-600" />
              Personnel
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {filteredPersonnel.instructors.map(([id, instructor]) => (
                <motion.div
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-sm sm:text-base"
                >
                  <h3 className="font-semibold text-gray-800">{instructor.Profile.fullName}</h3>
                  <p className="text-gray-600">Role: {instructor.Profile.role}</p>
                  <p className="text-gray-600">Email: {instructor.Profile.email}</p>
                  <p className="text-gray-600">Department: {instructor.Profile.department}</p>
                  <p className="text-gray-600">ID: {instructor.Profile.idNumber}</p>
                </motion.div>
              ))}
              {filteredPersonnel.students.map(([id, student]) => (
                <motion.div
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-sm sm:text-base"
                >
                  <h3 className="font-semibold text-gray-800">{student.fullName}</h3>
                  <p className="text-gray-600">Role: {student.role}</p>
                  <p className="text-gray-600">Email: {student.email}</p>
                  <p className="text-gray-600">Department: {student.department}</p>
                  <p className="text-gray-600">ID: {student.idNumber}</p>
                  <p className="text-gray-600">Weight: {student.weight.toFixed(2)} kg</p>
                </motion.div>
              ))}
              {filteredPersonnel.admins.map(([id, admin]) => (
                <motion.div
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-sm sm:text-base"
                >
                  <h3 className="font-semibold text-gray-800">{admin.fullName}</h3>
                  <p className="text-gray-600">Role: {admin.role}</p>
                  <p className="text-gray-600">Email: {admin.email}</p>
                  <p className="text-gray-600">ID: {admin.idNumber}</p>
                  <p className="text-gray-600">Last Tamper Stop: {formatTimestamp(admin.lastTamperStop)}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Schedules */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center">
              <ClockIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-indigo-600" />
              Schedules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-h-[400px] overflow-y-auto">
              {Object.entries(instructors).flatMap(([uid, instructor]) =>
                instructor.ClassStatus?.schedule ? (
                  <motion.div
                    key={`${uid}-${instructor.ClassStatus.schedule.subjectCode}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm sm:text-base"
                  >
                    <p className="font-semibold">
                      {instructor.ClassStatus.schedule.subject} (
                      {instructor.ClassStatus.schedule.subjectCode})
                    </p>
                    <p className="text-gray-600">Instructor: {instructor.Profile.fullName}</p>
                    <p className="text-gray-600">
                      {instructor.ClassStatus.schedule.day}: {instructor.ClassStatus.schedule.startTime} -{' '}
                      {instructor.ClassStatus.schedule.endTime}
                    </p>
                    <p className="text-gray-600">
                      Room:{' '}
                      {typeof instructor.ClassStatus.schedule.roomName === 'string'
                        ? instructor.ClassStatus.schedule.roomName
                        : instructor.ClassStatus.schedule.roomName.name}
                    </p>
                    <p className="text-gray-600">Section: {instructor.ClassStatus.schedule.section}</p>
                  </motion.div>
                ) : (
                  []
                )
              )}
              {Object.entries(students).flatMap(([uid, student]) =>
                student.schedules.map((schedule, index) => (
                  <motion.div
                    key={`${uid}-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm sm:text-base"
                  >
                    <p className="font-semibold">
                      {schedule.subject} ({schedule.subjectCode})
                    </p>
                    <p className="text-gray-600">Student: {student.fullName}</p>
                    <p className="text-gray-600">
                      {schedule.day}: {schedule.startTime} - {schedule.endTime}
                    </p>
                    <p className="text-gray-600">
                      Room:{' '}
                      {typeof schedule.roomName === 'string'
                        ? schedule.roomName
                        : schedule.roomName.name}
                    </p>
                    <p className="text-gray-600">Section: {schedule.section}</p>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Access Logs */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center">
              <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-indigo-600" />
              Access Logs
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {paginatedAccessLogs.map(({ uid, timestamp, log }) => (
                <motion.div
                  key={`${uid}-${timestamp}`}
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-sm sm:text-base"
                >
                  <p className="font-semibold text-gray-800">{log.fullName}</p>
                  <p className="text-gray-600">Action: {log.action}</p>
                  <p className="text-gray-600">Role: {log.role}</p>
                  <p className="text-gray-600">Time: {formatTimestamp(log.timestamp)}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 sm:mt-6 flex justify-between text-sm sm:text-base">
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({
                    ...prev,
                    accessLogs: Math.max(prev.accessLogs - 1, 1),
                  }))
                }
                disabled={currentPage.accessLogs === 1}
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition"
              >
                Previous
              </button>
              <span>
                Page {currentPage.accessLogs} of{' '}
                {Math.ceil(filteredAccessLogs.length / ITEMS_PER_PAGE)}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({ ...prev, accessLogs: prev.accessLogs + 1 }))
                }
                disabled={
                  currentPage.accessLogs >=
                  Math.ceil(filteredAccessLogs.length / ITEMS_PER_PAGE)
                }
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition"
              >
                Next
              </button>
            </div>
          </motion.div>

          {/* System Logs */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center">
              <DocumentTextIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-gray-600" />
              System Logs
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {paginatedSystemLogs.map(([id, log]) => (
                <motion.div
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-sm sm:text-base"
                >
                  <p className="text-gray-600">{log}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 sm:mt-6 flex justify-between text-sm sm:text-base">
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({
                    ...prev,
                    systemLogs: Math.max(prev.systemLogs - 1, 1),
                  }))
                }
                disabled={currentPage.systemLogs === 1}
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition"
              >
                Previous
              </button>
              <span>
                Page {currentPage.systemLogs} of{' '}
                {Math.ceil(filteredSystemLogs.length / ITEMS_PER_PAGE)}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({ ...prev, systemLogs: prev.systemLogs + 1 }))
                }
                disabled={
                  currentPage.systemLogs >=
                  Math.ceil(filteredSystemLogs.length / ITEMS_PER_PAGE)
                }
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition"
              >
                Next
              </button>
            </div>
          </motion.div>

          {/* RFID UIDs */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center">
              <TagIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-teal-600" />
              RFID UIDs
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {paginatedRFIDs.registered.map(([uid, data]) => (
                <motion.div
                  key={`reg-${uid}`}
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-sm sm:text-base"
                >
                  <p className="font-semibold text-gray-800">UID: {uid}</p>
                  <p className="text-gray-600">Status: Registered</p>
                  <p className="text-gray-600">Timestamp: {formatTimestamp(data.timestamp)}</p>
                </motion.div>
              ))}
              {paginatedRFIDs.unregistered.map(([uid, data]) => (
                <motion.div
                  key={`unreg-${uid}`}
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition text-sm sm:text-base"
                >
                  <p className="font-semibold text-gray-800">UID: {uid}</p>
                  <p className="text-gray-600">Status: Unregistered</p>
                  <p className="text-gray-600">
                    Access Attempt: {formatTimestamp(data.AccessLogs)}
                  </p>
                </motion.div>
              ))}
              {paginatedRFIDs.rfid.map(([uid, data]) => (
                <motion.div
                  key={`rfid-${uid}`}
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-sm sm:text-base"
                >
                  <p className="font-semibold text-gray-800">UID: {uid}</p>
                  <p className="text-gray-600">Role: {data.role}</p>
                  <p className="text-gray-600">User ID: {data.uid}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 sm:mt-6 flex justify-between text-sm sm:text-base">
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({ ...prev, rfid: Math.max(prev.rfid - 1, 1) }))
                }
                disabled={currentPage.rfid === 1}
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition"
              >
                Previous
              </button>
              <span>
                Page {currentPage.rfid} of{' '}
                {Math.ceil(
                  (filteredRFIDs.registered.length +
                    filteredRFIDs.unregistered.length +
                    filteredRFIDs.rfid.length) /
                    ITEMS_PER_PAGE
                )}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => ({ ...prev, rfid: prev.rfid + 1 }))}
                disabled={
                  currentPage.rfid >=
                  Math.ceil(
                    (filteredRFIDs.registered.length +
                      filteredRFIDs.unregistered.length +
                      filteredRFIDs.rfid.length) /
                      ITEMS_PER_PAGE
                  )
                }
                className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition"
              >
                Next
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;