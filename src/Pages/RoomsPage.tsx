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

// Interfaces based on JSON
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
  role?: string; // From rfid node
  schedules?: Schedule[]; // Derived or mocked
}

interface AdminPZEM {
  current: string;
  energy: string;
  frequency: string;
  power: string;
  powerFactor: string;
  voltage: string;
  timestamp: string;
  roomDetails: {
    building: string;
    floor: string;
    name: string;
    status: string;
    type: string;
  };
}

interface RoomAssignment {
  instructors: Instructor[];
  schedules: Record<string, Schedule[]>;
  isOccupied: boolean;
  adminPZEM?: AdminPZEM; // Add AdminPZEM to room assignment
}

const RoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [instructors, setInstructors] = useState<Record<string, Instructor>>({});
  const [accessLogs, setAccessLogs] = useState<any>({});
  const [rfidData, setRfidData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Room['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setIsLoading(true);

    const fetchData = async () => {
      const refs = {
        accessLogs: ref(rtdb, 'AccessLogs'),
        rfid: ref(rtdb, 'rfid'),
      };

      const listeners = [
        { path: 'accessLogs', ref: refs.accessLogs },
        { path: 'rfid', ref: refs.rfid },
      ];

      listeners.forEach(({ ref, path }) => {
        onValue(
          ref,
          (snapshot) => {
            const data = snapshot.val() || {};
            if (path === 'accessLogs') {
              setAccessLogs(data);
            } else if (path === 'rfid') {
              setRfidData(data);
            }
          },
          (error) => {
            console.error(`Error fetching ${path}:`, error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: `Failed to fetch ${path}`,
              customClass: {
                popup: 'rounded-lg sm:rounded-xl',
                title: 'text-blue-900',
                htmlContainer: 'text-blue-700',
                confirmButton: 'bg-blue-600 hover:bg-blue-700',
              },
            });
          }
        );
      });

      // Derive rooms from AccessLogs AdminPZEM roomDetails
      const derivedRooms: Room[] = [];
      Object.values(accessLogs).forEach((uidLogs: any) => {
        Object.values(uidLogs).forEach((log: any) => {
          if (log.action === 'exit' && log.AdminPZEM?.roomDetails) {
            const roomDetail = log.AdminPZEM.roomDetails;
            if (!derivedRooms.find((r) => r.name === roomDetail.name)) {
              derivedRooms.push({
                id: `room_${roomDetail.name}`,
                name: roomDetail.name,
                building: roomDetail.building,
                floor: roomDetail.floor,
                capacity: 0, // Not in JSON
                type: roomDetail.type as Room['type'],
                status: roomDetail.status as Room['status'],
              });
            }
          }
        });
      });

      // Mock instructors with schedules (since JSON lacks explicit schedules)
      const mockInstructors: Record<string, Instructor> = {};
      Object.entries(rfidData).forEach(([rfidUid, data]: [string, any]) => {
        if (data.role === 'instructor') {
          mockInstructors[rfidUid] = {
            uid: rfidUid,
            fullName: `Instructor_${rfidUid}`, // Placeholder, replace with Admin data if available
            email: `instructor_${rfidUid}@example.com`,
            role: data.role,
            schedules: [
              // Mock schedule; replace with actual if available
              {
                day: 'Monday',
                startTime: '08:00',
                endTime: '10:00',
                roomName: '705', // Match with room if needed
                section: 'A',
                subject: 'Computer Science',
                subjectCode: 'CS101',
              },
            ],
          };
        }
      });

      setInstructors(mockInstructors);
      setRooms(derivedRooms);
      setLastUpdated(new Date());
      setIsLoading(false);

      return () => {
        listeners.forEach(({ ref }) => off(ref));
      };
    };

    fetchData();
  }, []);

  const isTimeWithinSchedule = (schedule: Schedule, now: Date): boolean => {
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' });
    if (schedule.day !== currentDay) return false;

    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
  };

  const getAssignedInstructorAndStatus = (roomName: string): RoomAssignment => {
    const now = new Date('2025-04-13T12:00:00'); // Fixed for testing
    const assignedInstructors: Instructor[] = [];
    const schedulesByInstructor: Record<string, Schedule[]> = {};
    let isOccupied = false;
    let adminPZEM: AdminPZEM | undefined;

    // Fetch AdminPZEM data for exit action
    Object.entries(accessLogs).forEach(([uid, logs]: [string, any]) => {
      Object.entries(logs).forEach(([timestamp, log]: [string, any]) => {
        if (log.action === 'exit' && log.AdminPZEM?.roomDetails.name === roomName) {
          adminPZEM = log.AdminPZEM;
          // Match UID with instructors
          if (instructors[uid]) {
            assignedInstructors.push({ ...instructors[uid], uid });
            schedulesByInstructor[uid] = instructors[uid].schedules || [];
            if (instructors[uid].schedules?.some((schedule) => isTimeWithinSchedule(schedule, now))) {
              isOccupied = true;
            }
          }
        }
      });
    });

    // Additional check for instructor schedules
    Object.entries(instructors).forEach(([uid, instructor]) => {
      if (!schedulesByInstructor[uid]) {
        const matchingSchedules = instructor.schedules?.filter((schedule) => {
          const scheduleRoomName =
            typeof schedule.roomName === 'string' ? schedule.roomName : schedule.roomName.name;
          return scheduleRoomName === roomName;
        }) || [];
        if (matchingSchedules.length > 0) {
          assignedInstructors.push({ ...instructor, uid });
          schedulesByInstructor[uid] = matchingSchedules;
          if (matchingSchedules.some((schedule) => isTimeWithinSchedule(schedule, now))) {
            isOccupied = true;
          }
        }
      }
    });

    return {
      instructors: assignedInstructors,
      schedules: schedulesByInstructor,
      isOccupied,
      adminPZEM,
    };
  };

  const handleAddRoom = async (roomData: Partial<Room>) => {
    try {
      const completeRoomData: Room = {
        id: `room_${Date.now()}`,
        name: roomData.name || '',
        building: roomData.building || 'Unknown',
        floor: roomData.floor || 'Unknown',
        capacity: roomData.capacity || 0,
        type: roomData.type || 'classroom',
        status: roomData.status || 'available',
      };

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
      const { instructors, schedules, isOccupied, adminPZEM } = getAssignedInstructorAndStatus(room.name);
      return {
        ...room,
        status: room.status === 'maintenance' ? 'maintenance' : isOccupied ? 'occupied' : 'available',
        assignedInstructors: instructors,
        schedulesByInstructor: schedules,
        adminPZEM,
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
      <div className="fixed top-0 left-0 h-full bg-white shadow-lg w-[80px] lg:w-64 z-50">
        <AdminSidebar />
      </div>

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
                                    {schedule.day} {schedule.startTime}-{schedule.endTime} ({schedule.subject})
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
                  {room.adminPZEM && (
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm text-gray-600 flex items-center mb-1">
                        <ClockIcon className="w-4 h-4 mr-1" />
                        AdminPZEM Data
                      </span>
                      <div className="text-xs sm:text-sm font-medium">
                        <div>Current: {room.adminPZEM.current}</div>
                        <div>Energy: {room.adminPZEM.energy}</div>
                        <div>Frequency: {room.adminPZEM.frequency}</div>
                        <div>Power: {room.adminPZEM.power}</div>
                        <div>Power Factor: {room.adminPZEM.powerFactor}</div>
                        <div>Voltage: {room.adminPZEM.voltage}</div>
                        <div>Timestamp: {room.adminPZEM.timestamp}</div>
                      </div>
                    </div>
                  )}
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