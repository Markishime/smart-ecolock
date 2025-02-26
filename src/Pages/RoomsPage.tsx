import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from '../components/AdminSidebar';
import { 
  BuildingOfficeIcon, 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  LightBulbIcon,
  ComputerDesktopIcon,
  WifiIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import AdminLayout from '../components/AdminLayout';
import { theme } from '../styles/theme';
import AddRoomModal from '../components/AddRoomModal';

interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  type: 'classroom' | 'laboratory' | 'lecture_hall' | 'conference_room';
  status: 'available' | 'occupied' | 'maintenance';
  facilities?: {
    hasProjector: boolean;
    hasAC: boolean;
    hasComputers: boolean;
    hasWifi: boolean;
  };
  energyStatus: {
    lights: boolean;
    aircon: boolean;
    computers: boolean;
  };
}

const RoomsPage = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [filterStatus, setFilterStatus] = useState<Room['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      const roomsData = roomsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          building: data.building || '',
          floor: data.floor || '',
          capacity: data.capacity || 0,
          type: data.type || 'classroom',
          status: data.status || 'available',
          facilities: {
            hasProjector: false,
            hasAC: false,
            hasComputers: false,
            hasWifi: false,
            ...(data.facilities || {})
          },
          energyStatus: {
            lights: false,
            aircon: false,
            computers: false,
            ...(data.energyStatus || {})
          }
        } as Room;
      });
      setRooms(roomsData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      Swal.fire('Error', 'Failed to fetch rooms', 'error');
      setIsLoading(false);
    }
  };

  const handleToggleFacility = async (roomId: string, facility: keyof Room['energyStatus']) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      const updatedStatus = {
        ...room.energyStatus,
        [facility]: !room.energyStatus[facility]
      };

      await updateDoc(doc(db, 'rooms', roomId), {
        energyStatus: updatedStatus
      });

      setRooms(prevRooms => 
        prevRooms.map(r => 
          r.id === roomId 
            ? { ...r, energyStatus: updatedStatus }
            : r
        )
      );

      Swal.fire({
        icon: 'success',
        title: `${facility} ${updatedStatus[facility] ? 'turned on' : 'turned off'}`,
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      console.error('Error updating facility status:', error);
      Swal.fire('Error', 'Failed to update facility status', 'error');
    }
  };

  const handleAddRoom = async (roomData: Partial<Room>) => {
    try {
      await addDoc(collection(db, 'rooms'), {
        ...roomData,
        energyStatus: {
          lights: false,
          aircon: false,
          computers: false
        },
        createdAt: new Date().toISOString()
      });

      setIsAddModalOpen(false);
      fetchRooms(); // Refresh the rooms list

      Swal.fire({
        icon: 'success',
        title: 'Room Added Successfully',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      console.error('Error adding room:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to add room'
      });
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesStatus = filterStatus === 'all' || room?.status === filterStatus;
    const matchesSearch = searchQuery === '' || (
      (room?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (room?.building?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
    return matchesStatus && matchesSearch;
  });

  return (
    <AdminLayout
      title="Room Management"
      subtitle="Manage and monitor classroom facilities"
      icon={<BuildingOfficeIcon />}
      actions={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className={theme.components.button.primary}
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Room
        </button>
      }
    >
      {/* Filters */}
      <div className={theme.components.card}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Search Rooms
            </label>
            <input
              type="text"
              placeholder="Search by room number, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={theme.components.input}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as Room['status'] | 'all')}
              className={theme.components.input}
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map(room => (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={theme.components.card}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Room {room.name}
                </h3>
                <p className="text-sm text-gray-500">{room.name}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                room.status === 'available' ? 'bg-green-100 text-green-800' :
                room.status === 'occupied' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {room.status}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Building</span>
                <span className="text-sm font-medium">{room.building}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Floor</span>
                <span className="text-sm font-medium">{room.floor}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Capacity</span>
                <span className="text-sm font-medium">{room.capacity} seats</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Facilities Control</h4>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => handleToggleFacility(room.id, 'lights')}
                  className={`flex flex-col items-center p-3 rounded-lg ${
                    room.energyStatus.lights ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <LightBulbIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs">Lights</span>
                </button>
                <button
                  onClick={() => handleToggleFacility(room.id, 'aircon')}
                  className={`flex flex-col items-center p-3 rounded-lg ${
                    room.energyStatus.aircon ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <ComputerDesktopIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs">AC</span>
                </button>
                <button
                  onClick={() => handleToggleFacility(room.id, 'computers')}
                  className={`flex flex-col items-center p-3 rounded-lg ${
                    room.energyStatus.computers ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <WifiIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs">PCs</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AddRoomModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddRoom}
      />
    </AdminLayout>
  );
};

export default RoomsPage;