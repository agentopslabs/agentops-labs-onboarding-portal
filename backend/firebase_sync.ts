import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc 
} from "firebase/firestore";

// Read configuration from the config file in the workspace root
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (err) {
  console.warn("[Firebase Sync] Failed to load firebase-applet-config.json:", err);
}

// Fallback or override with environment variables
firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  appId: process.env.FIREBASE_APP_ID || firebaseConfig.appId,
  apiKey: process.env.FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "(default)",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId
};

const isPlaceholder = !firebaseConfig.projectId || firebaseConfig.projectId === "YOUR_AGENTOPS_PROJECT_ID";


// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID from config
const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

const collectionsInfo = [
  { name: "users", key: "users", type: "array" },
  { name: "passwords", key: "passwords", type: "map" },
  { name: "applications", key: "applications", type: "array" },
  { name: "documents", key: "documents", type: "array" },
  { name: "tests", key: "tests", type: "array" },
  { name: "assignedTests", key: "assignedTests", type: "array" },
  { name: "checklists", key: "checklists", type: "array" },
  { name: "activityLogs", key: "activityLogs", type: "array" },
  { name: "emails", key: "emails", type: "array" },
  { name: "notifications", key: "notifications", type: "array" },
  { name: "annotations", key: "annotations", type: "array" },
  { name: "messages", key: "messages", type: "array" },
  { name: "tasks", key: "tasks", type: "array" },
  { name: "taskSubmissions", key: "taskSubmissions", type: "array" },
  { name: "attendance", key: "attendance", type: "array" },
  { name: "leaves", key: "leaves", type: "array" }
];

const getId = (item: any, colName: string): string => {
  if (colName === "applications") return item.employeeId;
  return item.id;
};

/**
 * Loads database state from Google Firestore into the provided in-memory db object.
 * Fetch all collections concurrently for speed.
 */
export async function loadFromFirestore(memoryDb: any): Promise<boolean> {
  if (isPlaceholder) {
    console.log("[Firebase Sync] Firebase Project ID is placeholder or missing, bypassing Firestore load.");
    return false;
  }
  try {
    const promises = collectionsInfo.map(async (colInfo) => {
      try {
        const colRef = collection(firestoreDb, colInfo.name);
        const snapshot = await getDocs(colRef);
        
        if (colInfo.type === "array") {
          memoryDb[colInfo.key] = snapshot.docs.map(doc => doc.data());
        } else {
          // Map type (e.g. passwords)
          memoryDb[colInfo.key] = {};
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            memoryDb[colInfo.key][doc.id] = data.password;
          });
        }
      } catch (colErr: any) {
        console.warn(`[Firebase Sync] Failed to load collection "${colInfo.name}" (it may lack cloud rules):`, colErr.message || colErr);
        // Ensure memoryDb key is initialized to prevent undefined crashes
        if (!(colInfo.key in memoryDb)) {
          memoryDb[colInfo.key] = colInfo.type === "array" ? [] : {};
        }
      }
    });

    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error("[Firebase Sync] Critical error in loadFromFirestore:", err);
    return false;
  }
}

/**
 * Synchronizes the local memory database state to Google Firestore concurrently.
 */
export async function syncToFirestore(memoryDb: any): Promise<void> {
  if (isPlaceholder) {
    console.log("[Firebase Sync] Firebase Project ID is placeholder or missing, bypassing Firestore sync.");
    return;
  }
  try {
    const promises = collectionsInfo.map(async (colInfo) => {
      try {
        const colRef = collection(firestoreDb, colInfo.name);
        const snapshot = await getDocs(colRef);
        const existingIds = new Set(snapshot.docs.map(doc => doc.id));
        const subPromises: Promise<any>[] = [];

        if (colInfo.type === "array") {
          const items = memoryDb[colInfo.key] || [];
          
          // Write/update current items
          for (const item of items) {
            const id = getId(item, colInfo.name);
            if (id) {
              const docRef = doc(firestoreDb, colInfo.name, id);
              subPromises.push(setDoc(docRef, item));
            }
          }

          // Delete items that are no longer in memoryDb
          for (const existingId of existingIds) {
            const isStillPresent = items.some((item: any) => getId(item, colInfo.name) === existingId);
            if (!isStillPresent) {
              const docRef = doc(firestoreDb, colInfo.name, existingId);
              subPromises.push(deleteDoc(docRef));
            }
          }
        } else {
          // map type (passwords)
          const passwordsMap = memoryDb[colInfo.key] || {};
          
          // Write/update current passwords
          for (const [userId, password] of Object.entries(passwordsMap)) {
            const docRef = doc(firestoreDb, colInfo.name, userId);
            subPromises.push(setDoc(docRef, { id: userId, password }));
          }

          // Delete passwords that are no longer in memoryDb
          for (const existingId of existingIds) {
            if (!(existingId in passwordsMap)) {
              const docRef = doc(firestoreDb, colInfo.name, existingId);
              subPromises.push(deleteDoc(docRef));
            }
          }
        }

        await Promise.all(subPromises);
      } catch (colErr: any) {
        console.warn(`[Firebase Sync] Failed to sync collection "${colInfo.name}" (it may lack cloud rules):`, colErr.message || colErr);
      }
    });

    await Promise.all(promises);
    console.log("[Firebase Sync] Completed sync attempt to Firestore.");
  } catch (err) {
    console.error("[Firebase Sync] Critical error in syncToFirestore:", err);
  }
}
