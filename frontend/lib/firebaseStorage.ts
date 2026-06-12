/**
 * Firebase Storage uploader.
 * 
 * Files are uploaded directly to Firebase Storage (not base64-embedded in Firestore),
 * avoiding the Firestore 1MB per-document limit that silently caused uploads to fail.
 * 
 * Upload flow:
 *   1. Employee selects a file
 *   2. File is uploaded to Firebase Storage: documents/{employeeId}/{docType}/{fileName}
 *   3. A persistent download URL is returned
 *   4. The backend receives ONLY: employeeId, type, fileName, fileSize, fileUrl (the https:// URL)
 *   5. Firestore stores tiny metadata records (< 1KB each) — no more 10MB+ base64 blobs
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage
} from "firebase/storage";

// Firebase config — matches firebase-applet-config.json in the project root
const firebaseConfig = {
  apiKey: "AIzaSyB7s7fqLUS0sOuM7UeImheT1pFKmYIwQyk",
  authDomain: "arcane-object-vnzsc.firebaseapp.com",
  projectId: "arcane-object-vnzsc",
  storageBucket: "arcane-object-vnzsc.firebasestorage.app",
  messagingSenderId: "445946501373",
  appId: "1:445946501373:web:d98f99d31c56c962658694"
};

let app: FirebaseApp;
let storage: FirebaseStorage;

function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    storage = getStorage(app);
  }
  return storage;
}

export interface UploadProgress {
  percent: number;
  state: "running" | "paused" | "error" | "success";
}

/**
 * Upload a file to Firebase Storage and return its permanent download URL.
 * 
 * @param file          The File object to upload
 * @param employeeId    The employee ID (used to organise storage path)
 * @param docType       The document type (resume, aadhaar, pan, photo, educational)
 * @param onProgress    Optional callback receiving upload progress (0-100)
 * @returns             Permanent HTTPS download URL
 */
export async function uploadDocumentToStorage(
  file: File,
  employeeId: string,
  docType: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const st = getFirebaseStorage();

  // Create a unique storage path to avoid collisions
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
