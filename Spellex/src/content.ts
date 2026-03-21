console.log('Spellex Content Script loaded ✨');

let typingTimer: number | null = null;
const TYPING_INTERVAL = 2000; 
const BLOCK_SIZE = 10; 

let isApplyingCorrection = false;
let checkedBlocks: Set<string> = new Set(); 

let isCheckInFlight = false;          
let blocksBeingChecked: Set<string> = new Set(); 
let inFlightStale = false;            
let pendingTarget: HTMLElement | null = null; 

let isEnabled = true;
chrome.storage.sync.get(['spellexEnabled'], (result) => {
    isEnabled = result.spellexEnabled !== false; 
    console.log('Spellex is', isEnabled ? 'ENABLED ✅' : 'DISABLED ⏸');
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SPELLEX_TOGGLE') {
        isEnabled = message.enabled;
        console.log('Spellex toggled:', isEnabled ? 'ENABLED ✅' : 'DISABLED ⏸');
        if (!isEnabled) {
            hideLoadingState();
        }
    }
});

function getElementText(el: HTMLElement): string {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        return (el as HTMLInputElement | HTMLTextAreaElement).value;
    } else if (el.isContentEditable) {
        return el.innerText || el.textContent || '';
    }
    return '';
}

function runCheck(element: HTMLElement) {
    if (isCheckInFlight) {
        pendingTarget = element;
        return;
    }

    const text = getElementText(element);
    const trimmedText = text.replace(/\s+/g, ' ').trim();
    const words = trimmedText.split(' ');

    if (words.length < 3) return;

    const blocks: string[] = [];
    for (let i = 0; i < words.length; i += BLOCK_SIZE) {
        blocks.push(words.slice(i, i + BLOCK_SIZE).join(' '));
    }

    const uncheckedBlocks = blocks.filter(block => !checkedBlocks.has(block));

    if (uncheckedBlocks.length === 0) {
        console.log('Spellex: All blocks already checked, skipping.');
        return;
    }

    console.log(`Spellex: ${uncheckedBlocks.length} new block(s) to check:`, uncheckedBlocks);

    isCheckInFlight = true;
    inFlightStale = false;
    blocksBeingChecked = new Set(uncheckedBlocks);
    showLoadingState(element);

    let pendingBlocks = uncheckedBlocks.length;
    let totalCorrections = 0;

    const finalizeFlight = () => {
        isCheckInFlight = false;
        blocksBeingChecked.clear();

        if (inFlightStale) {
            console.log('Spellex: Flight was stale. Clearing cache for re-check.');
            checkedBlocks.clear();
            inFlightStale = false;
            hideLoadingState();
        } else {
            if (totalCorrections > 0) {
                showSuccessState(element, totalCorrections);
            } else {
                hideLoadingState();
            }
        }

        if (pendingTarget) {
            const queued = pendingTarget;
            pendingTarget = null;
            runCheck(queued);
        }
    };

    uncheckedBlocks.forEach(block => {
        try {
            chrome.runtime.sendMessage(
                { type: 'CHECK_TEXT', payload: { text: block } },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Spellex connection error:', chrome.runtime.lastError.message);
                        pendingBlocks--;
                        if (pendingBlocks <= 0) finalizeFlight();
                        return;
                    }

                    checkedBlocks.add(block);

                    if (!inFlightStale) {
                        if (response && response.success) {
                            if (response.corrections && response.corrections.length > 0) {
                                console.log('Spellex Corrections for block:', response.corrections);
                                applyCorrectionsRealTime(element, response.corrections);
                                totalCorrections += response.corrections.length;
                            }
                        } else if (response && response.error) {
                            console.error('Spellex Error:', response.error);
                        }
                    } else {
                        console.log('Spellex: Discarding stale correction for block:', block);
                    }

                    pendingBlocks--;
                    if (pendingBlocks <= 0) finalizeFlight();
                }
            );
        } catch (e: any) {
            pendingBlocks--;
            if (pendingBlocks <= 0) finalizeFlight();
            if (e.message.includes('Extension context invalidated')) {
                console.warn('Spellex has been updated. Please refresh the page.');
            } else {
                console.error('Spellex communication error:', e);
            }
        }
    });
}

