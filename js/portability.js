/* exports the active chat as a .crchat file and imports one back, moving image blobs in and out of indexeddb */

import { state } from './state.js';
import { saveChats } from './chat.js';
import { loadBlob, saveBlob } from './db.js';

export async function exportChat() {
    const chat = state.chats.find(function (c) {
        return c.id === state.activeChatId;
    });

    if (!chat) return;

    const messages = await rehydrateMessagesForExport(chat.messages);
    const payload = JSON.stringify({ version: 1, chat: Object.assign({}, chat, { messages }) }, null, 2);

    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = chat.title.slice(0, 40).replace(/[^a-z0-9]/gi, '_') + '.crchat';
    link.click();

    URL.revokeObjectURL(url);
}

async function rehydrateMessagesForExport(messages) {
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

export async function importChat(file) {
    const text = await file.text();
    let payload;

    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error('Invalid .crchat file');
    }

    if (payload.version !== 1 || !payload.chat) {
        throw new Error('Unsupported file format');
    }

    const chat = payload.chat;
    const messages = await storeImportedBlobs(chat.messages);
    const imported = Object.assign({}, chat, {
        id: Date.now().toString(),
        messages,
    });

    state.chats.unshift(imported);
    saveChats();

    return imported;
}

async function storeImportedBlobs(messages) {
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
