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
  UserIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../firebase';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';

interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
}

interface PZEMData {
  action: string;
  current: string;
  energy: string;
  frequency: string;
  power: string;
  powerFactor: string;
  timestamp: string;
  voltage: string;
  calculatedEnergy?: string;
  sessionDuration?: string;
}

interface ClassHistoryEntry {
  Status: string;
  dateTime: string;
  schedule: Schedule;
}

interface EnergyUsage {
  id: string;
  classroomId: string;
  timestamp: Date;
  powerWatts: number;
  consumptionKWh: number;
  devices: {
    lighting: number;
    projection: number;
    computers: number;
    hvac: number;
  };
  instructorName: string;
  subject: string;
  subjectCode: string;
  schedule: {
    day: string;
    startTime: string;
    endTime: string;
    section: string;
  };
}

interface Schedule {
  day: string;
  endTime: string;
  roomName: {
    name: string;
    pzem?: PZEMData;
  };
  section: string;
  startTime: string;
  subject: string;
  subjectCode: string;
}

interface AccessLogEntry {
  action: string;
  status: string;
  timestamp: string;
}

interface InstructorData {
  Profile?: {
    fullName: string;
    email?: string;
    department?: string;
    idNumber?: string;
    mobileNumber?: string;
    role: string;
    createdAt?: string;
  };
  ClassStatus?: {
    Status: string;
    dateTime: string;
    schedule: Schedule;
  };
  AccessLogs?: {
    [key: string]: AccessLogEntry;
  };
  ClassHistory?: {
    [key: string]: {
      Status: string;
      dateTime: string;
      schedule: Schedule;
    };
  };
}

interface InstructorEnergyData {
  rfidUid: string;
  totalPowerConsumption: number;
  roomName: string;
  pzemData: PZEMData | null;
  instructorName: string;
}

interface Duration {
  hours: number;
  minutes: number;
  totalHours: number;
}

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
  email: string;
  mobileNumber: string;
  department: string;
  role: string;
  attendance: any;
}

interface AttendanceRecord {
  personalInfo?: {
    fullName: string;
    idNumber: string;
    email: string;
    mobileNumber: string;
    department: string;
    role: string;
  };
  attendanceInfo?: {
    timestamp: string;
  };
}

const SCALING_FACTOR = 20; // Scaling factor set to 20x

const EnergyUsagePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [energyData, setEnergyData] = useState<EnergyUsage[]>([]);
  const [instructorsData, setInstructorsData] = useState<{ [key: string]: InstructorData }>({});
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [selectedTimestamp, setSelectedTimestamp] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [accessTimestamps, setAccessTimestamps] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [calcEnergyKWh, setCalcEnergyKWh] = useState<string>('0');
  const [calcDurationHours, setCalcDurationHours] = useState<string>('1');
  const [calcResult, setCalcResult] = useState<{
    prototypeKWh: string;
    actualKWh: string;
    prototypeCost: string;
    actualCost: string;
    durationHours: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State to store energy data for all instructors
  const [instructorsEnergyData, setInstructorsEnergyData] = useState<InstructorEnergyData[]>([]);

  // Add this state for the rate
  const [vecoRate, setVecoRate] = useState<number>(14);

  // Add this state for students
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Fetch all instructors' data in real-time
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const instructorsRef = ref(rtdb, `Instructors`);
    const unsubscribe = onValue(
      instructorsRef,
      (snapshot) => {
        const data = snapshot.val();
        setInstructorsData(data || {});
        setLoading(false);

        // Calculate total power consumption, room name, and PZEM data for each instructor
        const energyDataList: InstructorEnergyData[] = [];

        if (data) {
          Object.entries(data).forEach(([rfidUid, instructor]: [string, any]) => {
            let totalPower = 0;
            let fetchedRoomName = '';
            let fetchedPzem: PZEMData | null = null;
            const instructorName = instructor.Profile?.fullName || 'Unknown Instructor';

            // Prioritize ClassHistory data if available (officially ended sessions)
            if (instructor.ClassHistory) {
              // Find the most recent ClassHistory entry
              const historyEntries = Object.entries(instructor.ClassHistory);
              if (historyEntries.length > 0) {
                // Sort by timestamp (dateTime) to get the most recent entry
                historyEntries.sort((a, b) => {
                  const entryA = a[1] as ClassHistoryEntry;
                  const entryB = b[1] as ClassHistoryEntry;
                  return entryB.dateTime.localeCompare(entryA.dateTime);
                });
                
                const latestHistory = historyEntries[0][1] as ClassHistoryEntry;
                if (latestHistory.Status === "Class Ended" && 
                    latestHistory.schedule?.roomName?.pzem) {
                  const power = parseFloat(latestHistory.schedule.roomName.pzem.power) || 0;
                  totalPower = power;
                  fetchedRoomName = latestHistory.schedule.roomName.name || '';
                  fetchedPzem = latestHistory.schedule.roomName.pzem;
                }
              }
            }
            
            // Fall back to ClassStatus only if no valid ClassHistory data was found
            if (!fetchedPzem && instructor.ClassStatus?.schedule?.roomName?.pzem) {
              const power = parseFloat(instructor.ClassStatus.schedule.roomName.pzem.power) || 0;
              totalPower = power;
              fetchedRoomName = instructor.ClassStatus.schedule.roomName.name || '';
              fetchedPzem = instructor.ClassStatus.schedule.roomName.pzem;
            }

            energyDataList.push({
              rfidUid,
              totalPowerConsumption: totalPower,
              roomName: fetchedRoomName,
              pzemData: fetchedPzem,
              instructorName,
            });
          });
        }

        setInstructorsEnergyData(energyDataList);
      },
      (error) => {
        console.error('Error fetching instructors data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch instructors data',
          customClass: {
            popup: 'rounded-lg sm:rounded-xl',
            title: 'text-blue-900',
            htmlContainer: 'text-blue-700',
            confirmButton: 'bg-blue-600 hover:bg-blue-700',
          },
        });
        setLoading(false);
      }
    );

    return () => off(instructorsRef, 'value', unsubscribe);
  }, [currentUser]);

  // Fetch roomName and timestamps from Firebase
  useEffect(() => {
    const fetchRoomsAndTimestamps = () => {
      try {
        const roomSet = new Set<string>();
        const timestamps: string[] = [];

        // Fetch roomName from ClassHistory first, then fall back to ClassStatus
        Object.values(instructorsData).forEach((instructor) => {
          // First try to get room names from ClassHistory (officially ended sessions)
          if (instructor?.ClassHistory) {
            Object.values(instructor.ClassHistory).forEach((history: any) => {
              if (history.schedule?.roomName?.name) {
                roomSet.add(history.schedule.roomName.name);
              }
            });
          }
          
          // If no room was found in history, check ClassStatus
          if (instructor?.ClassStatus?.schedule?.roomName?.name &&
              !Array.from(roomSet).includes(instructor.ClassStatus.schedule.roomName.name)) {
            roomSet.add(instructor.ClassStatus.schedule.roomName.name);
          }

          // Fetch timestamps from AccessLogs, filter by action "Access"
          if (instructor?.AccessLogs) {
            Object.values(instructor.AccessLogs).forEach((log: AccessLogEntry) => {
              if (log.action === 'Access' && log.timestamp) {
                timestamps.push(log.timestamp);
              }
            });
          }
        });

        const roomsData: Room[] = Array.from(roomSet).map((name, index) => ({
          id: `room-${index}`,
          name,
          building: 'GLE Building',
          floor: '7th Floor',
        }));

        const sortedRooms = roomsData.sort((a, b) => a.name.localeCompare(b.name));
        setRooms(sortedRooms);
        setAccessTimestamps(timestamps.sort().reverse()); // Latest first

        if (sortedRooms.length > 0 && !selectedClassroom) {
          setSelectedClassroom(sortedRooms[0].name);
        }
        if (timestamps.length > 0 && !selectedTimestamp) {
          setSelectedTimestamp(timestamps[0]);
        }
      } catch (error) {
        console.error('Error processing rooms and timestamps:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch rooms or timestamps',
          customClass: {
            popup: 'rounded-lg sm:rounded-xl',
            title: 'text-blue-900',
            htmlContainer: 'text-blue-700',
            confirmButton: 'bg-blue-600 hover:bg-blue-700',
          },
        });
      }
    };

    fetchRoomsAndTimestamps();
  }, [instructorsData, selectedClassroom, selectedTimestamp]);

  // Process energy data based on selected classroom and timestamp
  useEffect(() => {
    if (!selectedClassroom || !selectedTimestamp) {
      setEnergyData([]);
      return;
    }

    const processData = () => {
      try {
        const energyEntries: EnergyUsage[] = [];

        Object.entries(instructorsData).forEach(([rfidUid, instructor]) => {
          // First check ClassHistory for PZEM data (officially ended sessions)
          let foundInHistory = false;
          
          if (instructor?.ClassHistory) {
            Object.entries(instructor.ClassHistory).forEach(([historyKey, historyEntry]) => {
              const entry = historyEntry as ClassHistoryEntry;
              const schedule = entry?.schedule;
              const roomName = schedule?.roomName;
              const pzem = roomName?.pzem;
              const instructorName = instructor?.Profile?.fullName || 'Unknown Instructor';
              
              if (pzem && roomName?.name && roomName.name === selectedClassroom && 
                  entry.Status === "Class Ended") {
                
                const selectedTime = parseTimestamp(selectedTimestamp);
                if (!selectedTime || isNaN(selectedTime.getTime())) {
                  return;
                }

                const timeWindowStart = new Date(selectedTime.getTime() - 60 * 60 * 1000);
                const timeWindowEnd = new Date(selectedTime.getTime() + 60 * 60 * 1000);
                
                const pzemTimestamp = parseTimestamp(pzem.timestamp);
                
                if (
                  pzemTimestamp &&
                  !isNaN(pzemTimestamp.getTime()) &&
                  pzemTimestamp >= timeWindowStart &&
                  pzemTimestamp <= timeWindowEnd
                ) {
                  const powerWatts = parseFloat(pzem.power) || 0;
                  const consumptionKWh = parseFloat(pzem.calculatedEnergy || pzem.energy) || 0;
                  
                  energyEntries.push({
                    id: `instructor_${rfidUid}_${historyKey}`,
                    classroomId: selectedClassroom,
                    timestamp: pzemTimestamp,
                    powerWatts,
                    consumptionKWh,
                    devices: {
                      lighting: consumptionKWh * 0.25,
                      projection: consumptionKWh * 0.25,
                      computers: consumptionKWh * 0.25,
                      hvac: consumptionKWh * 0.25,
                    },
                    instructorName,
                    subject: schedule?.subject || 'Unknown Subject',
                    subjectCode: schedule?.subjectCode || 'N/A',
                    schedule: {
                      day: schedule?.day || 'N/A',
                      startTime: schedule?.startTime || 'N/A',
                      endTime: schedule?.endTime || 'N/A',
                      section: schedule?.section || 'N/A',
                    },
                  });
                  
                  foundInHistory = true;
                }
              }
            });
          }
          
          // Only fall back to ClassStatus if no valid data was found in ClassHistory
          if (!foundInHistory) {
            const schedule = instructor?.ClassStatus?.schedule;
            const roomName = schedule?.roomName;
            const pzem = roomName?.pzem;
            const instructorName = instructor?.Profile?.fullName || 'Unknown Instructor';

            if (pzem && roomName?.name && roomName.name === selectedClassroom) {
              const selectedTime = parseTimestamp(selectedTimestamp);
              if (!selectedTime || isNaN(selectedTime.getTime())) {
                return;
              }

              const timeWindowStart = new Date(selectedTime.getTime() - 60 * 60 * 1000);
              const timeWindowEnd = new Date(selectedTime.getTime() + 60 * 60 * 1000);
              const pzemTimestamp = parseTimestamp(pzem.timestamp);

              if (
                pzemTimestamp &&
                !isNaN(pzemTimestamp.getTime()) &&
                pzemTimestamp >= timeWindowStart &&
                pzemTimestamp <= timeWindowEnd
              ) {
                const powerWatts = parseFloat(pzem.power) || 0;
                const consumptionKWh = parseFloat(pzem.calculatedEnergy || pzem.energy) || 0;
                
                energyEntries.push({
                  id: `instructor_${rfidUid}_${pzem.timestamp}`,
                  classroomId: selectedClassroom,
                  timestamp: pzemTimestamp,
                  powerWatts,
                  consumptionKWh,
                  devices: {
                    lighting: consumptionKWh * 0.25,
                    projection: consumptionKWh * 0.25,
                    computers: consumptionKWh * 0.25,
                    hvac: consumptionKWh * 0.25,
                  },
                  instructorName,
                  subject: schedule?.subject || 'Unknown Subject',
                  subjectCode: schedule?.subjectCode || 'N/A',
                  schedule: {
                    day: schedule?.day || 'N/A',
                    startTime: schedule?.startTime || 'N/A',
                    endTime: schedule?.endTime || 'N/A',
                    section: schedule?.section || 'N/A',
                  },
                });
              }
            }
          }
        });

        setEnergyData(energyEntries);
      } catch (error) {
        console.error('Error processing energy data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to process energy data',
          customClass: {
            popup: 'rounded-lg sm:rounded-xl',
            title: 'text-blue-900',
            htmlContainer: 'text-blue-700',
            confirmButton: 'bg-blue-600 hover:bg-blue-700',
          },
        });
      }
    };

    processData();
  }, [selectedClassroom, selectedTimestamp, instructorsData]);

  // Fetch students under current instructor
  useEffect(() => {
    if (!currentUser?.uid) return;

    const studentsRef = ref(rtdb, 'Students');
    const unsubscribe = onValue(
      studentsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const fetchedStudents: Student[] = [];
          
          // Process each student in the Students node
          Object.entries(data).forEach(([rfidUid, studentData]: [string, any]) => {
            console.log('Processing student:', rfidUid, studentData); // Debug log
            
            try {
              // First try to get personal info from Profile
              let personalInfo = studentData.Profile || null;
              
              // If no Profile, try to get from the most recent attendance record
              if (!personalInfo && studentData.Attendance) {
                // Get the last session key
                const lastSession = studentData.lastSession;
                if (lastSession && studentData.Attendance[lastSession]?.personalInfo) {
                  personalInfo = studentData.Attendance[lastSession].personalInfo;
                } else {
                  // If no lastSession or no personalInfo in lastSession, try any attendance record
                  const attendanceRecords = Object.values(studentData.Attendance) as AttendanceRecord[];
                  const recordWithInfo = attendanceRecords.find(record => record?.personalInfo);
                  if (recordWithInfo?.personalInfo) {
                    personalInfo = recordWithInfo.personalInfo;
                  }
                }
              }

              // Add student if we have any personal info
              if (personalInfo) {
                const student: Student = {
                  id: rfidUid,
                  fullName: personalInfo.fullName || 'Unknown',
                  idNumber: personalInfo.idNumber || 'N/A',
                  email: personalInfo.email || 'N/A',
                  mobileNumber: personalInfo.mobileNumber || 'N/A',
                  department: personalInfo.department || 'N/A',
                  role: personalInfo.role || 'student',
                  attendance: studentData.Attendance || {}
                };

                fetchedStudents.push(student);
              } else {
                console.warn(`No personal info found for student ${rfidUid}`);
              }
            } catch (error) {
              console.error(`Error processing student ${rfidUid}:`, error);
            }
          });

          console.log('Fetched students:', fetchedStudents); // Debug log
          
          // Sort students by name
          fetchedStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setStudents(fetchedStudents);
        }
        setLoadingStudents(false);
      },
      (error) => {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
        setLoadingStudents(false);
      }
    );

    return () => off(studentsRef, 'value', unsubscribe);
  }, [currentUser]);

  // Helper to parse timestamp format (YYYY_MM_DD_HHMMSS) and convert to 12-hour format
  const parseTimestamp = (timestamp: string): Date | null => {
    try {
      // Split the timestamp into components
      const parts = timestamp.split('_');
      if (parts.length < 4) return null;
      
      const [year, month, day] = parts.slice(0, 3);
      const timePart = parts[3];
      
      if (!year || !month || !day || !timePart) return null;
      
      const hours = timePart.substring(0, 2);
      const minutes = timePart.substring(2, 4);
      const seconds = timePart.substring(4, 6);
      
      // Convert to 12-hour format
      let hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12; // Convert to 12-hour format
      
      // Create formatted timestamp string
      const formatted = `${year}-${month}-${day} ${hour}:${minutes}:${seconds} ${ampm}`;
      const date = new Date(formatted);
      
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  // Get the latest PZEM data for real-time display
  const getCurrentData = () => {
    // First look for a matching ClassHistory with "Class Ended" status
    for (const instructor of Object.values(instructorsData)) {
      if (instructor?.ClassHistory) {
        // Sort history entries by timestamp to get the most recent one
        const historyEntries = Object.entries(instructor.ClassHistory)
          .sort((a, b) => {
            const entryA = a[1] as ClassHistoryEntry;
            const entryB = b[1] as ClassHistoryEntry;
            return entryB.dateTime.localeCompare(entryA.dateTime);
          });
        
        // Check the most recent class history entry first
        for (const pair of historyEntries) {
          const historyEntry = pair[1] as ClassHistoryEntry;
          if (
            historyEntry.Status === "Class Ended" &&
            historyEntry.schedule?.roomName?.name === selectedClassroom &&
            historyEntry.schedule?.roomName?.pzem
          ) {
            return {
              pzem: historyEntry.schedule.roomName.pzem,
              schedule: historyEntry.schedule
            };
          }
        }
      }
    }
    
    // Fall back to ClassStatus if no matching ClassHistory found
    for (const instructor of Object.values(instructorsData)) {
      if (
        instructor?.ClassStatus?.schedule?.roomName?.name === selectedClassroom &&
        instructor?.ClassStatus?.schedule?.roomName?.pzem
      ) {
        return {
          pzem: instructor.ClassStatus.schedule.roomName.pzem,
          schedule: instructor.ClassStatus.schedule
        };
      }
    }
    
    return null;
  };

  // Calculate duration based on Access timestamp and PZEM timestamp
  const calculateDuration = (): Duration => {
    if (!selectedTimestamp) {
      return { hours: 0, minutes: 0, totalHours: 0 };
    }

    try {
      let calculatedDuration: Duration = { hours: 0, minutes: 0, totalHours: 0 };
      let foundMatch = false;
      
      // Parse the selected access timestamp
      const accessTimestamp = parseTimestamp(selectedTimestamp);
      if (!accessTimestamp) {
        return calculatedDuration;
      }

      // First check ClassHistory for PZEM timestamp
      for (const instructor of Object.values(instructorsData)) {
        if (instructor?.ClassHistory) {
          // Look through ClassHistory entries
          const historyEntries = Object.entries(instructor.ClassHistory)
            .filter(([_, entry]) => (entry as ClassHistoryEntry).Status === "Class Ended");
          
          for (const [historyKey, historyEntry] of historyEntries) {
            const entry = historyEntry as ClassHistoryEntry;
            
            // Check if this history entry is for our selected classroom
            if (entry.schedule?.roomName?.name === selectedClassroom && 
                entry.schedule?.roomName?.pzem?.timestamp) {
              
              // Parse the PZEM timestamp
              const pzemTimestamp = parseTimestamp(entry.schedule.roomName.pzem.timestamp);
              
              if (pzemTimestamp) {
                // Calculate duration between access timestamp and PZEM timestamp
                const durationMs = pzemTimestamp.getTime() - accessTimestamp.getTime();
                
                // Only use positive durations
                if (durationMs > 0) {
                  const totalMinutes = Math.floor(durationMs / (1000 * 60));
                  
                  calculatedDuration = {
                    hours: Math.floor(totalMinutes / 60),
                    minutes: totalMinutes % 60,
                    totalHours: totalMinutes / 60
                  };
                  
                  foundMatch = true;
                  break;
                }
              }
            }
          }
          
          if (foundMatch) break;
        }
      }
      
      // If no matching ClassHistory, check ClassStatus
      if (!foundMatch) {
        for (const instructor of Object.values(instructorsData)) {
          if (instructor?.ClassStatus?.schedule?.roomName?.name === selectedClassroom &&
              instructor?.ClassStatus?.schedule?.roomName?.pzem?.timestamp) {
            
            // Parse the PZEM timestamp
            const pzemTimestamp = parseTimestamp(instructor.ClassStatus.schedule.roomName.pzem.timestamp);
            
            if (pzemTimestamp) {
              // Calculate duration between access timestamp and PZEM timestamp
              const durationMs = pzemTimestamp.getTime() - accessTimestamp.getTime();
              
              // Only use positive durations
              if (durationMs > 0) {
                const totalMinutes = Math.floor(durationMs / (1000 * 60));
                
                calculatedDuration = {
                  hours: Math.floor(totalMinutes / 60),
                  minutes: totalMinutes % 60,
                  totalHours: totalMinutes / 60
                };
                
                break;
              }
            }
          }
        }
      }

      return calculatedDuration;
    } catch (error) {
      console.error('Error calculating duration:', error);
      return { hours: 0, minutes: 0, totalHours: 0 };
    }
  };

  const duration = calculateDuration();

  // Calculate power consumption based on PZEM data
  const calculatePowerConsumption = () => {
    let prototypeConsumptionKWh = 0;
    let actualConsumptionKWh = 0;

    // Get current data for display in the UI
    const currentData = getCurrentData();
    const pzem = currentData?.pzem;

    if (pzem) {
      prototypeConsumptionKWh = parseFloat(pzem.calculatedEnergy || pzem.energy) || 0;

      // Update the latest entry's consumptionKWh and devices if we have entries
      if (energyData.length > 0) {
        const latestEntry = energyData[energyData.length - 1];
        latestEntry.consumptionKWh = prototypeConsumptionKWh;
        latestEntry.devices = {
          lighting: prototypeConsumptionKWh * 0.25,
          projection: prototypeConsumptionKWh * 0.25,
          computers: prototypeConsumptionKWh * 0.25,
          hvac: prototypeConsumptionKWh * 0.25,
        };
      }
    }

    // For display in the Power Consumption Analysis section
    // This shows the consumption for the current session/classroom
    actualConsumptionKWh = prototypeConsumptionKWh * SCALING_FACTOR;
    
    // Calculate costs based on consumption and duration
    const prototypeCost = prototypeConsumptionKWh * vecoRate * duration.totalHours;
    const actualCost = actualConsumptionKWh * vecoRate * duration.totalHours;

    return {
      prototypeConsumptionKWh: prototypeConsumptionKWh.toFixed(2),
      actualConsumptionKWh: actualConsumptionKWh.toFixed(2),
      prototypeCost: prototypeCost.toFixed(2),
      actualCost: actualCost.toFixed(2),
      durationHours: duration.totalHours.toFixed(2),
    };
  };

  const powerConsumption = calculatePowerConsumption();

  // For consistency with the displayed power consumption, get the instructor energy data for the selected classroom
  const selectedInstructorEnergyData = instructorsEnergyData.find(
    instructor => instructor.roomName === selectedClassroom
  );

  // Calculate the total consumption
  // If we have energy data entries, use them; otherwise use the current PZEM data
  const totalConsumption = energyData.length > 0 
    ? energyData.reduce((total, entry) => total + (entry.consumptionKWh * SCALING_FACTOR), 0)
    : parseFloat(powerConsumption.actualConsumptionKWh);
    
  // Calculate average consumption - if no entries, the average is the total
  const averageConsumption = energyData.length > 0 
    ? totalConsumption / energyData.length 
    : totalConsumption;
    
  // Calculate peak usage - if no entries, the peak is the total
  const peakUsage = energyData.length > 0 
    ? Math.max(...energyData.map((e) => e.consumptionKWh * SCALING_FACTOR)) 
    : totalConsumption;

  const handleCalculate = () => {
    const energyKWh = parseFloat(calcEnergyKWh) || 0;
    const userDurationHours = parseFloat(calcDurationHours) || 1;
    const prototypeKWh = energyKWh;
    const actualKWh = prototypeKWh * SCALING_FACTOR;
    const prototypeCost = prototypeKWh * vecoRate * userDurationHours;
    const actualCost = actualKWh * vecoRate * userDurationHours;

    setCalcResult({
      prototypeKWh: prototypeKWh.toFixed(2),
      actualKWh: actualKWh.toFixed(2),
      prototypeCost: prototypeCost.toFixed(2),
      actualCost: actualCost.toFixed(2),
      durationHours: userDurationHours.toFixed(2),
    });
  };

  const currentData = getCurrentData();
  const latestPzemData = currentData?.pzem;
  const latestSchedule = currentData?.schedule;
  
  // Get the instructor name with the same priority logic as PZEM data
  let latestInstructorName = 'Unknown Instructor';
  
  // First try to find matching instructor from ClassHistory with "Class Ended" status
  for (const instructor of Object.values(instructorsData)) {
    if (instructor?.ClassHistory) {
      // Sort history entries by timestamp to get the most recent one
      const historyEntries = Object.entries(instructor.ClassHistory)
        .sort((a, b) => {
          const entryA = a[1] as ClassHistoryEntry;
          const entryB = b[1] as ClassHistoryEntry;
          return entryB.dateTime.localeCompare(entryA.dateTime);
        });
      
      // Check the most recent class history entry first
      for (const pair of historyEntries) {
        const historyEntry = pair[1] as ClassHistoryEntry;
        if (
          historyEntry.Status === "Class Ended" &&
          historyEntry.schedule?.roomName?.name === selectedClassroom
        ) {
          latestInstructorName = instructor.Profile?.fullName || 'Unknown Instructor';
          break;
        }
      }
    }
  }
  
  // Fall back to ClassStatus if no matching ClassHistory found
  if (latestInstructorName === 'Unknown Instructor') {
    const instructorWithMatchingRoom = Object.values(instructorsData).find(
      (instructor) => instructor?.ClassStatus?.schedule?.roomName?.name === selectedClassroom
    );
    if (instructorWithMatchingRoom?.Profile?.fullName) {
      latestInstructorName = instructorWithMatchingRoom.Profile.fullName;
    }
  }

  const filteredEnergyData = energyData.filter((entry) =>
    [entry.instructorName, entry.subject, entry.subjectCode, entry.schedule.section]
      .some((field) => field.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-500 transition-colors"
      >
        <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'ml-64' : 'ml-0 md:ml-64'
        } overflow-y-auto p-4 sm:p-8`}
      >
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Energy Usage Analytics</h1>
          <p className="mt-1 sm:mt-2 text-gray-600 text-sm sm:text-base">
            Monitor and analyze classroom energy consumption in real-time
          </p>
        </div>
        {/* Display Energy Data for All Instructors */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center">
            <BoltIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
            Instructors' Classroom Energy Details
          </h3>
          {instructorsEnergyData.length > 0 ? (
            instructorsEnergyData.map((instructor) => (
              <div
                key={instructor.rfidUid}
                className="mb-6 p-4 border border-gray-200 rounded-lg"
              >
                <h4 className="text-sm sm:text-base font-medium mb-3">
                  Instructor: {instructor.instructorName} (RFID: {instructor.rfidUid})
                </h4>
                {instructor.roomName && instructor.pzemData ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-600">Room Name:</span>{' '}
                      <span className="font-medium">{instructor.roomName}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Power Consumption:</span>{' '}
                      <span className="font-medium">{instructor.totalPowerConsumption.toFixed(2)} W</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Current:</span>{' '}
                      <span className="font-medium">{parseFloat(instructor.pzemData.current).toFixed(2)} A</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Energy:</span>{' '}
                      <span className="font-medium">{parseFloat(instructor.pzemData.energy).toFixed(2)} kWh</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Frequency:</span>{' '}
                      <span className="font-medium">{parseFloat(instructor.pzemData.frequency).toFixed(2)} Hz</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Power Factor:</span>{' '}
                      <span className="font-medium">{parseFloat(instructor.pzemData.powerFactor).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Voltage:</span>{' '}
                      <span className="font-medium">{parseFloat(instructor.pzemData.voltage).toFixed(2)} V</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Timestamp:</span>{' '}
                      <span className="font-medium">{instructor.pzemData.timestamp.replace(/_/g, ':')}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-500">
                    No energy data available for this instructor
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs sm:text-sm text-gray-500">
              No instructors' energy data available
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
              <BuildingOfficeIcon className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2 text-indigo-600" />
              Select Classroom
            </label>
            {rooms.length > 0 ? (
              <select
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
                className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2.5 text-sm sm:text-base"
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.name}>
                    {room.name} - {room.building}, {room.floor}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center text-yellow-600 text-sm sm:text-base">
                <ExclamationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                <span>No rooms available</span>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
              <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2 text-indigo-600" />
              Select Access Timestamp
            </label>
            {accessTimestamps.length > 0 ? (
              <select
                value={selectedTimestamp}
                onChange={(e) => setSelectedTimestamp(e.target.value)}
                className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2.5 text-sm sm:text-base"
              >
                {accessTimestamps.map((ts) => (
                  <option key={ts} value={ts}>
                    {parseTimestamp(ts)?.toLocaleString() || ts}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center text-yellow-600 text-sm sm:text-base">
                <ExclamationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                <span>No access timestamps available</span>
              </div>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center">
                <BoltIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                Prototype Power Consumption ({selectedClassroom || ''})
              </h3>
              {latestPzemData && latestSchedule ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-600">Power:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.power).toFixed(2)} W</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.current).toFixed(2)} A</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Voltage:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.voltage).toFixed(2)} V</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Energy:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.calculatedEnergy || latestPzemData.energy).toFixed(2)} kWh</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Frequency:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.frequency).toFixed(2)} Hz</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Power Factor:</span>{' '}
                    <span className="font-medium">{parseFloat(latestPzemData.powerFactor).toFixed(2)}</span>
                  </div>
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
                    <div className="flex items-center text-gray-600 mb-2">
                      <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span>Instructor:</span>{' '}
                      <span className="font-medium ml-1">{latestInstructorName}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <AcademicCapIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span>Subject:</span>{' '}
                      <span className="font-medium ml-1">
                        {latestSchedule.subject} ({latestSchedule.subjectCode})
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600 mt-2">
                      <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span>Schedule:</span>{' '}
                      <span className="font-medium ml-1">
                        {latestSchedule.day} {latestSchedule.startTime}-{latestSchedule.endTime}, Section{' '}
                        {latestSchedule.section}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-full">
                    <span className="text-gray-600">Last Updated:</span>{' '}
                    <span className="font-medium">{latestPzemData.timestamp.replace(/_/g, ':')}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500">
                  No real-time power data available for {selectedClassroom || ''}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <StatCard
                icon={BoltIcon}
                title="Total Consumption"
                value={`${totalConsumption.toFixed(2)} kWh`}
                description="Total energy used"
              />
              <StatCard
                icon={ChartBarIcon}
                title="Average Consumption"
                value={`${averageConsumption.toFixed(2)} kWh`}
                description="Average per reading"
              />
              <StatCard
                icon={PowerIcon}
                title="Peak Usage"
                value={`${peakUsage.toFixed(2)} kWh`}
                description="Highest consumption"
              />
              <StatCard
                icon={ArrowsRightLeftIcon}
                title="Readings"
                value={energyData.length > 0 ? energyData.length : (latestPzemData ? 1 : 0)}
                description="Total data points"
              />
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold flex items-center">
                  <CalculatorIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                  Power Consumption Analysis
                </h3>
                <div className="flex items-center">
                  <label htmlFor="vecoRate" className="text-sm text-gray-600 mr-2">Rate (₱/kWh):</label>
                  <input
                    id="vecoRate"
                    type="number"
                    value={vecoRate}
                    onChange={(e) => setVecoRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-1 px-2"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Prototype Consumption</h4>
                  <p className="text-xs sm:text-sm">
                    Duration: {duration.hours} hours {duration.minutes} minutes
                    {duration.totalHours > 0 && ` (${duration.totalHours.toFixed(2)} hours)`}
                  </p>
                  <p className="text-xs sm:text-sm">Consumption: {powerConsumption.prototypeConsumptionKWh} kWh</p>
                  <p className="text-xs sm:text-sm">Cost: ₱{powerConsumption.prototypeCost}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Actual Room Consumption (Scaled x{SCALING_FACTOR})</h4>
                  <p className="text-xs sm:text-sm">
                    Duration: {duration.hours} hours {duration.minutes} minutes
                    {duration.totalHours > 0 && ` (${duration.totalHours.toFixed(2)} hours)`}
                  </p>
                  <p className="text-xs sm:text-sm">Consumption: {powerConsumption.actualConsumptionKWh} kWh</p>
                  <p className="text-xs sm:text-sm">Cost: ₱{powerConsumption.actualCost}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center">
                <CalculatorIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                Interactive Power Calculator (@ ₱{vecoRate}/kWh)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Energy Consumption (kWh)
                  </label>
                  <input
                    type="number"
                    value={calcEnergyKWh}
                    onChange={(e) => setCalcEnergyKWh(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2 px-2 sm:px-3 text-sm sm:text-base"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={calcDurationHours}
                    onChange={(e) => setCalcDurationHours(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2 px-2 sm:px-3 text-sm sm:text-base"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    onClick={handleCalculate}
                    className="w-full sm:w-auto px-4 sm:px-6 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base"
                  >
                    Calculate
                  </button>
                  {calcResult && (
                    <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg text-xs sm:text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Prototype Consumption</h4>
                          <p>Duration: {Math.floor(parseFloat(calcResult.durationHours))} hours {Math.round((parseFloat(calcResult.durationHours) % 1) * 60)} minutes</p>
                          <p>Consumption: {calcResult.prototypeKWh} kWh</p>
                          <p>Cost: ₱{calcResult.prototypeCost}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Actual Room Consumption (Scaled x{SCALING_FACTOR})</h4>
                          <p>Duration: {Math.floor(parseFloat(calcResult.durationHours))} hours {Math.round((parseFloat(calcResult.durationHours) % 1) * 60)} minutes</p>
                          <p>Consumption: {calcResult.actualKWh} kWh</p>
                          <p>Cost: ₱{calcResult.actualCost}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Device Energy Breakdown - show regardless of whether we have entries */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6">
                Device Energy Breakdown (Latest Reading)
              </h3>
              {latestPzemData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <DeviceEnergy
                    label="Lighting"
                    value={parseFloat(powerConsumption.actualConsumptionKWh) * 0.25}
                    color="rgb(59, 130, 246)"
                    icon={LightBulbIcon}
                  />
                  <DeviceEnergy
                    label="Projection"
                    value={parseFloat(powerConsumption.actualConsumptionKWh) * 0.25}
                    color="rgb(16, 185, 129)"
                    icon={ChartBarIcon}
                  />
                  <DeviceEnergy
                    label="Computers"
                    value={parseFloat(powerConsumption.actualConsumptionKWh) * 0.25}
                    color="rgb(245, 158, 11)"
                    icon={PowerIcon}
                  />
                  <DeviceEnergy
                    label="HVAC"
                    value={parseFloat(powerConsumption.actualConsumptionKWh) * 0.25}
                    color="rgb(239, 68, 68)"
                    icon={ArrowsRightLeftIcon}
                  />
                </div>
              ) : (
                <p className="text-center text-gray-500">No device breakdown available</p>
              )}
            </div>
            
            {energyData.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mt-6 sm:mt-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold flex items-center">
                    <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                    Energy Consumption Records
                  </h3>
                  <div className="mt-3 sm:mt-0 w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search by instructor, subject, or section..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 sm:py-2 px-2 sm:px-3 text-sm sm:text-base"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left text-gray-600">
                    <thead className="text-xs sm:text-sm text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Timestamp
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Instructor
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Subject
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Schedule
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Section
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Power (W)
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3">
                          Consumption (kWh)
                        </th>
                      </tr> 
                    </thead>
                    <tbody>
                      {filteredEnergyData.length > 0 ? (
                        filteredEnergyData.map((entry) => (
                          <tr key={entry.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 sm:px-6 py-3 sm:py-4">{entry.timestamp.toLocaleString()}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">{entry.instructorName}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.subject} ({entry.subjectCode})
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              {entry.schedule.day} {entry.schedule.startTime}-{entry.schedule.endTime}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">{entry.schedule.section}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">{entry.powerWatts.toFixed(2)}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4">{(entry.consumptionKWh * SCALING_FACTOR).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 sm:px-6 py-3 sm:py-4 text-center text-gray-500">
                            No records match your search
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Add Students Section */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center">
                <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600" />
                Students Under Current Instructor
              </h3>
              {loadingStudents ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : students.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {students.map((student) => (
                    <div key={student.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 font-medium">
                            {student.fullName.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{student.fullName}</h4>
                          <p className="text-sm text-gray-500">ID: {student.idNumber}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Department:</span>
                          <span className="ml-1 font-medium">{student.department}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Email:</span>
                          <span className="ml-1 font-medium">{student.email}</span>
                        </div>
                        {student.mobileNumber && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Mobile:</span>
                            <span className="ml-1 font-medium">{student.mobileNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">No students found</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, description }: any) => (
  <motion.div whileHover={{ scale: 1.02 }} className="bg-white p-4 sm:p-6 rounded-xl shadow-sm">
    <div className="flex items-center">
      <div className="p-2 bg-indigo-100 rounded-lg">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
      </div>
      <div className="ml-3 sm:ml-4">
        <p className="text-xs sm:text-sm font-medium text-gray-600">{title}</p>
        <p className="text-lg sm:text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-xs sm:text-sm text-gray-500">{description}</p>
      </div>
    </div>
  </motion.div>
);

const DeviceEnergy = ({ label, value, color, icon: Icon }: any) => (
  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
    <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-3">
      <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color }} />
      <span className="text-xs sm:text-sm font-medium text-gray-600">{label}</span>
    </div>
    <div className="flex justify-between items-center mb-1 sm:mb-2">
      <span className="text-lg sm:text-2xl font-semibold" style={{ color }}>
        {value.toFixed(2)} kWh
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
      <div
        className="h-1.5 sm:h-2 rounded-full transition-all duration-500"
        style={{ width: `${Math.min((value / 10) * 100, 100)}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
      />
    </div>
  </div>
);

export default EnergyUsagePage;