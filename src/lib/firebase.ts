import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, getDocs, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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

export const saveAQIRecord = async (record: {
  aqi: number;
  status: string;
  visibilityIndex: number;
  pm25: number;
  location: { lat: number; lng: number };
  address: string;
}) => {
  const path = 'air_quality_history';
  try {
    await addDoc(collection(db, path), {
      ...record,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getHistory = async (count = 20) => {
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
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};
