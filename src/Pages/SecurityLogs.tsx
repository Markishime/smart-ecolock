import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { 
  ShieldExclamationIcon, 
  LockClosedIcon, 
  UserIcon, 
  CalendarIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';

// Define interface for security logs
interface SecurityLog {
  id: string;
  timestamp: Date;
  event: string;
  description: string;
  user: string;
}

const SecurityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch security logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logsQuery = query(
          collection(db, 'securityLogs'), 
          orderBy('timestamp', 'desc')
        );
        const logsSnapshot = await getDocs(logsQuery);
        
        const fetchedLogs = logsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate()
        } as SecurityLog));

        setLogs(fetchedLogs);
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Fetch Error',
          text: error instanceof Error ? error.message : 'Failed to fetch security logs'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto"
      >
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <ShieldExclamationIcon className="w-8 h-8 text-indigo-600" />
              Security Logs
            </h1>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <ArrowPathIcon className="w-5 h-5" />
              Refresh
            </button>
          </div>

          {/* Logs Table */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-left">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Event</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">User</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5 text-gray-400" />
                          <span>{log.timestamp.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <LockClosedIcon className="w-5 h-5 text-gray-400" />
                          <span>{log.event}</span>
                        </div>
                      </td>
                      <td className="p-3">{log.description}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-5 h-5 text-gray-400" />
                          <span>{log.user}</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SecurityLogsPage;