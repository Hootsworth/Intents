/**
 * Intents Search - Home Page JavaScript
 */

const SEARCH_ENGINES = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    brave: { name: 'Brave', url: 'https://search.brave.com/search?q=' }
};

const state = {
    settings: {
        defaultEngine: 'google',
        style: 'subtle',  // Standard Stoic Style
        theme: 'dark',    // 'dark' or 'light'
        showQuickLinks: true,
        newTabResults: false,
        showAITaskbar: true,
        forceDarkMode: false,
        showQuote: false,  // Opt-in daily quote
        customBackground: 'none' // Curated background ID or 'none'
    },
    quickLinks: []
};

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadQuickLinks();
    initTimeWidget();
    initGreeting();
    initRecentSearches();
    initThoughtsPanel();
    initEventListeners();
    applyStyles();
    initDailyQuote();
    initCommandPalette();
    initGlobalShortcuts();
});

function loadSettings() {
    const saved = localStorage.getItem('intents-settings');
    if (saved) {
        try { state.settings = { ...state.settings, ...JSON.parse(saved) }; } catch (e) { }
    }
    document.getElementById('defaultEngine').value = state.settings.defaultEngine;
    document.getElementById('showQuickLinks').checked = state.settings.showQuickLinks;
    document.getElementById('newTabResults').checked = state.settings.newTabResults;

    // AI Taskbar
    const aiTaskbarCheckbox = document.getElementById('showAITaskbar');
    if (aiTaskbarCheckbox) {
        aiTaskbarCheckbox.checked = state.settings.showAITaskbar;
        aiTaskbarCheckbox.addEventListener('change', (e) => {
            state.settings.showAITaskbar = e.target.checked;
            saveSettings();
        });
    }

    // Force Dark Mode
    const forceDarkCheckbox = document.getElementById('forceDarkMode');
    if (forceDarkCheckbox) {
        forceDarkCheckbox.checked = state.settings.forceDarkMode;
    }

    // Daily Quote
    const showQuoteCheckbox = document.getElementById('showQuote');
    if (showQuoteCheckbox) {
        showQuoteCheckbox.checked = state.settings.showQuote;
        showQuoteCheckbox.addEventListener('change', (e) => {
            state.settings.showQuote = e.target.checked;
            saveSettings();
            initDailyQuote();
        });
    }


    const aiTaskbar = document.getElementById('aiTaskbar');
    if (aiTaskbar) aiTaskbar.style.display = state.settings.showAITaskbar ? 'flex' : 'none';

    // Style buttons removal handled in HTML
    document.documentElement.setAttribute('data-style', 'subtle');

    // Custom Background
    if (state.settings.customBackground) {
        document.querySelectorAll('.bg-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.bg === state.settings.customBackground);
        });
        applyBackground();
    }

    document.getElementById('quickLinks').style.display = state.settings.showQuickLinks ? 'block' : 'none';
}

function saveSettings() {
    localStorage.setItem('intents-settings', JSON.stringify(state.settings));

    // Sync critical settings to extension storage for content scripts
    chrome.storage.local.set({
        forceDarkMode: state.settings.forceDarkMode
    });
}

function applyStyles() {
    document.documentElement.setAttribute('data-style', state.settings.style);
    document.documentElement.setAttribute('data-theme', state.settings.theme);
}

function applyBackground() {
    const wp = document.getElementById('wallpaper');
    if (!wp) return;

    const bgId = state.settings.customBackground;
    const hasWallpaper = bgId !== 'none' && !!bgId;

    // Toggle class on body for CSS targeting
    document.body.classList.toggle('has-wallpaper', hasWallpaper);

    // Force dark mode when wallpaper is active
    if (hasWallpaper) {
        state.settings.theme = 'dark';
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === 'dark'));
    }

    // Clear previous state
    wp.classList.remove('animated');

    if (!hasWallpaper) {
        wp.classList.remove('active');
        setTimeout(() => {
            wp.style.backgroundImage = 'none';
        }, 600);
        return;
    }

    if (bgId === 'animated-stoic-flow') {
        wp.style.backgroundImage = 'none';
        wp.classList.add('animated');
        wp.classList.add('active');
        return;
    }

    const imgUrl = `https://images.unsplash.com/${bgId}?auto=format&fit=crop&w=1920&q=80`;

    // Predownload for smooth transition
    const tempImg = new Image();
    tempImg.src = imgUrl;
    tempImg.onload = () => {
        wp.style.backgroundImage = `url(${imgUrl})`;
        wp.classList.add('active');
    };
}

