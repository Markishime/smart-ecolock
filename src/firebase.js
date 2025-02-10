// firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDQIMqO4bJ-k4-pjjGnHGwCbCYUFUQe7Hw",
    authDomain: "smartecolock.firebaseapp.com",
    projectId: "smartecolock",
    storageBucket: "smartecolock.firebasestorage.app",
    messagingSenderId: "300630412358",
    appId: "1:300630412358:web:44afc1a224507ccb764e47",
    measurementId: "G-PNBNJ39FE0"
  };
  
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
