<img width="300" height="69" alt="chromeChatLogo" src="https://github.com/user-attachments/assets/4ae1cafd-21e0-4d09-8645-7068c14a61c8" />

Offline PWA chat powered by Chrome's built-in Gemini Nano ([Prompt API](https://developer.chrome.com/docs/ai/prompt-api)) and Microsoft Edge's Phi-4. No server, no API key, no internet required after setup.

> "Visit the [page once](https://nay-cat.github.io/ChromeChat/) using Wi-Fi, and then use it even without Wi-Fi"

## Requirements

**Google Chrome:**
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

## Troubleshooting

### API not found / LanguageModel API unavailable

- Make sure you are on **Chrome 148+**
- Go to `chrome://flags/#prompt-api-for-gemini-nano` and set it to **Enabled**, then relaunch Chrome
- Go to `chrome://components` and make sure **Optimization Guide On Device Model** is present and up to date
- Some Chromium-based browsers (Brave, Helium, etc.) expose the LanguageModel API but don't fully implement it. If you're on one of these browsers, switch to Google Chrome or check if your browser has its own Prompt API support *(many of them spoof the user agent, making browser detection unreliable and frankly not worth the effort)*

### Model not loading / API not responding after 30 seconds

- The API was detected but is not responding, this usually means the model component is missing or disabled
- Go to `chrome://components` and update/make sure is present **Optimization Guide On Device Model** (should be in Google Chrome)
- Open `chrome://on-device-internals` to see the model's actual status, file path, and any errors reported by Chrome, this is the most reliable way to diagnose download or initialization failures
- If the issue persists, try relaunching Chrome or reinstalling it

### Microsoft Edge: model not loading

- Edge uses its own built-in model (Phi) instead of Gemini Nano
- Go to `edge://flags/#edge-llm-prompt-api-for-phi-mini` and set it to **Enabled**, then relaunch Edge
- ChromeChat will automatically detect Edge and adapt accordingly

### Still having issues?

[Open an issue on GitHub](https://github.com/nay-cat/ChromeChat/issues) with your browser version and a description of the problem.

## Why ChromeChat?

- **Works anywhere** no Wi-Fi, no server, no cloud dependency
- **Fast responses** the model runs on your hardware
- **Funny** Funny

---
<img width="1717" height="891" alt="image" src="https://github.com/user-attachments/assets/f5a67f93-f410-410b-8d71-7b04ab297f84" />

Imagine using this so your data doesnt go to online servers, but then you remember that you are using Google Chrome