function loadQuickLinks() {
    const saved = localStorage.getItem('intents-quicklinks');
    if (saved) { try { state.quickLinks = JSON.parse(saved); } catch (e) { state.quickLinks = []; } }
    if (state.quickLinks.length === 0) {
        state.quickLinks = [
            { name: 'GitHub', url: 'https://github.com' },
            { name: 'Wikipedia', url: 'https://wikipedia.org' },
            { name: 'Stack', url: 'https://stackoverflow.com' },
            { name: 'MDN', url: 'https://developer.mozilla.org' }
        ];
        saveQuickLinks();
    }
    renderQuickLinks();
}



function saveQuickLinks() { localStorage.setItem('intents-quicklinks', JSON.stringify(state.quickLinks)); }

function renderQuickLinks() {
    const grid = document.getElementById('linksGrid');
    grid.innerHTML = '';
    state.quickLinks.forEach((link, i) => {
        const el = document.createElement('a');
        el.href = link.url;
        el.className = 'quick-link';
        el.target = '_blank';
        el.innerHTML = `<span class="quick-link-name">${link.name}</span><button class="quick-link-delete" data-index="${i}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
        grid.appendChild(el);
    });

    // Add "Add Link" tile
    const addBtn = document.createElement('button');
    addBtn.className = 'add-link-tile';
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    addBtn.addEventListener('click', () => {
        const modal = document.getElementById('addLinkModal');
        if (modal) {
            modal.classList.add('active');
            document.getElementById('linkName').value = '';
            document.getElementById('linkUrl').value = '';
            setTimeout(() => document.getElementById('linkName').focus(), 100);
        }
    });
    grid.appendChild(addBtn);

    grid.querySelectorAll('.quick-link-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.quickLinks.splice(parseInt(btn.dataset.index), 1);
            saveQuickLinks();
            renderQuickLinks();
        });
    });
}

function addQuickLink(name, url) {
    if (!name || !url) return false;
    if (!url.startsWith('http')) url = 'https://' + url;
    state.quickLinks.push({ name, url });
    saveQuickLinks();
    renderQuickLinks();
    return true;
}

function initTimeWidget() { updateTime(); setInterval(updateTime, 1000); }

function updateTime() {
    const now = new Date();
    const timeEl = document.getElementById('currentTime');
    const dateEl = document.getElementById('currentDate');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Time-based greeting
function initGreeting() {
    const greetingEl = document.getElementById('greeting');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let greeting = '';

    if (hour >= 5 && hour < 12) {
        greeting = 'Good morning';
    } else if (hour >= 12 && hour < 17) {
        greeting = 'Good afternoon';
    } else if (hour >= 17 && hour < 21) {
        greeting = 'Good evening';
    } else {
        greeting = 'Good night';
    }

    greetingEl.textContent = greeting;
}

// Daily Quote Feature
async function initDailyQuote() {
    const container = document.getElementById('quoteContainer');
    const textEl = document.getElementById('quoteText');
    const authorEl = document.getElementById('quoteAuthor');

    if (!container || !textEl || !authorEl) return;

    // Check if feature is enabled
    if (!state.settings.showQuote) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // Check cache first (refresh every 6 hours)
    const cached = localStorage.getItem('intents-daily-quote');
    const cacheTime = localStorage.getItem('intents-quote-time');
    const now = Date.now();
    const sixHours = 6 * 60 * 60 * 1000;

    if (cached && cacheTime && (now - parseInt(cacheTime)) < sixHours) {
        try {
            const quote = JSON.parse(cached);
            textEl.textContent = quote.text;
            authorEl.textContent = quote.author;
            return;
        } catch (e) { }
    }

    // Fetch new quote
    try {
        const response = await fetch('https://quoteslate.vercel.app/api/quotes/random');
        if (response.ok) {
            const data = await response.json();
            const quote = { text: data.quote, author: data.author };
            textEl.textContent = quote.text;
            authorEl.textContent = quote.author;
            localStorage.setItem('intents-daily-quote', JSON.stringify(quote));
            localStorage.setItem('intents-quote-time', now.toString());
        } else {
            throw new Error('API failed');
        }
    } catch (e) {
        // Fallback quotes
        const fallbacks = [
            { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
            { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
            { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
            { text: "Less is more.", author: "Ludwig Mies van der Rohe" },
            { text: "The secret of getting ahead is getting started.", author: "Mark Twain" }
        ];
        const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        textEl.textContent = fallback.text;
        authorEl.textContent = fallback.author;
    }
}

// Recent searches functionality
let recentSearches = [];

function initRecentSearches() {
    const saved = localStorage.getItem('intents-recent-searches');
    if (saved) {
        try { recentSearches = JSON.parse(saved); } catch (e) { recentSearches = []; }
    }

    const searchInput = document.getElementById('searchInput');
    const recentDropdown = document.getElementById('recentSearches');

    if (!searchInput || !recentDropdown) return;

    // Show recent searches on focus if empty
    searchInput.addEventListener('focus', () => {
        if (searchInput.value === '' && recentSearches.length > 0) {
            renderRecentSearches();
            recentDropdown.style.display = 'block';
        }
    });

    // Filter as you type
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        if (query === '' && recentSearches.length > 0) {
            renderRecentSearches();
            recentDropdown.style.display = 'block';
        } else if (recentSearches.some(s => s.toLowerCase().includes(query))) {
            renderRecentSearches(query);
            recentDropdown.style.display = 'block';
        } else {
            recentDropdown.style.display = 'none';
        }
    });

    // Hide on blur (with delay to allow click)
    searchInput.addEventListener('blur', () => {
        setTimeout(() => { recentDropdown.style.display = 'none'; }, 200);
    });
}

function renderRecentSearches(filter = '') {
    const recentDropdown = document.getElementById('recentSearches');
    if (!recentDropdown) return;

    const filtered = filter
        ? recentSearches.filter(s => s.toLowerCase().includes(filter.toLowerCase()))
        : recentSearches;

    if (filtered.length === 0) {
        recentDropdown.style.display = 'none';
        return;
    }

    recentDropdown.innerHTML = `
        <div class="recent-header">
            <span class="recent-title">Recent searches</span>
            <div class="recent-actions">
                <button class="clear-recent" id="clearRecent">Clear</button>
                <button class="close-btn-mac" id="closeRecent" title="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
        <div class="recent-items-container">
            ${filtered.slice(0, 5).map(search => `
                <button class="recent-item" data-search="${search}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    ${search}
                </button>
            `).join('')}
        </div>
    `;

    // Reset positioning to default (spawns at same spot)
    recentDropdown.style.removeProperty('position');
    recentDropdown.style.removeProperty('top');
    recentDropdown.style.removeProperty('left');
    recentDropdown.style.removeProperty('width');
    recentDropdown.style.removeProperty('z-index');
    recentDropdown.style.position = 'absolute'; // Ensure CSS default return
    recentDropdown.style.top = '100%';
    recentDropdown.style.left = '0';
    recentDropdown.style.width = ''; // Let CSS handle 100% stretch

    // Click handlers - use mousedown to trigger before blur
    recentDropdown.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Keep focus on input
            const searchInput = document.getElementById('searchInput');
            const searchForm = document.getElementById('searchForm');
            if (searchInput && searchForm) {
                searchInput.value = item.dataset.search;
                searchForm.requestSubmit();
            }
        });
    });

    document.getElementById('clearRecent')?.addEventListener('click', (e) => {
        e.stopPropagation();
        recentSearches = [];
        localStorage.removeItem('intents-recent-searches');
        recentDropdown.style.display = 'none';
    });

    document.getElementById('closeRecent')?.addEventListener('click', (e) => {
        e.stopPropagation();
        recentDropdown.style.display = 'none';
    });

    // DRAG LOGIC
    const header = recentDropdown.querySelector('.recent-header');
    header.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent text selection
        header.style.cursor = 'grabbing';

        const rect = recentDropdown.getBoundingClientRect();

        // Switch to fixed positioning for smooth dragging
        recentDropdown.style.position = 'fixed';
        recentDropdown.style.width = rect.width + 'px';
        recentDropdown.style.left = rect.left + 'px';
        recentDropdown.style.top = rect.top + 'px';
        recentDropdown.style.zIndex = '1000';
        recentDropdown.style.margin = '0'; // Remove margins that might affect position

        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        function onMouseMove(moveEvent) {
            recentDropdown.style.left = (moveEvent.clientX - offsetX) + 'px';
            recentDropdown.style.top = (moveEvent.clientY - offsetY) + 'px';
        }

        function onMouseUp() {
            header.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function saveRecentSearch(query) {
    if (!query || query.length < 2) return;

    // Remove if exists, add to front
    recentSearches = recentSearches.filter(s => s.toLowerCase() !== query.toLowerCase());
    recentSearches.unshift(query);

    // Keep only last 10
    recentSearches = recentSearches.slice(0, 10);

    localStorage.setItem('intents-recent-searches', JSON.stringify(recentSearches));
}

function initEventListeners() {
    // Main search form
    document.getElementById('searchForm')?.addEventListener('submit', handleSearch);

    // Settings modal
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsModal = document.getElementById('settingsModal');
    settingsToggle?.addEventListener('click', () => settingsModal.classList.add('active'));
    document.getElementById('closeSettings')?.addEventListener('click', () => settingsModal.classList.remove('active'));
    settingsModal?.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.remove('active'); });

    // Shortcuts Modal
    const shortcutsModal = document.getElementById('shortcutsModal');
    if (document.getElementById('openShortcutsBtn')) {
        document.getElementById('openShortcutsBtn').addEventListener('click', () => {
            shortcutsModal.classList.add('active');
        });
    }
    if (document.getElementById('closeShortcuts')) {
        document.getElementById('closeShortcuts').addEventListener('click', () => {
            shortcutsModal.classList.remove('active');
        });
    }
    shortcutsModal?.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) shortcutsModal.classList.remove('active');
    });

    // Release Notes Modal
    const releaseNotesModal = document.getElementById('releaseNotesModal');
    const versionBtn = document.getElementById('versionBtn');
    versionBtn?.addEventListener('click', () => releaseNotesModal.classList.add('active'));
    document.getElementById('closeReleaseNotes')?.addEventListener('click', () => releaseNotesModal.classList.remove('active'));
    releaseNotesModal?.addEventListener('click', (e) => {
        if (e.target === releaseNotesModal) releaseNotesModal.classList.remove('active');
    });



    // Add Link modal
    const addLinkModal = document.getElementById('addLinkModal');
    document.getElementById('addLinkBtn')?.addEventListener('click', () => {
        addLinkModal.classList.add('active');
        document.getElementById('linkName').value = '';
        document.getElementById('linkUrl').value = '';
    });
    document.getElementById('closeAddLink')?.addEventListener('click', () => addLinkModal.classList.remove('active'));
    addLinkModal?.addEventListener('click', (e) => { if (e.target === addLinkModal) addLinkModal.classList.remove('active'); });

    document.getElementById('saveLink')?.addEventListener('click', () => {
        if (addQuickLink(document.getElementById('linkName').value.trim(), document.getElementById('linkUrl').value.trim())) {
            addLinkModal.classList.remove('active');
        }
    });

    // Settings changes
    document.getElementById('defaultEngine')?.addEventListener('change', (e) => {
        state.settings.defaultEngine = e.target.value;
        saveSettings();
        const radio = document.querySelector(`input[name="engine"][value="${e.target.value}"]`);
        if (radio) radio.checked = true;
    });

    document.getElementById('showQuickLinks')?.addEventListener('change', (e) => {
        state.settings.showQuickLinks = e.target.checked;
        saveSettings();
        document.getElementById('quickLinks').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('newTabResults')?.addEventListener('change', (e) => {
        state.settings.newTabResults = e.target.checked;
        saveSettings();
    });

    // AI Taskbar toggle
    document.getElementById('showAITaskbar')?.addEventListener('change', (e) => {
        state.settings.showAITaskbar = e.target.checked;
        saveSettings();
        const aiTaskbar = document.getElementById('aiTaskbar');
        if (aiTaskbar) aiTaskbar.style.display = e.target.checked ? 'flex' : 'none';
    });

    // Force Dark Mode toggle
    document.getElementById('forceDarkMode')?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            // Request permission only when turning it on
            const granted = await chrome.permissions.request({
                origins: ["<all_urls>"]
            });

            if (!granted) {
                e.target.checked = false;
                return;
            }
        }

        state.settings.forceDarkMode = e.target.checked;
        saveSettings();

        // Broadcast to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'toggleDarkMode',
                    enabled: e.target.checked
                }).catch(() => { });
            });
        });
    });

    // Commands Modal
    const commandsModal = document.getElementById('commandsModal');
    document.getElementById('showCommandsBtn')?.addEventListener('click', () => {
        commandsModal.classList.add('active');
    });
    document.getElementById('closeCommands')?.addEventListener('click', () => {
        commandsModal.classList.remove('active');
    });
    commandsModal?.addEventListener('click', (e) => {
        if (e.target === commandsModal) commandsModal.classList.remove('active');
    });

    // Style changes removal handled in HTML

    // Theme buttons (Dark / Light)
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.settings.theme = btn.dataset.theme;
            saveSettings();
            applyStyles();
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === state.settings.theme));
        });
    });

    // Custom Background Picker
    document.querySelectorAll('.bg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.settings.customBackground = btn.dataset.bg;
            document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            saveSettings();
            applyBackground();
        });
    });

    // Intent Toggles
    const intentBtns = document.querySelectorAll('.intent-btn');
    intentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const wasActive = btn.classList.contains('active');

            // Deactivate all
            intentBtns.forEach(b => b.classList.remove('active'));

            if (!wasActive) {
                btn.classList.add('active');
                // Uncheck engine radios
                document.querySelectorAll('input[name="engine"]').forEach(r => r.checked = false);
            } else {
                // Re-select default engine if deselecting intent
                const defaultEngineRadio = document.querySelector(`input[name="engine"][value="${state.settings.defaultEngine}"]`);
                if (defaultEngineRadio) defaultEngineRadio.checked = true;
            }
        });
    });

    // When engine is selected, reset intent toggles
    document.querySelectorAll('input[name="engine"]').forEach(radio => {
        radio.addEventListener('change', () => {
            intentBtns.forEach(b => b.classList.remove('active'));
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Focus search with /
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
        // Close modals with Escape
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            document.getElementById('recentSearches').style.display = 'none';
        }
        // Intent shortcuts (1-2)
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT' && !e.ctrlKey && !e.metaKey) {
            if (e.key === '1') {
                e.preventDefault();
                const btn = document.querySelector('.intent-btn[data-intent="learn"]');
                if (btn) btn.click();
            } else if (e.key === '2') {
                e.preventDefault();
                const btn = document.querySelector('.intent-btn[data-intent="build"]');
                if (btn) btn.click();
            }
        }
    });
}

// Handle search - engines are default, intents are secondary
function handleSearch(e) {
    e.preventDefault();

    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    // Check for math expression first
    const calcResult = evaluateMathExpression(query);
    if (calcResult !== null) {
        showCalcResult(query, calcResult);
        return;
    }

    // Save to recent searches
    saveRecentSearch(query);

    // Check if using intent-based search
    const activeIntentBtn = document.querySelector('.intent-btn.active');
    if (activeIntentBtn) {
        const intent = activeIntentBtn.dataset.intent;
        const resultsUrl = `results.html?q=${encodeURIComponent(query)}&intent=${intent}`;
        if (state.settings.newTabResults) {
            window.open(resultsUrl, '_blank');
        } else {
            document.body.classList.add('page-exit-active');
            setTimeout(() => {
                window.location.href = resultsUrl;
            }, 300); // 300ms matches CSS transition
        }
        return;
    }

    // Default: Use search engine
    const engineRadio = document.querySelector('input[name="engine"]:checked');
    const engine = engineRadio ? engineRadio.value : state.settings.defaultEngine;
    const url = SEARCH_ENGINES[engine].url + encodeURIComponent(query);

    if (state.settings.newTabResults) {
        window.open(url, '_blank');
    } else {
        document.body.classList.add('page-exit-active');
        setTimeout(() => {
            window.location.href = url;
        }, 300);
    }
}

// Quick Calculator - evaluate math expressions
function evaluateMathExpression(query) {
    // Check if it looks like a math expression
    const mathPattern = /^[\d\s+\-*/().^%sqrtpielogsincostan]+$/i;
    if (!mathPattern.test(query)) return null;

    // Must contain at least one operator or function
    if (!/[+\-*/^%()]|sqrt|sin|cos|tan|log|pi|e/i.test(query)) return null;

    try {
        // Replace common math functions with JS equivalents
        let expr = query
            .replace(/\^/g, '**')
            .replace(/sqrt\(/gi, 'Math.sqrt(')
            .replace(/sin\(/gi, 'Math.sin(')
            .replace(/cos\(/gi, 'Math.cos(')
            .replace(/tan\(/gi, 'Math.tan(')
            .replace(/log\(/gi, 'Math.log10(')
            .replace(/ln\(/gi, 'Math.log(')
            .replace(/\bpi\b/gi, 'Math.PI')
            .replace(/\be\b/gi, 'Math.E');

        // Security: only allow safe characters
        if (/[^0-9+\-*/().%\s]/.test(expr.replace(/Math\.\w+/g, ''))) {
            return null;
        }

        // eslint-disable-next-line no-eval
        const result = eval(expr);

        if (typeof result === 'number' && isFinite(result)) {
            // Round to reasonable precision
            return Math.round(result * 1000000) / 1000000;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Show calculator result
function showCalcResult(expression, result) {
    // Remove existing result
    document.getElementById('calcResult')?.remove();

    const searchBar = document.querySelector('.search-container');
    const resultEl = document.createElement('div');
    resultEl.id = 'calcResult';
    resultEl.className = 'calc-result';
    resultEl.innerHTML = `
        <div class="calc-result-content">
            <span class="calc-expression">${escapeHtml(expression)} =</span>
            <span class="calc-answer">${result}</span>
            <button class="calc-copy" title="Copy result">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
            </button>
            <button class="calc-close close-btn-mac" style="width: 16px; height: 16px; margin-left: 8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `;

    searchBar.appendChild(resultEl);

    // Animate in
    requestAnimationFrame(() => resultEl.classList.add('visible'));

    // Copy button
    resultEl.querySelector('.calc-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(String(result));
        resultEl.querySelector('.calc-copy').innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
        `;
        setTimeout(() => {
            resultEl.querySelector('.calc-copy').innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
            `;
        }, 1500);
    });

    // Close button
    resultEl.querySelector('.calc-close').addEventListener('click', () => {
        resultEl.classList.remove('visible');
        setTimeout(() => resultEl.remove(), 200);
    });
}

