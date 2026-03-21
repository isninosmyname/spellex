document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const languageSelect = document.getElementById('targetLanguage') as HTMLSelectElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const statusMsg = document.getElementById('status') as HTMLDivElement;

    chrome.storage.sync.get(['openrouterApiKey', 'targetLanguage'], (result) => {
        if (result.openrouterApiKey) {
            apiKeyInput.value = result.openrouterApiKey as string;
        }
        if (result.targetLanguage) {
            languageSelect.value = result.targetLanguage as string;
        }
    });

    saveBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const lang = languageSelect.value;

        chrome.storage.sync.set({
            openrouterApiKey: key,
            targetLanguage: lang
        }, () => {
            statusMsg.style.display = 'block';
            setTimeout(() => {
                statusMsg.style.display = 'none';
            }, 2000);
        });
    });
});
