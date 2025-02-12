import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth, } from '../Pages/AuthContext';
import Login from '../Pages/Login';
import Register from '../Pages/Register';
import Dashboard from '../Pages/Dashboard';
import ResetPassword from '../Pages/ResetPassword';
import AdminDashboard from '../Pages/AdminDashboard';
import AdminRoute from '../Pages/AdminRoute';
import PrivateRoute from '../Pages/PrivateRoute';
import AdminRegistration from '../Pages/AdminRegistration';
import AttendancePage from '../Pages/AttendancePage';
import SecurityLogsPage from '../Pages/SecurityLogs';
import EnergyUsagePage from '../Pages/EnergyUsagePage';
import StudentDashboard from '../Pages/StudentDashboard';
import Reports from '../Pages/Reports';
import Users from '../Pages/Users';
import Schedules from '../Pages/Schedules';
import TeachersPage from '../Pages/TeachersPage';
import StudentsPage from '../Pages/StudentsPage';
import SettingsPage from '../Pages/SettingsPage';
import Subjects from '../Pages/Subjects';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/adminregistration" element={<AdminRegistration />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/attendance" element={<PrivateRoute><AttendancePage instructorfullName='' /></PrivateRoute>} />
          <Route path="/securitylogs" element={<PrivateRoute><SecurityLogsPage /></PrivateRoute>} />
          <Route path="/energyusage" element={<PrivateRoute><EnergyUsagePage /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="/studentdashboard" element={<PrivateRoute><StudentDashboard /></PrivateRoute>} />
          <Route path="/subjects" element={<PrivateRoute><Subjects /></PrivateRoute>} />
          <Route path="/schedules" element={<PrivateRoute><Schedules /></PrivateRoute>} />
          <Route path="/teachers" element={<PrivateRoute><TeachersPage /></PrivateRoute>} />
          <Route path="/schedules" element={<PrivateRoute><Schedules /></PrivateRoute>} />
          <Route path="/students" element={<PrivateRoute><StudentsPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />

          {/* Admin Protected routes */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-indigo-600 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
          Go back home
        </Link>
      </div>
    </div>
  );
};

export default App;