// ========== HOLD THAT THOUGHT - Thoughts Panel ==========

function initThoughtsPanel() {
    const toggle = document.getElementById('thoughtsToggle');
    const panel = document.getElementById('thoughtsPanel');
    const closeBtn = document.getElementById('thoughtsClose');

    if (!toggle || !panel) return;

    // Toggle panel
    toggle.addEventListener('click', () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            loadThoughts();
        }
    });

    // Close panel
    closeBtn?.addEventListener('click', () => {
        panel.classList.remove('open');
    });

    // Load thoughts count on init
    loadThoughtsCount();
}

function loadThoughtsCount() {
    // Check if we're in extension context
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'getThoughts' }, (response) => {
            if (response?.thoughts) {
                const count = document.getElementById('thoughtsCount');
                if (count) {
                    count.textContent = response.thoughts.length;
                    count.style.display = response.thoughts.length > 0 ? 'flex' : 'none';
                }
            }
        });
    }
}

function loadThoughts() {
    const list = document.getElementById('thoughtsList');
    if (!list) return;

    // Check if we're in extension context
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'getThoughts' }, (response) => {
            if (response?.thoughts && response.thoughts.length > 0) {
                renderThoughts(response.thoughts);
            } else {
                list.innerHTML = `<p class="thoughts-empty">No thoughts saved yet.<br><small>Select text on any page and right-click → "Hold That Thought"<br>or press <kbd>Alt+T</kbd></small></p>`;
            }
        });
    } else {
        // Not in extension context (local file)
        list.innerHTML = `<p class="thoughts-empty">Thoughts feature requires Chrome extension.<br><small>Load the extension from chrome://extensions</small></p>`;
    }
}

