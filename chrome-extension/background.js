/**
 * Intents - Background Service Worker
 * Creates context menus and handles storage for Hold That Thought and Intent Mode
 */

// Intent Mode configurations
const INTENTS = [
    { id: 'intent-read', title: '📖 Read', intent: 'read' },
    { id: 'intent-learn', title: '📚 Learn', intent: 'learn' },
    { id: 'intent-fix', title: '🔧 Fix', intent: 'fix' },
    { id: 'intent-study', title: '📝 Study', intent: 'study' },
    { id: 'intent-reflect', title: '🪞 Reflect', intent: 'reflect' }
];

// Function to create all context menus
function createContextMenus() {
    // Clear existing menus first
    chrome.contextMenus.removeAll(() => {
        // Hold That Thought menu (for selected text)
        chrome.contextMenus.create({
            id: 'hold-that-thought',
            title: '💭 Hold That Thought',
            contexts: ['selection']
        });

        // Intent Mode parent menu (for page context)
        chrome.contextMenus.create({
            id: 'intent-mode',
            title: '🎯 Intent Mode',
            contexts: ['page']
        });

        // Intent Mode sub-menus
        INTENTS.forEach(item => {
            chrome.contextMenus.create({
                id: item.id,
                parentId: 'intent-mode',
                title: item.title,
                contexts: ['page']
            });
        });

        console.log('Context menus created successfully');
    });
}

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
    createContextMenus();
});

// Also create on startup (in case extension was updated)
chrome.runtime.onStartup.addListener(() => {
    createContextMenus();
});

// Create menus immediately when script loads (for development)
createContextMenus();

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    // Skip chrome:// and other restricted pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return;
    }

    // Handle Hold That Thought
    if (info.menuItemId === 'hold-that-thought' && info.selectionText) {
        try {
            // Try to send message first
            await chrome.tabs.sendMessage(tab.id, {
                action: 'showThoughtPopup',
                selectedText: info.selectionText,
                pageTitle: tab.title,
                pageUrl: tab.url
            });
        } catch (error) {
            // Content script not injected - inject it now
            try {
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['thought-popup.css']
                });
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                // Wait a bit for script to load, then send message
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'showThoughtPopup',
                            selectedText: info.selectionText,
                            pageTitle: tab.title,
                            pageUrl: tab.url
                        });
                    } catch (e) {
                        console.log('Failed to show popup after injection:', e);
                    }
                }, 100);
            } catch (injectError) {
                console.log('Cannot inject into this page:', injectError);
            }
        }
        return;
    }

    // Handle Intent Mode
    const intentItem = INTENTS.find(i => i.id === info.menuItemId);
    if (intentItem) {
        try {
            // Try to send message first
            await chrome.tabs.sendMessage(tab.id, {
                action: 'activateIntentMode',
                intent: intentItem.intent
            });
        } catch (error) {
            // Intent Mode script not injected - inject it now
            try {
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['intent-mode.css']
                });
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['intent-mode.js']
                });
                // Wait a bit for script to load, then send message
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'activateIntentMode',
                            intent: intentItem.intent
                        });
                    } catch (e) {
                        console.log('Failed to activate Intent Mode after injection:', e);
                    }
                }, 150);
            } catch (injectError) {
                console.log('Cannot inject Intent Mode into this page:', injectError);
            }
        }
    }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'hold-that-thought') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return;
        }

        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'triggerHoldThought'
            });
        } catch (error) {
            // Inject content script first
            try {
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['thought-popup.css']
                });
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'triggerHoldThought'
                        });
                    } catch (e) {
                        console.log('Failed after injection:', e);
                    }
                }, 100);
            } catch (injectError) {
                console.log('Cannot inject into this page:', injectError);
            }
        }
    }
});

// Handle save thought from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveThought') {
        saveThought(request.thought).then(() => {
            sendResponse({ success: true });
        }).catch((err) => {
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep channel open for async response
    }

    if (request.action === 'getThoughts') {
        getThoughts().then((thoughts) => {
            sendResponse({ thoughts });
        });
        return true;
    }

    if (request.action === 'deleteThought') {
        deleteThought(request.id).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'mergeThoughts') {
        mergeThoughts(request.thoughtIds).then((result) => {
            sendResponse(result);
        });
        return true;
    }
});

// Save thought to storage
async function saveThought(thought) {
    const result = await chrome.storage.local.get(['thoughts']);
    const thoughts = result.thoughts || [];
    thoughts.unshift({
        ...thought,
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
    });
    // Keep only last 100 thoughts
    await chrome.storage.local.set({ thoughts: thoughts.slice(0, 100) });
}

// Get all thoughts
async function getThoughts() {
    const result = await chrome.storage.local.get(['thoughts']);
    return result.thoughts || [];
}

// Delete a thought
async function deleteThought(id) {
    const result = await chrome.storage.local.get(['thoughts']);
    const thoughts = (result.thoughts || []).filter(t => t.id !== id);
    await chrome.storage.local.set({ thoughts });
}

// Merge thoughts
async function mergeThoughts(thoughtIds) {
    const result = await chrome.storage.local.get(['thoughts']);
    const all = result.thoughts || [];
    const toMerge = all.filter(t => thoughtIds.includes(t.id));

    if (toMerge.length < 2) return { success: false, error: 'Not enough thoughts to merge' };

    // Sort old -> new
    toMerge.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const newest = toMerge[toMerge.length - 1]; // Use newest metadata
    const combinedText = toMerge.map(t => t.text).join('\n\n');

    // Combine context properly
    const uniqueContexts = [...new Set(toMerge.map(t => t.context).filter(c => c))];
    const combinedContext = uniqueContexts.join('\n---\n');

    // Combine tags
    const uniqueTags = [...new Set(toMerge.map(t => t.tag))];
    const combinedTag = uniqueTags.join(', '); // or just pick the first one? User might prefer multiple. 
    // Actually, UI only shows one tag bubble usually. Let's use Comma separated.

    const merged = {
        ...newest,
        text: combinedText,
        context: combinedContext,
        tag: combinedTag,
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
    };

    const remaining = all.filter(t => !thoughtIds.includes(t.id));
    // Put merged at the top (newest)
    const final = [merged, ...remaining];

    await chrome.storage.local.set({ thoughts: final });
    return { success: true };
}
