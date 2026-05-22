/* collects the user message, calls the gemini nano session, renders the response as markdown, then saves it */

import { state } from './state.js';
import { dom } from './dom.js';
import { truncate, scrollToBottom, updateSendBtn, showChat, autoResize, updateStorageDisclaimer } from './ui.js';
import { createChat, getActiveChat, saveChats } from './chat.js';
import { appendMessageDOM, appendStreamingMessage, makeCopyButton } from './render.js';
import { clearAttachments } from './files.js';
import { saveBlob, loadBlob } from './db.js';
import { getOrCreateChatSession } from './model.js';

export async function sendMessage() {
    if (state.isGenerating || !state.modelReady) return;

    const text = dom.messageInput.value.trim();
    const files = [...state.pendingFiles];

    if (!text && !files.length) return;

    if (!state.activeChatId) {
        createChat(text || 'Attachments');
        dom.messages.innerHTML = '';
    }

    showChat();

    const chat = getActiveChat();

    if (chat.messages.length === 0 && text) {
        chat.title = truncate(text, 40);
    }

    const messageId = Date.now().toString();
    const attachments = await buildAttachments(files, messageId);

    const userMessage = {
        id: messageId,
        role: 'user',
        content: text,
        attachments: attachments,
    };

    const userMessageWithBlobs = Object.assign({}, userMessage, {
        attachments: attachments.map(function (att, index) {
            if (att.blobKey) {
                return Object.assign({}, att, { dataUrl: files[index].dataUrl });
            }
            return att;
        }),
    });

    chat.messages.push(userMessage);
    saveChats();
    appendMessageDOM(userMessageWithBlobs);
    scrollToBottom();

    dom.messageInput.value = '';
    autoResize();
    clearAttachments();

    state.isGenerating = true;
    updateSendBtn(state);

    const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '',
        attachments: [],
    };

    chat.messages.push(aiMessage);

    const textEl = appendStreamingMessage('ai');

    const hasPdf = userMessage.attachments && userMessage.attachments.some(function (a) {
        return a.name && a.name.toLowerCase().endsWith('.pdf');
    });

    const dinoIndicator = document.createElement('img');
    dinoIndicator.src = './icons/dinosaur.svg';
    dinoIndicator.className = 'dino-typing';
    dinoIndicator.alt = '';

    if (hasPdf) {
        const analyzingLabel = document.createElement('span');
        analyzingLabel.className = 'analyzing-label';
        analyzingLabel.textContent = 'Analyzing document...';
        textEl.appendChild(analyzingLabel);
        textEl.appendChild(dinoIndicator);
    } else {
        textEl.appendChild(dinoIndicator);
    }

    scrollToBottom();

    try {
        const session = await getOrCreateChatSession(state.activeChatId);

        session.addEventListener('contextoverflow', function onOverflow() {
            const label = textEl.querySelector('.analyzing-label');
            if (label) label.textContent = 'Document too large, working with partial content...';
            session.removeEventListener('contextoverflow', onOverflow);
        });

        const promptContent = await buildPromptContent(userMessage);
        const stream = session.promptStreaming([{ role: 'user', content: promptContent }]);
        let accumulated = '';

        for await (const delta of stream) {
            accumulated += delta;

            const label = textEl.querySelector('.analyzing-label');
            if (label) label.remove();

            textEl.insertBefore(document.createTextNode(delta), dinoIndicator);
            scrollToBottom();
        }

        dinoIndicator.remove();

        await new Promise(function (resolve) { requestAnimationFrame(resolve); });

        textEl.style.opacity = '0';
        textEl.innerHTML = DOMPurify.sanitize(marked.parse(accumulated), { ADD_ATTR: ['class'] });

        requestAnimationFrame(function () {
            textEl.style.transition = 'opacity 0.15s';
            textEl.style.opacity = '1';
            textEl.parentNode.appendChild(makeCopyButton(accumulated));
            scrollToBottom();
        });

        aiMessage.content = accumulated;
        saveChats();
        updateStorageDisclaimer();
    } catch (err) {
        dinoIndicator.remove();

        let errorMessage;
        if (err.name === 'QuotaExceededError' || err.message.toLowerCase().includes('too large')) {
            errorMessage = 'The attached content is too large for ' + (self._ccLMIsEdge ? 'Phi' : 'Gemini Nano') + '\'s context window. Try a shorter document or paste only the relevant section.';
        } else {
            errorMessage = 'Error: ' + err.message;
        }

        textEl.textContent = errorMessage;
        aiMessage.content = textEl.textContent;
        saveChats();
        updateStorageDisclaimer();
    }

    state.isGenerating = false;
    updateSendBtn(state);
    scrollToBottom();
}

async function buildAttachments(files, messageId) {
    const attachments = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.type === 'image' && file.dataUrl) {
            const blobKey = messageId + '_' + i;
            await saveBlob(blobKey, file.dataUrl);
            attachments.push({ name: file.name, type: 'image', blobKey });
        } else {
            const att = { name: file.name, type: file.type, textContent: file.textContent };
            if (file.preAppended) att.preAppended = true;
            attachments.push(att);
        }
    }

    return attachments;
}

async function buildPromptContent(userMessage) {
    const parts = [];

    if (userMessage.content) {
        parts.push({ type: 'text', value: userMessage.content });
    }

    if (userMessage.attachments) {
        for (const att of userMessage.attachments) {
            if (att.type === 'image' && state.supportsImages) {
                const dataUrl = att.blobKey ? await loadBlob(att.blobKey) : att.dataUrl;
                if (dataUrl) {
                    const blob = dataUrlToBlob(dataUrl);
                    parts.push({ type: 'image', value: blob });
                }
            } else if (att.type === 'image' && !state.supportsImages) {
                parts.push({ type: 'text', value: '[Attached image: ' + att.name + ']' });
            } else if (att.textContent) {
                if (att.preAppended) {
                    parts.push({ type: 'text', value: '[Refer to the previously loaded document: ' + att.name + ']' });
                } else {
                    parts.push({ type: 'text', value: '[Attached file: ' + att.name + ']\n' + att.textContent });
                }
            }
        }
    }

    if (parts.length === 1 && parts[0].type === 'text') {
        return parts[0].value;
    }

    return parts;
}

function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}
