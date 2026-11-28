import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

function getClientApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey) return null;
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export function getClientAuth(): Auth | null {
  const app = getClientApp();
  return app ? getAuth(app) : null;
}

export function getClientDb(): Firestore | null {
  const app = getClientApp();
  return app ? getFirestore(app) : null;
}

export const auth: Auth | null = getClientAuth();
export const db: Firestore | null = getClientDb();

export async function ensureAuthUser() {
  const currentAuth = auth || getClientAuth();
  if (!currentAuth) throw new Error("Firebase client config is missing");
  if (currentAuth.currentUser) return currentAuth.currentUser;
  const cred = await signInAnonymously(currentAuth);
  return cred.user;
}