document.addEventListener('input', (event) => {
    if (isApplyingCorrection) return;

    if (!isEnabled) return;

    let targetNode = event.target as Node;

    if (targetNode.nodeType === Node.TEXT_NODE && targetNode.parentElement) {
        targetNode = targetNode.parentElement;
    }

    const target = targetNode as HTMLElement;

    const editableContainer = target.isContentEditable
        ? target
        : (typeof target.closest === 'function' ? target.closest('[contenteditable="true"]') as HTMLElement : null);

    if (!(
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text') ||
        editableContainer ||
        (typeof target.getAttribute === 'function' && target.getAttribute('role') === 'textbox')
    )) {
        return;
    }

    const finalTarget = editableContainer || target;

    if (typingTimer) clearTimeout(typingTimer);

    if (isCheckInFlight) {
        const trimmedCurrent = getElementText(finalTarget).replace(/\s+/g, ' ').trim();
        const userModifiedInFlightBlock = [...blocksBeingChecked].some(
            block => !trimmedCurrent.includes(block)
        );
        if (userModifiedInFlightBlock) {
            console.log('Spellex: User modified in-flight block. Marking stale.');
            inFlightStale = true;
        }
        typingTimer = window.setTimeout(() => runCheck(finalTarget), TYPING_INTERVAL);
        return;
    }

    typingTimer = window.setTimeout(() => runCheck(finalTarget), TYPING_INTERVAL);

}, true); 

function getOrCreateTooltip(): HTMLElement {
    let tooltip = document.getElementById('spellex-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'spellex-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = '#1e1e2f';
        tooltip.style.color = '#fff';
        tooltip.style.border = '1px solid #8b5cf6';
        tooltip.style.borderRadius = '6px';
        tooltip.style.padding = '8px 12px';
        tooltip.style.zIndex = '999999';
        tooltip.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        tooltip.style.fontFamily = 'system-ui, sans-serif';
        tooltip.style.fontSize = '14px';
        tooltip.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function showLoadingState(element: HTMLElement) {
    const tooltip = getOrCreateTooltip();
    const rect = element.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.innerHTML = `<div style="color: #a78bfa; font-style: italic;">✨ Spellex thinking...</div>`;
    tooltip.style.opacity = '1';
    tooltip.style.display = 'block';
}

function showSuccessState(element: HTMLElement, count: number) {
    const tooltip = getOrCreateTooltip();
    const rect = element.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.innerHTML = `<div style="color: #10b981; font-weight: bold;">✅ Spellex fixed ${count} error(s)</div>`;
    tooltip.style.opacity = '1';
    tooltip.style.display = 'block';

    setTimeout(() => {
        hideLoadingState();
    }, 2500);
}

function hideLoadingState() {
    const tooltip = document.getElementById('spellex-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            tooltip.style.display = 'none';
        }, 300);
    }
}

function applyCorrectionsRealTime(element: HTMLElement, corrections: any[]) {
    isApplyingCorrection = true;

    corrections.forEach(c => {
        applyCorrection(element, c.original, c.corrected);
    });

    const newText = getElementText(element);

    const correctedWords = newText.replace(/\s+/g, ' ').trim().split(' ');
    checkedBlocks.clear();
    for (let i = 0; i < correctedWords.length; i += BLOCK_SIZE) {
        checkedBlocks.add(correctedWords.slice(i, i + BLOCK_SIZE).join(' '));
    }

    setTimeout(() => {
        isApplyingCorrection = false;
    }, 100);
}

function applyCorrection(element: HTMLElement, original: string, corrected: string) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        const input = element as HTMLInputElement;
        input.value = input.value.replace(original, corrected);
    } else if (element.isContentEditable) {
        element.focus();
        if (window.getSelection) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const newText = (element.innerText || element.textContent || '').replace(original, corrected);
                document.execCommand('selectAll', false, '');
                document.execCommand('insertText', false, newText);
            }
        }
    }
}
