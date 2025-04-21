// firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { getStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey: "AIzaSyChJnuCK7QY2EXPTtF9Obp7mWyZXGfzsTE",
  authDomain: "acs-test-3e9f7.firebaseapp.com",
  databaseURL: "https://acs-test-3e9f7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "acs-test-3e9f7",
  storageBucket: "acs-test-3e9f7.firebasestorage.app",
  messagingSenderId: "488154646618",
  appId: "1:488154646618:web:bce97845a4a2a9c15b3063",
  measurementId: "G-BV4DB5HFLX"
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
