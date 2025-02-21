import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';

interface EnrichedUser extends FirebaseUser {
  role?: 'admin' | 'instructor' | 'student';
  fullName?: string;
  department?: string;
  adminPermissions?: boolean;
}

interface AuthContextType {
  currentUser: EnrichedUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<EnrichedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const getUserData = async (user: FirebaseUser) => {
    try {
      // First check admin users collection
      const adminDoc = await getDoc(doc(db, 'users', user.uid));
      if (adminDoc.exists()) {
        const userData = adminDoc.data();
        return {
          ...user,
          role: 'admin',
          fullName: userData.fullName,
          department: userData.department
        };
      }

      // Then check teachers collection
      const teacherDoc = await getDoc(doc(db, 'teachers', user.uid));
      if (teacherDoc.exists()) {
        const userData = teacherDoc.data();
        return {
          ...user,
          role: 'instructor',
          fullName: userData.fullName,
          department: userData.department
        };
      }

      // Finally check students collection
      const studentDoc = await getDoc(doc(db, 'students', user.uid));
      if (studentDoc.exists()) {
        const userData = studentDoc.data();
        return {
          ...user,
          role: 'student',
          fullName: userData.fullName,
          department: userData.department
        };
      }

      return user;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return user;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const enrichedUser = (await getUserData(user)) as EnrichedUser;
        setCurrentUser(enrichedUser);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const enrichedUser = await getUserData(user) as EnrichedUser;
      setCurrentUser(enrichedUser);
      
      if (enrichedUser.role) {
        const roleRoutes = {
          admin: '/admin/dashboard',
          instructor: '/instructor/dashboard',
          student: '/students/dashboard'
        };
        console.log('Redirecting to:', roleRoutes[enrichedUser.role]); // Debug log
        navigate(roleRoutes[enrichedUser.role], { replace: true });
      } else {
        throw new Error('User role not found');
      }
    } catch (error: any) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const register = async (email: string, password: string, userData: any): Promise<void> => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      // Additional user data will be saved in the appropriate collection
      // based on the role in the registration process
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const value = {
    currentUser,
    login,
    register,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};