function renderThoughts(thoughts) {
    const list = document.getElementById('thoughtsList');
    if (!list) return;

    // Group by URL to find duplicates
    const grouped = {};
    const urlOrder = [];

    thoughts.forEach(t => {
        if (!grouped[t.pageUrl]) {
            grouped[t.pageUrl] = [];
            urlOrder.push(t.pageUrl);
        }
        grouped[t.pageUrl].push(t);
    });

    list.innerHTML = urlOrder.map(url => {
        const group = grouped[url];
        if (group.length === 1) {
            return renderThoughtCard(group[0]);
        } else {
            // Render group
            const ids = group.map(t => t.id).join(',');
            return `
                <div class="thought-group">
                    <div class="thought-group-header">
                        <span>Similar thoughts found</span>
                        <button class="merge-btn" data-ids="${ids}">Merge All</button>
                    </div>
                    ${group.map(renderThoughtCard).join('')}
                </div>
            `;
        }
    }).join('');

    // Delete handlers
    list.querySelectorAll('.thought-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteThought(btn.dataset.id);
        });
    });

    // Merge handlers
    list.querySelectorAll('.merge-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMerge(btn.dataset.ids);
        });
    });
}

function renderThoughtCard(thought) {
    const date = new Date(thought.timestamp);
    const timeAgo = getTimeAgo(date);
    const importanceClass = thought.importance === 'high' ? 'high' : (thought.importance === 'medium' ? 'medium' : '');
    const deepLink = thought.pageUrl ? getFragmentUrl(thought.pageUrl, thought.text) : '';

    return `
        <div class="thought-card ${importanceClass}" style="border-left-color: ${thought.color}" data-id="${thought.id}">
            <div class="thought-header">
                <span class="thought-tag">${thought.tag}</span>
                <button class="thought-delete" data-id="${thought.id}" title="Delete">&times;</button>
            </div>
            <p class="thought-text">${escapeHtml(thought.text)}</p>
            ${thought.context ? `<p class="thought-context">${escapeHtml(thought.context)}</p>` : ''}
            <div class="thought-meta">
                ${thought.pageUrl
            ? `<a href="${deepLink}" target="_blank" class="thought-source">${escapeHtml(truncate(thought.pageTitle || 'Note', 40))}</a>`
            : `<span class="thought-source" style="color: inherit; opacity: 0.7;">${escapeHtml(truncate(thought.pageTitle || 'Note', 40))}</span>`
        }
                <span class="thought-time">${timeAgo}</span>
            </div>
        </div>
    `;
}

