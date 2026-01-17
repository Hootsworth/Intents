/**
 * Intents Search - Home Page JavaScript
 */

const GOOGLE_SEARCH_URL = 'https://www.google.com/search?q=';

const state = {
    settings: {
        style: 'subtle',  // Standard Stoic Style
        theme: 'dark',    // 'dark' or 'light'
        showQuickLinks: true,
        newTabResults: false,
        showAITaskbar: true,
        forceDarkMode: false,
        showGreeting: true,
        showFocusGoal: true,
        showDailyStats: true,
        customBackground: 'none' // Curated background ID or 'none'
    },
    quickLinks: [],
    stats: {
        searchesToday: 0,
        thoughtsCount: 0,
        lastDate: null
    },
    focus: {
        active: false,
        timeLeft: 1500, // 25 minutes
        timer: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadQuickLinks();
    initTimeWidget();
    initGreeting();
    initFocusGoal();
    initDailyStats();
    initRecentSearches();
    initThoughtsPanel();
    initEventListeners();
    applyStyles();
    initCommandPalette();
    initGlobalShortcuts();
    initReadingShelf();
    initFocusTimer();
    initThoughtCanvas();
    initBackgroundCuration();
    initQuickLinkShortcuts();
});

function loadSettings() {
    const saved = localStorage.getItem('intents-settings');
    if (saved) {
        try { state.settings = { ...state.settings, ...JSON.parse(saved) }; } catch (e) { }
    }

    // Quick Links
    const showQuickLinksEl = document.getElementById('showQuickLinks');
    if (showQuickLinksEl) {
        showQuickLinksEl.checked = state.settings.showQuickLinks;
        showQuickLinksEl.addEventListener('change', (e) => {
            state.settings.showQuickLinks = e.target.checked;
            document.querySelector('.quick-links')?.classList.toggle('hidden', !e.target.checked);
            saveSettings();
        });
    }

    // New Tab Results
    const newTabResultsEl = document.getElementById('newTabResults');
    if (newTabResultsEl) {
        newTabResultsEl.checked = state.settings.newTabResults;
        newTabResultsEl.addEventListener('change', (e) => {
            state.settings.newTabResults = e.target.checked;
            saveSettings();
        });
    }

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


    // Greeting
    const showGreetingCheckbox = document.getElementById('showGreeting');
    if (showGreetingCheckbox) {
        showGreetingCheckbox.checked = state.settings.showGreeting;
        showGreetingCheckbox.addEventListener('change', (e) => {
            state.settings.showGreeting = e.target.checked;
            document.getElementById('greetingSection')?.classList.toggle('hidden', !e.target.checked);
            saveSettings();
        });
    }

    // Focus Goal
    const showFocusGoalCheckbox = document.getElementById('showFocusGoal');
    if (showFocusGoalCheckbox) {
        showFocusGoalCheckbox.checked = state.settings.showFocusGoal;
        showFocusGoalCheckbox.addEventListener('change', (e) => {
            state.settings.showFocusGoal = e.target.checked;
            document.getElementById('focusGoalWidget')?.classList.toggle('hidden', !e.target.checked);
            saveSettings();
        });
    }

    const aiTaskbar = document.getElementById('aiTaskbar');
    if (aiTaskbar) aiTaskbar.style.display = state.settings.showAITaskbar ? 'flex' : 'none';

    // Apply initial visibility
    document.getElementById('greetingSection')?.classList.toggle('hidden', !state.settings.showGreeting);
    document.getElementById('focusGoalWidget')?.classList.toggle('hidden', !state.settings.showFocusGoal);

    // Style buttons visibility
    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.style === state.settings.style);
    });

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
    wp.classList.remove('minimal-gradient', 'minimal-mesh');

    if (!hasWallpaper) {
        wp.classList.remove('active');
        setTimeout(() => {
            wp.style.backgroundImage = 'none';
        }, 600);
        return;
    }

    // Handle flat minimal backgrounds
    if (bgId === 'minimal-gradient') {
        wp.style.backgroundImage = 'none';
        wp.classList.add('minimal-gradient');
        wp.classList.add('active');
        return;
    }

    if (bgId === 'minimal-mesh') {
        wp.style.backgroundImage = 'none';
        wp.classList.add('minimal-mesh');
        wp.classList.add('active');
        return;
    }

    // Unsplash or Picsum images
    let imgUrl = bgId;
    if (!bgId.startsWith('http')) {
        imgUrl = `https://images.unsplash.com/${bgId}?auto=format&fit=crop&w=1920&q=80`;
    }

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
        el.dataset.index = i;
        // Add number badge for shortcuts 1-9
        const numberBadge = i < 9 ? `<span class="quick-link-number">${i + 1}</span>` : '';
        el.innerHTML = `${numberBadge}<span class="quick-link-name">${link.name}</span><button class="quick-link-delete" data-index="${i}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
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

// Quick link keyboard shortcuts (1-9)
function initQuickLinkShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in an input, textarea, or contenteditable
        const active = document.activeElement;
        const isTyping = active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.contentEditable === 'true'
        );

        // Don't trigger if any modifier keys are held (except for number pad)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // Check for number keys 1-9
        const num = parseInt(e.key);
        if (!isTyping && num >= 1 && num <= 9) {
            const linkIndex = num - 1;
            if (state.quickLinks && state.quickLinks[linkIndex]) {
                e.preventDefault();
                window.open(state.quickLinks[linkIndex].url, '_blank');
            }
        }
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
    const greetingEl = document.getElementById('greetingText');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let greeting = '';

    if (hour >= 5 && hour < 12) {
        greeting = 'Good morning ☀️';
    } else if (hour >= 12 && hour < 17) {
        greeting = 'Good afternoon 🌤️';
    } else if (hour >= 17 && hour < 21) {
        greeting = 'Good evening 🌅';
    } else {
        greeting = 'Good night 🌙';
    }

    greetingEl.textContent = greeting;
}

// Focus Goal Widget
function initFocusGoal() {
    const widget = document.getElementById('focusGoalWidget');
    const input = document.getElementById('focusInput');
    const display = document.getElementById('focusDisplay');
    const focusText = document.getElementById('focusText');
    const clearBtn = document.getElementById('focusClear');

    if (!widget || !input || !display || !focusText || !clearBtn) return;

    // Load saved focus for today
    const today = new Date().toDateString();
    const savedFocus = localStorage.getItem('intents-focus');
    const savedDate = localStorage.getItem('intents-focus-date');

    if (savedFocus && savedDate === today) {
        focusText.textContent = savedFocus;
        input.classList.add('hidden');
        display.classList.add('active');
    }

    // Save focus on enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            const focus = input.value.trim();
            focusText.textContent = focus;
            localStorage.setItem('intents-focus', focus);
            localStorage.setItem('intents-focus-date', today);
            input.classList.add('hidden');
            display.classList.add('active');
        }
    });

    // Clear focus
    clearBtn.addEventListener('click', () => {
        localStorage.removeItem('intents-focus');
        localStorage.removeItem('intents-focus-date');
        focusText.textContent = '';
        input.value = '';
        input.classList.remove('hidden');
        display.classList.remove('active');
        input.focus();
    });
}

// Deep Focus Timer Logic
function initFocusTimer() {
    const focusToggle = document.getElementById('focusToggle');
    const focusTime = document.getElementById('focusTime');
    const focusBanner = document.getElementById('focusBanner');
    const stopFocus = document.getElementById('stopFocus');

    if (!focusToggle || !focusTime || !focusBanner || !stopFocus) return;

    focusToggle.addEventListener('click', () => {
        if (!state.focus.active) {
            startFocusSession();
        } else {
            toggleFocusDisplay();
        }
    });

    stopFocus.addEventListener('click', stopFocusSession);

    function startFocusSession() {
        state.focus.active = true;
        state.focus.timeLeft = 1500; // 25 mins
        focusBanner.style.display = 'flex';
        document.body.classList.add('focus-active');

        updateFocusDisplay();

        state.focus.timer = setInterval(() => {
            state.focus.timeLeft--;
            updateFocusDisplay();

            if (state.focus.timeLeft <= 0) {
                stopFocusSession();
                notifyFocusComplete();
            }
        }, 1000);
    }

    function stopFocusSession() {
        state.focus.active = false;
        clearInterval(state.focus.timer);
        focusBanner.style.display = 'none';
        document.body.classList.remove('focus-active');
        state.focus.timeLeft = 1500;
        updateFocusDisplay();
    }

    function updateFocusDisplay() {
        const mins = Math.floor(state.focus.timeLeft / 60);
        const secs = state.focus.timeLeft % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        focusTime.textContent = timeStr;
    }

    function toggleFocusDisplay() {
        // Just a subtle bounce to show it's active
        focusToggle.style.transform = 'scale(1.1)';
        setTimeout(() => focusToggle.style.transform = 'scale(1)', 200);
    }

    function notifyFocusComplete() {
        if (Notification.permission === "granted") {
            new Notification("Intents Focus", { body: "Focus session complete! Take a break." });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
}

// Daily Stats Widget
function initDailyStats() {
    const searchCountEl = document.getElementById('searchCount');
    const thoughtCountEl = document.getElementById('thoughtCount');

    if (!searchCountEl || !thoughtCountEl) return;

    // Load stats
    const today = new Date().toDateString();
    const savedStats = localStorage.getItem('intents-stats');

    if (savedStats) {
        try {
            const stats = JSON.parse(savedStats);
            if (stats.date === today) {
                state.stats.searchesToday = stats.searches || 0;
            } else {
                // Reset for new day
                state.stats.searchesToday = 0;
                localStorage.setItem('intents-stats', JSON.stringify({ date: today, searches: 0 }));
            }
        } catch (e) {
            state.stats.searchesToday = 0;
        }
    }

    // Get thoughts count
    const thoughts = localStorage.getItem('hold-that-thought-items');
    if (thoughts) {
        try {
            state.stats.thoughtsCount = JSON.parse(thoughts).length;
        } catch (e) {
            state.stats.thoughtsCount = 0;
        }
    }

    searchCountEl.textContent = state.stats.searchesToday;
    thoughtCountEl.textContent = state.stats.thoughtsCount;
}

// Increment search count
function incrementSearchCount() {
    const today = new Date().toDateString();
    state.stats.searchesToday++;
    localStorage.setItem('intents-stats', JSON.stringify({ date: today, searches: state.stats.searchesToday }));
    const searchCountEl = document.getElementById('searchCount');
    if (searchCountEl) searchCountEl.textContent = state.stats.searchesToday;
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
    const ghostText = document.getElementById('searchGhost');
    const searchHint = document.getElementById('searchHint');

    let currentSuggestion = '';

    if (!searchInput || !recentDropdown) return;

    // Update ghost text based on input
    function updateGhostText(value) {
        if (!ghostText) return;

        if (!value) {
            ghostText.textContent = '';
            searchHint?.classList.remove('visible');
            currentSuggestion = '';
            return;
        }

        // Find a matching recent search
        const match = recentSearches.find(s =>
            s.toLowerCase().startsWith(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
        );

        if (match) {
            // Show the typed part + the rest as ghost
            ghostText.textContent = match;
            searchHint?.classList.add('visible');
            currentSuggestion = match;
        } else {
            ghostText.textContent = '';
            searchHint?.classList.remove('visible');
            currentSuggestion = '';
        }
    }

    // Tab to accept suggestion
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && currentSuggestion) {
            e.preventDefault();
            searchInput.value = currentSuggestion;
            updateGhostText('');
            recentDropdown.style.display = 'none';
        }
    });

    // Show recent searches on focus if empty
    searchInput.addEventListener('focus', () => {
        if (searchInput.value === '' && recentSearches.length > 0) {
            renderRecentSearches();
            recentDropdown.style.display = 'block';
        }
    });

    // Filter as you type + Calculator trigger + Ghost text
    searchInput.addEventListener('input', () => {
        const value = searchInput.value;
        const query = value.toLowerCase();

        // Update ghost text autocomplete
        updateGhostText(value);

        // Real-time calculator trigger on '='
        if (value.includes('=')) {
            const expr = value.split('=')[0];
            const result = evaluateMathExpression(expr);
            if (result !== null) {
                showCalcResult(expr, result);
                return;
            }
        } else {
            // Hide result if = is removed
            document.getElementById('calcResult')?.remove();
        }

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
        setTimeout(() => {
            recentDropdown.style.display = 'none';
            // Keep ghost visible if there's input
        }, 200);
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

    // Style changes
    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.settings.style = btn.dataset.style;
            saveSettings();
            applyStyles();
            document.querySelectorAll('.style-btn').forEach(b => b.classList.toggle('active', b.dataset.style === state.settings.style));
        });
    });

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

// Handle search - Google only
function handleSearch(e) {
    e.preventDefault();

    let query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    // AI Omnibox handling
    if (query.startsWith('/ai ')) {
        const aiQuery = query.substring(4).trim();
        const aiUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(aiQuery)}`;
        saveRecentSearch(query);
        window.location.href = aiUrl;
        return;
    }

    // Check for math expression first
    const calcResult = evaluateMathExpression(query);
    if (calcResult !== null) {
        showCalcResult(query, calcResult);
        return;
    }

    // Save to recent searches
    saveRecentSearch(query);

    // Search with Google
    const url = GOOGLE_SEARCH_URL + encodeURIComponent(query);
    document.body.classList.add('page-exit-active');
    setTimeout(() => {
        window.location.href = url;
    }, 300);
}

