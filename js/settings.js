/* loads and saves user preferences to localStorage */

const DEFAULTS = {
    aiName: 'ChromeChat',
    userName: 'You',
    systemPrompt: 'You are a helpful, concise assistant. Respond in the language the user writes in.',
    welcomeMessage: 'Local AI with Gemini Nano. Works offline.',
};

export function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('cc_settings') || '{}');
        return Object.assign({}, DEFAULTS, saved);
    } catch {
        return Object.assign({}, DEFAULTS);
    }
}

export function saveSettings(settings) {
    localStorage.setItem('cc_settings', JSON.stringify(settings));
}
