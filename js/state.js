/* single mutable object that holds the runtime state shared across all modules */

export const state = {
    session: null,
    chats: JSON.parse(localStorage.getItem('cc_chats') || '[]'),
    activeChatId: null,
    pendingFiles: [],
    isGenerating: false,
    modelReady: false,
    selectedLang: localStorage.getItem('cc_lang') || 'en',
};
