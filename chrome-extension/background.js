/**
 * Hold That Thought - Background Service Worker
 * Creates context menu and handles storage
 */

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'hold-that-thought',
        title: '💭 Hold That Thought',
        contexts: ['selection']
    });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'hold-that-thought' && info.selectionText) {
        chrome.tabs.sendMessage(tab.id, {
            action: 'showThoughtPopup',
            selectedText: info.selectionText,
            pageTitle: tab.title,
            pageUrl: tab.url
        });
    }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
    if (command === 'hold-that-thought') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'triggerHoldThought'
                });
            }
        });
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
