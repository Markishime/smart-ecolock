// firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyCnBauXgFmxyWWO5VHcGUNToGy7lulbN6E",
  authDomain: "smartecolock-94f5a.firebaseapp.com",
  databaseURL: "https://smartecolock-94f5a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartecolock-94f5a",
  storageBucket: "smartecolock-94f5a.firebasestorage.app",
  messagingSenderId: "969191580797",
  appId: "1:969191580797:web:128057ff7ebe656c3ffd14",
  measurementId: "G-Q7GMNE9Q52"
};
  
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export const handleRFIDRegistration = async (uid) => {
  try {
    // Check if the UID already exists in the UIDs collection
    const uidRef = doc(db, 'UIDs', uid);
    const uidDoc = await getDoc(uidRef);

    if (uidDoc.exists()) {
      // UID is already registered
      return {
        success: false,
        message: 'This RFID tag is already registered.',
        existingUser: uidDoc.data()
      };
    }

    // If not registered, return success and the UID for registration
    return {
      success: true,
      uid: uid
    };
  } catch (error) {
    console.error('RFID Registration Error:', error);
    return {
      success: false,
      message: 'An error occurred while processing the RFID tag.'
    };
  }
};

export const listenForNewRFIDTag = (callback) => {
  const rfidRef = ref(rtdb, 'NewRFIDTag');
  
  const unsubscribe = onValue(rfidRef, (snapshot) => {
    const uid = snapshot.val();
    if (uid) {
      callback(uid);
    }
  });

  // Return the unsubscribe function to allow cleanup
  return unsubscribe;
};
