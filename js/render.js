/* builds and inserts message elements into the dom, rehydrating image blobs from indexeddb when loading old chats */

import { dom } from './dom.js';
import { scrollToBottom } from './ui.js';
import { getActiveChat } from './chat.js';
import { loadBlob } from './db.js';
import { loadSettings } from './settings.js';

export async function renderMessages() {
    dom.messages.innerHTML = '';

    const chat = getActiveChat();
    if (!chat) return;

    for (const msg of chat.messages) {
        const resolved = await loadMessageBlobs(msg);
        appendMessageDOM(resolved);
    }

    scrollToBottom();
}

async function loadMessageBlobs(msg) {
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

function makeAvatar(isUser, name) {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';

    if (isUser) {
        avatar.textContent = name.charAt(0).toUpperCase();
    } else {
        const img = document.createElement('img');
        img.src = './icons/dinosaur.svg';
        img.alt = 'AI';
        avatar.appendChild(img);
    }

    return avatar;
}

export function appendMessageDOM(msg) {
    const settings = loadSettings();
    const isUser = msg.role === 'user';
    let name;
    if (isUser) {
        name = settings.userName;
    } else {
        name = settings.aiName;
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'message ' + msg.role;
    messageEl.dataset.id = msg.id;

    const body = document.createElement('div');
    body.className = 'message-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'message-name';
    nameEl.textContent = name;
    body.appendChild(nameEl);

    if (msg.attachments && msg.attachments.length > 0) {
        body.appendChild(buildAttachmentsEl(msg.attachments));
    }

    const textEl = document.createElement('div');
    textEl.className = 'message-text';

    if (msg.content) {
        textEl.innerHTML = DOMPurify.sanitize(marked.parse(msg.content), { ADD_ATTR: ['class'] });
    }

    body.appendChild(textEl);

    if (!isUser && msg.content) {
        body.appendChild(makeCopyButton(msg.content));
    }

    messageEl.appendChild(makeAvatar(isUser, name));
    messageEl.appendChild(body);
    dom.messages.appendChild(messageEl);

    return messageEl;
}

export function appendStreamingMessage(role) {
    const settings = loadSettings();
    const isUser = role === 'user';
    let name;
    if (isUser) {
        name = settings.userName;
    } else {
        name = settings.aiName;
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'message ' + role;

    const body = document.createElement('div');
    body.className = 'message-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'message-name';
    nameEl.textContent = name;

    const textEl = document.createElement('div');
    textEl.className = 'message-text';

    body.appendChild(nameEl);
    body.appendChild(textEl);
    messageEl.appendChild(makeAvatar(isUser, name));
    messageEl.appendChild(body);
    dom.messages.appendChild(messageEl);

    return textEl;
}

function buildAttachmentsEl(attachments) {
    const wrap = document.createElement('div');
    wrap.className = 'message-attachments';

    for (const att of attachments) {
        if (att.type === 'image' && att.dataUrl) {
            const thumb = document.createElement('div');
            thumb.className = 'attachment-thumb';

            const img = document.createElement('img');
            img.src = att.dataUrl;
            img.alt = att.name;
            thumb.appendChild(img);

            wrap.appendChild(thumb);
        } else {
            const fileEl = document.createElement('div');
            fileEl.className = 'attachment-file';
            fileEl.textContent = att.name;
            wrap.appendChild(fileEl);
        }
    }

    return wrap;
}


export function makeCopyButton(content) {
    const btn = document.createElement('button');
    btn.className = 'msg-copy';

    const img = document.createElement('img');
    img.src = './icons/copyIcon.svg';
    img.alt = '';
    img.width = 13;
    img.height = 13;

    btn.appendChild(img);
    btn.appendChild(document.createTextNode(' Copy'));

    btn.onclick = function () {
        navigator.clipboard.writeText(content).then(function () {
            btn.textContent = 'Copied!';

            setTimeout(function () {
                btn.innerHTML = '';
                const imgRestored = document.createElement('img');
                imgRestored.src = './icons/copyIcon.svg';
                imgRestored.alt = '';
                imgRestored.width = 13;
                imgRestored.height = 13;
                btn.appendChild(imgRestored);
                btn.appendChild(document.createTextNode(' Copy'));
            }, 1800);
        });
    };

    return btn;
}
