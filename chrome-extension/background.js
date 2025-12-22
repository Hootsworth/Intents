/**
 * Intents - Background Service Worker
 * Creates context menus and handles storage for Hold That Thought and Intent Mode
 */

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

        // Single Intent Mode option (uses 'read' mode by default)
        chrome.contextMenus.create({
            id: 'intent-mode',
            title: '🧠 Intent Mode',
            contexts: ['page']
        });

        // Isolate Mode
        chrome.contextMenus.create({
            id: 'isolate-text',
            title: '🔍 Isolate this section',
            contexts: ['selection']
        });

        console.log('Context menus created successfully');
    });
}

// Create context menus on install only (prevents duplicate ID errors)
chrome.runtime.onInstalled.addListener(() => {
    createContextMenus();
});

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

    // Handle Isolate
    if (info.menuItemId === 'isolate-text') {
        sendMessageOrInject(tab, { action: 'triggerIsolate' }, ['intent-mode.css'], ['intent-mode.js']);
        return;
    }

    // Handle Intent Mode (single option, defaults to 'read')
    if (info.menuItemId === 'intent-mode') {
        sendMessageOrInject(tab, {
            action: 'activateIntentMode',
            intent: 'read'
        }, ['intent-mode.css'], ['intent-mode.js']);
    }
});

// Helper for injection
async function sendMessageOrInject(tab, message, cssFiles, jsFiles) {
    try {
        await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
        try {
            if (cssFiles && cssFiles.length) {
                await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: cssFiles });
            }
            if (jsFiles && jsFiles.length) {
                await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: jsFiles });
            }
            setTimeout(async () => {
                try {
                    await chrome.tabs.sendMessage(tab.id, message);
                } catch (e) {
                    console.log('Failed after injection:', e);
                }
            }, 150);
        } catch (injectError) {
            console.log('Injection failed:', injectError);
        }
    }
}

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

    if (command === 'hold-that-thought') {
        sendMessageOrInject(tab, { action: 'triggerHoldThought' }, ['thought-popup.css'], ['content.js']);
    }

    if (command === 'ping-me') {
        sendMessageOrInject(tab, { action: 'showPingBar' }, ['thought-popup.css'], ['content.js']);
    }

    if (command === 'quick-ai') {
        sendMessageOrInject(tab, { action: 'showAIBar' }, ['thought-popup.css'], ['content.js']);
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

    if (request.action === 'createPing') {
        saveThought({ ...request.thought, isPing: true }).then((savedThought) => {
            if (request.minutes) {
                chrome.alarms.create(`ping_${savedThought.id}`, { delayInMinutes: parseFloat(request.minutes) });
            }
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

    if (request.action === 'askAI') {
        handleAIRequest(request.prompt, request.context, sendResponse);
        return true;
    }

    if (request.action === 'checkAIKey') {
        chrome.storage.local.get(['openaiKey'], (result) => {
            sendResponse({ hasKey: !!result.openaiKey });
        });
        return true;
    }

    if (request.action === 'saveAIKey') {
        chrome.storage.local.set({ openaiKey: request.key }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('ping_')) {
        const thoughtId = alarm.name.replace('ping_', '');

        getThoughts().then(thoughts => {
            const thought = thoughts.find(t => t.id === thoughtId);
            if (thought) {
                // 1. Delete the thought (it's done)
                deleteThought(thoughtId);

                // 2. Trigger Custom Friendly UI on active tab
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs && tabs[0]) {
                        sendMessageOrInject(tabs[0], {
                            action: 'triggerPingNotification',
                            thought: thought
                        }, ['thought-popup.css'], ['content.js']);
                    }
                });
            }
        });
    }
});

chrome.notifications.onButtonClicked.addListener(() => {
    chrome.tabs.create({ url: 'index.html' });
});

