import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../Pages/AuthContext';
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
          <Route path="/attendance" element={<AttendancePage instructorfullName='' />} />
          <Route path="/securitylogs" element={<SecurityLogsPage />} />
          <Route path="/energyusage" element={<EnergyUsagePage />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/studentdashboard" element={<StudentDashboard />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard/></PrivateRoute>} />



           {/* Admin Protected route */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

          {/* Root redirect - ONLY if NO other routes match */}
          <Route path="/login" element={<NavigateToDefault />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
};
const NavigateToDefault = () => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const NotFound = () => {
  return (
    <div>
      <h1>404: Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      {/* You could add a "Go Home" link here */}
    </div>
  );
};

export default App;
