import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { theme } from '../styles/theme';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roomData: RoomData) => void;
}

interface RoomData {
  name: string;
  building: string;
  floor: string;
  capacity: number;
  type: 'classroom' | 'laboratory' | 'lecture_hall' | 'conference_room';
  status: 'available' | 'occupied' | 'maintenance';
  facilities: {
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

const AddRoomModal: React.FC<AddRoomModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<RoomData>({
    name: '',
    building: '',
    floor: '',
    capacity: 0,
    type: 'classroom',
    status: 'available',
    facilities: {
      hasProjector: false,
      hasAC: false,
      hasComputers: false,
      hasWifi: false
    },
    energyStatus: {
      lights: false,
      aircon: false,
      computers: false
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      name: '',
      building: '',
      floor: '',
      capacity: 0,
      type: 'classroom',
      status: 'available',
      facilities: {
        hasProjector: false,
        hasAC: false,
        hasComputers: false,
        hasWifi: false
      },
      energyStatus: {
        lights: false,
        aircon: false,
        computers: false
      }
    });
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
          <h2 className={theme.typography.h3}>Add New Room</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Name/Number
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={theme.components.input}
              required
              placeholder="e.g., Room 101"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Building
              </label>
              <input
                type="text"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                className={theme.components.input}
                required
                placeholder="e.g., Main Building"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Floor
              </label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className={theme.components.input}
                required
                placeholder="e.g., 1st Floor"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'classroom' | 'laboratory' | 'lecture_hall' | 'conference_room' })}
                className={theme.components.input}
                required
              >
                <option value="classroom">Classroom</option>
                <option value="laboratory">Laboratory</option>
                <option value="lecture_hall">Lecture Hall</option>
                <option value="conference_room">Conference Room</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capacity
              </label>
              <input
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                className={theme.components.input}
                required
                placeholder="e.g., 30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'available' | 'occupied' | 'maintenance' })}
              className={theme.components.input}
              required
            >
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Under Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Facilities
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.facilities.hasProjector}
                  onChange={(e) => setFormData({
                    ...formData,
                    facilities: {
                      ...formData.facilities,
                      hasProjector: e.target.checked
                    }
                  })}
                  className="rounded text-indigo-600"
                />
                <span className="text-sm text-gray-700">Projector</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.facilities.hasAC}
                  onChange={(e) => setFormData({
                    ...formData,
                    facilities: {
                      ...formData.facilities,
                      hasAC: e.target.checked
                    }
                  })}
                  className="rounded text-indigo-600"
                />
                <span className="text-sm text-gray-700">Air Conditioning</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.facilities.hasComputers}
                  onChange={(e) => setFormData({
                    ...formData,
                    facilities: {
                      ...formData.facilities,
                      hasComputers: e.target.checked
                    }
                  })}
                  className="rounded text-indigo-600"
                />
                <span className="text-sm text-gray-700">Computers</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.facilities.hasWifi}
                  onChange={(e) => setFormData({
                    ...formData,
                    facilities: {
                      ...formData.facilities,
                      hasWifi: e.target.checked
                    }
                  })}
                  className="rounded text-indigo-600"
                />
                <span className="text-sm text-gray-700">WiFi</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={theme.components.button.secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={theme.components.button.primary}
            >
              Add Room
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AddRoomModal; 