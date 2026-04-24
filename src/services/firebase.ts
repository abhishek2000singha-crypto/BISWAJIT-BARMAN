import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration from the auto-generated file
import firebaseConfig from '../../firebase-applet-config.json';

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
// Respect the named database if provided in the config
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ...(firebaseConfig.firestoreDatabaseId ? { databaseId: firebaseConfig.firestoreDatabaseId } : {})
});

export const storage = getStorage(app);

// Determine if we are in demo mode based on the API key
const API_KEY = firebaseConfig.apiKey;
export const isDemoMode = !API_KEY || 
  API_KEY === "dummy_key" || 
  API_KEY.includes("YOUR_") || 
  API_KEY.includes("API_KEY") ||
  API_KEY === "undefined" ||
  API_KEY === "null" ||
  API_KEY.length < 20; // Real Firebase API keys are typically ~39 chars

// Increase retry limits for better resilience on unstable networks
storage.maxUploadRetryTime = 1200000; // 20 minutes
storage.maxOperationRetryTime = 1200000; // 20 minutes
