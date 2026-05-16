/* stores and retrieves image blobs in indexeddb so they don't count against the 5mb localstorage limit */

const DB_NAME = 'chromechat';
const STORE_NAME = 'blobs';
let database = null;

function openDatabase() {
    if (database) {
        return Promise.resolve(database);
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = function (event) {
            event.target.result.createObjectStore(STORE_NAME);
        };

        request.onsuccess = function (event) {
            database = event.target.result;
            resolve(database);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}

export async function saveBlob(key, dataUrl) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(dataUrl, key);
        transaction.oncomplete = resolve;
        transaction.onerror = function () {
            reject(transaction.error);
        };
    });
}

export async function loadBlob(key) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(key);

        request.onsuccess = function () {
            resolve(request.result || null);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}

export async function deleteBlobs(keys) {
    if (!keys.length) return;

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');

        for (const key of keys) {
            transaction.objectStore(STORE_NAME).delete(key);
        }

        transaction.oncomplete = resolve;
        transaction.onerror = function () {
            reject(transaction.error);
        };
    });
}
