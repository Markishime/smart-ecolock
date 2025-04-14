import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  CalendarIcon,
  FingerPrintIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';

// Interfaces reflecting the JSON structure
interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string | { name: string; pzem?: { [key: string]: string } };
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

interface StudentAttendance {
  Action: string;
  Sensor: string;
  Status: string;
  'Time In': string;
  'Time Out': string;
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
}

interface Student {
  Attendance: Record<string, StudentAttendance>;
}

interface AccessLog {
  action: string;
  fullName: string;
  role: string;
  timestamp: string;
}

interface AdminPZEM {
  Current: string;
  Energy: string;
  Frequency: string;
  Power: string;
  PowerFactor: string;
  Voltage: string;
  timestamp: string;
  roomDetails: {
    building: string;
    floor: string;
    name: string;
    status: string;
    type: string;
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
  timestamp: { _methodName: string } | string;
  uid: string;
}

interface RoomPowerConsumption {
  roomName: string;
  building: string;
  floor: string;
  current: string;
  energy: string;
  frequency: string;
  power: string;
  powerFactor: string;
  voltage: string;
  timestamp: string;
}

const ITEMS_PER_PAGE = 10;

const Dashboard: React.FC = () => {
  const [instructors, setInstructors] = useState<Record<string, Instructor>>({});
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [admins, setAdmins] = useState<Record<string, Admin>>({});
  const [accessLogs, setAccessLogs] = useState<Record<string, Record<string, AccessLog>>>({});
  const [adminPZEM, setAdminPZEM] = useState<Record<string, Record<string, AdminPZEM>>>({});
  const [alerts, setAlerts] = useState<Record<string, Alert>>({});
  const [offlineDataLogging, setOfflineDataLogging] = useState<Record<string, OfflineTamper>>({});
  const [systemLogs, setSystemLogs] = useState<Record<string, string>>({});
  const [registeredUIDs, setRegisteredUIDs] = useState<Record<string, string>>({});
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
  const [expandedSections, setExpandedSections] = useState({
    personnel: true,
    schedules: true,
  });
  const [alertFilter, setAlertFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [accessLogFilter, setAccessLogFilter] = useState<'all' | 'admin' | 'instructor' | 'student'>('all');

  const [stats, setStats] = useState({
    totalInstructors: 0,
    totalStudents: 0,
    totalAdmins: 0,
    activeAlerts: 0,
    totalAccessToday: 0,
    totalSystemLogs: 0,
    totalRFIDs: 0,
    totalRoomsMonitored: 0,
    totalSchedules: 0,
    totalRFIDScansToday: 0,
  });

  useEffect(() => {
    setLoading(true);
    const refs = {
      instructors: ref(rtdb, 'Instructors'),
      students: ref(rtdb, 'Students'),
      admins: ref(rtdb, 'Admin'),
      accessLogs: ref(rtdb, 'AccessLogs'),
      adminPZEM: ref(rtdb, 'AdminPZEM'),
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
      { path: 'adminPZEM', ref: refs.adminPZEM },
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
              const instructorSchedules = Object.values(data as Record<string, Instructor>).flatMap(
                (instructor) => (instructor.ClassStatus?.schedule ? 1 : 0)
              ).length;
              setStats((prev) => ({
                ...prev,
                totalInstructors: Object.keys(data).length,
                totalSchedules: prev.totalSchedules ? prev.totalSchedules + instructorSchedules : instructorSchedules,
              }));
              break;
            case 'students':
              setStudents(data);
              const studentSchedules = Object.values(data as Record<string, Student>).flatMap(
                (student) =>
                  Object.values(student.Attendance || {}).flatMap((attendance) => attendance.schedules || []).length
              ).reduce((sum, count) => sum + count, 0);
              setStats((prev) => ({
                ...prev,
                totalStudents: Object.keys(data).length,
                totalSchedules: prev.totalSchedules ? prev.totalSchedules + studentSchedules : studentSchedules,
              }));
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
              setStats((prev) => ({
                ...prev,
                totalAccessToday: todayLogs.length,
              }));
              break;
            case 'adminPZEM':
              setAdminPZEM(data);
              const roomsMonitored = new Set(
                Object.values(data)
                  .flatMap((userPZEM) =>
                    Object.values(userPZEM as Record<string, any>)
                      .filter((pzem) => pzem.roomDetails)
                      .map((pzem) => pzem.roomDetails.name)
                  )
              ).size;
              setStats((prev) => ({
                ...prev,
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
              const todayScans = Object.values(data as Record<string, RFID>).filter((entry) => {
                const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : entry.timestamp?._methodName;
                return timestamp?.startsWith(today);
              }).length;
              setStats((prev) => ({
                ...prev,
                totalRFIDs: Object.keys(data).length,
                totalRFIDScansToday: todayScans,
              }));
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

  const formatTimestamp = (timestamp: string | { _methodName: string }): string => {
    if (!timestamp) return 'N/A';
    if (typeof timestamp === 'object' && '_methodName' in timestamp) {
      return 'Server Timestamp';
    }
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
          instructor.Profile.mobileNumber,
          instructor.Profile.createdAt,
        ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
      students: Object.entries(students).filter(([_, student]) =>
        Object.values(student.Attendance || {}).some((attendance) =>
          [
            attendance.fullName,
            attendance.email,
            attendance.department,
            attendance.idNumber,
            attendance.mobileNumber,
            attendance.sessionId,
            attendance.Action,
            attendance.Sensor,
            attendance.Status,
          ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      ),
      admins: Object.entries(admins).filter(([_, admin]) =>
        [admin.fullName, admin.email, admin.idNumber, admin.rfidUid, admin.createdAt].some(
          (field) => field?.toLowerCase().includes(searchQuery.toLowerCase())
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
      )
      .filter(({ log }) =>
        accessLogFilter === 'all' || log.role.toLowerCase() === accessLogFilter
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
      )
      .filter(({ log }) =>
        accessLogFilter === 'all' || log.role.toLowerCase() === accessLogFilter
      );
    return [...logs, ...instructorLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [accessLogs, instructors, searchQuery, accessLogFilter]);

  const filteredAlerts = useMemo(() => {
    const alertEntries = Object.entries(alerts).filter(([_, alert]) =>
      [
        alert.startTime,
        alert.endTime,
        alert.status,
        alert.resolvedByFullName,
        alert.resolvedByUID,
      ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
    ).filter(([_, alert]) =>
      alertFilter === 'all' || alert.status === alertFilter
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
      ])
      .filter(([_, alert]) =>
        alertFilter === 'all' || (typeof alert === 'object' && 'status' in alert && alert.status.toLowerCase() === alertFilter)
      );
    return [...alertEntries, ...offlineTamperEntries].sort((a, b) =>
      (typeof b[1] === 'object' && 'startTime' in b[1] ? b[1].startTime : '').localeCompare(
        typeof a[1] === 'object' && 'startTime' in a[1] ? a[1].startTime : ''
      )
    );
  }, [alerts, offlineDataLogging, searchQuery, alertFilter]);

  const filteredSystemLogs = useMemo(
    () =>
      Object.entries(systemLogs)
        .filter(([_, log]) => log.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => b[0].localeCompare(a[0])),
    [systemLogs, searchQuery]
  );

  const filteredRFIDs = useMemo(
    () => ({
      registered: Object.entries(registeredUIDs).filter(([uid, timestamp]) =>
        [uid, timestamp].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
      unregistered: Object.entries(unregisteredUIDs).filter(([uid, data]) =>
        [uid, data.AccessLogs].some((field) =>
          field?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
      rfid: Object.entries(rfid).filter(([uid, data]) =>
        [
          uid,
          data.role,
          data.uid,
          typeof data.timestamp === 'string' ? data.timestamp : data.timestamp?._methodName,
        ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    }),
    [registeredUIDs, unregisteredUIDs, rfid, searchQuery]
  );

  const roomPowerConsumption = useMemo(() => {
    const rooms: RoomPowerConsumption[] = [];

    // Extract from AdminPZEM
    Object.entries(adminPZEM).forEach(([uid, pzemEntries]) => {
      Object.entries(pzemEntries).forEach(([timestamp, pzem]) => {
        rooms.push({
          roomName: pzem.roomDetails.name,
          building: pzem.roomDetails.building,
          floor: pzem.roomDetails.floor,
          current: pzem.Current,
          energy: pzem.Energy,
          frequency: pzem.Frequency,
          power: pzem.Power,
          powerFactor: pzem.PowerFactor,
          voltage: pzem.Voltage,
          timestamp: pzem.timestamp,
        });
      });
    });

    // Extract from Instructors' ClassStatus.schedule.pzem
    Object.values(instructors).forEach((instructor) => {
      const schedule = instructor.ClassStatus?.schedule;
      if (schedule && typeof schedule.roomName !== 'string' && schedule.roomName.pzem) {
        const pzem = schedule.roomName.pzem;
        rooms.push({
          roomName: schedule.roomName.name,
          building: 'GLE Building', // Assuming same building as AdminPZEM
          floor: '7th Floor', // Assuming same floor
          current: pzem.current,
          energy: pzem.energy,
          frequency: pzem.frequency,
          power: pzem.power,
          powerFactor: pzem.powerFactor,
          voltage: pzem.voltage,
          timestamp: pzem.timestamp,
        });
      }
    });

    return rooms
      .filter((room) =>
        [
          room.roomName,
          room.building,
          room.floor,
          room.current,
          room.energy,
          room.frequency,
          room.power,
          room.powerFactor,
          room.voltage,
          room.timestamp,
        ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [adminPZEM, instructors, searchQuery]);

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
    bgColor,
    badge,
  }: {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    badge?: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      className={`relative p-4 sm:p-6 rounded-2xl shadow-lg flex items-center space-x-4 ${bgColor} border ${color} transition-all duration-300 backdrop-blur-sm bg-opacity-80`}
    >
      <div className={`p-3 rounded-full bg-opacity-20 ${bgColor.replace('bg-', 'bg-opacity-20 text-')}`}>
        {icon}
      </div>
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-gray-700">{title}</h3>
        <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
      </div>
      {badge && (
        <span className="absolute top-2 right-2 px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-full">
          {badge}
        </span>
      )}
    </motion.div>
  );

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
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
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-6 sm:mb-8 flex items-center"
        >
          <HomeIcon className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-indigo-600" />
          Smart Eco Lock Dashboard
        </motion.h1>

        {loading && (
          <div className="text-center text-indigo-600 text-lg sm:text-xl animate-pulse flex justify-center items-center">
            <svg className="animate-spin h-5 w-5 mr-3 text-indigo-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading insights...
          </div>
        )}

        <div className="mb-6 sm:mb-8">
          <input
            type="text"
            placeholder="Search personnel, logs, alerts, power data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-96 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300 py-2 sm:py-3 px-4 text-sm sm:text-base shadow-sm transition-all bg-white bg-opacity-80 backdrop-blur-sm"
            aria-label="Search dashboard data"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatCard
            title="Total Personnel"
            value={stats.totalInstructors + stats.totalStudents + stats.totalAdmins}
            icon={<UserGroupIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />}
            color="border-blue-200"
            bgColor="bg-blue-50"
          />
          <StatCard
            title="Active Alerts"
            value={stats.activeAlerts + Object.values(offlineDataLogging).filter(t => t.status === 'Active').length}
            icon={<BellIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />}
            color="border-red-200"
            bgColor="bg-red-50"
            badge={stats.activeAlerts > 0 ? `${stats.activeAlerts}` : undefined}
          />
          <StatCard
            title="Access Today"
            value={stats.totalAccessToday}
            icon={<ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />}
            color="border-indigo-200"
            bgColor="bg-indigo-50"
          />
          <StatCard
            title="Rooms Monitored"
            value={stats.totalRoomsMonitored}
            icon={<BoltIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />}
            color="border-green-200"
            bgColor="bg-green-50"
          />
          <StatCard
            title="Total Schedules"
            value={stats.totalSchedules}
            icon={<CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />}
            color="border-purple-200"
            bgColor="bg-purple-50"
          />
          <StatCard
            title="RFID Scans Today"
            value={stats.totalRFIDScansToday}
            icon={<FingerPrintIcon className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />}
            color="border-teal-200"
            bgColor="bg-teal-50"
          />
        </div>

        {newRFIDTag && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-green-50 border border-green-300 text-green-800 p-3 sm:p-4 rounded-xl shadow-lg flex items-center text-sm sm:text-base z-50 backdrop-blur-sm bg-opacity-80"
            aria-live="polite"
          >
            <TagIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-green-600" />
            <p>
              New RFID Tag Detected: <span className="font-semibold">{newRFIDTag}</span>
            </p>
          </motion.div>
        )}

        <div className="space-y-8 sm:space-y-10">
          {/* Power Consumption */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-sm bg-opacity-90"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center text-gray-800">
              <BoltIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-green-600" />
              Room Power Consumption (PZEM Data)
            </h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {paginatedPowerConsumption.length > 0 ? (
                paginatedPowerConsumption.map((room, index) => (
                  <motion.div
                    key={`${room.roomName}-${room.timestamp}-${index}`}
                    whileHover={{ scale: 1.01 }}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-200 shadow-sm"
                  >
                    <h3 className="font-medium text-gray-800 text-base sm:text-lg">Room {room.roomName}</h3>
                    <p className="text-gray-600 text-sm sm:text-base">Building: {room.building}</p>
                    <p className="text-gray-600 text-sm sm:text-base">Floor: {room.floor}</p>
                    <p className="text-gray-600 text-sm sm:text-base">Current: {room.current} A</p>
                    <p className="text-gray-600 text-sm sm:text-base">Energy: {room.energy} kWh</p>
                    <p className="text-gray-600 text-sm sm:text-base">Frequency: {room.frequency} Hz</p>
                    <p className="text-gray-600 text-sm sm:text-base">Power: {room.power} W</p>
                    <p className="text-gray-600 text-sm sm:text-base">Power Factor: {room.powerFactor}</p>
                    <p className="text-gray-600 text-sm sm:text-base">Voltage: {room.voltage} V</p>
                    <p className="text-gray-600 text-sm sm:text-base">Last Updated: {formatTimestamp(room.timestamp)}</p>
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-500 text-center text-sm sm:text-base">No power consumption data available.</p>
              )}
            </div>
            <div className="mt-6 flex justify-between items-center text-sm sm:text-base">
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({
                    ...prev,
                    powerConsumption: Math.max(prev.powerConsumption - 1, 1),
                  }))
                }
                disabled={currentPage.powerConsumption === 1}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-50 hover:bg-indigo-200 transition-all duration-200"
              >
                Previous
              </button>
              <span className="text-gray-600">
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
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-50 hover:bg-indigo-200 transition-all duration-200"
              >
                Next
              </button>
            </div>
          </motion.div>

          {/* Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-sm bg-opacity-90"
          >
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold flex items-center text-gray-800">
                <BellIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-red-600" />
                Alerts
              </h2>
              <select
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value as 'all' | 'active' | 'resolved')}
                className="px-3 py-1 rounded-lg border-gray-300 text-sm sm:text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map(([id, alert]) => (
                  <motion.div
                    key={typeof id === 'string' ? id : JSON.stringify(id)}
                    whileHover={{ scale: 1.01 }}
                    className={`p-4 rounded-lg border text-sm sm:text-base shadow-sm transition-all duration-200 ${
                      typeof alert === 'object' && 'status' in alert && alert.status === 'active'
                        ? 'bg-red-50 border-red-200 hover:bg-red-100'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-medium text-gray-800">
                      {typeof id === 'string' && id.includes('Tamper') ? 'Offline Tamper Detection' : 'Tamper Alert'}
                    </p>
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
                    {typeof alert === 'object' && 'resolvedByUID' in alert && alert.resolvedByUID && (
                      <p className="text-gray-600">Resolved by UID: {alert.resolvedByUID}</p>
                    )}
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-500 text-center text-sm sm:text-base">No alerts available.</p>
              )}
            </div>
          </motion.div>

          {/* Personnel */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-sm bg-opacity-90"
          >
            <div
              className="flex justify-between items-center mb-4 sm:mb-6 cursor-pointer"
              onClick={() => setExpandedSections((prev) => ({ ...prev, personnel: !prev.personnel }))}
            >
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold flex items-center text-gray-800">
                <UserGroupIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-indigo-600" />
                Personnel
              </h2>
              {expandedSections.personnel ? (
                <ChevronUpIcon className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-gray-600" />
              )}
            </div>
            <AnimatePresence>
              {expandedSections.personnel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 max-h-[400px] overflow-y-auto"
                >
                  {filteredPersonnel.instructors.map(([id, instructor]) => (
                    <motion.div
                      key={id}
                      whileHover={{ scale: 1.01 }}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-200 shadow-sm"
                    >
                      <h3 className="font-semibold text-gray-800 text-base sm:text-lg">{instructor.Profile.fullName}</h3>
                      <p className="text-gray-600 text-sm sm:text-base">Role: {instructor.Profile.role}</p>
                      <p className="text-gray-600 text-sm sm:text-base">Email: {instructor.Profile.email}</p>
                      <p className="text-gray-600 text-sm sm:text-base">Department: {instructor.Profile.department}</p>
                      <p className="text-gray-600 text-sm sm:text-base">ID: {instructor.Profile.idNumber}</p>
                      <p className="text-gray-600 text-sm sm:text-base">Mobile: {instructor.Profile.mobileNumber}</p>
                      <p className="text-gray-600 text-sm sm:text-base">Created: {formatTimestamp(instructor.Profile.createdAt)}</p>
                      {instructor.ClassStatus && (
                        <>
                          <p className="text-gray-600 text-sm sm:text-base">Class Status: {instructor.ClassStatus.Status}</p>
                          <p className="text-gray-600 text-sm sm:text-base">Class Status Time: {formatTimestamp(instructor.ClassStatus.dateTime)}</p>
                        </>
                      )}
                      {instructor.AccessLogs && (
                        <p className="text-gray-600 text-sm sm:text-base">Access Logs: {Object.keys(instructor.AccessLogs).length} entries</p>
                      )}
                      {instructor.rooms && (
                        <div className="mt-2">
                          <p className="text-gray-600 text-sm sm:text-base font-medium">Facilities:</p>
                          {Object.entries(instructor.rooms).map(([roomName, room]) => (
                            <div key={roomName} className="ml-2 text-sm sm:text-base">
                              <p className="text-gray-600">Room: {roomName}</p>
                              <p className="text-gray-600">Fans: {room.facilities.fans ? 'On' : 'Off'}</p>
                              <p className="text-gray-600">Lights: {room.facilities.lights ? 'On' : 'Off'}</p>
                              <p className="text-gray-600">Tampering: {room.facilities.tampering ? 'Detected' : 'None'}</p>
                              <p className="text-gray-600">Last Updated: {formatTimestamp(room.facilities.lastUpdated)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {filteredPersonnel.students.map(([id, student]) =>
                    Object.values(student.Attendance || {}).map((attendance, index) => (
                      <motion.div
                        key={`${id}-${index}`}
                        whileHover={{ scale: 1.01 }}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-200 shadow-sm"
                      >
                        <h3 className="font-semibold text-gray-800 text-base sm:text-lg">{attendance.fullName}</h3>
                        <p className="text-gray-600 text-sm sm:text-base">Role: {attendance.role}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Email: {attendance.email}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Department: {attendance.department}</p>
                        <p className="text-gray-600 text-sm sm:text-base">ID: {attendance.idNumber}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Mobile: {attendance.mobileNumber}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Action: {attendance.Action}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Sensor: {attendance.Sensor}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Status: {attendance.Status}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Time In: {formatTimestamp(attendance['Time In'])}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Time Out: {attendance['Time Out'] ? formatTimestamp(attendance['Time Out']) : 'N/A'}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Assigned Sensor ID: {attendance.assignedSensorId}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Date: {attendance.date}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Session ID: {attendance.sessionId}</p>
                        <p className="text-gray-600 text-sm sm:text-base">Timestamp: {formatTimestamp(attendance.timestamp)}</p>
                      </motion.div>
                    ))
                  )}
                  {filteredPersonnel.admins.map(([id, admin]) => (
                    <motion.div
                      key={id}
                      whileHover={{ scale: 1.01 }}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-200 shadow-sm"
                    >
                      <h3 className="font-semibold text-gray-800 text-base sm:text-lg">{admin.fullName}</h3>
                      <p className="text-gray-600 text-sm sm:text-base">Role: {admin.role}</p>
                      <p className="text-gray-600 text-sm sm:text-base">Email: {admin.email}</p>
                      <p className="text-gray-600 text-sm sm:text-base">ID: {admin.idNumber}</p>
                      <p className="text-gray-600 text-sm sm:text-base">RFID UID: {admin.rfidUid}</p>
                      <p className="text-gray-600 text-sm sm:text-base">Created: {formatTimestamp(admin.createdAt)}</p>
                      <p className="text-gray-600 text-sm sm:text-base">Last Tamper Stop: {formatTimestamp(admin.lastTamperStop)}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Schedules */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-sm bg-opacity-90"
          >
            <div
              className="flex justify-between items-center mb-4 sm:mb-6 cursor-pointer"
              onClick={() => setExpandedSections((prev) => ({ ...prev, schedules: !prev.schedules }))}
            >
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold flex items-center text-gray-800">
                <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-purple-600" />
                Schedules
              </h2>
              {expandedSections.schedules ? (
                <ChevronUpIcon className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-gray-600" />
              )}
            </div>
            <AnimatePresence>
              {expandedSections.schedules && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto"
                >
                  {Object.entries(instructors).flatMap(([uid, instructor]) =>
                    instructor.ClassStatus?.schedule ? (
                      <motion.div
                        key={`${uid}-${instructor.ClassStatus.schedule.subjectCode}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm"
                      >
                        <p className="font-semibold text-gray-800 text-base sm:text-lg">
                          {instructor.ClassStatus.schedule.subject} (
                          {instructor.ClassStatus.schedule.subjectCode})
                        </p>
                        <p className="text-gray-600 text-sm sm:text-base">Instructor: {instructor.Profile.fullName}</p>
                        <p className="text-gray-600 text-sm sm:text-base">
                          {instructor.ClassStatus.schedule.day}: {instructor.ClassStatus.schedule.startTime} -{' '}
                          {instructor.ClassStatus.schedule.endTime}
                        </p>
                        <p className="text-gray-600 text-sm sm:text-base">
                          Room:{' '}
                          {typeof instructor.ClassStatus.schedule.roomName === 'string'
                            ? instructor.ClassStatus.schedule.roomName
                            : instructor.ClassStatus.schedule.roomName.name}
                        </p>
                        <p className="text-gray-600 text-sm sm:text-base">Section: {instructor.ClassStatus.schedule.section}</p>
                        {typeof instructor.ClassStatus.schedule.roomName !== 'string' &&
                          instructor.ClassStatus.schedule.roomName.pzem && (
                            <div className="mt-2">
                              <p className="text-gray-600 text-sm sm:text-base font-medium">PZEM Data:</p>
                              <p className="text-gray-600 text-sm sm:text-base">Current: {instructor.ClassStatus.schedule.roomName.pzem.current} A</p>
                              <p className="text-gray-600 text-sm sm:text-base">Energy: {instructor.ClassStatus.schedule.roomName.pzem.energy} kWh</p>
                              <p className="text-gray-600 text-sm sm:text-base">Frequency: {instructor.ClassStatus.schedule.roomName.pzem.frequency} Hz</p>
                              <p className="text-gray-600 text-sm sm:text-base">Power: {instructor.ClassStatus.schedule.roomName.pzem.power} W</p>
                              <p className="text-gray-600 text-sm sm:text-base">Power Factor: {instructor.ClassStatus.schedule.roomName.pzem.powerFactor}</p>
                              <p className="text-gray-600 text-sm sm:text-base">Voltage: {instructor.ClassStatus.schedule.roomName.pzem.voltage} V</p>
                              <p className="text-gray-600 text-sm sm:text-base">Timestamp: {formatTimestamp(instructor.ClassStatus.schedule.roomName.pzem.timestamp)}</p>
                            </div>
                          )}
                      </motion.div>
                    ) : (
                      []
                    )
                  )}
                  {Object.entries(students).flatMap(([uid, student]) =>
                    Object.values(student.Attendance || {}).flatMap((attendance) =>
                      attendance.schedules.map((schedule, index) => (
                        <motion.div
                          key={`${uid}-${index}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm"
                        >
                          <p className="font-semibold text-gray-800 text-base sm:text-lg">
                            {schedule.subject} ({schedule.subjectCode})
                          </p>
                          <p className="text-gray-600 text-sm sm:text-base">Student: {attendance.fullName}</p>
                          <p className="text-gray-600 text-sm sm:text-base">
                            {schedule.day}: {schedule.startTime} - {schedule.endTime}
                          </p>
                          <p className="text-gray-600 text-sm sm:text-base">
                            Room:{' '}
                            {typeof schedule.roomName === 'string'
                              ? schedule.roomName
                              : schedule.roomName.name}
                          </p>
                          <p className="text-gray-600 text-sm sm:text-base">Section: {schedule.section}</p>
                          <p className="text-gray-600 text-sm sm:text-base">Instructor: {schedule.instructorName}</p>
                        </motion.div>
                      ))
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Access Logs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-sm bg-opacity-90"
          >
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold flex items-center text-gray-800">
                <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-indigo-600" />
                Access Logs
              </h2>
              <select
                value={accessLogFilter}
                onChange={(e) => setAccessLogFilter(e.target.value as 'all' | 'admin' | 'instructor' | 'student')}
                className="px-3 py-1 rounded-lg border-gray-300 text-sm sm:text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="instructor">Instructor</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {paginatedAccessLogs.length > 0 ? (
                <table className="w-full text-sm sm:text-base">
                  <thead>
                    <tr className="bg-indigo-50 text-indigo-800">
                      <th className="p-2 text-left">Full Name</th>
                      <th className="p-2 text-left">Role</th>
                      <th className="p-2 text-left">Action</th>
                      <th className="p-2 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAccessLogs.map(({ uid, timestamp, log }, index) => (
                      <motion.tr
                        key={`${uid}-${timestamp}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-200 hover:bg-gray-100 transition-all duration-200"
                      >
                        <td className="p-2 text-gray-800">{log.fullName}</td>
                        <td className="p-2 text-gray-600">{log.role}</td>
                        <td className="p-2 text-gray-600">{log.action}</td>
                        <td className="p-2 text-gray-600">{formatTimestamp(log.timestamp)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-center text-sm sm:text-base">No access logs available.</p>
              )}
            </div>
            <div className="mt-6 flex justify-between items-center text-sm sm:text-base">
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({
                    ...prev,
                    accessLogs: Math.max(prev.accessLogs - 1, 1),
                  }))
                }
                disabled={currentPage.accessLogs === 1}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-50 hover:bg-indigo-200 transition-all duration-200"
              >
                Previous
              </button>
              <span className="text-gray-600">
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
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-50 hover:bg-indigo-200 transition-all duration-200"
              >
                Next
              </button>
            </div>
          </motion.div>

          {/* System Logs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-sm bg-opacity-90"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center text-gray-800">
              <DocumentTextIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-gray-600" />
              System Logs
            </h2>
            <div className="max-h-[400px] overflow-y-auto">
              {paginatedSystemLogs.length > 0 ? (
                <table className="w-full text-sm sm:text-base">
                  <thead>
                    <tr className="bg-gray-100 text-gray-800">
                      <th className="p-2 text-left">Log Message</th>
                      <th className="p-2 text-left">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSystemLogs.map(([id, log]) => (
                      <motion.tr
                        key={id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-200 hover:bg-gray-100 transition-all duration-200"
                      >
                        <td className="p-2 text-gray-600">{log}</td>
                        <td className="p-2 text-gray-500">{formatTimestamp(id)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-center text-sm sm:text-base">No system logs available.</p>
              )}
            </div>
            <div className="mt-6 flex justify-between items-center text-sm sm:text-base">
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({
                    ...prev,
                    systemLogs: Math.max(prev.systemLogs - 1, 1),
                  }))
                }
                disabled={currentPage.systemLogs === 1}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-50 hover:bg-indigo-200 transition-all duration-200"
              >
                Previous
              </button>
              <span className="text-gray-600">
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
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-50 hover:bg-indigo-200 transition-all duration-200"
              >
                Next
              </button>
            </div>
          </motion.div>

          {/* RFID UIDs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-sm bg-opacity-90"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6 flex items-center text-gray-800">
              <TagIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-teal-600" />
              RFID UIDs
            </h2>
            <div className="max-h-[400px] overflow-y-auto">
              {(paginatedRFIDs.registered.length > 0 || paginatedRFIDs.unregistered.length > 0 || paginatedRFIDs.rfid.length > 0) ? (
                <table className="w-full text-sm sm:text-base">
                  <thead>
                    <tr className="bg-teal-50 text-teal-800">
                      <th className="p-2 text-left">UID</th>
                      <th className="p-2 text-left">Status/Role</th>
                      <th className="p-2 text-left">Details</th>
                      <th className="p-2 text-left">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRFIDs.registered.map(([uid, timestamp]) => (
                      <motion.tr
                        key={`reg-${uid}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-200 hover:bg-gray-100 transition-all duration-200"
                      >
                        <td className="p-2 text-gray-800 font-semibold">{uid}</td>
                        <td className="p-2 text-gray-600">Registered</td>
                        <td className="p-2 text-gray-600">-</td>
                        <td className="p-2 text-gray-600">{formatTimestamp(timestamp)}</td>
                      </motion.tr>
                    ))}
                    {paginatedRFIDs.unregistered.map(([uid, data]) => (
                      <motion.tr
                        key={`unreg-${uid}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-all duration-200"
                      >
                        <td className="p-2 text-gray-800 font-semibold">{uid}</td>
                        <td className="p-2 text-gray-600">Unregistered</td>
                        <td className="p-2 text-gray-600">Access Attempt</td>
                        <td className="p-2 text-gray-600">{formatTimestamp(data.AccessLogs)}</td>
                      </motion.tr>
                    ))}
                    {paginatedRFIDs.rfid.map(([uid, data]) => (
                      <motion.tr
                        key={`rfid-${uid}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-200 hover:bg-gray-100 transition-all duration-200"
                      >
                        <td className="p-2 text-gray-800 font-semibold">{uid}</td>
                        <td className="p-2 text-gray-600">{data.role}</td>
                        <td className="p-2 text-gray-600">User ID: {data.uid}</td>
                        <td className="p-2 text-gray-600">{formatTimestamp(data.timestamp)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-center text-sm sm:text-base">No RFID data available.</p>
              )}
            </div>
            <div className="mt-6 flex justify-between items-center text-sm sm:text-base">
              <button
                onClick={() =>
                  setCurrentPage((prev) => ({ ...prev, rfid: Math.max(prev.rfid - 1, 1) }))
                }
                disabled={currentPage.rfid === 1}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-50 hover:bg-indigo-200 transition-all duration-200"
              >
                Previous
              </button>
              <span className="text-gray-600">
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
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg disabled:opacity-50 hover:bg-indigo-200 transition-all duration-200"
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
