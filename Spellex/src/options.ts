document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const languageSelect = document.getElementById('targetLanguage') as HTMLSelectElement;
    const formalitySelect = document.getElementById('formalityLevel') as HTMLSelectElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const statusMsg = document.getElementById('status') as HTMLDivElement;

    chrome.storage.sync.get(['openrouterApiKey', 'targetLanguage', 'formalityLevel'], (result) => {
        if (result.openrouterApiKey) {
            apiKeyInput.value = result.openrouterApiKey as string;
        }
        if (result.targetLanguage) {
            languageSelect.value = result.targetLanguage as string;
        }
        if (result.formalityLevel) {
            formalitySelect.value = result.formalityLevel as string;
        }
    });

    saveBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const lang = languageSelect.value;
        const formality = formalitySelect.value;

        chrome.storage.sync.set({
            openrouterApiKey: key,
            targetLanguage: lang,
            formalityLevel: formality
        }, () => {
            statusMsg.style.display = 'block';
            setTimeout(() => {
                statusMsg.style.display = 'none';
            }, 2000);
        });
    });
});
