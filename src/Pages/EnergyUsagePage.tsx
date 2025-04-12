import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AdminSidebar from '../components/AdminSidebar';
import {
  BoltIcon,
  ChartBarIcon,
  PowerIcon,
  LightBulbIcon,
  ArrowsRightLeftIcon,
  BuildingOfficeIcon,
  ClockIcon,
  ExclamationCircleIcon,
  CalculatorIcon,
  UserIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/solid';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { collection, getDocs } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { db, rtdb } from '../firebase';
import Swal from 'sweetalert2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
}

interface Schedule {
  [x: string]: any;
  day: string;
  startTime: string;
  endTime: string;
  roomName: {
    name: string;
    pzem: PZEMData;
  };
  section: string;
  subject: string;
  subjectCode: string;
}

interface EnergyUsage {
  id: string;
  classroomId: string;
  timestamp: Date;
  powerWatts: number;
  consumptionKWh: number;
  devices: {
    lighting: number;
    projection: number;
    computers: number;
    hvac: number;
  };
  instructorName: string;
  subject: string;
  subjectCode: string;
  schedule: {
    day: string;
    startTime: string;
    endTime: string;
    section: string;
  };
}

interface PZEMData {
  action: string;
  current: string;
  energy: string;
  frequency: string;
  power: string;
  powerFactor: string;
  timestamp: string;
  voltage: string;
}

interface InstructorData {
  ClassStatus?: {
    Status: string;
    dateTime: string;
    schedules?: Schedule[]; // Changed to array to handle multiple schedules
  };
  Profile?: {
    fullName: string;
    email?: string;
    department?: string;
    idNumber?: string;
    mobileNumber?: string;
    role: string;
    createdAt?: string;
  };
}

interface InstructorsData {
  [uid: string]: InstructorData;
}

const VECO_RATE_PER_KWH = 14; // Pesos per kWh

