import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import AdminSidebar from '../components/AdminSidebar';
import {
  BuildingOfficeIcon, 
  PlusIcon,
  LightBulbIcon,
  ComputerDesktopIcon,
  WifiIcon,
  UserIcon,
  ClockIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
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

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
  department: string;
  details: string;
  instructorId?: string;
  instructors: string[];
  schedules: Schedule[];
  status: 'active' | 'inactive';
}

interface Teacher {
  id: string;
  fullName: string;
  uid: string;
}

interface RoomAssignment {
  instructorName: string | null;
  schedules: Schedule[];
}

const RoomsPage = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Room['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchRooms(), fetchTeachers(), fetchSubjects()]);
      setLastUpdated(new Date());
      setIsLoading(false);
    };
    fetchData();
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
      console.log('Fetched rooms:', roomsData);
      setRooms(roomsData);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      Swal.fire('Error', 'Failed to fetch rooms', 'error');
    }
  };

  const fetchTeachers = async () => {
    try {
      const teachersSnapshot = await getDocs(collection(db, 'teachers'));
      const teachersData = teachersSnapshot.docs.map(doc => ({
        id: doc.id,
        fullName: doc.data().fullName || 'Unknown',
        uid: doc.data().uid || doc.id,
      } as Teacher));
      console.log('Fetched teachers:', teachersData);
      setTeachers(teachersData);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      Swal.fire('Error', 'Failed to fetch teachers', 'error');
    }
  };

  const fetchSubjects = async () => {
    try {
      const subjectsSnapshot = await getDocs(collection(db, 'subjects'));
      const subjectsData = subjectsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown Subject',
          code: data.code || '',
          credits: data.credits || 0,
          department: data.department || 'Unassigned',
          details: data.details || '',
          instructorId: data.instructorId || undefined,
          instructors: data.instructors || [],
          schedules: data.schedules || [],
          status: data.status || 'active',
        } as Subject;
      });
      console.log('Fetched subjects:', subjectsData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      Swal.fire('Error', 'Failed to fetch subjects', 'error');
    }
  };

  const getAssignedInstructorAndStatus = (roomName: string) => {
    const now = new Date(); // Current date and time (March 28, 2025, based on system)
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' }); // e.g., "Friday"
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }); // e.g., "14:30"

    let instructorName: string | null = null;
    const roomSchedules: Schedule[] = [];
    let isOccupied = false;

    for (const subject of subjects) {
      const matchingSchedules = subject.schedules.filter(schedule => schedule.room === roomName);
      if (matchingSchedules.length > 0) {
        roomSchedules.push(...matchingSchedules);
        if (!instructorName) { // Set once from first matching subject
          const instructorUid = subject.instructors[0];
          const instructor = teachers.find(t => t.uid === instructorUid || t.id === instructorUid);
          instructorName = instructor ? instructor.fullName : 'Unknown';
        }

        // Check if current time falls within any schedule
        for (const schedule of matchingSchedules) {
          if (schedule.day === currentDay && currentTime >= schedule.startTime && currentTime <= schedule.endTime) {
            isOccupied = true;
            break;
          }
        }
      }
    }

    console.log(`Room ${roomName}: Instructor: ${instructorName}, Schedules:`, roomSchedules, `Occupied: ${isOccupied}`);
    return { instructorName, schedules: roomSchedules, isOccupied };
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
      fetchRooms();

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

  const handleSetMaintenance = async (roomId: string) => {
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'maintenance'
      });

      setRooms(prevRooms => 
        prevRooms.map(r => 
          r.id === roomId 
            ? { ...r, status: 'maintenance' }
            : r
        )
      );

      Swal.fire({
        icon: 'success',
        title: 'Room set to Maintenance',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      console.error('Error setting room to maintenance:', error);
      Swal.fire('Error', 'Failed to set room to maintenance', 'error');
    }
  };

  const filteredRooms = rooms
    .map(room => {
      const { instructorName, schedules, isOccupied } = getAssignedInstructorAndStatus(room.name);
      return {
        ...room,
        status: room.status === 'maintenance' ? 'maintenance' : isOccupied ? 'occupied' : 'available',
        currentInstructor: instructorName,
        assignedSchedules: schedules.map(schedule => `${schedule.day} ${schedule.startTime}-${schedule.endTime}`),
      };
    })
    .filter(room => {
      const matchesStatus = filterStatus === 'all' || room.status === filterStatus;
      const matchesSearch = searchQuery === '' || (
        (room?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (room?.building?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      );
      return matchesStatus && matchesSearch;
    });

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-purple-50/30 to-rose-50/30">
      <AdminSidebar />
      
      <div className="flex-1 transition-all duration-300 ml-[80px] lg:ml-64 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-blue-900 flex items-center">
              <div className="w-8 h-8 mr-3 text-blue-600">
                <BuildingOfficeIcon />
              </div>
              Room Management
            </h1>
            <p className="mt-1 text-blue-600/80">Manage and monitor classroom facilities</p>
          </div>
        
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className={theme.components.button.primary}
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Room
            </button>
          </div>
        </div>

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

        {lastUpdated && (
          <div className="mt-4 text-sm text-gray-500 flex items-center">
            <ClockIcon className="w-4 h-4 mr-1" />
            Last updated: {lastUpdated.toLocaleString()}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
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
                    <p className="text-sm text-gray-500">{room.building}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    room.status === 'available' ? 'bg-green-100 text-green-800' :
                    room.status === 'occupied' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {room.status === 'maintenance' ? 'Under Maintenance' : room.status}
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center">
                      <UserIcon className="w-4 h-4 mr-1" />
                      Assigned Instructor
                    </span>
                    {room.currentInstructor ? (
                      <span className="text-sm font-medium">
                        {room.currentInstructor}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">None</span>
                    )}
                  </div>
                  {room.assignedSchedules.length > 0 && (
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-600 flex items-center mb-1">
                        <ClockIcon className="w-4 h-4 mr-1" />
                        Schedules
                      </span>
                      <div className="text-sm font-medium">
                        {room.assignedSchedules.map((schedule, index) => (
                          <div key={index}>{schedule}</div>
                        ))}
                      </div>
                    </div>
                  )}
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

                <div className="mt-4">
                  <button
                    onClick={() => handleSetMaintenance(room.id)}
                    className="flex items-center justify-center w-full p-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                    disabled={room.status === 'maintenance'}
                  >
                    <WrenchIcon className="w-5 h-5 mr-2" />
                    Set to Maintenance
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <AddRoomModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={(roomData) => {
            const mappedRoomData = {
              ...roomData,
              type: roomData.type?.toLowerCase().replace(' ', '_') as Room['type'],
            };
            handleAddRoom(mappedRoomData);
          }}
        />
      </div>
    </div>
  );
};

export default RoomsPage;