// Save thought to storage
async function saveThought(thought) {
    const result = await chrome.storage.local.get(['thoughts']);
    const thoughts = result.thoughts || [];
    const newThought = {
        ...thought,
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
    };
    thoughts.unshift(newThought);
    // Keep only last 100 thoughts
    await chrome.storage.local.set({ thoughts: thoughts.slice(0, 100) });
    return newThought;
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

async function handleAIRequest(prompt, context, sendResponse) {
    try {
        const result = await chrome.storage.local.get(['openaiKey']);
        if (!result.openaiKey) {
            sendResponse({ error: 'OpenAI API Key provided. Go to New Tab > Settings.' });
            return;
        }

        const messages = [
            { role: "system", content: "You are a helpful, concise AI assistant. Give short, intuitive answers. Do not encourage follow-ups. Keep it under 50 words if possible." }
        ];

        if (context) {
            messages.push({ role: "system", content: `Context: "${context}"` });
        }

        messages.push({ role: "user", content: prompt });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${result.openaiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: messages,
                max_tokens: 150,
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (data.error) {
            sendResponse({ error: 'OpenAI Error: ' + data.error.message });
        } else {
            const answer = data.choices[0].message.content.trim();
            sendResponse({ answer: answer });
        }
    } catch (error) {
        sendResponse({ error: 'Network error or invalid key' });
    }
}

// ============================================
// FOOTSTEPS - Browsing Trail Tracker
// ============================================

// Track navigation for footsteps
chrome.webNavigation.onCommitted.addListener(async (details) => {
    // Only track main frame navigations (not iframes)
    if (details.frameId !== 0) return;

    // Skip chrome:// and extension pages
    if (details.url.startsWith('chrome://') ||
        details.url.startsWith('chrome-extension://') ||
        details.url.startsWith('about:') ||
        details.url === 'about:blank') return;

    // 1. Handle Automatic Dark Mode (Injection if granted)
    const settings = await chrome.storage.local.get(['forceDarkMode']);
    if (settings.forceDarkMode) {
        // We attempt to inject. If we don't have permission for this site, it will fail silently.
        try {
            await chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                files: ['content.js']
            });
        } catch (e) {
            // Silently fail if no permission for this host
        }
    }

    // 2. Get tab info for title (Footsteps)
    try {
        const tab = await chrome.tabs.get(details.tabId);
        await addFootstep({
            url: details.url,
            title: tab.title || new URL(details.url).hostname,
            tabId: details.tabId,
            timestamp: Date.now(),
            transitionType: details.transitionType
        });
    } catch (e) {
        console.log('Footsteps: Could not get tab info', e);
    }
});

// Update title when page finishes loading (titles are often empty on commit)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.title && tab.url) {
        await updateFootstepTitle(tab.url, changeInfo.title);
    }
});

// Add a footstep to the trail
async function addFootstep(footstep) {
    const result = await chrome.storage.local.get(['footsteps']);
    let footsteps = result.footsteps || [];

    // Don't add duplicate consecutive URLs
    if (footsteps.length > 0 && footsteps[0].url === footstep.url) {
        return;
    }

    // Add to front (newest first)
    footsteps.unshift({
        id: Date.now().toString(),
        url: footstep.url,
        title: footstep.title,
        domain: extractDomain(footstep.url),
        favicon: `https://www.google.com/s2/favicons?domain=${extractDomain(footstep.url)}&sz=32`,
        timestamp: footstep.timestamp,
        transitionType: footstep.transitionType
    });

    // Keep only last 50 footsteps
    footsteps = footsteps.slice(0, 50);

    await chrome.storage.local.set({ footsteps });
}

// Update footstep title
async function updateFootstepTitle(url, title) {
    const result = await chrome.storage.local.get(['footsteps']);
    let footsteps = result.footsteps || [];

    const footstep = footsteps.find(f => f.url === url);
    if (footstep && (!footstep.title || footstep.title === extractDomain(url))) {
        footstep.title = title;
        await chrome.storage.local.set({ footsteps });
    }
}

// Extract domain from URL
function extractDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return url;
    }
}

// Get footsteps
async function getFootsteps() {
    const result = await chrome.storage.local.get(['footsteps']);
    return result.footsteps || [];
}

// Clear footsteps
async function clearFootsteps() {
    await chrome.storage.local.set({ footsteps: [] });
}

// Handle footsteps message actions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getFootsteps') {
        getFootsteps().then(footsteps => {
            sendResponse({ footsteps });
        });
        return true;
    }

    if (request.action === 'clearFootsteps') {
        clearFootsteps().then(() => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'navigateToFootstep') {
        chrome.tabs.update({ url: request.url });
        sendResponse({ success: true });
        return true;
    }
});

// Handle footsteps keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'footsteps') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

        sendMessageOrInject(tab, { action: 'showFootstepsPanel' }, ['thought-popup.css'], ['content.js']);
    }
});
