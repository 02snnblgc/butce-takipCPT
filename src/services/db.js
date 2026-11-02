const DB_NAME = 'butce-takip-db';
const DB_VERSION = 1;
let connection;

function openDatabase() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' });
        store.createIndex('period', 'period', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('dueDate', 'dueDate', { unique: false });
      }
      if (!db.objectStoreNames.contains('periodNotes')) {
        db.createObjectStore('periodNotes', { keyPath: 'period' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Veritabanı açılamadı.'));
  });
  return connection;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Veritabanı işlemi başarısız.'));
  });
}

async function storeRequest(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try { result = operation(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error || new Error('Veritabanı işlemi başarısız.'));
    tx.onabort = () => reject(tx.error || new Error('Veritabanı işlemi iptal edildi.'));
  });
}

export const DB = {
  init: openDatabase,
  async allTransactions() {
    const db = await openDatabase();
    return requestResult(db.transaction('transactions', 'readonly').objectStore('transactions').getAll());
  },
  async getTransaction(id) {
    const db = await openDatabase();
    return requestResult(db.transaction('transactions', 'readonly').objectStore('transactions').get(id));
  },
  async saveTransaction(item) {
    const db = await openDatabase();
    const tx = db.transaction('transactions', 'readwrite');
    tx.objectStore('transactions').put(item);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteTransaction(id) {
    const db = await openDatabase();
    const tx = db.transaction('transactions', 'readwrite');
    tx.objectStore('transactions').delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
  async getPeriodNote(period) {
    const db = await openDatabase();
    const result = await requestResult(db.transaction('periodNotes', 'readonly').objectStore('periodNotes').get(period));
    return result?.note || '';
  },
  async setPeriodNote(period, note) {
    const db = await openDatabase();
    const tx = db.transaction('periodNotes', 'readwrite');
    tx.objectStore('periodNotes').put({ period, note, updatedAt: new Date().toISOString() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
  async getSetting(key, fallback = null) {
    const db = await openDatabase();
    const result = await requestResult(db.transaction('settings', 'readonly').objectStore('settings').get(key));
    return result ? result.value : fallback;
  },
  async setSetting(key, value) {
    const db = await openDatabase();
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
  async allSettings() {
    const db = await openDatabase();
    const rows = await requestResult(db.transaction('settings', 'readonly').objectStore('settings').getAll());
    return Object.fromEntries(rows.map(row => [row.key, row.value]));
  },
  async exportAll() {
    const [transactions, settings] = await Promise.all([this.allTransactions(), this.allSettings()]);
    const db = await openDatabase();
    const periodNotes = await requestResult(db.transaction('periodNotes', 'readonly').objectStore('periodNotes').getAll());
    return {
      app: 'butce-takip',
      schemaVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      transactions,
      settings,
      periodNotes
    };
  },
  async importAll(data) {
    if (!data || data.app !== 'butce-takip' || !Array.isArray(data.transactions) || !data.settings || !Array.isArray(data.periodNotes)) {
      throw new Error('Bu dosya geçerli bir Bütçe Takip yedeği değil.');
    }
    const db = await openDatabase();
    const tx = db.transaction(['transactions', 'settings', 'periodNotes'], 'readwrite');
    const txStore = tx.objectStore('transactions');
    const settingsStore = tx.objectStore('settings');
    const notesStore = tx.objectStore('periodNotes');
    txStore.clear(); settingsStore.clear(); notesStore.clear();
    data.transactions.forEach(item => txStore.put(item));
    Object.entries(data.settings).forEach(([key, value]) => settingsStore.put({ key, value }));
    data.periodNotes.forEach(note => notesStore.put(note));
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Yedek geri yüklenemedi.'));
    });
  }
};