function handleMerge(idsString) {
    const ids = idsString.split(',');

    const btn = document.querySelector(`.merge-btn[data-ids="${idsString}"]`);
    const groupContainer = btn ? btn.closest('.thought-group') : null;

    if (groupContainer) {
        // Optimistic UI: Animate immediately
        groupContainer.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        groupContainer.style.transform = 'scale(0.98)';
        groupContainer.style.opacity = '0.8';
        btn.textContent = 'Merging...';
        btn.disabled = true;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'mergeThoughts', thoughtIds: ids }, (response) => {
            if (response && response.success) {
                // Success animation
                if (groupContainer) {
                    groupContainer.style.transform = 'scale(0.9) translateY(10px)';
                    groupContainer.style.opacity = '0';
                    groupContainer.style.height = '0';
                    groupContainer.style.margin = '0';
                    groupContainer.style.padding = '0';
                    groupContainer.style.overflow = 'hidden';
                }

                // Wait for animation to finish before reloading list
                setTimeout(() => {
                    loadThoughts();
                    loadThoughtsCount();
                }, 400);
            } else {
                // Revert animation on failure
                if (groupContainer) {
                    groupContainer.style.transform = 'none';
                    groupContainer.style.opacity = '1';
                    btn.textContent = 'Merge All';
                    btn.disabled = false;
                    alert('Merge failed: ' + (response?.error || 'Unknown error'));
                }
            }
        });
    }
}

