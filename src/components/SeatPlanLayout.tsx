import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, doc, getDoc, getDocs, query, updateDoc, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../Pages/AuthContext';
import { 
  UserCircleIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  PencilSquareIcon,
  ArrowPathIcon,
  UserPlusIcon,
  ClockIcon
} from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
  email?: string;
  major?: string;
  yearLevel?: string;
}

interface Seat {
  id: string;
  position: { row: number; col: number };
  studentId?: string;
  weightSensorStatus?: boolean;
  rfidConfirmed?: boolean;
  lastUpdated?: Date;
}

interface Room {
  id: string;
  number: string;
  capacity: number;
  layout: {
    rows: number;
    cols: number;
  };
  seats: Seat[];
}

interface SeatPlanLayoutProps {
  roomId: string;
  sectionId: string;
}

const SeatPlanLayout: React.FC<SeatPlanLayoutProps> = ({ roomId, sectionId }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { currentUser } = useAuth();

  // Fetch room data
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomId));
        if (roomDoc.exists()) {
          const roomData = roomDoc.data() as Omit<Room, 'id'>;
          setRoom({
            id: roomDoc.id,
            ...roomData,
            seats: roomData.seats || generateDefaultSeats(roomData.layout.rows, roomData.layout.cols)
          });
        }
      } catch (error) {
        console.error('Error fetching room:', error);
        toast.error('Failed to load room data');
      }
    };

    fetchRoom();
  }, [roomId]);

  // Fetch students in the section
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const sectionDoc = await getDoc(doc(db, 'sections', sectionId));
        
        if (sectionDoc.exists()) {
          const sectionData = sectionDoc.data();
          const studentIds = sectionData.students || [];
          
          if (studentIds.length > 0) {
            const studentsData: Student[] = [];
            
            for (const studentId of studentIds) {
              const studentDoc = await getDoc(doc(db, 'students', studentId));
              if (studentDoc.exists()) {
                const data = studentDoc.data();
                studentsData.push({
                  id: studentDoc.id,
                  fullName: data.fullName || '',
                  idNumber: data.idNumber || '',
                  email: data.email || '',
                  major: data.major || '',
                  yearLevel: data.yearLevel || ''
                });
              }
            }
            
            setStudents(studentsData);
          }
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load student data');
      } finally {
        setLoading(false);
      }
    };

    if (sectionId) {
      fetchStudents();
    }
  }, [sectionId]);

  // Listen for real-time weight sensor updates
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'rooms', roomId),
      (snapshot) => {
        if (snapshot.exists()) {
          const roomData = snapshot.data() as Omit<Room, 'id'>;
          setRoom(prev => {
            if (!prev) return null;
            return {
              ...prev,
              seats: roomData.seats || prev.seats
            };
          });
        }
      },
      (error) => {
        console.error('Error listening to room updates:', error);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  // Generate default seats if none exist
  const generateDefaultSeats = (rows: number, cols: number): Seat[] => {
    const seats: Seat[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        seats.push({
          id: `seat-${row}-${col}`,
          position: { row, col },
          weightSensorStatus: false,
          rfidConfirmed: false
        });
      }
    }
    return seats;
  };

  // Handle seat click to open edit modal
  const handleSeatClick = (seat: Seat) => {
    setSelectedSeat(seat);
    setSelectedStudent(seat.studentId || '');
    setIsEditModalOpen(true);
  };

  // Save seat assignment
  const handleSaveSeatAssignment = async () => {
    if (!room || !selectedSeat) return;

    try {
      // Update the seat in the room
      const updatedSeats = room.seats.map(seat => 
        seat.id === selectedSeat.id 
          ? { ...seat, studentId: selectedStudent || undefined }
          : seat
      );

      await updateDoc(doc(db, 'rooms', roomId), {
        seats: updatedSeats
      });

      setRoom({
        ...room,
        seats: updatedSeats
      });

      setIsEditModalOpen(false);
      toast.success('Seat assignment updated');
    } catch (error) {
      console.error('Error updating seat assignment:', error);
      toast.error('Failed to update seat assignment');
    }
  };

  // Filter students based on search query
  const filteredStudents = students.filter(student => 
    student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.idNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get student name by ID
  const getStudentName = (studentId?: string) => {
    if (!studentId) return 'Unassigned';
    const student = students.find(s => s.id === studentId);
    return student ? student.fullName : 'Unknown Student';
  };

  // Render loading state
  if (loading || !room) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-2 text-gray-600">Loading seat plan...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            Room {room.number} Seat Plan
          </h2>
          <div className="text-sm text-gray-500">
            Capacity: {room.capacity} students
          </div>
        </div>
      </div>

      {/* Seat Plan Grid */}
      <div className="p-6">
        <div 
          className="grid gap-4"
          style={{ 
            gridTemplateColumns: `repeat(${room.layout.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${room.layout.rows}, 1fr)`
          }}
        >
          {room.seats.map((seat) => (
            <motion.div
              key={seat.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`
                relative p-3 rounded-lg border-2 cursor-pointer
                ${seat.weightSensorStatus ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}
                ${seat.rfidConfirmed ? 'bg-green-50 border-green-300' : ''}
                hover:shadow-md transition-all duration-200
              `}
              onClick={() => handleSeatClick(seat)}
            >
              <div className="flex flex-col h-full">
                <div className="text-xs text-gray-500 mb-1">
                  Seat {seat.position.row + 1}-{seat.position.col + 1}
                </div>
                
                {seat.studentId ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="font-medium text-sm truncate">
                      {getStudentName(seat.studentId)}
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center">
                        {seat.weightSensorStatus ? (
                          <div className="flex items-center text-blue-600 text-xs">
                            <UserCircleIcon className="w-3 h-3 mr-1" />
                            <span>Seated</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400 text-xs">
                            <UserCircleIcon className="w-3 h-3 mr-1" />
                            <span>Empty</span>
                          </div>
                        )}
                      </div>
                      
                      {seat.rfidConfirmed ? (
                        <div className="flex items-center text-green-600 text-xs">
                          <CheckCircleIcon className="w-3 h-3 mr-1" />
                          <span>Confirmed</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-gray-400 text-xs">
                          <XCircleIcon className="w-3 h-3 mr-1" />
                          <span>Unconfirmed</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <button className="text-gray-400 hover:text-indigo-500 transition-colors">
                      <UserPlusIcon className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
              
              {seat.lastUpdated && (
                <div className="absolute bottom-1 right-1 text-xs text-gray-400 flex items-center">
                  <ClockIcon className="w-3 h-3 mr-1" />
                  {new Date(seat.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              
              <button 
                className="absolute top-1 right-1 text-gray-400 hover:text-indigo-500 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSeatClick(seat);
                }}
              >
                <PencilSquareIcon className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-50 border-2 border-gray-200 rounded-full mr-2"></div>
            <span>Empty</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-50 border-2 border-blue-300 rounded-full mr-2"></div>
            <span>Seated (Weight Detected)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-50 border-2 border-green-300 rounded-full mr-2"></div>
            <span>Attendance Confirmed (RFID)</span>
          </div>
        </div>
      </div>

      {/* Edit Seat Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedSeat && (
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
              className="bg-white rounded-xl shadow-xl w-full max-w-md"
            >
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-bold text-gray-800">
                  Edit Seat {selectedSeat.position.row + 1}-{selectedSeat.position.col + 1}
                </h2>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Student
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto border rounded-lg mb-4">
                  <div className="divide-y divide-gray-200">
                    <div 
                      className={`p-3 cursor-pointer hover:bg-gray-50 ${!selectedStudent ? 'bg-indigo-50' : ''}`}
                      onClick={() => setSelectedStudent('')}
                    >
                      <div className="font-medium">Unassigned</div>
                      <div className="text-sm text-gray-500">Remove student from seat</div>
                    </div>
                    
                    {filteredStudents.map(student => (
                      <div 
                        key={student.id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedStudent === student.id ? 'bg-indigo-50' : ''}`}
                        onClick={() => setSelectedStudent(student.id)}
                      >
                        <div className="font-medium">{student.fullName}</div>
                        <div className="text-sm text-gray-500">{student.idNumber} • {student.major}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSeatAssignment}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Save Assignment
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SeatPlanLayout; 