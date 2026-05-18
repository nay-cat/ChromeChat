/* entry point: wires up all event listeners and boots the app */

import { state } from './state.js';
import { dom } from './dom.js';
import { autoResize, updateSendBtn, showWelcome, showChat, updateStorageDisclaimer, startDino, stopDino } from './ui.js';
import { getLocalStorageSize } from './utils.js';
import { createChat, deleteChat, saveChats } from './chat.js';
import { renderMessages } from './render.js';
import { sendMessage } from './send.js';
import { handleFiles } from './files.js';
import { initModel } from './model.js';
import { exportChat, importChat } from './portability.js';
import { loadSettings, saveSettings } from './settings.js';

function applySettingsToUI() {
    const settings = loadSettings();
    dom.welcomeTitle.textContent = settings.aiName;
    dom.welcomeSubtitle.textContent = settings.welcomeMessage;
    dom.messageInput.placeholder = 'Ask ' + settings.aiName + ' anything...';
}

function startNewChat() {
    state.activeChatId = null;
    dom.exportBtn.disabled = true;
    dom.messages.innerHTML = '';
    showWelcome();
}

dom.messageInput.addEventListener('input', function () {
    autoResize();
    updateSendBtn(state);

    if (dom.messageInput.value.trim()) {
        startDino();
    } else {
        stopDino();
    }
});

dom.messageInput.addEventListener('blur', stopDino);

dom.messageInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
});

dom.messageInput.addEventListener('paste', function (event) {
    const items = event.clipboardData ? Array.from(event.clipboardData.items) : [];

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) handleFiles([file]);
        }
    }
});

async function handleSend() {
    stopDino();
    await sendMessage();
    dom.exportBtn.disabled = !state.activeChatId;
}

dom.sendBtn.addEventListener('click', handleSend);

dom.newChatBtn.addEventListener('click', startNewChat);

dom.exportBtn.addEventListener('click', function () {
    exportChat();
});

dom.importBtn.addEventListener('click', function () {
    dom.importInput.click();
});

dom.importInput.addEventListener('change', async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const chat = await importChat(file);
        state.activeChatId = chat.id;
        showChat();
        await renderMessages();
        dom.exportBtn.disabled = false;
    } catch (err) {
        alert('Import failed: ' + err.message);
    }

    dom.importInput.value = '';
});

dom.historyBtn.addEventListener('click', function () {
    renderHistoryList();
    dom.historyDropdown.classList.toggle('hidden');
});

dom.historyClose.addEventListener('click', function () {
    dom.historyDropdown.classList.add('hidden');
});

document.addEventListener('click', function (event) {
    const clickedOutside = !dom.historyDropdown.contains(event.target);
    const clickedButton = event.target === dom.historyBtn;

    if (clickedOutside && !clickedButton) {
        dom.historyDropdown.classList.add('hidden');
    }
});