function getFragmentUrl(url, text) {
    if (!text) return url;

    // Clean text: remove newlines and extra spaces
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) return url;

    // Create text fragment
    // If text is long (> 300 chars), use start,end syntax
    let fragment = '';
    if (cleanText.length > 300) {
        const words = cleanText.split(' ');
        if (words.length > 10) {
            const start = words.slice(0, 5).join(' ');
            const end = words.slice(-5).join(' ');
            fragment = `#:~:text=${encodeURIComponent(start)},${encodeURIComponent(end)}`;
        } else {
            fragment = `#:~:text=${encodeURIComponent(cleanText)}`;
        }
    } else {
        fragment = `#:~:text=${encodeURIComponent(cleanText)}`;
    }

    return url + fragment;
}

function deleteThought(id) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'deleteThought', id }, () => {
            loadThoughts();
            loadThoughtsCount();
        });
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Listen for storage changes to update list in real-time
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.thoughts) {
            loadThoughts();
            loadThoughtsCount();
        }
    });
}

// ========== COMMAND PALETTE ==========
const COMMANDS = [
    { id: 'search', name: 'Focus Search', desc: 'Jump to search bar', icon: '🔍', action: () => document.getElementById('searchInput')?.focus() },
    { id: 'chatgpt', name: 'Open ChatGPT', desc: 'Open ChatGPT in new tab', icon: '🤖', action: () => window.open('https://chatgpt.com', '_blank') },
    { id: 'claude', name: 'Open Claude', desc: 'Open Claude AI in new tab', icon: '🧠', action: () => window.open('https://claude.ai', '_blank') },
    { id: 'gemini', name: 'Open Gemini', desc: 'Open Google Gemini', icon: '✨', action: () => window.open('https://gemini.google.com', '_blank') },
    { id: 'thoughts', name: 'Toggle Thoughts', desc: 'Show or hide saved thoughts', icon: '💭', shortcut: ['Ctrl', 'Shift', 'H'], action: () => document.getElementById('thoughtsPanel')?.classList.toggle('active') },
    { id: 'settings', name: 'Open Settings', desc: 'Open extension settings', icon: '⚙️', action: () => document.getElementById('settingsModal')?.classList.add('active') },
    { id: 'addlink', name: 'Add Quick Link', desc: 'Add a new quick link', icon: '🔗', action: () => document.getElementById('addLinkModal')?.classList.add('active') },
    { id: 'github', name: 'Open GitHub', desc: 'Go to GitHub', icon: '🐙', action: () => window.open('https://github.com', '_blank') },
    { id: 'stackoverflow', name: 'Open Stack Overflow', desc: 'Go to Stack Overflow', icon: '📚', action: () => window.open('https://stackoverflow.com', '_blank') },
    { id: 'mdn', name: 'Open MDN Docs', desc: 'Mozilla Developer Network', icon: '📖', action: () => window.open('https://developer.mozilla.org', '_blank') },
    { id: 'commands', name: 'Show All Commands', desc: 'View keyboard shortcuts', icon: '⌨️', action: () => document.getElementById('commandsModal')?.classList.add('active') },
];

