import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { 
  BoltIcon,
  ChartBarIcon,
  PowerIcon,
  LightBulbIcon,
  ArrowsRightLeftIcon
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
  const [selectedClassroom, setSelectedClassroom] = useState<string>('Room-101');
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('hour');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        Swal.fire('Error', 'Failed to fetch energy data', 'error');
        setLoading(false);
      }
    };

    fetchEnergyData();
  }, [selectedClassroom, timeRange]);

  const getStartTime = () => {
    const now = new Date();
    switch(timeRange) {
      case 'hour': return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  };

  const chartData = {
    labels: energyData.map(entry => 
      entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    ),
    datasets: [
      {
        label: 'Total Energy Consumption (kWh)',
        data: energyData.map(entry => entry.consumptionKWh),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const totalConsumption = energyData.reduce((sum, entry) => sum + entry.consumptionKWh, 0);
  const averageUsage = energyData.length > 0 ? totalConsumption / energyData.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2 mb-4 md:mb-0">
              <BoltIcon className="w-8 h-8 text-indigo-600" />
              Energy Usage Monitoring
            </h1>
            <div className="flex gap-4">
              <select
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
                className="p-2 rounded-lg border border-gray-300"
              >
                <option value="Room-101">Room 101</option>
                <option value="Room-102">Room 102</option>
                <option value="Room-103">Room 103</option>
              </select>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="p-2 rounded-lg border border-gray-300"
              >
                <option value="hour">Last Hour</option>
                <option value="day">Last 24 Hours</option>
                <option value="week">Last Week</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : energyData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No energy usage data available for this period
            </div>
          ) : (
            <>
              {/* Main Chart */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8"
              >
                <div className="bg-gray-50 p-4 rounded-xl">
                  <Line data={chartData} options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Energy Consumption Over Time' }
                    },
                  }} />
                </div>
              </motion.div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                  icon={PowerIcon}
                  title="Total Consumption"
                  value={`${totalConsumption.toFixed(2)} kWh`}
                  description="Total energy used in selected period"
                />
                <StatCard
                  icon={ArrowsRightLeftIcon}
                  title="Average Usage"
                  value={`${averageUsage.toFixed(2)} kWh/h`}
                  description="Average hourly consumption"
                />
                <StatCard
                  icon={LightBulbIcon}
                  title="Projected Cost"
                  value={`$${(totalConsumption * 0.15).toFixed(2)}`}
                  description="Estimated cost at $0.15/kWh"
                />
              </div>

              {/* Device Breakdown */}
              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <ChartBarIcon className="w-6 h-6 text-indigo-600" />
                  Energy Consumption Breakdown
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DeviceEnergy
                    label="Lighting"
                    value={energyData.reduce((sum, entry) => sum + entry.devices.lighting, 0)}
                    color="bg-yellow-400"
                  />
                  <DeviceEnergy
                    label="Projection"
                    value={energyData.reduce((sum, entry) => sum + entry.devices.projection, 0)}
                    color="bg-blue-400"
                  />
                  <DeviceEnergy
                    label="Computers"
                    value={energyData.reduce((sum, entry) => sum + entry.devices.computers, 0)}
                    color="bg-green-400"
                  />
                  <DeviceEnergy
                    label="HVAC"
                    value={energyData.reduce((sum, entry) => sum + entry.devices.hvac, 0)}
                    color="bg-red-400"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, description }: any) => (
  <motion.div
    className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
    whileHover={{ y: -5 }}
  >
    <div className="flex items-center gap-4">
      <div className="p-3 bg-indigo-100 rounded-lg">
        <Icon className="w-6 h-6 text-indigo-600" />
      </div>
      <div>
        <h4 className="text-lg font-semibold">{title}</h4>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  </motion.div>
);

const DeviceEnergy = ({ label, value, color }: any) => (
  <div className="bg-white p-4 rounded-lg flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <span className="font-medium">{label}</span>
    </div>
    <span className="text-gray-600">{value.toFixed(2)} kWh</span>
  </div>
);

export default EnergyUsagePage;