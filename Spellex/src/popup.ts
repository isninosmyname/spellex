document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;
    const optionsBtn = document.getElementById('optionsBtn') as HTMLButtonElement;

    chrome.storage.sync.get(['spellexEnabled'], (result) => {
        const isEnabled = result.spellexEnabled !== false; 
        updateToggleUI(isEnabled);
    });

    toggleBtn.addEventListener('click', () => {
        chrome.storage.sync.get(['spellexEnabled'], (result) => {
            const wasEnabled = result.spellexEnabled !== false;
            const nowEnabled = !wasEnabled;

            chrome.storage.sync.set({ spellexEnabled: nowEnabled }, () => {
                updateToggleUI(nowEnabled);

                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        if (tab.id) {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'SPELLEX_TOGGLE',
                                enabled: nowEnabled
                            }).catch(() => { }); 
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