let selectedCommandIndex = 0;
let filteredCommands = [...COMMANDS];

function initCommandPalette() {
    const palette = document.getElementById('commandPalette');
    const input = document.getElementById('commandInput');
    const results = document.getElementById('commandResults');
    const closeBtn = document.getElementById('commandPaletteClose');

    if (!palette || !input) return;

    // Close button
    closeBtn?.addEventListener('click', closeCommandPalette);

    // Click outside to close
    palette.addEventListener('click', (e) => {
        if (e.target === palette) closeCommandPalette();
    });

    // Input handling
    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterCommands(query);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedCommandIndex = Math.min(selectedCommandIndex + 1, filteredCommands.length - 1);
            updateCommandSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedCommandIndex = Math.max(selectedCommandIndex - 1, 0);
            updateCommandSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executeSelectedCommand();
        } else if (e.key === 'Escape') {
            closeCommandPalette();
        }
    });

    // Initial render
    renderCommands();
}

function openCommandPalette() {
    const palette = document.getElementById('commandPalette');
    const input = document.getElementById('commandInput');

    if (!palette) return;

    palette.classList.add('active');
    filteredCommands = [...COMMANDS];
    selectedCommandIndex = 0;
    input.value = '';
    renderCommands();

    setTimeout(() => input?.focus(), 50);
}

