/* shared ui helpers: modal open/close, status indicator, scroll, input resize, dino animation, storage disclaimer */

import { dom } from './dom.js';
import { getLocalStorageSize } from './utils.js';

export function setStatus(type, text) {
    dom.modelStatus.className = 'model-status ' + type;
    dom.statusText.textContent = text;
}

export function openModal(title, message) {
    dom.setupModal.classList.remove('hidden');
    dom.setupTitle.textContent = title;
    dom.setupMessage.textContent = message;
}

export function closeModal() {
    dom.setupModal.classList.add('hidden');
    dom.setupError.classList.add('hidden');
    dom.setupLang.classList.add('hidden');
    dom.setupProgress.classList.add('hidden');
}

export function showError(msg) {
    openModal('Not available', '');
    dom.setupError.classList.remove('hidden');
    dom.setupErrorMsg.innerHTML = msg;
}

export function showWelcome() {
    dom.welcomeScreen.classList.remove('hidden');
    dom.messagesContainer.classList.add('hidden');
}

export function showChat() {
    dom.welcomeScreen.classList.add('hidden');
    dom.messagesContainer.classList.remove('hidden');
}

export function scrollToBottom() {
    dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
}

export function autoResize() {
    dom.messageInput.style.height = 'auto';
    dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 200) + 'px';
}

export function updateSendBtn(state) {
    const hasText = dom.messageInput.value.trim().length > 0;
    const hasFiles = state.pendingFiles.length > 0;
    const canSend = (hasText || hasFiles) && state.modelReady && !state.isGenerating;
    dom.sendBtn.disabled = !canSend;
}

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function truncate(str, maxLength) {
    if (str.length > maxLength) {
        return str.slice(0, maxLength) + '…';
    }
    return str;
}

export function updateStorageDisclaimer() {
    const el = document.getElementById('storage-disclaimer');
    if (!el) return;

    const size = getLocalStorageSize();
    if (size) {
        el.textContent = 'Local storage: ' + size.kb + ' KB used (' + size.pct + '% of 5 MB)';
    } else {
        el.textContent = 'Local storage: unable to measure';
    }
}

let dinoStopTimer = null;

export function startDino() {
    dom.dinoRunner.classList.add('running');
    clearTimeout(dinoStopTimer);
}

export function stopDino() {
    dinoStopTimer = setTimeout(function () {
        dom.dinoRunner.classList.remove('running');
    }, 800);
}
