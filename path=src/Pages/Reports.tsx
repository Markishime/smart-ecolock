import React, { useState, useEffect, useMemo } from 'react';
import { ref } from 'firebase/database';
import { useFirebase } from '../contexts/FirebaseContext';

interface AdminRoomPZEM {
  Current: string;
  Energy: string;
  Frequency: string;
  Power: string;
  PowerFactor: string;
  Voltage: string;
  timestamp: string;
  roomName: string;
}

interface Admin {
  createdAt: string;
  email: string;
  fullName: string;
  idNumber: string;
  lastTamperStop: string;
  rfidUid: string;
  role: string;
  rooms?: {
    [roomName: string]: {
      pzem?: AdminRoomPZEM;
      facilities?: {
        fans: boolean;
        lights: boolean;
        tampering: boolean;
        lastUpdated: string;
      };
    };
  };
}

const Dashboard: React.FC = () => {
  const [adminRoomsPZEM, setAdminRoomsPZEM] = useState<AdminRoomPZEM[]>([]);

  useEffect(() => {
    setLoading(true);
    const refs = {
      admins: ref(rtdb, 'Admin'),
    };

    const listeners = [
      { 
        path: 'admins', 
        ref: refs.admins,
        handler: (data: Record<string, Admin>) => {
          setAdmins(data);
          setStats((prev) => ({ ...prev, totalAdmins: Object.keys(data).length }));
          
          const pzemData: AdminRoomPZEM[] = [];
          Object.values(data).forEach(admin => {
            if (admin.rooms) {
              Object.entries(admin.rooms).forEach(([roomName, room]) => {
                if (room.pzem) {
                  pzemData.push({
                    ...room.pzem,
                    roomName
                  });
                }
              });
            }
          });
          setAdminRoomsPZEM(pzemData);
        }
      },
    ];

    // ... rest of the useEffect code ...
  }, []);

  const roomPowerConsumption = useMemo(() => {
    const rooms: RoomPowerConsumption[] = [];

    adminRoomsPZEM.forEach((pzem) => {
      rooms.push({
        roomName: pzem.roomName,
        building: 'Admin Building',
        floor: 'Admin Floor',
        current: pzem.Current,
        energy: pzem.Energy,
        frequency: pzem.Frequency,
        power: pzem.Power,
        powerFactor: pzem.PowerFactor,
        voltage: pzem.Voltage,
        timestamp: pzem.timestamp
      });
    });

    Object.entries(adminPZEM).forEach(([uid, pzemEntries]) => {
      Object.entries(pzemEntries).forEach(([timestamp, pzem]) => {
        rooms.push({
          roomName: pzem.roomDetails.name,
          building: pzem.roomDetails.building,
          floor: pzem.roomDetails.floor,
          current: pzem.Current,
          energy: pzem.Energy,
          frequency: pzem.Frequency,
          power: pzem.Power,
          powerFactor: pzem.PowerFactor,
          voltage: pzem.Voltage,
          timestamp: pzem.timestamp,
        });
      });
    });

    Object.values(instructors).forEach((instructor) => {
      const schedule = instructor.ClassStatus?.schedule;
      if (schedule && typeof schedule.roomName !== 'string' && schedule.roomName.pzem) {
        const pzem = schedule.roomName.pzem;
        rooms.push({
          roomName: schedule.roomName.name,
          building: 'GLE Building',
          floor: '7th Floor',
          current: pzem.current,
          energy: pzem.energy,
          frequency: pzem.frequency,
          power: pzem.power,
          powerFactor: pzem.powerFactor,
          voltage: pzem.voltage,
          timestamp: pzem.timestamp,
        });
      }
    });

    return rooms
      .filter((room) =>
        [
          room.roomName,
          room.building,
          room.floor,
          room.current,
          room.energy,
          room.frequency,
          room.power,
          room.powerFactor,
          room.voltage,
          room.timestamp,
        ].some((field) => field?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [adminPZEM, instructors, adminRoomsPZEM, searchQuery]);

  // ... rest of the component code ...
};

export default Dashboard; 