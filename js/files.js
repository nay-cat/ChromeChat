/* handles file and image attachments: reads them with filereader and renders the preview strip above the input */

import { state } from './state.js';
import { dom } from './dom.js';
import { escapeHtml, truncate, updateSendBtn } from './ui.js';

export async function handleFiles(fileList) {
    for (const file of fileList) {
        if (state.pendingFiles.length >= 5) break;

        const entry = {
            name: file.name,
            size: file.size,
        };

        if (file.type.startsWith('image/')) {
            entry.type = 'image';
            entry.dataUrl = await readFileAs(file, 'dataURL');
        } else if (file.type === 'application/pdf') {
            entry.type = 'file';

            const toast = showPdfToast(file.name);
            try {
                entry.textContent = await readPdf(file);
            } catch (err) {
                entry.textContent = '[Could not read PDF: ' + err.message + ']';
            } finally {
                toast.remove();
            }
        } else {
            entry.type = 'file';

            try {
                entry.textContent = await readFileAs(file, 'text');
            } catch {
                entry.textContent = '[Could not read file]';
            }
        }

        state.pendingFiles.push(entry);
    }

    renderAttachmentsPreview();
    updateSendBtn(state);
}

function readFileAs(file, mode) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();

        reader.onload = function (event) {
            resolve(event.target.result);
        };

        reader.onerror = reject;

        if (mode === 'dataURL') {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
}

let pdfjsLib = null;

async function loadPdfJs() {
    if (pdfjsLib) return;
    const module = await import('./lib/pdf.min.mjs');
    pdfjsLib = module;
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.min.mjs', import.meta.url).href;
}

/* shows a temporary toast while a pdf is being read */
function showPdfToast(filename) {
    const toast = document.createElement('div');
    toast.className = 'pdf-toast';

    const dino = document.createElement('img');
    dino.src = './icons/dinosaur.svg';
    dino.className = 'pdf-toast-dino';
    dino.alt = '';

    const text = document.createElement('span');
    text.textContent = 'Reading ' + filename + '...';

    toast.appendChild(dino);
    toast.appendChild(text);
    document.body.appendChild(toast);

    return toast;
}

/* extracts all text content from a pdf file using pdf.js */
async function readPdf(file) {
    await loadPdfJs();

    const arrayBuffer = await new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function (e) { resolve(e.target.result); };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pageTexts = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const lines = content.items.map(function (item) { return item.str; });
        pageTexts.push('--- Page ' + i + ' ---\n' + lines.join(' '));
    }

    return pageTexts.join('\n\n');
}

function renderAttachmentsPreview() {
    dom.attachmentsPreview.innerHTML = '';

    if (!state.pendingFiles.length) {
        dom.attachmentsPreview.classList.add('hidden');
        return;
    }

    dom.attachmentsPreview.classList.remove('hidden');

    state.pendingFiles.forEach(function (file, index) {
        const item = document.createElement('div');
        item.className = 'preview-item';

        if (file.type === 'image') {
            item.innerHTML = `<img src="${file.dataUrl}" alt="${escapeHtml(file.name)}" />`;
        } else {
            const filePreview = document.createElement('div');
            filePreview.className = 'preview-item-file';

            const fileIcon = document.createElement('img');
            fileIcon.src = './icons/documentIcon.svg';
            fileIcon.alt = '';
            fileIcon.width = 14;
            fileIcon.height = 14;

            filePreview.appendChild(fileIcon);
            filePreview.appendChild(document.createTextNode(truncate(file.name, 22)));
            item.appendChild(filePreview);
        }

        const removeButton = document.createElement('button');
        removeButton.className = 'preview-remove';
        removeButton.textContent = 'x';
        removeButton.onclick = function () {
            state.pendingFiles.splice(index, 1);
            renderAttachmentsPreview();
            updateSendBtn(state);
        };

        item.appendChild(removeButton);
        dom.attachmentsPreview.appendChild(item);
    });
}

export function clearAttachments() {
    state.pendingFiles = [];
    dom.fileInput.value = '';
    renderAttachmentsPreview();
}
