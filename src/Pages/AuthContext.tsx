import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { User, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';

interface Schedule {
  days: string[];
  startTime: string;
  endTime: string;
}

interface UserData {
  uid: string;
  email: string;
  role: 'admin' | 'instructor' | 'student' | 'superadmin';
  fullName: string;
  idNumber: string;
  mobileNumber: string;
  department: string;
  major: string;
  yearLevel?: string;
  yearsOfExperience?: string;
  sections: string[];
  schedule: Schedule;
  photoURL?: string | null;
  adminPermissions?: {
    canManageUsers?: boolean;
    canManageSubjects?: boolean;
    canViewReports?: boolean;
    canManageSchedules?: boolean;
    canAccessSecurityLogs?: boolean;
  };
}

interface AuthContextType {
  currentUser: UserData | null;
  loading: boolean;
  isAdmin: boolean;
  isInstructor: boolean;
  isStudent: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<UserData>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  currentUser: null,
  loading: true,
  isAdmin: false,
  isInstructor: false,
  isStudent: false,
  isSuperAdmin: false,
  login: async () => { throw new Error('Not implemented') },
  logout: async () => { throw new Error('Not implemented') }
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const getUserData = async (user: User): Promise<UserData | null> => {
    // Check in users collection first (for admins)
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        uid: user.uid,
        email: user.email || '',
        role: data.role,
        fullName: data.fullName,
        idNumber: data.idNumber,
        mobileNumber: data.mobileNumber,
        department: data.department,
        major: data.major,
        yearLevel: data.yearLevel,
        yearsOfExperience: data.yearsOfExperience,
        sections: data.sections || [],
        schedule: data.schedule || {
          days: [],
          startTime: '',
          endTime: ''
        },
        photoURL: user.photoURL,
        adminPermissions: data.adminPermissions
      };
    }

    // Check in instructors collection
    const instructorDoc = await getDoc(doc(db, 'teachers', user.uid));
    if (instructorDoc.exists()) {
      const data = instructorDoc.data();
      return {
        uid: user.uid,
        email: user.email || '',
        role: 'instructor',
        fullName: data.fullName,
        idNumber: data.idNumber,
        mobileNumber: data.mobileNumber,
        department: data.department,
        major: data.major,
        yearsOfExperience: data.yearsOfExperience,
        sections: data.sections || [],
        schedule: data.schedule || {
          days: [],
          startTime: '',
          endTime: ''
        },
        photoURL: user.photoURL
      };
    }

    // Check in students collection
    const studentDoc = await getDoc(doc(db, 'students', user.uid));
    if (studentDoc.exists()) {
      const data = studentDoc.data();
      return {
        uid: user.uid,
        email: user.email || '',
        role: 'student',
        fullName: data.fullName,
        idNumber: data.idNumber,
        mobileNumber: data.mobileNumber,
        department: data.department,
        major: data.major,
        yearLevel: data.yearLevel,
        sections: data.sections || [],
        schedule: data.schedule || {
          days: [],
          startTime: '',
          endTime: ''
        },
        photoURL: user.photoURL
      };
    }

    return null;
  };

  const createUserProfile = async (user: User, additionalData: Partial<UserData>) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    
    // Default permissions for different roles
    const defaultPermissions = {
      admin: {
        canManageUsers: true,
        canManageSubjects: true,
        canViewReports: true,
        canManageSchedules: true,
        canAccessSecurityLogs: true
      },
      superadmin: {
        canManageUsers: true,
        canManageSubjects: true,
        canViewReports: true,
        canManageSchedules: true,
        canAccessSecurityLogs: true
      },
      instructor: {},
      student: {}
    };

    const userProfile: UserData = {
      uid: user.uid,
      email: user.email ?? '',
      fullName: additionalData.fullName ?? '',
      role: additionalData.role ?? 'student',
      photoURL: user.photoURL ?? additionalData.photoURL ?? null,
      department: additionalData.department ?? '',
      idNumber: additionalData.idNumber ?? '',
      mobileNumber: additionalData.mobileNumber ?? '',
      major: additionalData.major ?? '',
      sections: additionalData.sections ?? [],
      schedule: additionalData.schedule ?? { days: [], startTime: '', endTime: '' },
      adminPermissions: defaultPermissions[additionalData.role ?? 'student']
    };

    await setDoc(userRef, userProfile, { merge: true });
    return userProfile;
  };

  const login = async (email: string, password: string): Promise<UserData> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await getUserData(userCredential.user);
      
      if (!userData) {
        await auth.signOut();
        throw new Error('User data not found in database');
      }

      return userData;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Login failed: ${error.message}`);
      }
      throw new Error('Login failed');
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setCurrentUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userData = await getUserData(user);
          if (userData) {
            setCurrentUser(userData);
          } else {
            await auth.signOut();
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          await auth.signOut();
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    isAdmin: currentUser?.role === 'admin',
    isInstructor: currentUser?.role === 'instructor',
    isStudent: currentUser?.role === 'student',
    isSuperAdmin: currentUser?.role === 'superadmin',
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);