function closeCommandPalette() {
    document.getElementById('commandPalette')?.classList.remove('active');
}

function filterCommands(query) {
    if (!query) {
        filteredCommands = [...COMMANDS];
    } else {
        filteredCommands = COMMANDS.filter(cmd =>
            cmd.name.toLowerCase().includes(query) ||
            cmd.desc.toLowerCase().includes(query)
        );
    }
    selectedCommandIndex = 0;
    renderCommands();
}

function renderCommands() {
    const results = document.getElementById('commandResults');
    if (!results) return;

    if (filteredCommands.length === 0) {
        results.innerHTML = '<div class="command-palette-empty">No commands found</div>';
        return;
    }

    results.innerHTML = filteredCommands.map((cmd, i) => `
        <div class="command-item ${i === selectedCommandIndex ? 'selected' : ''}" data-index="${i}">
            <div class="command-item-icon">${cmd.icon}</div>
            <div class="command-item-text">
                <div class="command-item-name">${cmd.name}</div>
                <div class="command-item-desc">${cmd.desc}</div>
            </div>
            ${cmd.shortcut ? `
                <div class="command-item-shortcut">
                    ${cmd.shortcut.map(k => `<kbd>${k}</kbd>`).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');

    // Click handlers
    results.querySelectorAll('.command-item').forEach(item => {
        item.addEventListener('click', () => {
            selectedCommandIndex = parseInt(item.dataset.index);
            executeSelectedCommand();
        });
    });
}

function updateCommandSelection() {
    document.querySelectorAll('.command-item').forEach((item, i) => {
        item.classList.toggle('selected', i === selectedCommandIndex);
    });

    // Scroll into view
    document.querySelector('.command-item.selected')?.scrollIntoView({ block: 'nearest' });
}

function executeSelectedCommand() {
    const cmd = filteredCommands[selectedCommandIndex];
    if (cmd) {
        closeCommandPalette();
        cmd.action();
    }
}

// ========== GLOBAL KEYBOARD SHORTCUTS ==========
function initGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger when typing in inputs
        const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) &&
            !document.activeElement?.classList.contains('command-palette-input');

        // Ctrl+K or Cmd+K - Command Palette
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openCommandPalette();
            return;
        }

        // / key - Focus search (only when not typing)
        if (e.key === '/' && !isTyping) {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
            return;
        }

        // Ctrl+Shift+H - Toggle Thoughts (H for Hold That Thought)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
            e.preventDefault();
            document.getElementById('thoughtsPanel')?.classList.toggle('active');
            return;
        }

        // Escape - Close modals
        if (e.key === 'Escape') {
            closeCommandPalette();
            document.getElementById('settingsModal')?.classList.remove('active');
            document.getElementById('addLinkModal')?.classList.remove('active');
            document.getElementById('commandsModal')?.classList.remove('active');
            document.getElementById('releaseModal')?.classList.remove('active');
            document.getElementById('thoughtsPanel')?.classList.remove('active');
            document.getElementById('calcResult')?.classList.remove('visible');
        }
    });
}
