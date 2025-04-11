import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from '../Pages/AuthContext';
import Login from '../Pages/Login';
import Dashboard from '../Pages/Dashboard';
import ResetPassword from '../Pages/ResetPassword';
import AdminDashboard from '../Pages/AdminDashboard';
import PrivateRoute from '../Pages/PrivateRoute';
import AdminRegistration from '../Pages/AdminRegistration';
import AttendancePage from '../Pages/AttendancePage';
import SecurityLogsPage from '../Pages/SecurityLogs';
import EnergyUsagePage from '../Pages/EnergyUsagePage';
import StudentDashboard from '../Pages/StudentDashboard';
import Reports from '../Pages/Reports';
import Users from '../Pages/Users';
import SettingsPage from '../Pages/SettingsPage';
import ClassesPage from '../Pages/ClassesPage';
import InstructorSchedules from '../Pages/Schedules';
import AdminSchedules from '../Pages/AdminSchedules';
import TakeAttendance from '../Pages/TakeAttendance';
import RFIDRegistrationPage from '../Pages/Register';
import AdminSections from '../Pages/AdminSectionPage';
import RoomsPage from '../Pages/RoomsPage';
import AttendanceManagement from '../Pages/AttendanceManagement';
import SubjectSelection from '../Pages/SubjectSelection';
import SubjectsManagement from '../Pages/SubjectManagement';
import StudentSchedules from '../Pages/StudentsSchedules';
import StudentProfile from '../Pages/StudentProfile';
import { useParams } from 'react-router-dom';

// Wrapper component to pass instructorName from URL params
const AttendancePageWrapper: React.FC = () => {
  const { instructorName } = useParams<{ instructorName: string }>();
  return <AttendancePage instructorName={instructorName} />;
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/adminregistration" element={<AdminRegistration />} />
          <Route path="/rfid-registration" element={<RFIDRegistrationPage />} />

          {/* Admin routes */}
          <Route
            path="/admin/dashboard"
            element={
              <PrivateRoute roles={['admin']}>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <PrivateRoute roles={['admin']}>
                <Users />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/insights"
            element={
              <PrivateRoute roles={['admin']}>
                <Reports />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/security-logs"
            element={
              <PrivateRoute roles={['admin']}>
                <SecurityLogsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <PrivateRoute roles={['admin']}>
                <SettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/energyusage"
            element={
              <PrivateRoute roles={['admin']}>
                <EnergyUsagePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/schedules"
            element={
              <PrivateRoute roles={['admin']}>
                <AdminSchedules />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/sections"
            element={
              <PrivateRoute roles={['admin']}>
                <AdminSections />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/rooms"
            element={
              <PrivateRoute roles={['admin']}>
                <RoomsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/subjects-management"
            element={
              <PrivateRoute roles={['admin']}>
                <SubjectsManagement />
              </PrivateRoute>
            }
          />

          {/* Instructor routes */}
          <Route
            path="/instructor/dashboard"
            element={
              <PrivateRoute roles={['instructor']}>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/instructor/schedules"
            element={
              <PrivateRoute roles={['instructor']}>
                <InstructorSchedules />
              </PrivateRoute>
            }
          />
          <Route
            path="/instructor/classes"
            element={
              <PrivateRoute roles={['instructor']}>
                <ClassesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/instructor/settings"
            element={
              <PrivateRoute roles={['instructor']}>
                <SettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/instructor/take-attendance"
            element={
              <PrivateRoute roles={['instructor']}>
                <TakeAttendance />
              </PrivateRoute>
            }
          />
          <Route
            path="/instructor/attendance-management"
            element={
              <PrivateRoute roles={['instructor']}>
                <AttendanceManagement />
              </PrivateRoute>
            }
          />

          {/* Student routes */}
          <Route
            path="/student/dashboard"
            element={
              <PrivateRoute roles={['student']}>
                <StudentDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/attendance/:instructorName?"
            element={
              <PrivateRoute roles={['student']}>
                <AttendancePageWrapper />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/subject-selection"
            element={
              <PrivateRoute roles={['student']}>
                <SubjectSelection />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/student-schedules"
            element={
              <PrivateRoute roles={['student']}>
                <StudentSchedules />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/settings"
            element={
              <PrivateRoute roles={['student']}>
                <SettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/profile"
            element={
              <PrivateRoute roles={['student']}>
                <StudentProfile />
              </PrivateRoute>
            }
          />

          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Catch-all route for 404 */}
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
        <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
          Go to Login
        </Link>
      </div>
    </div>
  );
};

export default App;