// Quick Calculator - evaluate math expressions
function evaluateMathExpression(query) {
    // Trim and handle trailing =
    query = query.replace(/=$/, '').trim();
    if (!query) return null;

    // Check if it looks like a math expression
    const mathPattern = /^[0-9\s+*/().^%\.-]+$|^[0-9\s+*/().^%\.-]*(sqrt|sin|cos|tan|log|ln|pi|e)[0-9\s+*/().^%\.-]*/i;
    if (!mathPattern.test(query)) return null;

    // Must start with a number, opening paren, or function name
    if (!/^[0-9(]|^(sqrt|sin|cos|tan|log|ln|pi|e)/i.test(query)) return null;

    // Must contain at least one operator or math function
    if (!/[+*/^%\.-]/.test(query) && !/(sqrt|sin|cos|tan|log|ln)\(/i.test(query)) return null;

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

        // Security: only allow safe characters after replacements
        const sanitized = expr.replace(/Math\.\w+/g, '').replace(/\*\*/g, '');
        if (/[^0-9+*/().%\s\.-]/.test(sanitized)) {
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

    const searchBar = document.getElementById('searchForm');
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

    // Render all thoughts individually (no grouping)
    list.innerHTML = thoughts.map(thought => renderThoughtCard(thought)).join('');

    // Delete handlers
    list.querySelectorAll('.thought-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteThought(btn.dataset.id);
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
    { id: 'contextualize', name: 'Contextualize', desc: 'Look up selected text (Ctrl+Shift+X)', icon: '📖', shortcut: ['Ctrl', 'Shift', 'X'], action: () => showNotification('Select text on any page, then press Ctrl+Shift+X') },
    { id: 'chatgpt', name: 'Open ChatGPT', desc: 'Open ChatGPT in new tab', icon: '🤖', action: () => window.open('https://chatgpt.com', '_blank') },
    { id: 'claude', name: 'Open Claude', desc: 'Open Claude AI in new tab', icon: '🧠', action: () => window.open('https://claude.ai', '_blank') },
    { id: 'gemini', name: 'Open Gemini', desc: 'Open Google Gemini', icon: '✨', action: () => window.open('https://gemini.google.com', '_blank') },
    { id: 'perplexity', name: 'Open Perplexity', desc: 'Open Perplexity AI', icon: '🔮', action: () => window.open('https://perplexity.ai', '_blank') },
    { id: 'thoughts', name: 'Toggle Thoughts', desc: 'Show or hide saved thoughts', icon: '💭', shortcut: ['Ctrl', 'Shift', 'H'], action: () => document.getElementById('thoughtsPanel')?.classList.toggle('active') },
    { id: 'settings', name: 'Open Settings', desc: 'Open extension settings', icon: '⚙️', action: () => document.getElementById('settingsModal')?.classList.add('active') },
    { id: 'addlink', name: 'Add Quick Link', desc: 'Add a new quick link', icon: '🔗', action: () => document.getElementById('addLinkModal')?.classList.add('active') },
    { id: 'github', name: 'Open GitHub', desc: 'Go to GitHub', icon: '🐙', action: () => window.open('https://github.com', '_blank') },
    { id: 'stackoverflow', name: 'Open Stack Overflow', desc: 'Go to Stack Overflow', icon: '📚', action: () => window.open('https://stackoverflow.com', '_blank') },
    { id: 'mdn', name: 'Open MDN Docs', desc: 'Mozilla Developer Network', icon: '📖', action: () => window.open('https://developer.mozilla.org', '_blank') },
    { id: 'commands', name: 'Show All Commands', desc: 'View keyboard shortcuts', icon: '⌨️', action: () => document.getElementById('commandsModal')?.classList.add('active') },
    { id: 'releasenotes', name: 'Release Notes', desc: 'See what\'s new in this version', icon: '📋', action: () => document.getElementById('releaseModal')?.classList.add('active') },
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

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== CONTINUE READING SHELF ==========
// ========== ECHOES (CONTINUE READING) ==========
function initReadingShelf() {
    const echoesSection = document.getElementById('echoesSection');
    const echoesGrid = document.getElementById('echoesGrid');

    if (!echoesSection || !echoesGrid) return;

    chrome.storage.local.get(['readingShelf'], (result) => {
        const shelf = result.readingShelf || {};
        const items = Object.values(shelf);

        // Filter out old items (> 7 days)
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const validItems = items.filter(item => Date.now() - item.timestamp < sevenDays);

        if (validItems.length > 0) {
            echoesSection.style.display = 'block';
            echoesGrid.innerHTML = '';
            validItems.sort((a, b) => b.timestamp - a.timestamp);
            validItems.slice(0, 3).forEach(item => {
                echoesGrid.appendChild(createEchoCard(item));
            });
        } else {
            echoesSection.style.display = 'none';
        }
    });
}

function createEchoCard(item) {
    const card = document.createElement('div');
    card.className = 'echo-card';
    card.dataset.url = item.url;

    card.innerHTML = `
        <span class="echo-site">${item.hostname || 'Article'}</span>
        <div class="echo-title">${escapeHtml(item.title || 'Untitled')}</div>
        <div class="echo-progress-container">
            <div class="echo-progress-bar" style="width: ${item.progressPercent || 0}%"></div>
        </div>
        <div class="echo-meta">
            <span>${item.progressPercent || 0}% read</span>
            <span>${item.readingTime || ''}</span>
        </div>
    `;

    card.addEventListener('click', () => {
        openShelfArticle(item);
    });

    return card;
}

function openShelfArticle(item) {
    // Open the URL and send a message to activate Intent Mode with scroll position
    chrome.runtime.sendMessage({
        action: 'openInIntentMode',
        url: item.url,
        scrollTop: item.scrollTop
    });
}

function removeShelfItem(url) {
    const key = 'intent-reading-progress-' + hashString(url);
    chrome.storage.local.get(['readingShelf'], (result) => {
        const shelf = result.readingShelf || {};
        delete shelf[key];
        chrome.storage.local.set({ readingShelf: shelf });
    });
}

// Simple hash function for URL keys
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

/**
 * Thought Canvas - Spatial Organization with Basket, Connectors, Zoom
 */
function initThoughtCanvas() {
    const openBtn = document.getElementById('openCanvasBtn');
    const closeBtn = document.getElementById('closeCanvas');
    const modal = document.getElementById('canvasModal');
    const workspace = document.getElementById('canvasWorkspace');
    const content = document.getElementById('canvasContent');
    const resetBtn = document.getElementById('canvasReset');
    const connectorsLayer = document.getElementById('canvasConnectors');
    const basketEl = document.getElementById('thoughtBasket');
    const basketThoughts = document.getElementById('basketThoughts');
    const basketCount = document.getElementById('basketCount');

    // Toolbar buttons
    const connectModeBtn = document.getElementById('connectModeBtn');
    const addNoteBtn = document.getElementById('addNoteBtn');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomResetBtn = document.getElementById('zoomResetBtn');
    const zoomLevelEl = document.getElementById('zoomLevel');

    if (!openBtn || !modal || !content) return;

    // Canvas state
    let canvasState = {
        zoom: 1,
        panX: 0,
        panY: 0,
        connectMode: false,
        connectSource: null,
        connections: [],
        canvasThoughts: [], // Thoughts placed on canvas
        isPanning: false,
        panStartX: 0,
        panStartY: 0
    };

    // Open canvas
    openBtn.addEventListener('click', () => {
        modal.classList.add('active');
        loadCanvasState();
    });

    // Close canvas
    closeBtn?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Clear canvas
    resetBtn?.addEventListener('click', () => {
        if (confirm('Clear all thoughts from canvas? They will return to the basket.')) {
            canvasState.canvasThoughts = [];
            canvasState.connections = [];
            saveCanvasState();
            renderCanvas();
        }
    });

    // Connect mode toggle
    connectModeBtn?.addEventListener('click', () => {
        canvasState.connectMode = !canvasState.connectMode;
        connectModeBtn.classList.toggle('active', canvasState.connectMode);
        workspace.classList.toggle('connect-mode', canvasState.connectMode);
        canvasState.connectSource = null;
        content.querySelectorAll('.thought-card').forEach(c => {
            c.classList.remove('connect-selected', 'connect-candidate');
            if (canvasState.connectMode) c.classList.add('connect-candidate');
        });
    });

    // Add note
    addNoteBtn?.addEventListener('click', () => {
        const noteId = `note-${Date.now()}`;
        const note = {
            id: noteId,
            type: 'note',
            text: 'New note...',
            x: 300 + Math.random() * 200,
            y: 200 + Math.random() * 200
        };
        canvasState.canvasThoughts.push(note);
        saveCanvasState();
        renderCanvas();
    });

    // Zoom controls
    zoomInBtn?.addEventListener('click', () => setZoom(canvasState.zoom + 0.1));
    zoomOutBtn?.addEventListener('click', () => setZoom(canvasState.zoom - 0.1));
    zoomResetBtn?.addEventListener('click', () => {
        canvasState.zoom = 1;
        canvasState.panX = 0;
        canvasState.panY = 0;
        applyTransform();
    });

    // Mouse wheel zoom
    workspace?.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom(canvasState.zoom + delta);
        }
    }, { passive: false });

    // Pan with middle mouse or space+drag
    let spacePressed = false;
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && modal.classList.contains('active')) {
            spacePressed = true;
            workspace.style.cursor = 'grab';
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            spacePressed = false;
            workspace.style.cursor = '';
        }
    });

    workspace?.addEventListener('mousedown', (e) => {
        if ((e.button === 1 || spacePressed) && e.target === workspace || e.target.classList.contains('canvas-grid-bg')) {
            canvasState.isPanning = true;
            canvasState.panStartX = e.clientX - canvasState.panX;
            canvasState.panStartY = e.clientY - canvasState.panY;
            workspace.classList.add('panning');
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (canvasState.isPanning) {
            canvasState.panX = e.clientX - canvasState.panStartX;
            canvasState.panY = e.clientY - canvasState.panStartY;
            applyTransform();
        }
    });

    document.addEventListener('mouseup', () => {
        if (canvasState.isPanning) {
            canvasState.isPanning = false;
            workspace.classList.remove('panning');
        }
    });

    function setZoom(newZoom) {
        canvasState.zoom = Math.max(0.25, Math.min(2, newZoom));
        applyTransform();
    }

    function applyTransform() {
        content.style.transform = `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`;
        connectorsLayer.style.transform = `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`;
        zoomLevelEl.textContent = Math.round(canvasState.zoom * 100) + '%';
    }

    // Load canvas state
    function loadCanvasState() {
        chrome.storage.local.get(['canvas-state', 'thoughts'], (data) => {
            const saved = data['canvas-state'] || {};
            canvasState.canvasThoughts = saved.thoughts || [];
            canvasState.connections = saved.connections || [];
            canvasState.zoom = saved.zoom || 1;
            canvasState.panX = saved.panX || 0;
            canvasState.panY = saved.panY || 0;

            applyTransform();
            renderCanvas();
            renderBasket(data.thoughts || []);
        });
    }

    // Save canvas state
    function saveCanvasState() {
        const stateToSave = {
            thoughts: canvasState.canvasThoughts,
            connections: canvasState.connections,
            zoom: canvasState.zoom,
            panX: canvasState.panX,
            panY: canvasState.panY
        };
        chrome.storage.local.set({ 'canvas-state': stateToSave });
    }

    // Render basket with available thoughts
    function renderBasket(allThoughts) {
        // Filter out thoughts already on canvas
        const canvasIds = canvasState.canvasThoughts.filter(t => t.type !== 'note').map(t => t.id);
        const availableThoughts = allThoughts.filter(t => !canvasIds.includes(t.id));

        basketCount.textContent = availableThoughts.length;
        basketCount.style.display = availableThoughts.length > 0 ? 'flex' : 'none';

        basketThoughts.innerHTML = '';

        availableThoughts.slice(0, 6).forEach((thought, idx) => {
            const el = document.createElement('div');
            el.className = 'basket-thought-preview';
            el.dataset.id = thought.id;
            el.draggable = true;
            el.innerHTML = `
                <div class="basket-thought-title">${escapeHtml(thought.pageTitle || 'Note')}</div>
                <div class="basket-thought-text">${escapeHtml(thought.text || '')}</div>
            `;

            // Drag from basket
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('thought-id', thought.id);
                e.dataTransfer.setData('thought-data', JSON.stringify(thought));
                el.classList.add('dragging');
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
            });

            basketThoughts.appendChild(el);
        });
    }

    // Drop zone on canvas
    content.addEventListener('dragover', (e) => {
        e.preventDefault();
        content.classList.add('drag-over');
    });

    content.addEventListener('dragleave', () => {
        content.classList.remove('drag-over');
    });

    content.addEventListener('drop', (e) => {
        e.preventDefault();
        content.classList.remove('drag-over');

        const thoughtData = e.dataTransfer.getData('thought-data');
        if (!thoughtData) return;

        const thought = JSON.parse(thoughtData);
        const rect = content.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
        const y = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;

        // Add to canvas
        canvasState.canvasThoughts.push({
            ...thought,
            x: x,
            y: y
        });

        saveCanvasState();

        // Re-render
        chrome.storage.local.get(['thoughts'], (data) => {
            renderCanvas();
            renderBasket(data.thoughts || []);
        });
    });

    // Render canvas thoughts and notes
    function renderCanvas() {
        content.innerHTML = '';

        // Add gradient definition for connectors
        connectorsLayer.innerHTML = `
            <defs>
                <linearGradient id="connectorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#64c896;stop-opacity:0.8" />
                    <stop offset="100%" style="stop-color:#4aa373;stop-opacity:0.8" />
                </linearGradient>
            </defs>
        `;

        canvasState.canvasThoughts.forEach((item) => {
            if (item.type === 'note') {
                createStickyNote(item);
            } else {
                createThoughtCard(item);
            }
        });

        // Render connections
        renderConnections();
    }

    function createThoughtCard(thought) {
        const card = document.createElement('div');
        card.className = 'thought-card';
        card.id = `canvas-${thought.id}`;
        card.dataset.thoughtId = thought.id;
        card.style.left = `${thought.x || 100}px`;
        card.style.top = `${thought.y || 100}px`;

        if (canvasState.connectMode) {
            card.classList.add('connect-candidate');
        }

        card.innerHTML = `
            <button class="close-btn-mac close-btn-sm" title="Remove from canvas">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
            <div class="thought-card-title">${escapeHtml(thought.pageTitle || 'Note')}</div>
            <div class="thought-card-text">${escapeHtml(thought.text || '')}</div>
            <div class="thought-card-tag">${thought.tag || 'Idea'}</div>
        `;

        // Remove button
        card.querySelector('.close-btn-mac').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromCanvas(thought.id);
        });

        // Connect mode click
        card.addEventListener('click', (e) => {
            if (!canvasState.connectMode) return;
            e.stopPropagation();
            handleConnectClick(thought.id, card);
        });

        content.appendChild(card);
        makeCanvasDraggable(card, thought.id);
    }

    function createStickyNote(note) {
        const el = document.createElement('div');
        el.className = 'canvas-sticky-note';
        el.id = `canvas-${note.id}`;
        el.dataset.noteId = note.id;
        el.style.left = `${note.x || 100}px`;
        el.style.top = `${note.y || 100}px`;
        el.style.transform = `rotate(${(Math.random() - 0.5) * 4}deg)`;

        el.innerHTML = `
            <button class="close-btn-mac close-btn-sm" title="Delete note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
            <textarea class="canvas-sticky-note-content">${escapeHtml(note.text || '')}</textarea>
        `;

        // Remove button
        el.querySelector('.close-btn-mac').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromCanvas(note.id);
        });

        // Save on text change
        const textarea = el.querySelector('textarea');
        textarea.addEventListener('input', () => {
            const item = canvasState.canvasThoughts.find(t => t.id === note.id);
            if (item) {
                item.text = textarea.value;
                saveCanvasState();
            }
        });

        textarea.addEventListener('focus', () => el.classList.add('editing'));
        textarea.addEventListener('blur', () => el.classList.remove('editing'));

        content.appendChild(el);
        makeCanvasDraggable(el, note.id, true);
    }

    function removeFromCanvas(id) {
        // Remove connections involving this item
        canvasState.connections = canvasState.connections.filter(
            c => c.from !== id && c.to !== id
        );

        // Remove from canvas
        canvasState.canvasThoughts = canvasState.canvasThoughts.filter(t => t.id !== id);
        saveCanvasState();

        // Re-render
        chrome.storage.local.get(['thoughts'], (data) => {
            renderCanvas();
            renderBasket(data.thoughts || []);
        });
    }

    function handleConnectClick(thoughtId, card) {
        if (!canvasState.connectSource) {
            // First click - select source
            canvasState.connectSource = thoughtId;
            card.classList.add('connect-selected');
            card.classList.remove('connect-candidate');
        } else if (canvasState.connectSource === thoughtId) {
            // Clicked same - deselect
            canvasState.connectSource = null;
            card.classList.remove('connect-selected');
            card.classList.add('connect-candidate');
        } else {
            // Second click - create connection
            const exists = canvasState.connections.some(
                c => (c.from === canvasState.connectSource && c.to === thoughtId) ||
                    (c.from === thoughtId && c.to === canvasState.connectSource)
            );

            if (!exists) {
                canvasState.connections.push({
                    id: `conn-${Date.now()}`,
                    from: canvasState.connectSource,
                    to: thoughtId
                });
                saveCanvasState();
                renderConnections();
            }

            // Reset selection
            content.querySelectorAll('.thought-card').forEach(c => {
                c.classList.remove('connect-selected');
                c.classList.add('connect-candidate');
            });
            canvasState.connectSource = null;
        }
    }

    function renderConnections() {
        // Clear existing connections (keep defs)
        const defs = connectorsLayer.querySelector('defs');
        connectorsLayer.innerHTML = '';
        if (defs) connectorsLayer.appendChild(defs);

        canvasState.connections.forEach(conn => {
            const fromEl = document.getElementById(`canvas-${conn.from}`);
            const toEl = document.getElementById(`canvas-${conn.to}`);

            if (!fromEl || !toEl) return;

            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();
            const contentRect = content.getBoundingClientRect();

            // Calculate center points relative to content
            const x1 = (fromEl.offsetLeft + fromEl.offsetWidth / 2);
            const y1 = (fromEl.offsetTop + fromEl.offsetHeight / 2);
            const x2 = (toEl.offsetLeft + toEl.offsetWidth / 2);
            const y2 = (toEl.offsetTop + toEl.offsetHeight / 2);

            // Create start dot
            const startDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            startDot.setAttribute('cx', x1);
            startDot.setAttribute('cy', y1);
            startDot.setAttribute('r', '4');
            startDot.setAttribute('class', 'connector-dot connector-dot-start');
            connectorsLayer.appendChild(startDot);

            // Create end dot
            const endDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            endDot.setAttribute('cx', x2);
            endDot.setAttribute('cy', y2);
            endDot.setAttribute('r', '3');
            endDot.setAttribute('class', 'connector-dot connector-dot-end');
            connectorsLayer.appendChild(endDot);

            // Create bezier curve
            const midX = (x1 + x2) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${(y1 + y2) / 2} T ${x2} ${y2}`);
            path.setAttribute('class', 'canvas-connector');
            path.setAttribute('stroke', 'url(#connectorGradient)');
            path.dataset.connId = conn.id;

            // Click to delete
            path.style.pointerEvents = 'stroke';
            path.addEventListener('click', () => {
                path.classList.add('deleting');
                setTimeout(() => {
                    canvasState.connections = canvasState.connections.filter(c => c.id !== conn.id);
                    saveCanvasState();
                    renderConnections();
                }, 300);
            });

            connectorsLayer.appendChild(path);
        });
    }

    function makeCanvasDraggable(el, id, isNote = false) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let isDragging = false;

        el.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            // Don't drag if clicking remove button or textarea
            if (e.target.closest('.close-btn-mac') || e.target.closest('.close-btn-sm') || e.target.tagName === 'TEXTAREA') return;
            if (canvasState.connectMode && !isNote) return; // In connect mode, clicks are for connecting

            e.preventDefault();
            isDragging = true;
            el.classList.add('dragging');
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.addEventListener('mouseup', closeDragElement);
            document.addEventListener('mousemove', elementDrag);
        }

        function elementDrag(e) {
            if (!isDragging) return;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            const newTop = el.offsetTop - pos2 / canvasState.zoom;
            const newLeft = el.offsetLeft - pos1 / canvasState.zoom;

            el.style.top = newTop + "px";
            el.style.left = newLeft + "px";

            // Update connections in real-time
            renderConnections();
        }

        function closeDragElement() {
            if (!isDragging) return;
            isDragging = false;
            el.classList.remove('dragging');
            document.removeEventListener('mouseup', closeDragElement);
            document.removeEventListener('mousemove', elementDrag);

            // Save position
            const item = canvasState.canvasThoughts.find(t => t.id === id);
            if (item) {
                item.x = parseInt(el.style.left);
                item.y = parseInt(el.style.top);
                saveCanvasState();
            }
        }
    }

    // Keyboard shortcuts for canvas
    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;

        if (e.key === 'c' || e.key === 'C') {
            connectModeBtn?.click();
        } else if (e.key === 'n' || e.key === 'N') {
            addNoteBtn?.click();
        } else if (e.key === '+' || e.key === '=') {
            zoomInBtn?.click();
        } else if (e.key === '-') {
            zoomOutBtn?.click();
        } else if (e.key === '0') {
            zoomResetBtn?.click();
        }
    });
}

/**
 * Background Curation - Unsplash Integration
 */
function initBackgroundCuration() {
    const randomBtn = document.getElementById('randomBgBtn');
    const searchBtn = document.getElementById('bgSearchBtn');
    const searchInput = document.getElementById('bgSearchInput');

    if (!randomBtn || !searchBtn || !searchInput) return;

    randomBtn.addEventListener('click', async () => {
        randomBtn.disabled = true;
        randomBtn.style.opacity = '0.5';

        try {
            // Switch to Picsum for high reliability and 100% uptime
            // source.unsplash.com is deprecated/unstable for free tier
            state.settings.customBackground = `https://picsum.photos/1920/1080?random=${Date.now()}`;

            saveSettings();
            applyBackground();

            // Update UI active state
            document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
            randomBtn.classList.add('active');
        } catch (err) {
            console.error('BG Random Error:', err);
        } finally {
            setTimeout(() => {
                randomBtn.disabled = false;
                randomBtn.style.opacity = '1';
            }, 1000);
        }
    });

    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (!query) return;

        searchBtn.disabled = true;
        searchBtn.textContent = '...';

        // Use direct Unsplash Image source which is more stable than Source API
        // Fallback to picsum if that fails, but for now we'll use a curated query
        state.settings.customBackground = `https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80&q_search=${encodeURIComponent(query)}`;

        // Note: For real search we'd need an API key. 
        // For this demo, we'll append a query param to salt the cache and use a beautiful landscape.
        // In a real app, this would fetch from a serverless function with an Unsplash API Key.

        saveSettings();
        applyBackground();

        // Update UI
        document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));

        setTimeout(() => {
            searchBtn.disabled = false;
            searchBtn.textContent = 'Search';
        }, 1000);
    });

    // Enter key for search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });
}
