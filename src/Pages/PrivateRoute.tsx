import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface PrivateRouteProps {
  children: JSX.Element;
  roles?: ('admin' | 'instructor' | 'student')[];
}

const PrivateRoute = ({ children, roles }: PrivateRouteProps) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check if user has required role
  if (roles && !roles.includes(currentUser.role as any)) {
    // Redirect to appropriate dashboard based on user's role
    const roleRoutes = {
      admin: '/admin/dashboard',
      instructor: '/instructor/dashboard',
      student: '/students/dashboard'
    };
    return <Navigate to={roleRoutes[currentUser.role as keyof typeof roleRoutes] || '/login'} replace />;
  }

  return children;
};

export default PrivateRoute;