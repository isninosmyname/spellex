// Spellex Content Script

console.log('Spellex Content Script loaded ✨');

let typingTimer: number | null = null;
const TYPING_INTERVAL = 500; // Wait 500ms after user stops typing to trigger check
const BLOCK_SIZE = 10; // Words per block

// Guards to prevent correction loops
let isApplyingCorrection = false;
let checkedBlocks: Set<string> = new Set(); // Track which blocks we've already checked

// Global enabled state — loaded from storage on startup
let isEnabled = true;
chrome.storage.sync.get(['spellexEnabled'], (result) => {
    isEnabled = result.spellexEnabled !== false; // Default to true
    console.log('Spellex is', isEnabled ? 'ENABLED ✅' : 'DISABLED ⏸');
});

// Listen for toggle messages from popup
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SPELLEX_TOGGLE') {
        isEnabled = message.enabled;
        console.log('Spellex toggled:', isEnabled ? 'ENABLED ✅' : 'DISABLED ⏸');
        if (!isEnabled) {
            hideLoadingState();
        }
    }
});

// Basic listener structure for text inputs
document.addEventListener('input', (event) => {
    // If WE are the ones making the change, ignore the event entirely
    if (isApplyingCorrection) {
        return;
    }

    // If Spellex is disabled, don't process
    if (!isEnabled) {
        return;
    }

    let targetNode = event.target as Node;

    // If the event fired on a text node (common in rich text editors), get its parent element
    if (targetNode.nodeType === Node.TEXT_NODE && targetNode.parentElement) {
        targetNode = targetNode.parentElement;
    }

    const target = targetNode as HTMLElement;

    // Discord specifically uses a contenteditable div deeply nested within other elements.
    const editableContainer = target.isContentEditable ? target : (typeof target.closest === 'function' ? target.closest('[contenteditable="true"]') as HTMLElement : null);

    // We only care about editable elements
    if (target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text') ||
        editableContainer || (typeof target.getAttribute === 'function' && target.getAttribute('role') === 'textbox')) {

        // Use the container if the target was a child element (common in Discord/Slate)
        const finalTarget = editableContainer || target;

        // Clear the previous timer
        if (typingTimer) clearTimeout(typingTimer);

        // 1. Debounce and extract text
        typingTimer = setTimeout(() => {
            let text = '';

            // Extract based on element type
            if (finalTarget.tagName === 'TEXTAREA' || finalTarget.tagName === 'INPUT') {
                text = (finalTarget as HTMLInputElement | HTMLTextAreaElement).value;
            } else if (finalTarget.isContentEditable) {
                text = finalTarget.innerText || finalTarget.textContent || '';
            }

            // Remove excessive whitespace
            const trimmedText = text.replace(/\s+/g, ' ').trim();
            const words = trimmedText.split(' ');

            // Need at least 3 words for context
            if (words.length < 3) return;

            // Split into blocks of BLOCK_SIZE words
            const blocks: string[] = [];
            for (let i = 0; i < words.length; i += BLOCK_SIZE) {
                const block = words.slice(i, i + BLOCK_SIZE).join(' ');
                blocks.push(block);
            }

            // Find blocks that haven't been checked yet
            const uncheckedBlocks = blocks.filter(block => !checkedBlocks.has(block));

            if (uncheckedBlocks.length === 0) {
                console.log('Spellex: All blocks already checked, skipping.');
                return;
            }

            console.log(`Spellex: ${uncheckedBlocks.length} new block(s) to check:`, uncheckedBlocks);

            // Show loading state
            showLoadingState(finalTarget);

            // Process each unchecked block
            let pendingBlocks = uncheckedBlocks.length;
            let totalCorrections = 0;

            uncheckedBlocks.forEach(block => {
                try {
                    chrome.runtime.sendMessage(
                        { type: 'CHECK_TEXT', payload: { text: block } },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                console.warn("Spellex connection error:", chrome.runtime.lastError.message);
                                pendingBlocks--;
                                if (pendingBlocks <= 0) hideLoadingState();
                                return;
                            }

                            // Mark this block as checked
                            checkedBlocks.add(block);

                            if (response && response.success) {
                                if (response.corrections && response.corrections.length > 0) {
                                    console.log("Spellex Corrections for block:", response.corrections);
                                    applyCorrectionsRealTime(finalTarget, response.corrections);
                                    totalCorrections += response.corrections.length;
                                }
                            } else if (response && response.error) {
                                console.error("Spellex Error:", response.error);
                            }

                            pendingBlocks--;
                            if (pendingBlocks <= 0) {
                                if (totalCorrections > 0) {
                                    showSuccessState(finalTarget, totalCorrections);
                                } else {
                                    hideLoadingState();
                                }
                            }
                        }
                    );
                } catch (e: any) {
                    pendingBlocks--;
                    if (pendingBlocks <= 0) hideLoadingState();
                    if (e.message.includes('Extension context invalidated')) {
                        console.warn('Spellex has been updated. Please refresh the page.');
                    } else {
                        console.error('Spellex communication error:', e);
                    }
                }
            });

        }, TYPING_INTERVAL);
    }
}, true); // Use capture phase

// ─── Tooltip UI ───────────────────────────────────────────────

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

    // Auto-hide after 2.5 seconds
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

// ─── Correction Logic ─────────────────────────────────────────

function applyCorrectionsRealTime(element: HTMLElement, corrections: any[]) {
    // Set the guard flag BEFORE making changes
    isApplyingCorrection = true;

    corrections.forEach(c => {
        applyCorrection(element, c.original, c.corrected);
    });

    // Update checkedBlocks with corrected text
    let newText = '';
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        newText = (element as HTMLInputElement | HTMLTextAreaElement).value;
    } else if (element.isContentEditable) {
        newText = element.innerText || element.textContent || '';
    }

    // Re-build blocks from corrected text and mark them all as checked
    const correctedWords = newText.replace(/\s+/g, ' ').trim().split(' ');
    checkedBlocks.clear();
    for (let i = 0; i < correctedWords.length; i += BLOCK_SIZE) {
        checkedBlocks.add(correctedWords.slice(i, i + BLOCK_SIZE).join(' '));
    }

    // Release the guard after a short delay
    setTimeout(() => {
        isApplyingCorrection = false;
    }, 100);
}

function applyCorrection(element: HTMLElement, original: string, corrected: string) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        const input = element as HTMLInputElement;
        input.value = input.value.replace(original, corrected);
        // DON'T dispatch a new input event — we don't want to trigger ourselves
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
