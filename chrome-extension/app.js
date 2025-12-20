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
        style: 'subtle',  // Default to Native/Formal
        theme: 'dark',    // 'dark' or 'light'
        showQuickLinks: true,
        newTabResults: false,
        showAITaskbar: true
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
    if (aiTaskbarCheckbox) aiTaskbarCheckbox.checked = state.settings.showAITaskbar;
    const aiTaskbar = document.getElementById('aiTaskbar');
    if (aiTaskbar) aiTaskbar.style.display = state.settings.showAITaskbar ? 'flex' : 'none';

    // Set default engine radio
    const engineRadio = document.querySelector(`input[name="engine"][value="${state.settings.defaultEngine}"]`);
    if (engineRadio) engineRadio.checked = true;

    // Update style buttons
    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.style === state.settings.style);
    });

    // Update theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
    });

    document.getElementById('quickLinks').style.display = state.settings.showQuickLinks ? 'block' : 'none';
}

function saveSettings() {
    localStorage.setItem('intents-settings', JSON.stringify(state.settings));
}

function applyStyles() {
    document.documentElement.setAttribute('data-style', state.settings.style);
    document.documentElement.setAttribute('data-theme', state.settings.theme);
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
        el.innerHTML = `<span class="quick-link-name">${link.name}</span><button class="quick-link-delete" data-index="${i}">&times;</button>`;
        grid.appendChild(el);
    });
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
            <span>Recent searches</span>
            <button class="clear-recent" id="clearRecent">Clear</button>
        </div>
        ${filtered.slice(0, 5).map(search => `
            <button class="recent-item" data-search="${search}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${search}
            </button>
        `).join('')}
    `;

    // Click handlers
    recentDropdown.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById('searchInput').value = item.dataset.search;
            document.getElementById('searchForm').dispatchEvent(new Event('submit'));
        });
    });

    document.getElementById('clearRecent')?.addEventListener('click', (e) => {
        e.stopPropagation();
        recentSearches = [];
        localStorage.removeItem('intents-recent-searches');
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

    // Style buttons (Brutal / Subtle)
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

    // When intent is selected, uncheck engine radios
    document.querySelectorAll('input[name="intent"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('input[name="engine"]').forEach(r => r.checked = false);
        });
    });

    // When engine is selected, uncheck intent radios
    document.querySelectorAll('input[name="engine"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('input[name="intent"]').forEach(r => r.checked = false);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Focus search with /
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
        // Close modals with Escape
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            document.getElementById('recentSearches').style.display = 'none';
        }
        // Intent shortcuts (1-4) when not in input
        if (document.activeElement.tagName !== 'INPUT' && !e.ctrlKey && !e.metaKey) {
            const intents = ['learn', 'fix', 'build', 'chill'];
            if (['1', '2', '3', '4'].includes(e.key)) {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                const intentRadio = document.querySelector(`input[name="intent"][value="${intents[index]}"]`);
                if (intentRadio) {
                    intentRadio.checked = true;
                    intentRadio.dispatchEvent(new Event('change'));
                    // Open details if closed
                    document.querySelector('.intent-details')?.setAttribute('open', '');
                }
            }
        }
    });
}

// Handle search - engines are default, intents are secondary
function handleSearch(e) {
    e.preventDefault();

    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    // Save to recent searches
    saveRecentSearch(query);

    // Check if using intent-based search
    const intentRadio = document.querySelector('input[name="intent"]:checked');
    if (intentRadio) {
        const resultsUrl = `results.html?q=${encodeURIComponent(query)}&intent=${intentRadio.value}`;
        if (state.settings.newTabResults) {
            window.open(resultsUrl, '_blank');
        } else {
            window.location.href = resultsUrl;
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
        window.location.href = url;
    }
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
    const deepLink = getFragmentUrl(thought.pageUrl, thought.text);

    return `
        <div class="thought-card ${importanceClass}" style="border-left-color: ${thought.color}" data-id="${thought.id}">
            <div class="thought-header">
                <span class="thought-tag">${thought.tag}</span>
                <button class="thought-delete" data-id="${thought.id}" title="Delete">&times;</button>
            </div>
            <p class="thought-text">${escapeHtml(thought.text)}</p>
            ${thought.context ? `<p class="thought-context">${escapeHtml(thought.context)}</p>` : ''}
            <div class="thought-meta">
                <a href="${deepLink}" target="_blank" class="thought-source">${escapeHtml(truncate(thought.pageTitle, 40))}</a>
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
    return str.length > len ? str.substring(0, len) + '...' : str;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
