/**
 * Firebase Storage uploader — reads config from firebase-applet-config.json
 * 
 * Falls back to base64 encoding if Firebase Storage is not configured yet.
 * Once you set up your AgentOps Firebase project in firebase-applet-config.json,
 * files will be uploaded to Firebase Storage and stored as HTTPS URLs (no size limit).
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage
} from "firebase/storage";

let storageInstance: FirebaseStorage | null = null;
let firebaseConfigured = false;
let configChecked = false;

async function tryInitFirebaseStorage(): Promise<FirebaseStorage | null> {
  if (configChecked) return storageInstance;
  configChecked = true;

  try {
    const res = await fetch("/firebase-applet-config.json");
    if (!res.ok) return null;
    const config = await res.json();

    // Check if config has real values (not placeholders)
    if (
      !config.projectId ||
      config.projectId === "YOUR_AGENTOPS_PROJECT_ID" ||
      !config.apiKey ||
      config.apiKey === "YOUR_API_KEY" ||
      !config.storageBucket ||
      config.storageBucket.includes("YOUR_")
    ) {
      console.warn("[Firebase Storage] Not configured yet — using base64 fallback mode.");
      return null;
    }

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
    firebaseConfigured = true;
    console.log("[Firebase Storage] Initialized with project:", config.projectId);
    return storageInstance;
  } catch (e) {
    console.warn("[Firebase Storage] Init failed, using base64 fallback:", e);
    return null;
  }
}

/**
 * Read a file as a base64 data URL (fallback when Firebase Storage not configured).
 */
function readFileAsBase64(file: File, onProgress?: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 85));
      }
    };
    reader.onload = () => {
      if (onProgress) onProgress(100);
      resolve(reader.result as string);
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a file to Firebase Storage and return its permanent download URL.
 * If Firebase Storage is not configured, returns the file as a base64 data URL instead.
 */
export async function uploadDocumentToStorage(
  file: File,
  employeeId: string,
  docType: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Try Firebase Storage first
  const st = await tryInitFirebaseStorage();

  if (!st) {
    // Fallback: return base64 data URL (works without Firebase setup)
    if (onProgress) onProgress(10);
    const base64 = await readFileAsBase64(file, onProgress);
    return base64;
  }

  // Firebase Storage path
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
        // On storage error, fall back to base64
        console.warn("[Firebase Storage] Falling back to base64 mode...");
        readFileAsBase64(file, onProgress).then(resolve).catch(reject);
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
