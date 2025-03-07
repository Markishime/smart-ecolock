import React, { createContext, useState, useContext, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Enhanced user type with role and other properties
interface EnrichedUser extends FirebaseUser {
  role?: 'admin' | 'instructor' | 'student';
  fullName?: string;
  department?: string;
  adminPermissions?: boolean;
  idNumber?: string;
}

// Admin data structure
interface AdminData {
  id: string;
  email: string;
  idNumber: string;
  role: string;
  fullName: string;
}

// Auth context type definition
interface AuthContextType {
  currentUser: EnrichedUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  setUser: (user: { uid: string } & AdminData) => Promise<void>;
}

// Create context with default values
const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<EnrichedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Function to get user data from Firestore
  const getUserData = async (user: FirebaseUser): Promise<EnrichedUser> => {
    try {
      // First check localStorage for cached data
      const cachedUserData = localStorage.getItem('userData');
      const cachedUserRole = localStorage.getItem('userRole');
      
      if (cachedUserData && cachedUserRole) {
        const userData = JSON.parse(cachedUserData);
        return {
          ...user,
          role: cachedUserRole as 'admin' | 'instructor' | 'student',
          fullName: userData.fullName,
          department: userData.department,
          idNumber: userData.idNumber
        };
      }

      // Check admin collection
      const adminQuery = query(
        collection(db, 'users'),
        where('idNumber', '==', user.email?.split('@')[0]),
        where('role', '==', 'admin')
      );
      const adminSnapshot = await getDocs(adminQuery);
      
      if (!adminSnapshot.empty) {
        const adminData = adminSnapshot.docs[0].data();
        const enrichedUser = {
          ...user,
          role: 'admin' as 'admin',
          fullName: adminData.fullName,
          department: adminData.department,
          idNumber: adminData.idNumber
        };
        
        // Cache the user data
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('userData', JSON.stringify({
          fullName: adminData.fullName,
          department: adminData.department,
          idNumber: adminData.idNumber
        }));
        
        return enrichedUser;
      }

      // Check teachers collection
      const teacherDoc = await getDoc(doc(db, 'teachers', user.uid));
      if (teacherDoc.exists()) {
        const userData = teacherDoc.data();
        const enrichedUser = {
          ...user,
          role: 'instructor' as 'instructor',
          fullName: userData.fullName,
          department: userData.department
        };
        
        // Cache the user data
        localStorage.setItem('userRole', 'instructor');
        localStorage.setItem('userData', JSON.stringify({
          fullName: userData.fullName,
          department: userData.department
        }));
        
        return enrichedUser;
      }

      // Check students collection
      const studentDoc = await getDoc(doc(db, 'students', user.uid));
      if (studentDoc.exists()) {
        const userData = studentDoc.data();
        const enrichedUser = {
          ...user,
          role: 'student' as 'student',
          fullName: userData.fullName,
          department: userData.department
        };
        
        // Cache the user data
        localStorage.setItem('userRole', 'student');
        localStorage.setItem('userData', JSON.stringify({
          fullName: userData.fullName,
          department: userData.department
        }));
        
        return enrichedUser;
      }

      return user;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return user;
    }
  };

  // Handle navigation based on user role
  const handleNavigation = (user: EnrichedUser | null) => {
    if (!user || !user.role) return;

    const publicPaths = ['/', '/login', '/admin/login', '/register'];
    const currentPath = location.pathname;
    
    // Don't redirect if user is already on a role-specific page
    if (currentPath.includes(`/${user.role}/`)) return;
    
    // Don't redirect if user just logged out and is on a public page
    if (!user && publicPaths.includes(currentPath)) return;

    // Role-specific redirects
    const routes = {
      admin: '/admin/dashboard',
      instructor: '/instructor/dashboard',
      student: '/student/dashboard'
    };

    // Only redirect if user is on a public page or wrong role page
    if (publicPaths.includes(currentPath) || 
        (currentPath.includes('/admin/') && user.role !== 'admin') ||
        (currentPath.includes('/instructor/') && user.role !== 'instructor') ||
        (currentPath.includes('/student/') && user.role !== 'student')) {
      navigate(routes[user.role], { replace: true });
    }
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const enrichedUser = await getUserData(user);
          setCurrentUser(enrichedUser);
          handleNavigation(enrichedUser);
        } else {
          setCurrentUser(null);
          localStorage.removeItem('userRole');
          localStorage.removeItem('userData');
          
          // Redirect to login if on protected route
          const currentPath = location.pathname;
          if (currentPath.includes('/admin/') || 
              currentPath.includes('/instructor/') || 
              currentPath.includes('/student/')) {
            navigate('/login', { replace: true });
          }
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, location]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      // Format email if needed
      const loginEmail = email.includes('@') ? email : `${email}@yourdomain.com`;
      
      // Sign in with Firebase
      const { user } = await signInWithEmailAndPassword(auth, loginEmail, password);
      
      // Get user data and update state
      const enrichedUser = await getUserData(user);
      setCurrentUser(enrichedUser);
      
      // Navigation will be handled by the auth state listener
      return Promise.resolve();
    } catch (error) {
      console.error("Login error:", error);
      return Promise.reject(error);
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (email: string, password: string, userData: any): Promise<void> => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', user.uid), {
      ...userData,
      createdAt: new Date().toISOString()
    });
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      localStorage.removeItem('userData');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  // Set user function for admin login
  const setUser = async (user: { uid: string } & AdminData) => {
    try {
      const enrichedUser = {
        ...auth.currentUser,
        ...user,
        role: 'admin'
      } as EnrichedUser;
      
      setCurrentUser(enrichedUser);
      
      // Cache admin data
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('userData', JSON.stringify({
        fullName: user.fullName,
        idNumber: user.idNumber,
        email: user.email
      }));
      
      // Navigate to admin dashboard
      navigate('/admin/dashboard', { replace: true });
      
      return Promise.resolve();
    } catch (error) {
      console.error("Set user error:", error);
      return Promise.reject(error);
    }
  };

  const value = {
    currentUser,
    login,
    register,
    logout,
    loading,
    setUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : <div>Loading...</div>}
    </AuthContext.Provider>
  );
};