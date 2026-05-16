/* creates, deletes and persists chats to localstorage, pruning the oldest ones if the quota is exceeded */

import { state } from './state.js';
import { truncate } from './ui.js';
import { deleteBlobs } from './db.js';

export function saveChats() {
    try {
        localStorage.setItem('cc_chats', JSON.stringify(state.chats));
    } catch {
        pruneOldestUntilFits();
    }
}

function pruneOldestUntilFits() {
    while (state.chats.length > 0) {
        const removed = state.chats.pop();
        deleteBlobs(collectBlobKeys(removed));

        try {
            localStorage.setItem('cc_chats', JSON.stringify(state.chats));
            return;
        } catch (err) {
            console.warn('localStorage still full after pruning, continuing:', err.message);
        }
    }

    localStorage.removeItem('cc_chats');
}

export function createChat(title) {
    const chatTitle = title || 'New chat';
    const id = Date.now().toString();

    const chat = {
        id: id,
        title: truncate(chatTitle, 40),
        messages: [],
        createdAt: Date.now(),
    };

    state.chats.unshift(chat);
    state.activeChatId = id;
    saveChats();

    return chat;
}

export function getActiveChat() {
    return state.chats.find(function (chat) {
        return chat.id === state.activeChatId;
    });
}

export function deleteChat(id) {
    const chat = state.chats.find(function (c) {
        return c.id === id;
    });

    if (chat) {
        deleteBlobs(collectBlobKeys(chat));
    }

    state.chats = state.chats.filter(function (c) {
        return c.id !== id;
    });

    if (state.activeChatId === id) {
        state.activeChatId = null;
    }

    saveChats();
}

function collectBlobKeys(chat) {
    const keys = [];

    for (const msg of chat.messages || []) {
        for (const att of msg.attachments || []) {
            if (att.blobKey) {
                keys.push(att.blobKey);
            }
        }
    }

    return keys;
}
