/* detects and initialises the chrome LanguageModel api, handles the download flow and session creation */

import { state } from './state.js';
import { dom } from './dom.js';
import { setStatus, openModal, closeModal, showError, updateSendBtn } from './ui.js';
import { loadSettings } from './settings.js';

export async function initModel() {
    setStatus('checking', 'Checking model...');

    const api = self.LanguageModel || (self.ai && self.ai.languageModel) || null;

    // https://stackoverflow.com/questions/4900436/how-to-detect-the-installed-chrome-version
    if (!api) {
        setStatus('unavailable', 'API unavailable');
        const match = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
        const chromeVersion = match ? parseInt(match[2], 10) : null;
        const versionLine = chromeVersion
            ? 'Your Chrome version: ' + chromeVersion + ', required: 148+.'
            : 'Could not detect your Chrome version (required: 148+).';
        showError(
            'LanguageModel API not found. ' + versionLine + ' ' +
            'Make sure chrome://flags/#prompt-api-for-gemini-nano is set to "Enabled". ' +
            'Some Chromium-based browsers (Brave, Hellium, etc..) may have disabled or removed this component' +
            'check <a href="chrome://components" target="_blank" rel="noopener noreferrer">chrome://components</a> and make sure "Optimization Guide On Device Model" is present and up to date. ' +
            'See <a href="https://developer.chrome.com/docs/ai/built-in-apis" target="_blank" rel="noopener noreferrer">Chrome built-in AI docs</a> for more info. ' +
            'If you think this is a bug, please <a href="https://github.com/nay-cat/ChromeChat/issues" target="_blank" rel="noopener noreferrer">open an issue on GitHub</a>.'
        );
        return;
    }

    self._ccLM = api;
    self._ccLMIsEdge = /Edg\//.test(navigator.userAgent);

    const timeoutHandle = setTimeout(() => {
        setStatus('checking', 'Still checking...');
        showError(
            'ChromeChat detected the LanguageModel API but it is not responding. ' +
            'This usually happens with Chromium-based browsers (Brave, Helium, etc.) that expose the API but don\'t fully implement it, ' +
            'or with a modified version of Chrome where the underlying model component is missing or disabled. ' +
            'Check <a href="chrome://components" target="_blank" rel="noopener noreferrer">chrome://components</a> and make sure "Optimization Guide On Device Model" is installed and up to date. ' +
            'If you think this is a bug, please <a href="https://github.com/nay-cat/ChromeChat/issues" target="_blank" rel="noopener noreferrer">open an issue on GitHub</a>.'
        );

        const btn = document.createElement('button');
        btn.textContent = 'I am using Chrome, keep waiting';
        btn.className = 'btn-secondary';
        btn.onclick = function () {
            dom.setupModal.classList.add('hidden');
            setStatus('checking', 'Checking model...');
        };
        dom.setupError.querySelector('.setup-error-actions').appendChild(btn);
    }, 75000);

    try {
        const langs = getSelectedLangs();
        const availabilityParams = self._ccLMIsEdge ? {} : {
            expectedInputs: [{ type: 'text', languages: langs }],
            expectedOutputs: [{ type: 'text', languages: langs }],
        };
        const availability = await api.availability(availabilityParams);
        clearTimeout(timeoutHandle);

        if (availability === 'unavailable') {
            setStatus('unavailable', 'Model unavailable');
            showError((self._ccLMIsEdge ? 'The built-in model' : 'Gemini Nano') + ' is not available on this device. Check hardware requirements in Settings.');
            return;
        }

        if (availability === 'downloadable') {
            showLangAndDownload();
            return;
        }

        if (availability === 'downloading') {
            setStatus('downloading', 'Downloading...');
            await waitForDownload(langs);
            return;
        }

        await createNanoSession(langs);
    } catch (err) {
        clearTimeout(timeoutHandle);
        setStatus('unavailable', 'Error');
        showError('Initialization error: ' + err.message);
    }
}

function getSelectedLangs() {
    const saved = localStorage.getItem('cc_langs');

    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (err) {
            console.warn('Could not parse saved languages, using default:', err.message);
        }
    }

    return ['en'];
}

function saveSelectedLangs(langs) {
    localStorage.setItem('cc_langs', JSON.stringify(langs));
    state.selectedLang = langs[0];
    localStorage.setItem('cc_lang', langs[0]);
}

async function waitForDownload(langs) {
    openModal('Downloading model...', (self._ccLMIsEdge ? 'Your browser' : 'Chrome') + ' is downloading the model. This only happens once.');
    dom.setupProgress.classList.remove('hidden');

    try {
        const session = await self._ccLM.create({
            monitor: function (monitor) {
                monitor.addEventListener('downloadprogress', function (event) {
                    let pct = 0;
                    if (event.total > 0) {
                        pct = Math.round((event.loaded / event.total) * 100);
                    }
                    dom.progressFill.style.width = pct + '%';
                    dom.progressText.textContent = pct + '%';
                    setStatus('downloading', 'Downloading ' + pct + '%');
                });
            },
        });

        session.destroy();
        dom.setupProgress.classList.add('hidden');
        await createNanoSession(langs);
    } catch (err) {
        dom.setupProgress.classList.add('hidden');

        const availability = await self._ccLM.availability({
            expectedInputs: [{ type: 'text', languages: langs }],
            expectedOutputs: [{ type: 'text', languages: langs }],
        }).catch(() => 'unavailable');

        if (availability === 'available') {
            await createNanoSession(langs);
        } else {
            showError('Download failed: ' + err.message);
        }
    }
}

