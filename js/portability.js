/* exports the active chat as a .crchat file and imports one back, moving image blobs in and out of indexeddb */

import { state } from './state.js';
import { saveChats } from './chat.js';
import { rehydrateBlobsForExport, storeBlobsFromImport } from './utils.js';

export async function exportChat() {
    const chat = state.chats.find(function (c) {
        return c.id === state.activeChatId;
    });

    if (!chat) return;

    const messages = await rehydrateBlobsForExport(chat.messages);
    const payload = JSON.stringify({ version: 1, chat: Object.assign({}, chat, { messages }) }, null, 2);

    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = chat.title.slice(0, 40).replace(/[^a-z0-9]/gi, '_') + '.crchat';
    link.click();

    URL.revokeObjectURL(url);
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
    const messages = await storeBlobsFromImport(chat.messages);
    const imported = Object.assign({}, chat, {
        id: Date.now().toString(),
        messages,
    });

    state.chats.unshift(imported);
    saveChats();

    return imported;
}

