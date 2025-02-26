import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
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
  ExclamationCircleIcon
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
import Swal from 'sweetalert2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Room {
  id: string;
  roomNumber: string;
  department: string;
}

interface EnergyUsage {
  id: string;
  classroomId: string;
  timestamp: Date;
  consumptionKWh: number;
  devices: {
    lighting: number;
    projection: number;
    computers: number;
    hvac: number;
  };
}

const EnergyUsagePage: React.FC = () => {
  const [energyData, setEnergyData] = useState<EnergyUsage[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('hour');
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch rooms from teachers collection
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const teachersRef = collection(db, 'teachers');
        const snapshot = await getDocs(teachersRef);
        const uniqueRooms = new Set<string>();
        const roomsData: Room[] = [];

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.roomNumber && !uniqueRooms.has(data.roomNumber)) {
            uniqueRooms.add(data.roomNumber);
            roomsData.push({
              id: doc.id,
              roomNumber: data.roomNumber,
              department: data.department || 'Unknown'
            });
          }
        });

        setRooms(roomsData.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)));
        if (roomsData.length > 0 && !selectedClassroom) {
          setSelectedClassroom(roomsData[0].roomNumber);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
        Swal.fire('Error', 'Failed to fetch rooms', 'error');
      }
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    if (!selectedClassroom) return;

    const getStartTime = () => {
      const now = new Date();
      switch(timeRange) {
        case 'hour': return new Date(now.getTime() - 60 * 60 * 1000);
        case 'day': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    };

    const fetchEnergyData = async () => {
      try {
        const q = query(
          collection(db, 'energyUsage'),
          where("classroomId", "==", selectedClassroom),
          where("timestamp", ">", getStartTime())
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp.toDate()
          } as EnergyUsage));
          
          setEnergyData(data);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching energy data:', error);
        Swal.fire('Error', 'Failed to fetch energy data', 'error');
        setLoading(false);
      }
    };

    fetchEnergyData();
  }, [selectedClassroom, timeRange]);

  const chartData = {
    labels: energyData.map(entry => 
      entry.timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    ),
    datasets: [
      {
        label: 'Total Energy Consumption (kWh)',
        data: energyData.map(entry => entry.consumptionKWh),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        tension: 0.4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Energy Consumption Over Time',
        font: {
          size: 16,
          weight: 'bold' as 'bold'
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Energy (kWh)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        }
      }
    }
  };

  const totalConsumption = energyData.reduce((sum, entry) => sum + entry.consumptionKWh, 0);
  const averageConsumption = totalConsumption / (energyData.length || 1);
  const peakUsage = energyData.length > 0 ? Math.max(...energyData.map(d => d.consumptionKWh)) : 0;

  return (
    <div className="flex h-screen bg-gray-50">
       <AdminSidebar />
      
       <div className={`flex-1 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'ml-20' : 'ml-64'} overflow-y-auto`}>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Energy Usage Analytics</h1>
            <p className="mt-2 text-gray-600">Monitor and analyze classroom energy consumption</p>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <BuildingOfficeIcon className="w-5 h-5 inline-block mr-2 text-indigo-600" />
                Select Classroom
              </label>
              {rooms.length > 0 ? (
                <select
                  value={selectedClassroom}
                  onChange={(e) => setSelectedClassroom(e.target.value)}
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-2.5"
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.roomNumber}>
                      Room {room.roomNumber} - {room.department}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center text-yellow-600">
                  <ExclamationCircleIcon className="w-5 h-5 mr-2" />
                  <span>No rooms available</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <ClockIcon className="w-5 h-5 inline-block mr-2 text-indigo-600" />
                Time Range
              </label>
              <div className="flex gap-3">
                {['hour', 'day', 'week'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as any)}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

              {/* Main Chart */}
              <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                <div className="h-[400px]">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              {/* Device Breakdown */}
              {energyData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h3 className="text-lg font-semibold mb-6">Device Energy Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, description }: any) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="bg-white p-6 rounded-xl shadow-sm"
  >
    <div className="flex items-center">
      <div className="p-2 bg-indigo-100 rounded-lg">
        <Icon className="w-6 h-6 text-indigo-600" />
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  </motion.div>
);

const DeviceEnergy = ({ label, value, color, icon: Icon }: any) => (
  <div className="bg-gray-50 p-4 rounded-lg">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-5 h-5" style={{ color }} />
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
    <div className="flex justify-between items-center mb-2">
      <span className="text-2xl font-semibold" style={{ color }}>
        {value.toFixed(2)} kWh
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ 
          width: `${(value / 10) * 100}%`, 
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}40`
        }}
      />
    </div>
  </div>
);

export default EnergyUsagePage;
    