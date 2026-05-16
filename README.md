<img width="300" height="69" alt="chromeChatLogo" src="https://github.com/user-attachments/assets/4ae1cafd-21e0-4d09-8645-7068c14a61c8" />

Offline PWA chat powered by Chrome's built-in Gemini Nano. No server, no API key, no internet required after setup.

> "Visit the [page once](https://nay-cat.github.io/ChromeChat/) using Wi-Fi, and then use it even without Wi-Fi"

## Requirements

- Chrome 148+
- Enable the flag: `chrome://flags/#prompt-api-for-gemini-nano` 
- ~4GB free storage (for the Gemini Nano model download)
- Compatible GPU and CPU (checked automatically on first launch)
- [More info about requirements here](https://developer.chrome.com/docs/ai/prompt-api)

## Features

- Runs fully **offline** after the model is downloaded (~4 GB, one-time)
- **Chat history** saved locally in your browser
- **File attachments**, images, PDFs, text files, and code files
- **Export / Import** chats.
- Markdown rendering with **syntax highlighting**
- Customizable AI name, your name, and system prompt

## How to use

1. [Open the web in Chrome](https://nay-cat.github.io/ChromeChat/)
2. On first launch, ChromeChat will check if Gemini Nano is available and guide you through the model download
3. Select your preferred languages (English, Spanish, Japanese)
4. Start chatting

## How data is stored

ChromeChat uses two browser storage mechanisms, both completely local:

> **LocalStorage:** stores chat history (titles, messages, timestamps) as JSON.
  Limited to 5 MB, so if it fills up, the oldest chats are automatically deleted to make room.

> **IndexedDB:** stores image and file attachments as binary data.
  Used instead of LocalStorage because attachments can be large and would quickly hit the 5 MB limit.

When you **export** a chat (`.crchat` file), attachments are pulled from IndexedDB and embedded into the JSON file so the export is self-contained.
When you **import** a `.crchat` file, attachments are extracted and saved back into IndexedDB.

Nothing is ever sent to a server, all data stays in your browser.

## Why ChromeChat?

- **Works anywhere** no Wi-Fi, no server, no cloud dependency
- **Fast responses** the model runs on your hardware
- **Funny** Funny

---
<img width="1717" height="891" alt="image" src="https://github.com/user-attachments/assets/f5a67f93-f410-410b-8d71-7b04ab297f84" />

Imagine using this so your data doesnt go to online servers, but then you remember that you are using Google Chrome
