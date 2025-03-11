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

// Static JSON data
const energyDataJson = {
  "Alerts": {
    "Tamper": "03-11-2025 12:27:21"
  },
  "Instructors": {
    "1419CF": {
      "AccessLogs": "e:03-10-2025 20:02:32",
      "PZEMData": {
        "Current": "0.16",
        "Energy": "0.04",
        "Frequency": "59.80",
        "Power": "1.20",
        "PowerFactor": "0.03",
        "Voltage": "228.40"
      }
    },
    "1419CFBA": {
      "AccessLogs": "03-10-2025 20:02:32",
      "PZEMData": {
        "Current": "0.16",
        "Energy": "0.04",
        "Frequency": "59.80",
        "Power": "1.20",
        "PowerFactor": "0.03",
        "Voltage": "228.40"
      }
    },
    "74F8C4BA": {
      "AccessLogs": "03-10-2025 21:12:31",
      "PZEMData": {
        "Current": "0.16",
        "Energy": "0.04",
        "Frequency": "60.10",
        "Power": "1.10",
        "PowerFactor": "0.03",
        "Voltage": "226.50"
      }
    }
  },
  "RegisteredUIDs": {
    "1419CF": "e:03-10-2025 20:18:05",
    "1419CFBA": "03-10-2025 20:18:05",
    "74F8C4BA": "03-10-2025 21:12:31"
  },
  "UnregisteredUIDs": {
    "1419CF": { "AccessLogs": "e:03-10-2025 20:01:24" },
    "7422B5BA": { "AccessLogs": "03-10-2025 21:12:44" },
    "74F8C4": { "AccessLogs": "e:03-10-2025 20:19:21" },
    "F429BA": { "AccessLogs": "e:03-11-2025 12:27:44" },
    "F429BABA": { "AccessLogs": "03-11-2025 12:27:44" }
  },
  "rfid": {
    "1419CFBA": {
      "role": "instructor",
      "timestamp": { "_methodName": "serverTimestamp" },
      "uid": "T4TVOYRBpgTX3voUkXuxpAyte4r2"
    },
    "74F8C4BA": {
      "role": "student",
      "timestamp": { "_methodName": "serverTimestamp" },
      "uid": "eEIYuVZ2B4MXwEBWRANowKdf7Hw1"
    }
  }
};

interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
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

interface PZEMData {
  Current: string;
  Energy: string;
  Frequency: string;
  Power: string;
  PowerFactor: string;
  Voltage: string;
  timestamp?: string;
}

interface InstructorPZEMData {
  roomName: string;
  pzemData: PZEMData;
}

