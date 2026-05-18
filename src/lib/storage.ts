import { HistoryRecord } from "../types";

const LOCAL_STORAGE_KEY = "pantau_langit_local_history";

export const saveLocalAQI = (record: Omit<HistoryRecord, "id">) => {
  try {
    const history = getLocalAQI();
    const newRecord: HistoryRecord = {
      ...record,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    
    // Convert Date to string for JSON storage if it's a Date object
    const serializableRecord = {
      ...newRecord,
      timestamp: newRecord.timestamp instanceof Date ? newRecord.timestamp.toISOString() : newRecord.timestamp
    };

    const updatedHistory = [serializableRecord, ...history].slice(0, 100);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (err) {
    console.error("Local storage save error:", err);
  }
};

export const getLocalAQI = (): HistoryRecord[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data) as HistoryRecord[];
    return parsed.map((item) => ({
      ...item,
      timestamp: new Date(item.timestamp)
    }));
  } catch (err) {
    console.error("Local storage read error:", err);
    return [];
  }
};

export const clearLocalAQI = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
};
