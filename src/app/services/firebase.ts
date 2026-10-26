
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDUb9W7ndMXMWYrCLZdNwwqHaJcCL9mmG8',
  authDomain: 'ojt-progresstrack-cf8b4.firebaseapp.com',
  projectId: 'ojt-progresstrack-cf8b4',
  storageBucket: 'ojt-progresstrack-cf8b4.firebasestorage.app',
  messagingSenderId: '280929237361',
  appId: '1:280929237361:web:ea8bf0fa40ea6fb1075ed0'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const studentCreationApp = initializeApp(
  firebaseConfig,
  'studentCreationApp'
);
export const studentCreationAuth = getAuth(studentCreationApp);

export const db = getFirestore(app, '(default)');
