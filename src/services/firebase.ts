import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy_project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase safely
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.warn("Firebase initialization failed. Using dummy app for demo mode.");
  app = initializeApp({ apiKey: "dummy", projectId: "dummy" });
}

export const auth = getAuth(app);
// Use long polling for better resilience in proxied or restricted network environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);

// Increase retry limits for better resilience on unstable networks
storage.maxUploadRetryTime = 1200000; // 20 minutes
storage.maxOperationRetryTime = 1200000; // 20 minutes
