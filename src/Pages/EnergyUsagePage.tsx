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
  CalculatorIcon
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

interface AdminPZEMData {
  [roomId: string]: {
    Current: string;
    Energy: string;
    Frequency: string;
    Power: string;
    PowerFactor: string;
    Voltage: string;
    timestamp: string;
  };
}

const VECO_RATE_PER_KWH = 14; // Pesos per kWh

const EnergyUsagePage: React.FC = () => {
  const [energyData, setEnergyData] = useState<EnergyUsage[]>([]);
  const [pzemData, setPzemData] = useState<InstructorPZEMData[]>([]);
  const [adminPzemData, setAdminPzemData] = useState<AdminPZEMData>({});
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('hour');
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Calculator states
  const [calcPowerWatts, setCalcPowerWatts] = useState<string>('0');
  const [calcHours, setCalcHours] = useState<string>('1');
  const [calcResult, setCalcResult] = useState<{ kWh: string; cost: string } | null>(null);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomsCollection = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsCollection);
        const roomsData = roomsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          building: doc.data().building || '',
          floor: doc.data().floor || ''
        }) as Room);

        const sortedRooms = roomsData.sort((a, b) => a.name.localeCompare(b.name));
        setRooms(sortedRooms);
        if (sortedRooms.length > 0) {
          setSelectedClassroom(sortedRooms[0].name);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
        Swal.fire('Error', 'Failed to fetch rooms', 'error');
      }
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    const adminPzemRef = ref(rtdb, 'AdminPZEM');
    const unsubscribe = onValue(adminPzemRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAdminPzemData(data);
      }
    }, (error) => {
      console.error('Error fetching AdminPZEM data:', error);
      Swal.fire('Error', 'Failed to fetch AdminPZEM data', 'error');
    });

    return () => off(adminPzemRef, 'value', unsubscribe);
  }, []);

  useEffect(() => {
    if (!selectedClassroom) return;

    const processData = () => {
      try {
        const mockEnergyData: EnergyUsage[] = Object.entries(adminPzemData).map(([roomId, data]) => {
          const room = rooms.find(r => r.id === roomId);
          return {
            id: roomId,
            classroomId: room?.name || roomId,
            timestamp: new Date(data.timestamp),
            consumptionKWh: parseFloat(data.Energy) || 0,
            devices: {
              lighting: parseFloat(data.Energy) * 0.25 || 0,
              projection: parseFloat(data.Energy) * 0.25 || 0,
              computers: parseFloat(data.Energy) * 0.25 || 0,
              hvac: parseFloat(data.Energy) * 0.25 || 0
            }
          };
        });

        const filteredEnergyData = mockEnergyData.filter(entry => {
          const startTime = getStartTime();
          return entry.classroomId === selectedClassroom && entry.timestamp > startTime;
        });

        setEnergyData(filteredEnergyData);

        const roomAssignments: { [key: string]: string } = {};
        rooms.forEach(room => {
          roomAssignments[room.id] = room.name;
        });

        const instructorsData = energyData; // Replace with the correct variable or define energyDataJson if needed
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
              timestamp: data.AccessLogs.replace('e:', ''),
            };
            pzemEntries.push({ roomName, pzemData });
          }
        });

        const filteredPzemData = pzemEntries.filter(entry => {
          const matchesRoom = !selectedClassroom || entry.roomName === selectedClassroom;
          const entryTime = new Date(entry.pzemData.timestamp || '');
          const startTime = getStartTime();
          return matchesRoom && entryTime > startTime;
        });

        setPzemData(filteredPzemData);
        setLoading(false);
      } catch (error) {
        console.error('Error processing data:', error);
        Swal.fire('Error', 'Failed to process energy data', 'error');
      }
    };

    processData();
  }, [selectedClassroom, timeRange, adminPzemData, rooms]);

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

  const calculatePowerCosts = () => {
    const actualConsumptionKWh = totalConsumption;
    const potentialConsumptionKWh = totalPzemPower / 1000;
    const actualCost = actualConsumptionKWh * VECO_RATE_PER_KWH;
    const potentialCost = potentialConsumptionKWh * VECO_RATE_PER_KWH;

    return {
      actualConsumptionKWh: actualConsumptionKWh.toFixed(2),
      potentialConsumptionKWh: potentialConsumptionKWh.toFixed(2),
      actualCost: actualCost.toFixed(2),
      potentialCost: potentialCost.toFixed(2),
      savings: (actualCost - potentialCost).toFixed(2)
    };
  };

  const powerCosts = calculatePowerCosts();

  const handleCalculate = () => {
    const power = parseFloat(calcPowerWatts) || 0;
    const hours = parseFloat(calcHours) || 0;
    const kWh = (power * hours) / 1000; // Convert W*h to kWh
    const cost = kWh * VECO_RATE_PER_KWH;
    setCalcResult({
      kWh: kWh.toFixed(2),
      cost: cost.toFixed(2)
    });
  };

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
                  description="Total energy used (Actual)"
                />
                <StatCard
                  icon={ChartBarIcon}
                  title="Average Consumption"
                  value={`${averageConsumption.toFixed(2)} kWh`}
                  description="Average per reading (Actual)"
                />
                <StatCard
                  icon={PowerIcon}
                  title="Peak Usage"
                  value={`${peakUsage.toFixed(2)} kWh`}
                  description="Highest consumption (Actual)"
                />
                <StatCard
                  icon={ArrowsRightLeftIcon}
                  title="Readings"
                  value={energyData.length}
                  description="Total data points (Actual)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  icon={BoltIcon}
                  title="Total PZEM Power"
                  value={`${totalPzemPower.toFixed(2)} W`}
                  description="Total power (Prototype)"
                />
                <StatCard
                  icon={ChartBarIcon}
                  title="Average PZEM Power"
                  value={`${averagePzemPower.toFixed(2)} W`}
                  description="Average power (Prototype)"
                />
                <StatCard
                  icon={PowerIcon}
                  title="PZEM Readings"
                  value={pzemData.length}
                  description="Total PZEM points (Prototype)"
                />
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <CalculatorIcon className="w-5 h-5 mr-2 text-indigo-600" />
                  Power Consumption Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Actual Room</h4>
                    <p>Consumption: {powerCosts.actualConsumptionKWh} kWh</p>
                    <p>Cost: ₱{powerCosts.actualCost}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Prototype</h4>
                    <p>Consumption: {powerCosts.potentialConsumptionKWh} kWh</p>
                    <p>Cost: ₱{powerCosts.potentialCost}</p>
                  </div>
                  <div className="col-span-2">
                    <p className={`font-semibold ${parseFloat(powerCosts.savings) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Potential Savings: ₱{powerCosts.savings}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <CalculatorIcon className="w-5 h-5 mr-2 text-indigo-600" />
                  Interactive Power Calculator
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Power (Watts)
                    </label>
                    <input
                      type="number"
                      value={calcPowerWatts}
                      onChange={(e) => setCalcPowerWatts(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hours Used
                    </label>
                    <input
                      type="number"
                      value={calcHours}
                      onChange={(e) => setCalcHours(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={handleCalculate}
                      className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Calculate
                    </button>
                    {calcResult && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p>Energy Consumption: {calcResult.kWh} kWh</p>
                        <p>Cost (@ ₱{VECO_RATE_PER_KWH}/kWh): ₱{calcResult.cost}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                <div className="h-[400px]">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              {pzemData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                  <h3 className="text-lg font-semibold mb-6">PZEM Power Readings (Prototype)</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Power (W)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voltage (V)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current (A)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Energy (kWh)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pzemData.map((entry, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.roomName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{parseFloat(entry.pzemData.Power || '0').toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{parseFloat(entry.pzemData.Voltage || '0').toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{parseFloat(entry.pzemData.Current || '0').toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{parseFloat(entry.pzemData.Energy || '0').toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(entry.pzemData.timestamp || '').toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {energyData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h3 className="text-lg font-semibold mb-6">Device Energy Breakdown (Actual Room)</h3>
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