// Import from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Config
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
const analytics = getAnalytics(app);
const db = getDatabase(app);

// Export database so index.js can use it
export { db };
