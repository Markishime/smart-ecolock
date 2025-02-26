import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { theme } from '../styles/theme';
import Swal from 'sweetalert2';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userType: 'student' | 'teacher' | 'admin';
}

interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
  status: 'available' | 'occupied' | 'maintenance';
}

interface User {
  id: string;
  fullName: string;
  email: string;
  idNumber: string;
  department?: string;
  major?: string;
  roomAssigned?: string;
  role: string;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, userId, userType }) => {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [assignmentSuccess, setAssignmentSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserAndRooms();
    }
  }, [isOpen, userId]);

  const fetchUserAndRooms = async () => {
    try {
      setIsLoading(true);
      
      // Fetch user data
      const userRef = doc(db, userType === 'student' ? 'students' : 'teachers', userId);
      const userSnap = await getDoc(userRef);
      
      let currentUserData: User | null = null;
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        currentUserData = {
          ...userData,
          id: userId
        };
        setUser(currentUserData);
        setSelectedRoom(userData.roomAssigned || '');
      } else {
        console.error('User document does not exist');
        setIsLoading(false);
        return;
      }
      
      // Fetch available rooms
      const roomsRef = collection(db, 'rooms');
      const roomsSnapshot = await getDocs(roomsRef);
      
      const availableRooms = roomsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Room))
        .filter(room => room.status === 'available' || room.id === currentUserData?.roomAssigned);
      
      setRooms(availableRooms);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsLoading(false);
      Swal.fire('Error', 'Failed to load user or room data', 'error');
    }
  };

  const handleAssignRoom = async () => {
    try {
      if (!user || !user.id) {
        console.error('User data is missing or incomplete');
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'User data is missing or incomplete'
        });
        return;
      }
      
      console.log('Updating user:', user.id, 'with room:', selectedRoom);
      
      // Update user's room assignment
      const userRef = doc(db, userType === 'student' ? 'students' : 'teachers', user.id);
      await updateDoc(userRef, {
        roomAssigned: selectedRoom
      });
      
      // Update room status if needed
      if (selectedRoom) {
        const roomRef = doc(db, 'rooms', selectedRoom);
        await updateDoc(roomRef, {
          status: 'occupied'
        });
      }
      
      // If previous room exists and is different, update its status
      if (user.roomAssigned && user.roomAssigned !== selectedRoom) {
        const prevRoomRef = doc(db, 'rooms', user.roomAssigned);
        await updateDoc(prevRoomRef, {
          status: 'available'
        });
      }
      
      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Room Assigned Successfully',
        showConfirmButton: false,
        timer: 1500,
        position: 'top-end',
        toast: true
      });
      
      // Update the user object with the new room assignment
      setUser(prevUser => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          roomAssigned: selectedRoom
        };
      });
      
      // Refresh the room list to show updated status
      fetchUserAndRooms();
      
      // Set success state
      setAssignmentSuccess(true);
      
      // Clear success state after 3 seconds
      setTimeout(() => {
        setAssignmentSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error assigning room:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to assign room: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setAssignmentSuccess(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className={theme.typography.h3}>
            {user?.fullName} - {userType === 'student' ? 'Student' : 'Teacher'} Details
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              {/* User Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">ID Number</p>
                    <p className="font-medium">{user?.idNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                  {user?.department && (
                    <div>
                      <p className="text-sm text-gray-500">Department</p>
                      <p className="font-medium">{user.department}</p>
                    </div>
                  )}
                  {user?.major && (
                    <div>
                      <p className="text-sm text-gray-500">Major</p>
                      <p className="font-medium">{user.major}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Room Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Room
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className={theme.components.input}
                >
                  <option value="">No Room Assigned</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name} - {room.building}, Floor {room.floor}
                    </option>
                  ))}
                </select>
                
                {selectedRoom && (
                  <div className={`mt-4 ${assignmentSuccess ? 'bg-green-50' : 'bg-blue-50'} p-3 rounded-lg flex items-start transition-colors duration-300`}>
                    <BuildingOfficeIcon className={`w-5 h-5 ${assignmentSuccess ? 'text-green-500' : 'text-blue-500'} mt-0.5 mr-2`} />
                    <div>
                      <p className={`text-sm font-medium ${assignmentSuccess ? 'text-green-700' : 'text-blue-700'}`}>
                        {assignmentSuccess ? 'Room Assignment Updated!' : 'Current Room Assignment'}
                      </p>
                      <p className={`text-sm ${assignmentSuccess ? 'text-green-600' : 'text-blue-600'}`}>
                        {rooms.find(r => r.id === selectedRoom)?.name} - 
                        {rooms.find(r => r.id === selectedRoom)?.building}, 
                        Floor {rooms.find(r => r.id === selectedRoom)?.floor}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-4 p-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className={theme.components.button.secondary}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignRoom}
                className={theme.components.button.primary}
              >
                {selectedRoom ? 'Assign Selected Room' : 'Clear Room Assignment'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default UserModal;