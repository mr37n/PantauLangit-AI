import { initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  orderBy, 
  limit, 
  serverTimestamp, 
  Timestamp,
  doc,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { HistoryRecord } from '../types';

const isConfigValid = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

const app = isConfigValid ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : (null as unknown as Auth);

export const db: Firestore | null = app ? initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
}, firebaseConfig.firestoreDatabaseId) : null;

export async function testFirestoreConnection() {
  if (!db) {
    console.warn("Firestore not initialized: Missing or invalid config");
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    console.log("Firestore connection test: Success");
    return true;
  } catch (error) {
    console.error("Firestore connection test: Error:", error);
    return false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const saveAQIRecord = async (record: Partial<HistoryRecord> & {
  aqi: number;
  status: string;
  visibilityIndex: number;
  pm25: number;
  location: { lat: number; lng: number };
  address: string;
}) => {
  if (!db) {
    console.warn("Skipping Firestore save: DB not initialized");
    return;
  }
  const path = 'air_quality_history';
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timestamp, id, ...rest } = record;
    await addDoc(collection(db, path), {
      ...rest,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getHistory = async (count = 20): Promise<HistoryRecord[]> => {
  if (!db) {
    console.warn("Skipping Firestore fetch: DB not initialized");
    return [];
  }
  const path = 'air_quality_history';
  try {
    const q = query(
      collection(db, path),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp)?.toDate()
    })) as HistoryRecord[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};
