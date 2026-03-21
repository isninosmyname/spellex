import { checkTextWithAI } from './ai';

chrome.runtime.onInstalled.addListener(() => {
    console.log('Spellex installed and ready!');
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'CHECK_TEXT') {
        const textToCheck = request.payload.text;

        chrome.storage.sync.get(['openrouterApiKey', 'targetLanguage'], async (result) => {
            const apiKey = result.openrouterApiKey as string;
            const targetLanguage = (result.targetLanguage as string) || 'auto';

            if (!apiKey) {
                sendResponse({ success: false, error: 'Please set your OpenRouter API key in the extension options.' });
                return;
            }

            const aiResult = await checkTextWithAI(textToCheck, apiKey, targetLanguage);
            sendResponse(aiResult);
        });

        return true; 
    }
});
