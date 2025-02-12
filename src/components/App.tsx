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
import Schedules from '../Pages/AdminSchedules';
import TeachersPage from '../Pages/TeachersPage';
import StudentsPage from '../Pages/StudentsPage';
import SettingsPage from '../Pages/SettingsPage';
import Subjects from '../Pages/Subjects';
import ClassesPage from '../Pages/ClassesPage';
import Departments from '../Pages/Departments';
import InstructorSchedules from '../Pages/Schedules';

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/adminregistration" element={<AdminRegistration />} />

          {/* Admin routes */}
          <Route path="/admin/dashboard" element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute roles={['admin']}><Users /></PrivateRoute>} />
          <Route path="/admin/schedules" element={<PrivateRoute roles={['admin']}><Schedules /></PrivateRoute>} />
          <Route path="/admin/reports" element={<PrivateRoute roles={['admin']}><Reports /></PrivateRoute>} />
          <Route path="/admin/security-logs" element={<PrivateRoute roles={['admin']}><SecurityLogsPage /></PrivateRoute>} />
          <Route path="/admin/settings" element={<PrivateRoute roles={['admin']}><SettingsPage /></PrivateRoute>} />
          <Route path="/admin/departments" element={<PrivateRoute roles={['admin']}><Departments /></PrivateRoute>} />
          <Route path="/admin/energyusage" element={<PrivateRoute roles={['admin']}><EnergyUsagePage /></PrivateRoute>} />

          {/* Instructor routes */}
          <Route path="/instructor/dashboard" element={<PrivateRoute roles={['instructor']}><Dashboard /></PrivateRoute>} />
          <Route path="/instructor/attendance" element={<PrivateRoute roles={['instructor']}><AttendancePage instructorfullName='' /></PrivateRoute>} />
          <Route path="/instructor/subjects" element={<PrivateRoute roles={['instructor']}><Subjects /></PrivateRoute>} />
          <Route path="/instructor/schedules" element={<PrivateRoute roles={['instructor']}><InstructorSchedules /></PrivateRoute>} />
          <Route path="/instructor/classes" element={<PrivateRoute roles={['instructor']}><ClassesPage /></PrivateRoute>} />

          {/* Student routes */}
          <Route path="/students/dashboard" element={<PrivateRoute roles={['student']}><StudentDashboard /></PrivateRoute>} />
          <Route path="/students/attendance" element={<PrivateRoute roles={['student']}><AttendancePage instructorfullName='' /></PrivateRoute>} />

          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
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