const EnergyUsagePage: React.FC = () => {
  const [energyData, setEnergyData] = useState<EnergyUsage[]>([]);
  const [pzemData, setPzemData] = useState<InstructorPZEMData[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('hour');
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Simulated room data since we don't have Firestore
  useEffect(() => {
    const mockRooms: Room[] = [
      { id: "1", name: "705", building: "GLE Building", floor: "7th Floor" },
      { id: "2", name: "706", building: "GLE Building", floor: "7th Floor" },
    ];
    setRooms(mockRooms.sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedClassroom(mockRooms[0].name);
  }, []);

  // Simulated energy usage data (since original doesn't contain this)
  useEffect(() => {
    if (!selectedClassroom) return;

    const mockEnergyData: EnergyUsage[] = [
      {
        id: "1",
        classroomId: selectedClassroom,
        timestamp: new Date("2025-03-10T20:00:00"),
        consumptionKWh: 0.04,
        devices: { lighting: 0.01, projection: 0.01, computers: 0.01, hvac: 0.01 }
      },
      {
        id: "2",
        classroomId: selectedClassroom,
        timestamp: new Date("2025-03-10T21:00:00"),
        consumptionKWh: 0.04,
        devices: { lighting: 0.01, projection: 0.01, computers: 0.01, hvac: 0.01 }
      },
    ];

    const filteredData = mockEnergyData.filter(entry => {
      const startTime = getStartTime();
      return entry.timestamp > startTime;
    });

    setEnergyData(filteredData);
    setLoading(false);
  }, [selectedClassroom, timeRange]);

  // Fetch PZEM data from static JSON
  useEffect(() => {
    const fetchPZEMData = () => {
      try {
        // Simulated room assignments
        const roomAssignments: { [key: string]: string } = {
          "1419CF": "705",
          "1419CFBA": "705",
          "74F8C4BA": "706",
        };

        const instructorsData = energyDataJson.Instructors;
        const pzemEntries: InstructorPZEMData[] = [];

        Object.entries(instructorsData).forEach(([instructorId, data]: [string, any]) => {
          const roomName = roomAssignments[instructorId] || 'Unknown';
          if (data.PZEMData) {
            const pzemData: PZEMData = {
              Current: data.PZEMData.Current || '0',
              Energy: data.PZEMData.Energy || '0',
              Frequency: data.PZEMData.Frequency || '0',
              Power: data.PZEMData.Power || '0',
              PowerFactor: data.PZEMData.PowerFactor || '0',
              Voltage: data.PZEMData.Voltage || '0',
              timestamp: data.AccessLogs.replace('e:', ''), // Using AccessLogs as timestamp
            };
            pzemEntries.push({
              roomName,
              pzemData,
            });
          }
        });

        const filteredPzemData = pzemEntries.filter((entry) => {
          const matchesRoom = !selectedClassroom || entry.roomName === selectedClassroom;
          const entryTime = new Date(entry.pzemData.timestamp || '');
          const startTime = getStartTime();
          const matchesTime = entryTime > startTime;
          return matchesRoom && matchesTime;
        });

        setPzemData(filteredPzemData);
        setLoading(false);
      } catch (error) {
        console.error('Error processing PZEM data:', error);
        Swal.fire('Error', 'Failed to process PZEM data', 'error');
      }
    };

    fetchPZEMData();
  }, [selectedClassroom, timeRange]);

  const getStartTime = () => {
    const now = new Date();
    switch (timeRange) {
      case 'hour': return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default: return now;
    }
  };

  const chartData = {
    labels: energyData.map((entry) =>
      entry.timestamp.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    ),
    datasets: [
      {
        label: 'Total Energy Consumption (kWh)',
        data: energyData.map((entry) => entry.consumptionKWh),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        tension: 0.4,
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
        text: 'Energy Consumption Over Time',
        font: { size: 16, weight: 'bold' as 'bold' },
      },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Energy (kWh)' } },
      x: { title: { display: true, text: 'Time' } },
    },
  };

  const totalConsumption = energyData.reduce((sum, entry) => sum + entry.consumptionKWh, 0);
  const averageConsumption = totalConsumption / (energyData.length || 1);
  const peakUsage = energyData.length > 0 ? Math.max(...energyData.map((d) => d.consumptionKWh)) : 0;

  const totalPzemPower = pzemData.reduce((sum, entry) => sum + parseFloat(entry.pzemData.Power || '0'), 0);
  const averagePzemPower = totalPzemPower / (pzemData.length || 1);

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-500 transition-colors"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>

      <div className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-64' : 'ml-0 md:ml-64'} overflow-y-auto`}>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Energy Usage Analytics</h1>
            <p className="mt-2 text-gray-600">Monitor and analyze classroom energy consumption</p>
          </div>

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
                    <option key={room.id} value={room.name}>
                      {room.name} - {room.building}, {room.floor}
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  icon={BoltIcon}
                  title="Total PZEM Power"
                  value={`${totalPzemPower.toFixed(2)} W`}
                  description="Total power from PZEM"
                />
                <StatCard
                  icon={ChartBarIcon}
                  title="Average PZEM Power"
                  value={`${averagePzemPower.toFixed(2)} W`}
                  description="Average power reading"
                />
                <StatCard
                  icon={PowerIcon}
                  title="PZEM Readings"
                  value={pzemData.length}
                  description="Total PZEM data points"
                />
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                <div className="h-[400px]">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              {pzemData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                  <h3 className="text-lg font-semibold mb-6">PZEM Power Readings</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Room Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Power (W)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Voltage (V)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Current (A)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Energy (kWh)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Timestamp
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pzemData.map((entry, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {entry.roomName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {parseFloat(entry.pzemData.Power || '0').toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {parseFloat(entry.pzemData.Voltage || '0').toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {parseFloat(entry.pzemData.Current || '0').toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {parseFloat(entry.pzemData.Energy || '0').toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(entry.pzemData.timestamp || '').toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
  <motion.div whileHover={{ scale: 1.02 }} className="bg-white p-6 rounded-xl shadow-sm">
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
        style={{ width: `${(value / 10) * 100}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
      />
    </div>
  </div>
);

export default EnergyUsagePage;