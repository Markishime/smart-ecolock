import React, { useState, useEffect } from 'react';
import { ref, onValue, off, set } from 'firebase/database';
import { rtdb } from '../firebase';
import AdminSidebar from '../components/AdminSidebar';
import {
  BuildingOfficeIcon,
  PlusIcon,
  UserIcon,
  ClockIcon,
  WrenchIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import { theme } from '../styles/theme';
import AddRoomModal from '../components/AddRoomModal';

// Interfaces based on JSON and requirements
interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  type: 'classroom' | 'laboratory' | 'lecture_hall' | 'conference_room' | 'faculty_room';
  status: 'available' | 'occupied' | 'maintenance';
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string | { name: string };
  section: string;
  subject: string;
  subjectCode: string;
  instructorName?: string;
  sectionId?: string;
}

interface Instructor {
  uid: string;
  fullName: string;
  email: string;
  ClassStatus?: {
    Status: string;
    dateTime: string;
    schedule?: Schedule;
  };
}

interface Student {
  schedules: Schedule[];
  fullName: string;
  email: string;
}

interface RoomAssignment {
  instructors: Instructor[];
  schedules: Record<string, Schedule[]>;
  isOccupied: boolean;
}

const RoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [instructors, setInstructors] = useState<Record<string, Instructor>>({});
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Room['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setIsLoading(true);

    // Derive rooms from schedules since JSON lacks a Rooms node
    const fetchData = async () => {
      const refs = {
        instructors: ref(rtdb, 'Instructors'),
        students: ref(rtdb, 'Students'),
      };

      const listeners = [
        { path: 'instructors', ref: refs.instructors },
        { path: 'students', ref: refs.students },
      ];

      listeners.forEach(({ ref, path }) => {
        onValue(
          ref,
          (snapshot) => {
            const data = snapshot.val() || {};
            if (path === 'instructors') {
              setInstructors(data);
            } else if (path === 'students') {
              setStudents(data);
            }
          },
          (error) => {
            console.error(`Error fetching ${path}:`, error);
            Swal.fire('Error', `Failed to fetch ${path}`, 'error');
          }
        );
      });

      // Derive rooms from schedules
      const allSchedules = [
        ...Object.values(instructors).flatMap((instructor) =>
          instructor.ClassStatus?.schedule ? [instructor.ClassStatus.schedule] : []
        ),
        ...Object.values(students).flatMap((student) => student.schedules || []),
      ];

      const uniqueRoomNames = Array.from(
        new Set(
          allSchedules.map((schedule) =>
            typeof schedule.roomName === 'string' ? schedule.roomName : schedule.roomName.name
          )
        )
      );

      const derivedRooms: Room[] = uniqueRoomNames.map((name, index) => ({
        id: `room_${index}`,
        name,
        building: 'Unknown', // Placeholder, as JSON lacks building
        floor: 'Unknown', // Placeholder
        capacity: 0, // Placeholder
        type: 'classroom', // Default
        status: 'available',
      }));

      setRooms(derivedRooms);
      setLastUpdated(new Date());
      setIsLoading(false);

      return () => {
        listeners.forEach(({ ref }) => off(ref));
      };
    };

    fetchData();
  }, []);

  const getAssignedInstructorAndStatus = (roomName: string): RoomAssignment => {
    const now = new Date();
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' });
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const assignedInstructors: Instructor[] = [];
    const schedulesByInstructor: Record<string, Schedule[]> = {};
    let isOccupied = false;

    // Check instructor schedules
    Object.entries(instructors).forEach(([uid, instructor]) => {
      const matchingSchedules: Schedule[] = [];
      if (instructor.ClassStatus?.schedule) {
        const schedule = instructor.ClassStatus.schedule;
        const scheduleRoomName =
          typeof schedule.roomName === 'string' ? schedule.roomName : schedule.roomName.name;
        if (scheduleRoomName === roomName) {
          matchingSchedules.push(schedule);
          if (
            schedule.day === currentDay &&
            currentTime >= schedule.startTime &&
            currentTime <= schedule.endTime
          ) {
            isOccupied = true;
          }
        }
      }
      if (matchingSchedules.length > 0) {
        assignedInstructors.push({ ...instructor, uid });
        schedulesByInstructor[uid] = matchingSchedules;
      }
    });

    // Check student schedules
    Object.values(students).forEach((student) => {
      student.schedules?.forEach((schedule) => {
        const scheduleRoomName =
          typeof schedule.roomName === 'string' ? schedule.roomName : schedule.roomName.name;
        if (scheduleRoomName === roomName) {
          if (
            schedule.day === currentDay &&
            currentTime >= schedule.startTime &&
            currentTime <= schedule.endTime
          ) {
            isOccupied = true;
          }
        }
      });
    });

    return {
      instructors: assignedInstructors,
      schedules: schedulesByInstructor,
      isOccupied,
    };
  };

  const handleAddRoom = async (roomData: Partial<Room>) => {
    try {
      const completeRoomData: Room = {
        id: `room_${Date.now()}`, // Generate a unique ID
        name: roomData.name || '',
        building: roomData.building || 'Unknown',
        floor: roomData.floor || 'Unknown',
        capacity: roomData.capacity || 0,
        type: roomData.type || 'classroom',
        status: roomData.status || 'available',
      };

      // Write to RTDB
      await set(ref(rtdb, `Rooms/${completeRoomData.id}`), {
        ...completeRoomData,
        createdAt: new Date().toISOString(),
      });

      setIsAddModalOpen(false);
      setRooms((prev) => [...prev, completeRoomData]);

      Swal.fire({
        icon: 'success',
        title: 'Room Added Successfully',
        showConfirmButton: false,
        timer: 1500,
        customClass: {
          popup: 'rounded-lg sm:rounded-xl',
          title: 'text-blue-900',
          htmlContainer: 'text-blue-700',
        },
      });
    } catch (error) {
      console.error('Error adding room:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to add room',
        customClass: {
          popup: 'rounded-lg sm:rounded-xl',
          title: 'text-blue-900',
          htmlContainer: 'text-blue-700',
          confirmButton: 'bg-blue-600 hover:bg-blue-700',
        },
      });
    }
  };

  const handleSetMaintenance = async (roomId: string) => {
    try {
      await set(ref(rtdb, `Rooms/${roomId}/status`), 'maintenance');

      setRooms((prevRooms) =>
        prevRooms.map((r) => (r.id === roomId ? { ...r, status: 'maintenance' } : r))
      );

      Swal.fire({
        icon: 'success',
        title: 'Room set to Maintenance',
        showConfirmButton: false,
        timer: 1500,
        customClass: {
          popup: 'rounded-lg sm:rounded-xl',
          title: 'text-blue-900',
          htmlContainer: 'text-blue-700',
        },
      });
    } catch (error) {
      console.error('Error setting room to maintenance:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to set room to maintenance',
        customClass: {
          popup: 'rounded-lg sm:rounded-xl',
          title: 'text-blue-900',
          htmlContainer: 'text-blue-700',
          confirmButton: 'bg-blue-600 hover:bg-blue-700',
        },
      });
    }
  };

  const handleSetAvailable = async (roomId: string) => {
    try {
      await set(ref(rtdb, `Rooms/${roomId}/status`), 'available');

      setRooms((prevRooms) =>
        prevRooms.map((r) => (r.id === roomId ? { ...r, status: 'available' } : r))
      );

      Swal.fire({
        icon: 'success',
        title: 'Room set to Available',
        showConfirmButton: false,
        timer: 1500,
        customClass: {
          popup: 'rounded-lg sm:rounded-xl',
          title: 'text-blue-900',
          htmlContainer: 'text-blue-700',
        },
      });
    } catch (error) {
      console.error('Error setting room to available:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to set room to available',
        customClass: {
          popup: 'rounded-lg sm:rounded-xl',
          title: 'text-blue-900',
          htmlContainer: 'text-blue-700',
          confirmButton: 'bg-blue-600 hover:bg-blue-700',
        },
      });
    }
  };

  const filteredRooms = rooms
    .map((room) => {
      const { instructors, schedules, isOccupied } = getAssignedInstructorAndStatus(room.name);
      return {
        ...room,
        status: room.status === 'maintenance' ? 'maintenance' : isOccupied ? 'occupied' : 'available',
        assignedInstructors: instructors,
        schedulesByInstructor: schedules,
      };
    })
    .filter((room) => {
      const matchesStatus = filterStatus === 'all' || room.status === filterStatus;
      const matchesSearch =
        searchQuery === '' ||
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.building.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-purple-50/30 to-rose-50/30">
      <AdminSidebar />

      <div className="flex-1 transition-all duration-300 ml-[80px] lg:ml-64 p-4 sm:p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-blue-900 flex items-center">
              <BuildingOfficeIcon className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-blue-600" />
              Room Management
            </h1>
            <p className="mt-1 text-blue-600/80 text-sm sm:text-base">Monitor rooms in real-time</p>
          </div>

          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className={`${theme.components.button.primary} text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2`}
            >
              <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              Add Room
            </button>
          </div>
        </div>

        <div className={`${theme.components.card} p-4 sm:p-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-teal-700 mb-1 sm:mb-2">
                Search Rooms
              </label>
              <input
                type="text"
                placeholder="Search by room number, name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${theme.components.input} text-sm sm:text-base py-1.5 sm:py-2`}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-teal-700 mb-1 sm:mb-2">
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as Room['status'] | 'all')}
                className={`${theme.components.input} text-sm sm:text-base py-1.5 sm:py-2`}
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
          <div className="mt-4 text-xs sm:text-sm text-gray-500 flex items-center">
            <ClockIcon className="w-4 h-4 mr-1" />
            Last updated: {lastUpdated.toLocaleString()}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredRooms.map((room) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${theme.components.card} p-4 sm:p-6`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Room {room.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{room.building}</p>
                  </div>
                  <span
                    className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                      room.status === 'available'
                        ? 'bg-green-100 text-green-800'
                        : room.status === 'occupied'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {room.status === 'maintenance' ? 'Under Maintenance' : room.status}
                  </span>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Building</span>
                    <span className="text-xs sm:text-sm font-medium">{room.building}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Floor</span>
                    <span className="text-xs sm:text-sm font-medium">{room.floor}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Capacity</span>
                    <span className="text-xs sm:text-sm font-medium">{room.capacity} seats</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm text-gray-600 flex items-center mb-1">
                      <UserIcon className="w-4 h-4 mr-1" />
                      Assigned Instructors
                    </span>
                    {room.assignedInstructors.length > 0 ? (
                      room.assignedInstructors.map((instructor) => (
                        <div key={instructor.uid} className="mb-2">
                          <span className="text-xs sm:text-sm font-medium">
                            {instructor.fullName.length > 20
                              ? `${instructor.fullName.substring(0, 17)}...`
                              : instructor.fullName}
                          </span>
                          {room.schedulesByInstructor[instructor.uid]?.length > 0 ? (
                            <div className="mt-1">
                              <span className="text-xs sm:text-sm text-gray-600 flex items-center mb-1">
                                <ClockIcon className="w-4 h-4 mr-1" />
                                Schedules in {room.name}
                              </span>
                              <div className="text-xs sm:text-sm font-medium">
                                {room.schedulesByInstructor[instructor.uid].map((schedule, index) => (
                                  <div key={index}>
                                    {schedule.day} {schedule.startTime}-{schedule.endTime}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs sm:text-sm text-gray-500 mt-1">
                              No schedules in this room
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs sm:text-sm text-gray-500">None</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => handleSetMaintenance(room.id)}
                    className="flex items-center justify-center w-full p-1.5 sm:p-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-xs sm:text-sm"
                    disabled={room.status === 'maintenance'}
                  >
                    <WrenchIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                    Set to Maintenance
                  </button>
                  <button
                    onClick={() => handleSetAvailable(room.id)}
                    className="flex items-center justify-center w-full p-1.5 sm:p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm"
                    disabled={room.status !== 'maintenance'}
                  >
                    <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                    Set to Available
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <AddRoomModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={(roomData: Partial<Room>) => {
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