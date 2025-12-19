/**
 * Intents Search - Search Results Page JavaScript
 */

const SEARCH_ENGINES = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    brave: { name: 'Brave', url: 'https://search.brave.com/search?q=' }
};

let currentEngine = 'google';
let currentQuery = '';

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    parseUrlParams();
    initEventListeners();
    performRedirect();
});

function loadTheme() {
    const saved = localStorage.getItem('intents-settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
            currentEngine = settings.defaultEngine || 'google';
        } catch (e) { }
    }
}

function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    currentQuery = params.get('q') || '';
    const engine = params.get('engine');
    if (engine && SEARCH_ENGINES[engine]) currentEngine = engine;

    document.getElementById('queryDisplay').textContent = currentQuery;
    document.getElementById('engineDisplay').textContent = SEARCH_ENGINES[currentEngine].name;
    document.getElementById('headerSearchInput').value = currentQuery;

    // Highlight active engine
    document.querySelectorAll('.engine-quick').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.engine === currentEngine);
    });
}

function performRedirect() {
    if (!currentQuery) {
        window.location.href = 'index.html';
        return;
    }

    const searchUrl = SEARCH_ENGINES[currentEngine].url + encodeURIComponent(currentQuery);

    // Update manual redirect link
    document.getElementById('manualRedirect').href = searchUrl;
    document.getElementById('resultsLink').href = searchUrl;

    // Check settings for new tab preference
    const saved = localStorage.getItem('intents-settings');
    let newTab = false;
    if (saved) {
        try { newTab = JSON.parse(saved).newTabResults; } catch (e) { }
    }

    // Short delay then redirect
    setTimeout(() => {
        if (newTab) {
            window.open(searchUrl, '_blank');
            document.getElementById('loading').style.display = 'none';
            document.getElementById('embedFallback').style.display = 'block';
        } else {
            window.location.href = searchUrl;
        }
    }, 300);
}

function initEventListeners() {
    // Header search form
    document.getElementById('headerSearchForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('headerSearchInput').value.trim();
        if (query) {
            const url = SEARCH_ENGINES[currentEngine].url + encodeURIComponent(query);
            window.location.href = url;
        }
    });

    // Quick engine buttons
    document.querySelectorAll('.engine-quick').forEach(btn => {
        btn.addEventListener('click', () => {
            currentEngine = btn.dataset.engine;
            document.querySelectorAll('.engine-quick').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('engineDisplay').textContent = SEARCH_ENGINES[currentEngine].name;

            // If there's a query, redirect immediately
            if (currentQuery) {
                window.location.href = SEARCH_ENGINES[currentEngine].url + encodeURIComponent(currentQuery);
            }
        });
    });
}
