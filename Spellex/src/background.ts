import { checkTextWithAI } from './ai';

// Spellex Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
    console.log('Spellex installed and ready!');
});

// Listener for messages from the content script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'CHECK_TEXT') {
        const textToCheck = request.payload.text;

        // Retrieve API key and language preference from storage
        chrome.storage.sync.get(['openrouterApiKey', 'targetLanguage'], async (result) => {
            const apiKey = result.openrouterApiKey as string;
            const targetLanguage = (result.targetLanguage as string) || 'auto';

            if (!apiKey) {
                sendResponse({ success: false, error: 'Please set your OpenRouter API key in the extension options.' });
                return;
            }

            // Call AI Function with language preference
            const aiResult = await checkTextWithAI(textToCheck, apiKey, targetLanguage);
            sendResponse(aiResult);
        });

        return true; // Keep the message channel open for async response
    }
});
