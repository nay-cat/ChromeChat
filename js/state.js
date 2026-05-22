/* single mutable object that holds the runtime state shared across all modules */

export const state = {
    sessions: {},
    sessionCreateParams: null,
    supportsImages: false,
    chats: JSON.parse(localStorage.getItem('cc_chats') || '[]'),
    activeChatId: null,
    pendingFiles: [],
    isGenerating: false,
    modelReady: false,
    selectedLang: localStorage.getItem('cc_lang') || 'en',
};