const EnergyUsagePage: React.FC = () => {
  const [energyData, setEnergyData] = useState<EnergyUsage[]>([]);
  const [instructorsData, setInstructorsData] = useState<InstructorsData>({});
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('hour');
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Calculator states
  const [calcPowerWatts, setCalcPowerWatts] = useState<string>('0');
  const [calcHours, setCalcHours] = useState<string>('1');
  const [calcResult, setCalcResult] = useState<{ kWh: string; cost: string } | null>(null);
  // Filter state for table
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomsCollection = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsCollection);
        const roomsData = roomsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          building: doc.data().building || '',
          floor: doc.data().floor || '',
        }) as Room);

        const sortedRooms = roomsData.sort((a, b) => a.name.localeCompare(b.name));
        setRooms(sortedRooms);
        if (sortedRooms.length > 0) {
          setSelectedClassroom(sortedRooms[0].name);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch rooms',
          customClass: {
            popup: 'rounded-lg sm:rounded-xl',
            title: 'text-blue-900',
            htmlContainer: 'text-blue-700',
            confirmButton: 'bg-blue-600 hover:bg-blue-700',
          },
        });
      }
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    const instructorsRef = ref(rtdb, 'Instructors');
    const unsubscribe = onValue(
      instructorsRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        // Normalize data to handle single schedule as array
        Object.values(data).forEach((instructor: any) => {
          if (instructor.ClassStatus?.schedule && !instructor.ClassStatus.schedules) {
            instructor.ClassStatus.schedules = [instructor.ClassStatus.schedule];
            delete instructor.ClassStatus.schedule;
          }
        });
        setInstructorsData(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching Instructors data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch instructors data',
          customClass: {
            popup: 'rounded-lg sm:rounded-xl',
            title: 'text-blue-900',
            htmlContainer: 'text-blue-700',
            confirmButton: 'bg-blue-600 hover:bg-blue-700',
          },
        });
      }
    );

    return () => off(instructorsRef);
  }, []);

  useEffect(() => {
    if (!selectedClassroom || Object.keys(instructorsData).length === 0) return;

    const processData = () => {
      try {
        const energyEntries: EnergyUsage[] = [];
        const timeRangeHours = timeRange === 'hour' ? 1 : timeRange === 'day' ? 24 : 7 * 24;

        Object.entries(instructorsData).forEach(([uid, instructor]) => {
          const schedules = instructor.ClassStatus?.schedules || [];
          schedules.forEach((schedule, index) => {
            if (schedule.roomName?.name === selectedClassroom && schedule.pzem) {
              const pzem = schedule.pzem;
              const powerWatts = parseFloat(pzem.power) || 0;
              const consumptionKWh = (powerWatts * timeRangeHours) / 1000;
              const instructorName = instructor.Profile?.fullName || 'Unknown Instructor';
              const timestampStr = pzem.timestamp.replace(/_/g, ':');
              const timestamp = new Date(timestampStr);

              if (isNaN(timestamp.getTime())) {
                console.warn(`Invalid timestamp for UID ${uid}, schedule ${index}: ${timestampStr}`);
                return;
              }

              energyEntries.push({
                id: `${uid}_${pzem.timestamp}_${index}`,
                classroomId: selectedClassroom,
                timestamp,
                powerWatts,
                consumptionKWh,
                devices: {
                  lighting: consumptionKWh * 0.25,
                  projection: consumptionKWh * 0.25,
                  computers: consumptionKWh * 0.25,
                  hvac: consumptionKWh * 0.25,
                },
                instructorName,
                subject: schedule.subject || 'Unknown Subject',
                subjectCode: schedule.subjectCode || 'N/A',
                schedule: {
                  day: schedule.day || 'N/A',
                  startTime: schedule.startTime || 'N/A',
                  endTime: schedule.endTime || 'N/A',
                  section: schedule.section || 'N/A',
                },
              });
            }
          });
        });

        const startTime = getStartTime();
        const filteredEnergyData = energyEntries
          .filter(entry => entry.timestamp > startTime)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        setEnergyData(filteredEnergyData);
      } catch (error) {
        console.error('Error processing Instructors data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to process energy data',
          customClass: {
            popup: 'rounded-lg sm:rounded-xl',
            title: 'text-blue-900',
            htmlContainer: 'text-blue-700',
            confirmButton: 'bg-blue-600 hover:bg-blue-700',
          },
        });
      }
    };

    processData();
  }, [selectedClassroom, timeRange, instructorsData]);

  const getStartTime = () => {
    const now = new Date();
    switch (timeRange) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default:
        return now;
    }
  };

  const getLatestPzemData = (): { pzem: PZEMData; schedule: Schedule } | null => {
    let latestData: { pzem: PZEMData; schedule: Schedule } | null = null;
    Object.entries(instructorsData).forEach(([uid, instructor]) => {
      const schedules = instructor.ClassStatus?.schedules || [];
      schedules.forEach(schedule => {
        if (schedule.roomName?.name === selectedClassroom && schedule.pzem) {
          const pzem = schedule.pzem;
          if (!latestData || pzem.timestamp > latestData.pzem.timestamp) {
            latestData = { pzem, schedule };
          }
        }
      });
    });
    return latestData;
  };

  const getLatestInstructorName = (): string => {
    let latestInstructorName = 'Unknown Instructor';
    let latestTimestamp = '';
    Object.entries(instructorsData).forEach(([uid, instructor]) => {
      const schedules = instructor.ClassStatus?.schedules || [];
      schedules.forEach(schedule => {
        if (schedule.roomName?.name === selectedClassroom && schedule.pzem) {
          const pzem = schedule.pzem;
          if (!latestTimestamp || pzem.timestamp > latestTimestamp) {
            latestTimestamp = pzem.timestamp;
            latestInstructorName = instructor.Profile?.fullName || 'Unknown Instructor';
          }
        }
      });
    });
    return latestInstructorName;
  };

  const chartData = {
    labels: energyData.map(entry =>
      entry.timestamp.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    ),
    datasets: [
      {
        label: 'Energy Consumption (kWh)',
        data: energyData.map(entry => entry.consumptionKWh),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        tension: 0.4,
      },
      {
        label: 'Power (W)',
        data: energyData.map(entry => entry.powerWatts),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: {
        display: true,
        text: `Energy Consumption Over Time - ${selectedClassroom}`,
        font: { size: 14, weight: 'bold' as 'bold' },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const index = context.dataIndex;
            const datasetLabel = context.dataset.label || '';
            const value = context.parsed.y;
            const entry = energyData[index];
            if (!entry) return '';
            return [
              `${datasetLabel}: ${value.toFixed(2)}`,
              `Instructor: ${entry.instructorName}`,
              `Subject: ${entry.subject} (${entry.subjectCode})`,
              `Schedule: ${entry.schedule.day} ${entry.schedule.startTime}-${entry.schedule.endTime}`,
              `Section: ${entry.schedule.section}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Energy (kWh)' },
      },
      y1: {
        position: 'right' as const,
        beginAtZero: true,
        title: { display: true, text: 'Power (W)' },
        grid: { drawOnChartArea: false },
      },
      x: { title: { display: true, text: 'Time' } },
    },
  };

  // Computed consumption stats
  const totalConsumption = energyData.reduce((sum, entry) => sum + entry.consumptionKWh, 0);
  const averageConsumption = totalConsumption / (energyData.length || 1);
  const peakUsage = energyData.length > 0 ? Math.max(...energyData.map(d => d.consumptionKWh)) : 0;
  const totalPower = energyData.reduce((sum, entry) => sum + entry.powerWatts, 0);

  const calculatePowerCosts = () => {
    const timeRangeHours = timeRange === 'hour' ? 1 : timeRange === 'day' ? 24 : 7 * 24;
    const consumptionKWh = totalConsumption;
    const cost = consumptionKWh * VECO_RATE_PER_KWH;

    return {
      consumptionKWh: consumptionKWh.toFixed(2),
      cost: cost.toFixed(2),
    };
  };

  const powerCosts = calculatePowerCosts();

  const handleCalculate = () => {
    const power = parseFloat(calcPowerWatts) || 0;
    const hours = parseFloat(calcHours) || 0;
    const kWh = (power * hours) / 1000;
    const cost = kWh * VECO_RATE_PER_KWH;
    setCalcResult({
      kWh: kWh.toFixed(2),
      cost: cost.toFixed(2),
    });
  };

  const latestData = getLatestPzemData();
  const latestPzemData = latestData?.pzem;
  const latestSchedule = latestData?.schedule;
  const latestInstructorName = getLatestInstructorName();

  // Filter energy data based on search query
  const filteredEnergyData = energyData.filter(entry =>
    [entry.instructorName, entry.subject, entry.subjectCode, entry.schedule.section]
      .some(field => field.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar/>

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-500 transition-colors"
      >
        <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>

      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'ml-64' : 'ml-0 md:ml-64'
        } overflow-y-auto p-4 sm:p-8`}
      >
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Energy Usage Analytics</h1>
          <p className="mt-1 sm:mt-2 text-gray-600 text-sm sm:text-base">
            Monitor and analyze classroom energy consumption with schedule details
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
              <BuildingOfficeIcon className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2 text-indigo-600" />
              Select Classroom
            </label>
            {rooms.length > 0 ? (
              <select
                value={selectedClassroom}
                onChange={e => setSelectedClassroom(e.target.value)}
                className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2.5 text-sm sm:text-base"
              >
                {rooms.map(room => (
                  <option key={room.id} value={room.name}>
                    {room.name} - {room.building}, {room.floor}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center text-yellow-600 text-sm sm:text-base">
                <ExclamationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                <span>No rooms available</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
              <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2 text-indigo-600" />
              Time Range
            </label>
            <div className="flex gap-2 sm:gap-3">
              {['hour', 'day', 'week'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as any)}
                  className={`flex-1 py-1.5 sm:py-2.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                    timeRange === range
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {range === 'hour' ? 'Last Hour' : range === 'day' ? 'Last 24 Hours' : 'Last Week'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Real-time Power Consumption Section */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center">
                <BoltIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                Real-time Power Consumption ({selectedClassroom})
              </h3>
              {latestPzemData && latestSchedule ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-600">Power:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.power).toFixed(2)} W</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.current).toFixed(2)} A</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Voltage:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.voltage).toFixed(2)} V</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Energy:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.energy).toFixed(2)} kWh</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Frequency:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.frequency).toFixed(2)} Hz</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Power Factor:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.powerFactor).toFixed(2)}</span>
                  </div>
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
                    <div className="flex items-center text-gray-600 mb-2">
                      <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span>Instructor:</span>{' '}
                      <span className="font-medium ml-1">
                        {latestInstructorName.length > 20
                          ? `${latestInstructorName.substring(0, 17)}...`
                          : latestInstructorName}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <AcademicCapIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span>Subject:</span>{' '}
                      <span className="font-medium ml-1">
                        {latestSchedule.subject} ({latestSchedule.subjectCode})
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600 mt-2">
                      <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span>Schedule:</span>{' '}
                      <span className="font-medium ml-1">
                        {latestSchedule.day} {latestSchedule.startTime}-{latestSchedule.endTime}, Section{' '}
                        {latestSchedule.section}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-full">
                    <span className="text-gray-600">Last Updated:</span>{' '}
                    <span className="font-medium">{latestPzemData.timestamp.replace(/_/g, ':')}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500">
                  No real-time power data available for {selectedClassroom}
                </p>
              )}
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <StatCard
                icon={BoltIcon}
                title="Total Consumption"
                value={`${totalConsumption.toFixed(2)} kWh`}
                description="Total energy used"
              />
              <StatCard
                icon={ChartBarIcon}
                title="Average Consumption"
                value={`${averageConsumption.toFixed(2)} kWh`}
                description="Average per reading"
              />
              <StatCard
                icon={PowerIcon}
                title="Peak Usage"
                value={`${peakUsage.toFixed(2)} kWh`}
                description="Highest consumption"
              />
              <StatCard
                icon={ArrowsRightLeftIcon}
                title="Readings"
                value={energyData.length}
                description="Total data points"
              />
            </div>

            {/* Power Consumption Analysis */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center">
                <CalculatorIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                Power Consumption Analysis (@ ₱{VECO_RATE_PER_KWH}/kWh)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Room Consumption</h4>
                  <p className="text-xs sm:text-sm">Consumption: {powerCosts.consumptionKWh} kWh</p>
                  <p className="text-xs sm:text-sm">Cost: ₱{powerCosts.cost}</p>
                </div>
              </div>
            </div>

            {/* Interactive Power Calculator */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center">
                <CalculatorIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                Interactive Power Calculator
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Power (Watts)
                  </label>
                  <input
                    type="number"
                    value={calcPowerWatts}
                    onChange={e => setCalcPowerWatts(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2 px-2 sm:px-3 text-sm sm:text-base"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Hours Used
                  </label>
                  <input
                    type="number"
                    value={calcHours}
                    onChange={e => setCalcHours(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2 px-2 sm:px-3 text-sm sm:text-base"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    onClick={handleCalculate}
                    className="w-full sm:w-auto px-4 sm:px-6 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base"
                  >
                    Calculate
                  </button>
                  {calcResult && (
                    <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg text-xs sm:text-sm">
                      <p>Energy Consumption: {calcResult.kWh} kWh</p>
                      <p>Cost (@ ₱{VECO_RATE_PER_KWH}/kWh): ₱{calcResult.cost}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <div className="h-[300px] sm:h-[400px]">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Device Energy Breakdown */}
            {energyData.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
                <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6">
                  Device Energy Breakdown (Latest Reading)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <DeviceEnergy
                    label="Lighting"
                    value={energyData[energyData.length - 1].devices.lighting}
                    color="rgb(59, 130, 246)"
                    icon={LightBulbIcon}
                  />
                  <DeviceEnergy
                    label="Projection"
                    value={energyData[energyData.length - 1].devices.projection}
                    color="rgb(16, 185, 129)"
                    icon={ChartBarIcon}
                  />
                  <DeviceEnergy
                    label="Computers"
                    value={energyData[energyData.length - 1].devices.computers}
                    color="rgb(245, 158, 11)"
                    icon={PowerIcon}
                  />
                  <DeviceEnergy
                    label="HVAC"
                    value={energyData[energyData.length - 1].devices.hvac}
                    color="rgb(239, 68, 68)"
                    icon={ArrowsRightLeftIcon}
                  />
                </div>
              </div>
            )}

            {/* Energy Data Table */}
            {energyData.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mt-6 sm:mt-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold flex items-center">
                    <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                    Energy Consumption Records
                  </h3>
                  <div className="mt-3 sm:mt-0 w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search by instructor, subject, or section..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2 px-2 sm:px-3 text-sm sm:text-base"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left text-gray-600">
                    <thead className="text-xs sm:text-sm text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Timestamp
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Instructor
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Subject
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Schedule
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Section
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Power (W)
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Consumption (kWh)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEnergyData.length > 0 ? (
                        filteredEnergyData.map(entry => (
                          <tr key={entry.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.timestamp.toLocaleString()}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.instructorName.length > 20
                                ? `${entry.instructorName.substring(0, 17)}...`
                                : entry.instructorName}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.subject} ({entry.subjectCode})
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.schedule.day} {entry.schedule.startTime}-{entry.schedule.endTime}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.schedule.section}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.powerWatts.toFixed(2)}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.consumptionKWh.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 sm:px-6 py-3 sm:py-4 text-center text-gray-500">
                            No records match your search
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, description }: any) => (
  <motion.div whileHover={{ scale: 1.02 }} className="bg-white p-4 sm:p-6 rounded-xl shadow-sm">
    <div className="flex items-center">
      <div className="p-2 bg-indigo-100 rounded-lg">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
      </div>
      <div className="ml-3 sm:ml-4">
        <p className="text-xs sm:text-sm font-medium text-gray-600">{title}</p>
        <p className="text-lg sm:text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-xs sm:text-sm text-gray-500">{description}</p>
      </div>
    </div>
  </motion.div>
);

const DeviceEnergy = ({ label, value, color, icon: Icon }: any) => (
  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
    <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-3">
      <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color }} />
      <span className="text-xs sm:text-sm font-medium text-gray-600">{label}</span>
    </div>
    <div className="flex justify-between items-center mb-1 sm:mb-2">
      <span className="text-lg sm:text-2xl font-semibold" style={{ color }}>
        {value.toFixed(2)} kWh
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
      <div
        className="h-1.5 sm:h-2 rounded-full transition-all duration-500"
        style={{ width: `${Math.min((value / 10) * 100, 100)}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
      />
    </div>
  </div>
);

export default EnergyUsagePage;