function showLangAndDownload() {
    setStatus('downloading', 'Model not downloaded');
    openModal('Download model', 'Choose the languages you need and download the model.');
    dom.setupLang.classList.remove('hidden');

    populateCompatBox();

    const savedLangs = getSelectedLangs();

    dom.langGrid.querySelectorAll('input[type="checkbox"]').forEach(function (checkbox) {
        checkbox.checked = savedLangs.includes(checkbox.value);
    });

    dom.setupDownloadBtn.onclick = function () {
        const checked = Array.from(dom.langGrid.querySelectorAll('input:checked'));
        const langs = checked.map(function (cb) { return cb.value; });
        let finalLangs;
        if (langs.length > 0) {
            finalLangs = langs;
        } else {
            finalLangs = ['en'];
        }
        saveSelectedLangs(finalLangs);
        downloadNano(finalLangs);
    };
}

async function populateCompatBox() {
    const gpuRow = document.getElementById('compat-gpu');
    const cpuRow = document.getElementById('compat-cpu');

    const ram = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency;

    let gpuVram = null;
    let gpuName = null;

    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const debugExt = gl && gl.getExtension('WEBGL_debug_renderer_info');
        const memExt = gl && gl.getExtension('WEBGL_memory_info_CHROMIUM');

        if (debugExt) {
            gpuName = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL);
        }

        if (memExt) {
            gpuVram = gl.getParameter(memExt.GPU_MEMORY_INFO_DEDICATED_VIDMEM_NVX) / 1024;
        }
    } catch (err) {
        console.warn('WebGL GPU info unavailable:', err.message);
    }

    const cpuOk = ram >= 16 && cores >= 4;

    if (gpuVram !== null) {
        const gpuOk = gpuVram > 4096;
        setCompatDot(gpuRow, gpuOk);
        const vramGB = (gpuVram / 1024).toFixed(1);
        let label;
        if (gpuName) {
            label = gpuName + ' (' + vramGB + ' GB VRAM, need >4 GB)';
        } else {
            label = vramGB + ' GB VRAM (need >4 GB)';
        }
        gpuRow.querySelector('span:last-child').textContent = 'GPU: ' + label;
    } else {
        setCompatDot(gpuRow, null);
        let label;
        if (gpuName) {
            label = gpuName + ' (VRAM unknown, need >4 GB)';
        } else {
            label = 'Unable to detect GPU (need >4 GB VRAM)';
        }
        gpuRow.querySelector('span:last-child').textContent = 'GPU: ' + label;
    }

    setCompatDot(cpuRow, cpuOk);
    let coresText;
    if (cores) {
        coresText = String(cores);
    } else {
        coresText = '?';
    }
    let ramText;
    if (ram) {
        ramText = String(ram);
    } else {
        ramText = '?';
    }
    cpuRow.querySelector('span:last-child').textContent = 'CPU: ' + coresText + ' cores, ' + ramText + ' GB RAM (need 4+ cores, 16+ GB)';
}

function setCompatDot(row, status) {
    const dot = row.querySelector('.compat-dot');

    if (status === null) {
        dot.className = 'compat-dot compat-warn';
    } else if (status === true) {
        dot.className = 'compat-dot compat-ok';
    } else {
        dot.className = 'compat-dot compat-fail';
    }
}

async function downloadNano(langs) {
    dom.setupLang.classList.add('hidden');
    dom.setupProgress.classList.remove('hidden');
    dom.setupTitle.textContent = 'Downloading model...';
    dom.setupMessage.textContent = 'This may take several minutes. You can keep this tab open.';
    setStatus('downloading', 'Downloading...');

    try {
        const session = await self._ccLM.create({
            expectedInputs: [{ type: 'text', languages: langs }],
            expectedOutputs: [{ type: 'text', languages: langs }],
            monitor: function (monitor) {
                monitor.addEventListener('downloadprogress', function (event) {
                    let pct = 0;
                    if (event.total > 0) {
                        pct = Math.round((event.loaded / event.total) * 100);
                    }
                    dom.progressFill.style.width = pct + '%';
                    dom.progressText.textContent = pct + '%';
                    setStatus('downloading', 'Downloading ' + pct + '%');
                });
            },
        });

        session.destroy();
        dom.setupProgress.classList.add('hidden');
        await createNanoSession(langs);
    } catch (err) {
        dom.setupProgress.classList.add('hidden');
        showError('Download failed: ' + err.message);
    }
}

async function createNanoSession(langs) {
    try {
        const settings = loadSettings();

        let createParams;
        if (self._ccLMIsEdge) {
            createParams = {
                initialPrompts: [{ role: 'system', content: settings.systemPrompt }],
            };
        } else {
            const imageAvail = await self._ccLM.availability({
                expectedInputs: [{ type: 'text', languages: langs }, { type: 'image' }],
                expectedOutputs: [{ type: 'text', languages: langs }],
            }).catch(() => 'unavailable');

            createParams = {
                expectedInputs: imageAvail === 'available'
                    ? [{ type: 'text', languages: langs }, { type: 'image' }]
                    : [{ type: 'text', languages: langs }],
                expectedOutputs: [{ type: 'text', languages: langs }],
                initialPrompts: [{ role: 'system', content: settings.systemPrompt }],
            };
        }

        state.session = await self._ccLM.create(createParams);

        state.modelReady = true;
        setStatus('ready', (self._ccLMIsEdge ? 'Phi' : 'Gemini Nano') + ' ready');
        closeModal();
        updateSendBtn(state);
    } catch (err) {
        setStatus('unavailable', 'Error');
        showError('Could not create session: ' + err.message);
    }
}
