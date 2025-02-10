import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const storedAdminStatus = localStorage.getItem('isAdmin');

    if (storedAdminStatus) {
      setIsAdmin(JSON.parse(storedAdminStatus));
    } else {
      setIsAdmin(false); // Default to false if nothing is stored
    }
  }, []);

  useEffect(() => {
    if (isAdmin === false && location.pathname.startsWith('/admin')) {
      navigate('/login', { replace: true });
    }
  }, [isAdmin, location.pathname, navigate]);


  if (isAdmin === null) {
    return <div>Loading...</div>;
  }

  if (isAdmin) {
    return <>{children}</>;
  } else if (location.pathname.startsWith('/admin')) {
    return <Navigate to="/login" replace />;
  } else { // If not admin but not trying to access admin page
    return null; // Or return a different component/message if you prefer
  }
};

export default AdminRoute;