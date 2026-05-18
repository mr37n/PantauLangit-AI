import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { HistoryRecord } from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
  host: "firestore.googleapis.com",
  ssl: true,
}, firebaseConfig.firestoreDatabaseId);

export async function testFirestoreConnection() {
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
