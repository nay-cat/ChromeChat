/* collects the user message, calls the gemini nano session, renders the response as markdown, then saves it */

import { state } from './state.js';
import { dom } from './dom.js';
import { truncate, scrollToBottom, updateSendBtn, showChat, autoResize, updateStorageDisclaimer } from './ui.js';
import { createChat, getActiveChat, saveChats } from './chat.js';
import { appendMessageDOM, appendStreamingMessage, makeCopyButton } from './render.js';
import { clearAttachments } from './files.js';
import { saveBlob } from './db.js';
import { loadSettings } from './settings.js';

const MAX_PROMPT_CHARS = 20000;

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

        state.session.addEventListener('contextoverflow', function onOverflow() {
            analyzingLabel.textContent = 'Document too large, working with partial content...';
            state.session.removeEventListener('contextoverflow', onOverflow);
        });
    } else {
        textEl.appendChild(dinoIndicator);
    }

    scrollToBottom();

    try {
        const settings = loadSettings();
        const prompt = buildPrompt(userMessage, chat.messages, settings);
        const stream = state.session.promptStreaming(prompt);
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
            attachments.push({ name: file.name, type: file.type, textContent: file.textContent });
        }
    }

    return attachments;
}


function buildPrompt(userMessage, allMessages, settings) {
    const recentHistory = allMessages.slice(-8, -2).filter(function (m) {
        return m.content;
    });

    let prompt = '';

    if (recentHistory.length > 0) {
        const historyLines = recentHistory.map(function (m) {
            let speaker;
            if (m.role === 'user') {
                speaker = settings.userName;
            } else {
                speaker = settings.aiName;
            }
            return speaker + ': ' + m.content;
        });

        prompt = historyLines.join('\n') + '\n\n' + settings.userName + ': ';
    }

    prompt += userMessage.content || '';

    if (userMessage.attachments) {
        for (const att of userMessage.attachments) {
            if (att.textContent) {
                const remaining = MAX_PROMPT_CHARS - prompt.length - 200;
                let content = att.textContent;
                let truncated = false;

                if (content.length > remaining) {
                    content = content.slice(0, remaining);
                    truncated = true;
                }

                prompt += '\n\n[Attached file: ' + att.name;
                if (truncated) {
                    prompt += ' — truncated to fit context window';
                }
                prompt += ']\n' + content;
            } else if (att.type === 'image') {
                prompt += '\n\n[Attached image: ' + att.name + ']';
            }
        }
    }

    return prompt.trim();
}
