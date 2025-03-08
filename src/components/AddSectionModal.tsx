import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { theme } from '../styles/theme';

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [sectionName, setSectionName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      name: sectionName,
      students: []
    });
    
    resetForm();
  };

  const resetForm = () => {
    setSectionName('');
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
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden"
      >
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className={theme.typography.h3}>Add New Section</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section Name
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className={theme.components.input}
              placeholder="e.g., BSIT-3A"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 mt-6 border-t">
            <button
              type="button"
              onClick={() => {
                onClose();
                resetForm();
              }}
              className={theme.components.button.secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={theme.components.button.primary}
              disabled={!sectionName}
            >
              Create Section
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AddSectionModal;