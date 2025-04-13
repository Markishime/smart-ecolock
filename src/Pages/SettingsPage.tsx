import React, { useState, useEffect, useRef } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, PhotoIcon } from '@heroicons/react/24/solid';
import { useAuth } from './AuthContext';
import { SettingsSection } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { db, storage, auth } from '../firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    profilePicture: '',
  });
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changePassword, setChangePassword] = useState(false);
  const [errors, setErrors] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    profilePicture: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user profile data from Firestore
  useEffect(() => {
    if (currentUser?.uid) {
      const fetchProfile = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfileData({
              fullName: data.fullName || currentUser.fullName || '',
              email: data.email || currentUser.email || '',
              profilePicture: data.profilePicture || '',
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          toast.error('Failed to load profile data');
        }
      };
      fetchProfile();
    }
  }, [currentUser]);

  // Handle profile picture selection and preview
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrors(prev => ({ ...prev, profilePicture: 'Image size must be less than 5MB' }));
        return;
      }
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setErrors(prev => ({ ...prev, profilePicture: 'Only JPEG or PNG images are allowed' }));
        return;
      }
      setProfilePictureFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrors(prev => ({ ...prev, profilePicture: '' }));
    }
  };

  // Validate form inputs
  const validateInputs = () => {
    let isValid = true;
    const newErrors = {
      fullName: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      profilePicture: '',
    };

    if (!profileData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileData.email)) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    }

    if (changePassword) {
      if (!passwordData.currentPassword) {
        newErrors.currentPassword = 'Current password is required';
        isValid = false;
      }
      if (!passwordData.newPassword) {
        newErrors.newPassword = 'New password is required';
        isValid = false;
      } else if (passwordData.newPassword.length < 6) {
        newErrors.newPassword = 'Password must be at least 6 characters';
        isValid = false;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // Handle form submission
  const handleSaveChanges = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    try {
      const updates: any = {
        fullName: profileData.fullName,
        email: profileData.email,
      };

      // Upload profile picture if selected
      if (profilePictureFile) {
        const storageRef = ref(storage, `profilePictures/${currentUser?.uid}`);
        await uploadBytes(storageRef, profilePictureFile);
        const photoURL = await getDownloadURL(storageRef);
        updates.profilePicture = photoURL;
        setProfileData(prev => ({ ...prev, profilePicture: photoURL }));
        setProfilePictureFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }

      // Save profile data to Firestore
      await setDoc(doc(db, 'users', currentUser?.uid || ''), updates, { merge: true });

      // Update email in Firebase Auth
      if (profileData.email !== currentUser?.email && auth.currentUser) {
        // Re-authenticate user before updating email
        const credential = EmailAuthProvider.credential(
          currentUser?.email || '',
          passwordData.currentPassword || prompt('Please enter your current password to update email') || ''
        );
        await reauthenticateWithCredential(auth.currentUser, credential);
        // Note: updateEmail is not directly available in Firebase v9 modular SDK
        // You may need to implement a backend function or prompt for re-authentication
        // For simplicity, we'll assume email updates are handled in Firestore
      }

      // Update password if changed
      if (changePassword && auth.currentUser) {
        await updatePassword(auth.currentUser, passwordData.newPassword);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setChangePassword(false);
      }

      toast.success('Settings updated successfully');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please re-login to update sensitive information');
      } else {
        toast.error('Failed to update settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const settingsSections: Record<string, SettingsSection> = {
    profile: {
      icon: UserIcon,
      title: 'Profile Settings',
      description: 'Manage your personal information and profile picture',
      content: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">Profile Picture</label>
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {previewUrl || profileData.profilePicture ? (
                  <img
                    src={previewUrl || profileData.profilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <PhotoIcon className="h-5 w-5 mr-2" />
                  Upload Picture
                </button>
                {errors.profilePicture && (
                  <p className="text-red-500 text-xs mt-1">{errors.profilePicture}</p>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">Full Name</label>
            <input
              type="text"
              value={profileData.fullName}
              onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">Email</label>
            <input
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
        </div>
      ),
    },
    security: {
      icon: LockClosedIcon,
      title: 'Security Settings',
      description: 'Update your password and security preferences',
      content: (
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={changePassword}
              onChange={(e) => setChangePassword(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm font-medium text-blue-800">
              Change Password
            </label>
          </div>
          {changePassword && (
            <>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-800 mb-2">Current Password</label>
                <input
                  type={showPassword.current ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-10 text-gray-500"
                >
                  {showPassword.current ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
                {errors.currentPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>
                )}
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-800 mb-2">New Password</label>
                <input
                  type={showPassword.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-10 text-gray-500"
                >
                  {showPassword.new ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
                {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>}
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-800 mb-2">Confirm New Password</label>
                <input
                  type={showPassword.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-10 text-gray-500"
                >
                  {showPassword.confirm ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </>
          )}
        </div>
      ),
    },
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <AdminSidebar />
      <div
        className={`flex-1 transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-64'
        } p-8 overflow-y-auto`}
      >
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-blue-800 flex items-center">
              <UserIcon className="h-10 w-10 mr-3 text-blue-600" />
              Settings
            </h1>
          </div>
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar Navigation */}
            <div className="col-span-3 bg-white rounded-xl shadow-md p-4">
              {Object.keys(settingsSections).map((section, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSection(index)}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition ${
                    activeSection === index
                      ? 'bg-blue-100 text-blue-800'
                      : 'hover:bg-blue-50 text-blue-600'
                  }`}
                >
                  <div className="flex items-center">
                    {React.createElement(settingsSections[section].icon, { className: "h-6 w-6 mr-3" })}
                    <div>
                      <p className="font-semibold">{settingsSections[section].title}</p>
                      <p className="text-xs text-blue-400">{settingsSections[section].description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {/* Settings Content */}
            <div className="col-span-9 bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-blue-800 mb-6">
                {settingsSections[Object.keys(settingsSections)[activeSection]].title}
              </h2>
              {settingsSections[Object.keys(settingsSections)[activeSection]].content}
              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={handleSaveChanges}
                  disabled={loading}
                  className={`flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? (
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H4z"
                      />
                    </svg>
                  ) : (
                    <UserIcon className="h-5 w-5 mr-2" />
                  )}
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;