function renderHistoryList() {
    dom.historyList.innerHTML = '';

    if (!state.chats.length) {
        dom.historyList.innerHTML = '<p class="history-empty">No chats yet.</p>';
        return;
    }

    for (const chat of state.chats) {
        const item = document.createElement('div');
        if (chat.id === state.activeChatId) {
            item.className = 'history-item active';
        } else {
            item.className = 'history-item';
        }

        const titleEl = document.createElement('span');
        titleEl.className = 'history-title';
        titleEl.textContent = chat.title;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'history-del';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
        </svg>`;

        deleteBtn.onclick = function (event) {
            event.stopPropagation();
            deleteChat(chat.id);

            if (!state.activeChatId) {
                showWelcome();
            }

            renderHistoryList();
        };

        item.addEventListener('click', function () {
            state.activeChatId = chat.id;
            showChat();
            renderMessages();
            dom.exportBtn.disabled = false;
            dom.historyDropdown.classList.add('hidden');
        });

        item.appendChild(titleEl);
        item.appendChild(deleteBtn);
        dom.historyList.appendChild(item);
    }
}

dom.attachBtn.addEventListener('click', function () {
    dom.fileInput.click();
});

dom.fileInput.addEventListener('change', function (event) {
    handleFiles(event.target.files);
});

dom.inputBox.addEventListener('dragover', function (event) {
    event.preventDefault();
    dom.inputBox.style.borderColor = 'var(--accent)';
});

dom.inputBox.addEventListener('dragleave', function () {
    dom.inputBox.style.borderColor = '';
});

dom.inputBox.addEventListener('drop', function (event) {
    event.preventDefault();
    dom.inputBox.style.borderColor = '';

    if (event.dataTransfer.files.length) {
        handleFiles(event.dataTransfer.files);
    }
});

document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
        dom.messageInput.value = chip.dataset.prompt;
        autoResize();
        updateSendBtn(state);
        dom.messageInput.focus();
    });
});

dom.settingsBtn.addEventListener('click', openSettings);
dom.settingsClose.addEventListener('click', closeSettings);

dom.settingsPanel.addEventListener('click', function (event) {
    if (event.target === dom.settingsPanel) {
        closeSettings();
    }
});

dom.settingsSave.addEventListener('click', function () {
    saveSettings({
        aiName:         dom.sAiName.value.trim()      || 'ChromeChat',
        userName:       dom.sUserName.value.trim()     || 'You',
        systemPrompt:   dom.sSystemPrompt.value.trim() || 'You are a helpful, concise assistant.',
        welcomeMessage: dom.sWelcomeMsg.value.trim()   || 'Local AI with Gemini Nano. Works offline.',
    });

    applySettingsToUI();
    updateStorageDisclaimer();
    closeSettings();
});

dom.settingsReset.addEventListener('click', function () {
    localStorage.removeItem('cc_settings');
    applySettingsToUI();
    openSettings();
});

dom.clearStorageBtn.addEventListener('click', function () {
    if (!confirm('Delete all chats? This cannot be undone.')) return;

    state.chats = [];
    state.activeChatId = null;
    saveChats();
    startNewChat();
    updateStorageDisclaimer();
    updateStorageInfo();
});

function openSettings() {
    const settings = loadSettings();
    dom.sAiName.value = settings.aiName;
    dom.sUserName.value = settings.userName;
    dom.sSystemPrompt.value = settings.systemPrompt;
    dom.sWelcomeMsg.value = settings.welcomeMessage;
    updateStorageInfo();
    populateDeviceSpecs();
    dom.settingsPanel.classList.remove('hidden');
}

function closeSettings() {
    dom.settingsPanel.classList.add('hidden');
}

function updateStorageInfo() {
    const size = getLocalStorageSize();
    if (size) {
        dom.storageInfo.textContent = size.kb + ' KB used (' + size.pct + '% of 5 MB limit)';
    } else {
        dom.storageInfo.textContent = 'Unable to measure storage';
    }
}

document.getElementById('open-internals').addEventListener('click', function () {
    copyToClipboardWithFeedback('chrome://on-device-internals', this);
});

document.getElementById('open-flags').addEventListener('click', function () {
    copyToClipboardWithFeedback('chrome://flags/#prompt-api-for-gemini-nano', this);
});

function copyToClipboardWithFeedback(text, button) {
    navigator.clipboard.writeText(text).then(function () {
        const originalHTML = button.innerHTML;
        const lastNode = button.childNodes[button.childNodes.length - 1];
        lastNode.textContent = ' Copied! Paste in address bar';

        setTimeout(function () {
            button.innerHTML = originalHTML;
        }, 2000);
    });
}

async function populateDeviceSpecs() {
    const specs = [];

    await addBrowserSpecs(specs);
    addHardwareSpecs(specs);
    await addGpuSpecs(specs);
    await addModelSpecs(specs);

    const grid = document.getElementById('device-specs');
    grid.innerHTML = '';

    for (const [key, value] of specs) {
        const keyEl = document.createElement('span');
        keyEl.className = 'specs-key';
        keyEl.textContent = key;

        const valEl = document.createElement('span');
        valEl.className = 'specs-val';
        valEl.textContent = value;

        grid.appendChild(keyEl);
        grid.appendChild(valEl);
    }
}

async function addBrowserSpecs(specs) {
    const uaData = navigator.userAgentData;

    if (uaData) {
        const info = await uaData.getHighEntropyValues(['platformVersion', 'uaFullVersion']).catch(function () {
            return {};
        });

        const chromeEntry = uaData.brands && uaData.brands.find(function (b) {
            return b.brand === 'Google Chrome';
        });

        let version;
        if (info.uaFullVersion) {
            version = info.uaFullVersion;
        } else if (chromeEntry) {
            version = chromeEntry.version;
        } else {
            version = 'unknown';
        }
        specs.push(['Browser', 'Chrome ' + version]);

        let platform = uaData.platform;
        if (info.platformVersion) {
            platform = platform + ' ' + info.platformVersion;
        }
        specs.push(['Platform', platform.trim()]);
    } else {
        const match = navigator.userAgent.match(/Chrome\/([\d.]+)/);
        let browser;
        if (match) {
            browser = match[0];
        } else {
            browser = 'Unknown';
        }
        specs.push(['Browser', browser]);
    }
}

function addHardwareSpecs(specs) {
    const cores = navigator.hardwareConcurrency;
    const ram = navigator.deviceMemory;

    let coresText;
    if (cores) {
        coresText = String(cores);
    } else {
        coresText = 'unknown';
    }
    specs.push(['CPU cores', coresText]);

    let ramText;
    if (ram) {
        ramText = '>= ' + ram + ' GB';
    } else {
        ramText = 'unknown';
    }
    specs.push(['RAM', ramText]);
}

async function addGpuSpecs(specs) {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');

        if (ext) {
            specs.push(['GPU', gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)]);
        }
    } catch (err) {
        console.warn('WebGL GPU info unavailable:', err.message);
    }
}

async function addModelSpecs(specs) {
    let modelLabel;
    if (state.modelReady) {
        modelLabel = (self._ccLMIsEdge ? 'Phi' : 'Gemini Nano') + ' (on-device)';
    } else {
        modelLabel = 'Not loaded';
    }
    specs.push(['Model', modelLabel]);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        const swUrl = new URL('../sw.js', import.meta.url).href;
        navigator.serviceWorker.register(swUrl).catch(function (err) {
            console.warn('Service Worker registration failed:', err.message);
        });
    });
}

applySettingsToUI();
updateStorageDisclaimer();
showWelcome();
initModel();
