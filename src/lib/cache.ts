import { HistoryRecord } from '../types';

const DB_NAME = 'PantauLangitOfflineDB';
const STORE_NAME = 'history';
const DB_VERSION = 1;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveHistoryToCache = async (records: HistoryRecord[]) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    records.forEach(record => {
      const serializableRecord = {
        ...record,
        timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp
      };
      store.put(serializableRecord);
    });

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to save history to IDB:', error);
  }
};

export const saveHistoryRecordToCache = async (record: HistoryRecord) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const serializableRecord = {
      ...record,
      timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp
    };
    
    store.put(serializableRecord);

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to save record to IDB:', error);
  }
};

export const getHistoryFromCache = async (): Promise<HistoryRecord[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result.map(record => ({
          ...record,
          timestamp: new Date(record.timestamp)
        })) as HistoryRecord[];
        
        // Sort by timestamp descending (newest first)
        results.sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return timeB - timeA;
        });
        
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to read from IDB:', error);
    return [];
  }
};
