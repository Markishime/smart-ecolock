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

interface EnergyUsage {
  id: string;
  classroomId: string;
  timestamp: Date;
  powerWatts: number; // Prototype power from Power field
  consumptionKWh: number; // Computed actual energy in kWh
  devices: {
    lighting: number;
    projection: number;
    computers: number;
    hvac: number;
  };
}

interface PZEMData {
  Current: string;
  Energy: string; // Not used for actual consumption in this case
  Frequency: string;
  Power: string; // Used as prototype power
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

interface AdminPZEMData {
  [uid: string]: {
    [timestamp: string]: PZEMData;
  };
}

const VECO_RATE_PER_KWH = 14; // Pesos per kWh

const EnergyUsagePage: React.FC = () => {
  const [energyData, setEnergyData] = useState<EnergyUsage[]>([]);
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
          floor: doc.data().floor || '',
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
      const data = snapshot.val() || {};
      setAdminPzemData(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching AdminPZEM data:', error);
      Swal.fire('Error', 'Failed to fetch AdminPZEM data', 'error');
    });

    return () => off(adminPzemRef);
  }, []);

  useEffect(() => {
    if (!selectedClassroom || Object.keys(adminPzemData).length === 0) return;

    const processData = () => {
      try {
        const energyEntries: EnergyUsage[] = [];
        const timeRangeHours = timeRange === 'hour' ? 1 : timeRange === 'day' ? 24 : 7 * 24;

        Object.entries(adminPzemData).forEach(([uid, logs]) => {
          Object.entries(logs).forEach(([timestamp, log]) => {
            if (log.roomDetails.name === selectedClassroom) {
              const powerWatts = parseFloat(log.Power) || 0; // Prototype power
              const consumptionKWh = (powerWatts * timeRangeHours) / 1000; // Computed actual energy
              energyEntries.push({
                id: `${uid}_${timestamp}`,
                classroomId: log.roomDetails.name,
                timestamp: new Date(log.timestamp.replace(/_/g, ':')),
                powerWatts,
                consumptionKWh,
                devices: {
                  lighting: consumptionKWh * 0.25,
                  projection: consumptionKWh * 0.25,
                  computers: consumptionKWh * 0.25,
                  hvac: consumptionKWh * 0.25,
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
        console.error('Error processing AdminPZEM data:', error);
        Swal.fire('Error', 'Failed to process energy data', 'error');
      }
    };

    processData();
  }, [selectedClassroom, timeRange, adminPzemData]);

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

  const getLatestPzemData = (): PZEMData | null => {
    let latestData: PZEMData | null = null;
    Object.values(adminPzemData).forEach(logs => {
      Object.entries(logs).forEach(([timestamp, log]) => {
        if (log.roomDetails.name === selectedClassroom) {
          if (!latestData || log.timestamp > latestData.timestamp) {
            latestData = log;
          }
        }
      });
    });
    return latestData;
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
        label: 'Actual Energy Consumption (kWh)',
        data: energyData.map(entry => entry.consumptionKWh),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        tension: 0.4,
      },
      {
        label: 'Prototype Power (W)',
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
        text: 'Energy Consumption Over Time',
        font: { size: 16, weight: 'bold' as 'bold' },
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

  // Computed actual consumption stats
  const totalActualConsumption = energyData.reduce((sum, entry) => sum + entry.consumptionKWh, 0);
  const averageActualConsumption = totalActualConsumption / (energyData.length || 1);
  const peakActualUsage = energyData.length > 0 ? Math.max(...energyData.map(d => d.consumptionKWh)) : 0;
  const totalPrototypePower = energyData.reduce((sum, entry) => sum + entry.powerWatts, 0);

  const calculatePowerCosts = () => {
    const timeRangeHours = timeRange === 'hour' ? 1 : timeRange === 'day' ? 24 : 7 * 24;

    // Actual Consumption (computed from prototype Power)
    const actualConsumptionKWh = totalActualConsumption;
    const actualCost = actualConsumptionKWh * VECO_RATE_PER_KWH;

    // Prototype Consumption (direct Power in watts, cumulative over time range)
    const prototypeConsumptionKWh = (totalPrototypePower * timeRangeHours) / 1000;
    const prototypeCost = prototypeConsumptionKWh * VECO_RATE_PER_KWH;

    return {
      actualConsumptionKWh: actualConsumptionKWh.toFixed(2),
      actualCost: actualCost.toFixed(2),
      prototypeConsumptionKWh: prototypeConsumptionKWh.toFixed(2),
      prototypeCost: prototypeCost.toFixed(2),
      savings: (prototypeCost - actualCost).toFixed(2),
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
      cost: cost.toFixed(2),
    });
  };

  const latestPzemData = getLatestPzemData();

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
            <p className="mt-2 text-gray-600">Monitor and analyze classroom energy consumption in real-time</p>
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
                  onChange={e => setSelectedClassroom(e.target.value)}
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-2.5"
                >
                  {rooms.map(room => (
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
                {['hour', 'day', 'week'].map(range => (
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
              {/* Real-time Power Consumption Section */}
              <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <BoltIcon className="w-5 h-5 mr-2 text-indigo-600" />
                  Real-time Power Consumption ({selectedClassroom})
                </h3>
                {latestPzemData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Power:</span>{' '}
                      <span className="font-medium">{parseFloat(latestPzemData.Power).toFixed(2)} W</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Current:</span>{' '}
                      <span className="font-medium">{parseFloat(latestPzemData.Current).toFixed(2)} A</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Voltage:</span>{' '}
                      <span className="font-medium">{parseFloat(latestPzemData.Voltage).toFixed(2)} V</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Energy:</span>{' '}
                      <span className="font-medium">{parseFloat(latestPzemData.Energy).toFixed(2)} kWh</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Frequency:</span>{' '}
                      <span className="font-medium">{parseFloat(latestPzemData.Frequency).toFixed(2)} Hz</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Power Factor:</span>{' '}
                      <span className="font-medium">{parseFloat(latestPzemData.PowerFactor).toFixed(2)}</span>
                    </div>
                    <div className="col-span-full">
                      <span className="text-gray-600">Last Updated:</span>{' '}
                      <span className="font-medium">{latestPzemData.timestamp.replace(/_/g, ':')}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No real-time power data available for {selectedClassroom}</p>
                )}
              </div>

              {/* Stat Cards with Actual Consumption */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  icon={BoltIcon}
                  title="Total Actual Consumption"
                  value={`${totalActualConsumption.toFixed(2)} kWh`}
                  description="Total energy used (Actual)"
                />
                <StatCard
                  icon={ChartBarIcon}
                  title="Average Actual Consumption"
                  value={`${averageActualConsumption.toFixed(2)} kWh`}
                  description="Average per reading (Actual)"
                />
                <StatCard
                  icon={PowerIcon}
                  title="Peak Actual Usage"
                  value={`${peakActualUsage.toFixed(2)} kWh`}
                  description="Highest consumption (Actual)"
                />
                <StatCard
                  icon={ArrowsRightLeftIcon}
                  title="Readings"
                  value={energyData.length}
                  description="Total data points"
                />
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <CalculatorIcon className="w-5 h-5 mr-2 text-indigo-600" />
                  Power Consumption Analysis (@ ₱{VECO_RATE_PER_KWH}/kWh)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Actual Room (Computed)</h4>
                    <p>Consumption: {powerCosts.actualConsumptionKWh} kWh</p>
                    <p>Cost: ₱{powerCosts.actualCost}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Prototype (Raw Power)</h4>
                    <p>Consumption: {powerCosts.prototypeConsumptionKWh} kWh</p>
                    <p>Cost: ₱{powerCosts.prototypeCost}</p>
                  </div>
                  <div className="col-span-2">
                    <p
                      className={`font-semibold ${
                        parseFloat(powerCosts.savings) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      Difference (Prototype - Actual): ₱{powerCosts.savings}{' '}
                      {parseFloat(powerCosts.savings) > 0 ? '(Higher)' : '(Lower)'}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Power (Watts)</label>
                    <input
                      type="number"
                      value={calcPowerWatts}
                      onChange={e => setCalcPowerWatts(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hours Used</label>
                    <input
                      type="number"
                      value={calcHours}
                      onChange={e => setCalcHours(e.target.value)}
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

              {energyData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h3 className="text-lg font-semibold mb-6">Device Energy Breakdown (Latest Actual Reading)</h3>
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