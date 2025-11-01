// firebase.js — Firebase Realtime Database config and exports for MBBS Financial Records

// Import Firebase SDK modules from CDN (browser-safe)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

// Optional: analytics (not needed but harmless)
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-analytics.js";

// Your Firebase config (you already created this)
const firebaseConfig = {
  apiKey: "AIzaSyADSxtX0bNk8PKOMcVmAqWOgIXk6f5vNsI",
  authDomain: "mbbs-financial.firebaseapp.com",
  databaseURL:
    "https://mbbs-financial-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mbbs-financial",
  storageBucket: "mbbs-financial.firebasestorage.app",
  messagingSenderId: "670206142011",
  appId: "1:670206142011:web:1c7bb906ae45707d8dde1e",
  measurementId: "G-TQSV6S6TJX",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
getAnalytics(app);

// Initialize Realtime Database
const db = getDatabase(app);

// Export database utilities for index.js
export { db, ref, set, onValue };
