/* shared utility functions used across multiple modules */

import { loadBlob, saveBlob } from './db.js';

export function getLocalStorageSize() {
    try {
        const used = new Blob(Object.values(localStorage)).size;
        return {
            kb: (used / 1024).toFixed(1),
            pct: ((used / (5 * 1024 * 1024)) * 100).toFixed(1),
        };
    } catch {
        return null;
    }
}

export async function rehydrateBlobsForDisplay(msg) {
    const hasBlobs = msg.attachments && msg.attachments.some(function (a) {
        return a.blobKey;
    });

    if (!hasBlobs) return msg;

    const attachments = await Promise.all(msg.attachments.map(async function (att) {
        if (att.blobKey) {
            const dataUrl = await loadBlob(att.blobKey);
            return Object.assign({}, att, { dataUrl });
        }
        return att;
    }));

    return Object.assign({}, msg, { attachments });
}

export async function rehydrateBlobsForExport(messages) {
    return Promise.all(messages.map(async function (msg) {
        const hasBlobs = msg.attachments && msg.attachments.some(function (a) {
            return a.blobKey;
        });

        if (!hasBlobs) return msg;

        const attachments = await Promise.all(msg.attachments.map(async function (att) {
            if (!att.blobKey) return att;

            const dataUrl = await loadBlob(att.blobKey);
            const copy = Object.assign({}, att);
            delete copy.blobKey;
            copy.dataUrl = dataUrl;
            return copy;
        }));

        return Object.assign({}, msg, { attachments });
    }));
}

export async function storeBlobsFromImport(messages) {
    return Promise.all(messages.map(async function (msg) {
        const hasInlineImages = msg.attachments && msg.attachments.some(function (a) {
            return a.dataUrl;
        });

        if (!hasInlineImages) return msg;

        const attachments = await Promise.all(msg.attachments.map(async function (att, index) {
            if (att.type !== 'image' || !att.dataUrl) return att;

            const blobKey = msg.id + '_' + index;
            await saveBlob(blobKey, att.dataUrl);

            const copy = Object.assign({}, att);
            delete copy.dataUrl;
            copy.blobKey = blobKey;
            return copy;
        }));

        return Object.assign({}, msg, { attachments });
    }));
}
