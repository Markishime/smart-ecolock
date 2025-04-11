import React, { useState, useEffect } from 'react';
import { useAuth } from '../Pages/AuthContext';
import { db, storage } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { motion } from 'framer-motion';
import { 
  UserIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  CameraIcon,
  IdentificationIcon,
  PhoneIcon,
  HomeIcon,
  CakeIcon,
  CalendarIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import StudentNavbar from '../components/StudentNavbar';

// Define interface for student data
interface StudentData {
  fullName: string;
  department: string;
  section: string;
  email: string;
  photoURL?: string;
  idNumber?: string;
  phoneNumber?: string;
  address?: string;
  dateOfBirth?: string;
  enrollmentDate?: string;
  [key: string]: any; // For flexibility with unknown fields
}

const StudentProfile: React.FC = () => {
  const { currentUser } = useAuth();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!currentUser) return;

      setIsLoading(true);
      try {
        // Fetch student data
        const studentRef = doc(db, 'students', currentUser.uid);
        const studentSnap = await getDoc(studentRef);

        if (!studentSnap.exists()) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Student data not found.',
          });
          setIsLoading(false);
          return;
        }

        const student = studentSnap.data() as StudentData;
        // Ensure email is set (fallback to currentUser.email if not in Firestore)
        student.email = student.email || currentUser.email || 'N/A';
        setStudentData(student);
      } catch (error) {
        console.error('Error fetching student data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to fetch your profile.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [currentUser]);

  // Handle photo file selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid File Type',
          text: 'Please upload a JPEG, PNG, or GIF image.',
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        Swal.fire({
          icon: 'error',
          title: 'File Too Large',
          text: 'Please upload an image smaller than 5MB.',
        });
        return;
      }

      setPhotoFile(file);
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = async () => {
    if (!photoFile || !currentUser || !studentData) return;

    try {
      // Upload photo to Firebase Storage
      const storageRef = ref(storage, `profile-photos/${currentUser.uid}/${photoFile.name}`);
      await uploadBytes(storageRef, photoFile);
      const photoURL = await getDownloadURL(storageRef);

      // Update Firestore with new photo URL
      const studentRef = doc(db, 'students', currentUser.uid);
      await updateDoc(studentRef, { photoURL });

      // Update local state
      setStudentData({ ...studentData, photoURL });
      setPhotoFile(null);
      setPhotoPreview(null);

      Swal.fire({
        icon: 'success',
        title: 'Profile Photo Updated',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to upload profile photo.',
      });
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    // Validate passwords
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (!currentUser || !currentUser.email) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'User not authenticated.',
      });
      return;
    }

    try {
      // Re-authenticate the user (Firebase requires recent authentication for sensitive operations)
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update the password
      await updatePassword(currentUser, newPassword);

      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);

      Swal.fire({
        icon: 'success',
        title: 'Password Updated',
        text: 'Your password has been successfully updated.',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        setPasswordError('Current password is incorrect.');
      } else if (error.code === 'auth/requires-recent-login') {
        Swal.fire({
          icon: 'error',
          title: 'Session Expired',
          text: 'Please log in again to update your password.',
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to update password. Please try again.',
        });
      }
    }
  };

  // Clean up preview URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  if (!studentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white font-mono">
      {/* StudentNavbar */}
      <StudentNavbar
        student={{
          fullName: studentData.fullName,
          department: studentData.department,
          section: studentData.section,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center mb-8"
        >
          <UserIcon className="h-8 w-8 text-cyan-400 mr-3" />
          <h1 className="text-3xl font-bold text-cyan-100">Your Profile</h1>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg p-6 border border-cyan-800 max-w-md mx-auto"
          >
            {/* Profile Photo */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                <img
                  src={photoPreview || studentData.photoURL || 'https://via.placeholder.com/150'}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover border-4 border-cyan-800"
                />
                <label
                  htmlFor="photo-upload"
                  className="absolute bottom-0 right-0 bg-cyan-600 p-2 rounded-full cursor-pointer hover:bg-cyan-700 transition-colors"
                >
                  <CameraIcon className="h-6 w-6 text-white" />
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>
              {photoFile && (
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={handlePhotoUpload}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Upload Photo
                  </button>
                  <button
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Profile Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-cyan-400" />
                  Full Name
                </span>
                <span className="text-sm font-medium text-cyan-100">{studentData.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 flex items-center">
                  <AcademicCapIcon className="h-5 w-5 mr-2 text-cyan-400" />
                  Department
                </span>
                <span className="text-sm font-medium text-cyan-100">{studentData.department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 flex items-center">
                  <BuildingOfficeIcon className="h-5 w-5 mr-2 text-cyan-400" />
                  Section
                </span>
                <span className="text-sm font-medium text-cyan-100">{studentData.section}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 flex items-center">
                  <EnvelopeIcon className="h-5 w-5 mr-2 text-cyan-400" />
                  Email
                </span>
                <span className="text-sm font-medium text-cyan-100">{studentData.email}</span>
              </div>
              {studentData.idNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 flex items-center">
                    <IdentificationIcon className="h-5 w-5 mr-2 text-cyan-400" />
                    ID Number
                  </span>
                  <span className="text-sm font-medium text-cyan-100">{studentData.idNumber}</span>
                </div>
              )}
              {studentData.phoneNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 flex items-center">
                    <PhoneIcon className="h-5 w-5 mr-2 text-cyan-400" />
                    Phone Number
                  </span>
                  <span className="text-sm font-medium text-cyan-100">{studentData.phoneNumber}</span>
                </div>
              )}
              {studentData.address && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 flex items-center">
                    <HomeIcon className="h-5 w-5 mr-2 text-cyan-400" />
                    Address
                  </span>
                  <span className="text-sm font-medium text-cyan-100">{studentData.address}</span>
                </div>
              )}
              {studentData.dateOfBirth && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 flex items-center">
                    <CakeIcon className="h-5 w-5 mr-2 text-cyan-400" />
                    Date of Birth
                  </span>
                  <span className="text-sm font-medium text-cyan-100">{studentData.dateOfBirth}</span>
                </div>
              )}
              {studentData.enrollmentDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 flex items-center">
                    <CalendarIcon className="h-5 w-5 mr-2 text-cyan-400" />
                    Enrollment Date
                  </span>
                  <span className="text-sm font-medium text-cyan-100">{studentData.enrollmentDate}</span>
                </div>
              )}
              {/* Display any additional fields */}
              {Object.keys(studentData).map((key) => {
                if (
                  ![
                    'fullName',
                    'department',
                    'section',
                    'email',
                    'photoURL',
                    'idNumber',
                    'phoneNumber',
                    'address',
                    'dateOfBirth',
                    'enrollmentDate',
                    'enrolledSubjects', // Exclude fields that are arrays or not meant for display
                  ].includes(key)
                ) {
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-400 flex items-center">
                        <UserIcon className="h-5 w-5 mr-2 text-cyan-400" />
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                      <span className="text-sm font-medium text-cyan-100">{studentData[key]}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            {/* Change Password Section */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="flex items-center text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <LockClosedIcon className="h-5 w-5 mr-2" />
                {showPasswordForm ? 'Cancel' : 'Change Password'}
              </button>
              {showPasswordForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-4"
                  onSubmit={handlePasswordChange}
                >
                  <div>
                    <label className="text-sm text-gray-400 flex items-center">
                      <LockClosedIcon className="h-5 w-5 mr-2 text-cyan-400" />
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full mt-1 p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 flex items-center">
                      <LockClosedIcon className="h-5 w-5 mr-2 text-cyan-400" />
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full mt-1 p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 flex items-center">
                      <LockClosedIcon className="h-5 w-5 mr-2 text-cyan-400" />
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full mt-1 p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                      required
                    />
                  </div>
                  {passwordError && (
                    <p className="text-sm text-red-400">{passwordError}</p>
                  )}
                  <button
                    type="submit"
                    className="w-full bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors"
                  >
                    Update Password
                  </button>
                </motion.form>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default StudentProfile;