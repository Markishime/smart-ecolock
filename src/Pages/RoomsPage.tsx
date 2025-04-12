import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
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

interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  type: 'classroom' | 'laboratory' | 'lecture_hall' | 'conference_room' | 'faculty_room';
  status: 'available' | 'occupied' | 'maintenance';
  facilities?: {
    hasProjector: boolean;
    hasAC: boolean;
    hasComputers: boolean;
    hasWifi: boolean;
  };
}

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
  department: string;
  details: string;
  sections: Section[];
  status: 'active' | 'inactive';
}

interface Section {
  id: string;
  code: string;
  name: string;
  instructorId: string;
  instructorName: string;
  schedules: Schedule[];
}

interface Instructor {
  uid: string;
  fullName: string;
  email?: string;
  assignedSubjects: Subject[];
}

interface RoomAssignment {
  instructors: Instructor[];
  schedules: Record<string, Schedule[]>;
  isOccupied: boolean;
}

const RoomsPage = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Room['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchRooms(), fetchSubjects(), fetchInstructors()]);
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
            ...(data.facilities || {}),
          },
        } as Room;
      });
      setRooms(roomsData);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      Swal.fire('Error', 'Failed to fetch rooms', 'error');
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
          sections: data.sections || [],
          status: data.status || 'active',
        } as Subject;
      });
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      Swal.fire('Error', 'Failed to fetch subjects', 'error');
    }
  };

  const fetchInstructors = async () => {
    try {
      const teachersSnapshot = await getDocs(collection(db, 'teachers'));
      const instructorsData = teachersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          fullName: data.fullName || 'Unknown Instructor',
          email: data.email || '',
          assignedSubjects: data.assignedSubjects || [],
        } as Instructor;
      });
      setInstructors(instructorsData);
    } catch (error) {
      console.error('Error fetching instructors:', error);
      Swal.fire('Error', 'Failed to fetch instructors', 'error');
    }
  };

  const getAssignedInstructorAndStatus = (roomName: string): RoomAssignment => {
    const now = new Date();
    const currentDay = now.toLocaleString('en-US', { weekday: 'long' });
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const assignedInstructors: Instructor[] = [];
    const schedulesByInstructor: Record<string, Schedule[]> = {};
    let isOccupied = false;

    instructors.forEach(instructor => {
      const matchingSchedules: Schedule[] = [];
      instructor.assignedSubjects.forEach(subject => {
        subject.sections.forEach(section => {
          section.schedules.forEach(schedule => {
            if (schedule.roomName === roomName) {
              matchingSchedules.push(schedule);
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
      });
      if (matchingSchedules.length > 0) {
        assignedInstructors.push(instructor);
        schedulesByInstructor[instructor.uid] = matchingSchedules;
      }
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
        id: '',
        name: roomData.name || '',
        building: roomData.building || '',
        floor: roomData.floor || '',
        capacity: roomData.capacity || 0,
        type: roomData.type || 'classroom',
        status: roomData.status || 'available',
        facilities: {
          hasProjector: roomData.facilities?.hasProjector || false,
          hasAC: roomData.facilities?.hasAC || false,
          hasComputers: roomData.facilities?.hasComputers || false,
          hasWifi: roomData.facilities?.hasWifi || false,
        },
      };

      await addDoc(collection(db, 'rooms'), {
        ...completeRoomData,
        createdAt: new Date().toISOString(),
      });

      setIsAddModalOpen(false);
      await fetchRooms();

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
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'maintenance',
      });

      setRooms(prevRooms =>
        prevRooms.map(r =>
          r.id === roomId ? { ...r, status: 'maintenance' } : r
        )
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
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'available',
      });

      setRooms(prevRooms =>
        prevRooms.map(r =>
          r.id === roomId ? { ...r, status: 'available' } : r
        )
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
    .map(room => {
      const { instructors, schedules, isOccupied } = getAssignedInstructorAndStatus(room.name);
      return {
        ...room,
        status: room.status === 'maintenance' ? 'maintenance' : isOccupied ? 'occupied' : 'available',
        assignedInstructors: instructors,
        schedulesByInstructor: schedules,
      };
    })
    .filter(room => {
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
              <label className="block text-xs sm:text-sm font-medium text-teal-700 mb-1 sm:mb-2">Search Rooms</label>
              <input
                type="text"
                placeholder="Search by room number, name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`${theme.components.input} text-sm sm:text-base py-1.5 sm:py-2`}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-teal-700 mb-1 sm:mb-2">Filter by Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as Room['status'] | 'all')}
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
            {filteredRooms.map(room => (
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
                      room.assignedInstructors.map(instructor => (
                        <div key={instructor.uid} className="mb-2">
                          <span className="text-xs sm:text-sm font-medium">
                            {instructor.fullName.length > 20 ? `${instructor.fullName.substring(0, 17)}...` : instructor.fullName}
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
                            <div className="text-xs sm:text-sm text-gray-500 mt-1">No schedules in this room</div>
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