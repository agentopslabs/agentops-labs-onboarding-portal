/**
 * Firebase Storage uploader — reads config from firebase-applet-config.json
 * 
 * Files are uploaded directly to Firebase Storage (not base64-embedded in Firestore),
 * avoiding the Firestore 1MB per-document limit.
 * 
 * Upload flow:
 *   1. Employee selects a file
 *   2. File is uploaded to Firebase Storage: documents/{employeeId}/{docType}/{fileName}
 *   3. A permanent download URL is returned
 *   4. The backend stores ONLY the tiny metadata + https:// URL in Firestore
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage
} from "firebase/storage";

// Load config dynamically from the project config file
// Update firebase-applet-config.json with your AgentOps Firebase project credentials
async function loadFirebaseConfig() {
  try {
    const res = await fetch("/firebase-applet-config.json");
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("[Firebase] Failed to load config:", e);
  }
  return null;
}

let storageInstance: FirebaseStorage | null = null;
let configLoaded = false;

async function getFirebaseStorage(): Promise<FirebaseStorage | null> {
  if (storageInstance) return storageInstance;

  const config = await loadFirebaseConfig();
  if (!config || !config.projectId || config.projectId === "YOUR_AGENTOPS_PROJECT_ID") {
    console.error("[Firebase Storage] Not configured yet. Please set up firebase-applet-config.json with your AgentOps Firebase project.");
    return null;
  }

  try {
    let app: FirebaseApp;
    if (getApps().length === 0) {
      app = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      });
    } else {
      app = getApps()[0];
    }
    storageInstance = getStorage(app);
    return storageInstance;
  } catch (e) {
    console.error("[Firebase Storage] Initialization failed:", e);
    return null;
  }
}

/**
 * Upload a file to Firebase Storage and return its permanent download URL.
 */
export async function uploadDocumentToStorage(
  file: File,
  employeeId: string,
  docType: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const st = await getFirebaseStorage();
  
  if (!st) {
    throw new Error("Firebase Storage is not configured. Please set up your AgentOps Firebase project in firebase-applet-config.json.");
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `documents/${employeeId}/${docType}/${timestamp}_${safeName}`;

  const storageRef = ref(st, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        if (onProgress) onProgress(percent);
      },
      (error) => {
        console.error("[Firebase Storage] Upload failed:", error);
        reject(new Error(`File upload failed: ${error.message}`));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (onProgress) onProgress(100);
          resolve(downloadURL);
        } catch (err: any) {
          reject(new Error(`Failed to get download URL: ${err.message}`));
        }
      }
    );
  });
}
