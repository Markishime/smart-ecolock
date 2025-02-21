import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
const db = getFirestore(app);

async function fetchData() {
  try {
    // Fetch subjects
    console.log('Fetching subjects...');
    const subjectsCollection = collection(db, 'subjects');
    const subjectSnapshot = await getDocs(subjectsCollection);
    console.log('\nSubjects:');
    subjectSnapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });

    // Fetch teachers
    console.log('\nFetching teachers...');
    const teachersCollection = collection(db, 'teachers');
    const teacherSnapshot = await getDocs(teachersCollection);
    console.log('\nTeachers:');
    teacherSnapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();
