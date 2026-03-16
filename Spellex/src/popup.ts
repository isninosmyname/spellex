// Spellex Popup Logic
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;
    const optionsBtn = document.getElementById('optionsBtn') as HTMLButtonElement;

    // Load persisted state
    chrome.storage.sync.get(['spellexEnabled'], (result) => {
        const isEnabled = result.spellexEnabled !== false; // Default to true
        updateToggleUI(isEnabled);
    });

    toggleBtn.addEventListener('click', () => {
        chrome.storage.sync.get(['spellexEnabled'], (result) => {
            const wasEnabled = result.spellexEnabled !== false;
            const nowEnabled = !wasEnabled;

            chrome.storage.sync.set({ spellexEnabled: nowEnabled }, () => {
                updateToggleUI(nowEnabled);

                // Notify all tabs about the state change
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        if (tab.id) {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'SPELLEX_TOGGLE',
                                enabled: nowEnabled
                            }).catch(() => { }); // Ignore tabs where content script isn't loaded
                        }
                    });
                });
            });
        });
    });

    optionsBtn.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    function updateToggleUI(isEnabled: boolean) {
        toggleBtn.textContent = isEnabled ? '⏸ Disable' : '▶ Enable';
        toggleBtn.style.backgroundColor = isEnabled ? '#8b5cf6' : '#475569';
    }
});
