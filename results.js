/**
 * Intents Search - Results Page
 * Fetches from multiple APIs based on user intent
 * Hides sections that fail to load or have no results
 */

const INTENT_CONFIG = {
    learn: {
        icon: '📚',
        name: 'Learn',
        primary: { name: 'Wikipedia', icon: '📖', source: 'wikipedia.org' },
        secondary: { name: 'arXiv Papers', icon: '🔬', source: 'arxiv.org' },
        tertiary: { name: 'Related Topics', icon: '💡', source: 'DuckDuckGo' }
    },
    fix: {
        icon: '🔧',
        name: 'Fix',
        primary: { name: 'StackOverflow', icon: '💻', source: 'stackoverflow.com' },
        secondary: { name: 'MDN Docs', icon: '📚', source: 'developer.mozilla.org' },
        tertiary: { name: 'Quick Answer', icon: '⚡', source: 'DuckDuckGo' }
    },
    build: {
        icon: '🛠️',
        name: 'Build',
        primary: { name: 'GitHub Repos', icon: '🐙', source: 'github.com' },
        secondary: { name: 'Documentation', icon: '📖', source: 'Various' },
        tertiary: { name: 'Tutorials', icon: '🎓', source: 'DuckDuckGo' }
    },
    chill: {
        icon: '☕',
        name: 'Chill',
        primary: { name: 'Wikipedia', icon: '📖', source: 'wikipedia.org' },
        secondary: { name: 'Interesting Facts', icon: '🎯', source: 'DuckDuckGo' },
        tertiary: { name: 'Related Reads', icon: '📰', source: 'Various' }
    }
};

let currentQuery = '';
let currentIntent = 'learn';

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    parseParams();
    setupEventListeners();
    performSearch();
});

function loadTheme() {
    const saved = localStorage.getItem('intents-settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            document.documentElement.setAttribute('data-style', settings.style || 'brutal');
            document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
        } catch (e) { }
    }
}

function parseParams() {
    const params = new URLSearchParams(window.location.search);
    currentQuery = params.get('q') || '';
    currentIntent = params.get('intent') || 'learn';

    document.getElementById('queryDisplay').textContent = currentQuery;
    document.getElementById('headerSearchInput').value = currentQuery;

    const config = INTENT_CONFIG[currentIntent];
    document.getElementById('intentBadge').textContent = `${config.icon} ${config.name}`;

    // Update section headers
    document.getElementById('primaryIcon').textContent = config.primary.icon;
    document.getElementById('primaryTitle').textContent = config.primary.name;
    document.getElementById('primarySource').textContent = config.primary.source;

    document.getElementById('secondaryIcon').textContent = config.secondary.icon;
    document.getElementById('secondaryTitle').textContent = config.secondary.name;
    document.getElementById('secondarySource').textContent = config.secondary.source;

    document.getElementById('tertiaryIcon').textContent = config.tertiary.icon;
    document.getElementById('tertiaryTitle').textContent = config.tertiary.name;
    document.getElementById('tertiarySource').textContent = config.tertiary.source;

    // Update intent buttons
    document.querySelectorAll('.intent-quick').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.intent === currentIntent);
    });

    // Update fallback links
    document.getElementById('googleFallback').href = `https://www.google.com/search?q=${encodeURIComponent(currentQuery)}`;
    document.getElementById('ddgFallback').href = `https://duckduckgo.com/?q=${encodeURIComponent(currentQuery)}`;
}

function setupEventListeners() {
    document.getElementById('headerSearchForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('headerSearchInput').value.trim();
        if (query) {
            window.location.href = `results.html?q=${encodeURIComponent(query)}&intent=${currentIntent}`;
        }
    });

    document.querySelectorAll('.intent-quick').forEach(btn => {
        btn.addEventListener('click', () => {
            currentIntent = btn.dataset.intent;
            window.location.href = `results.html?q=${encodeURIComponent(currentQuery)}&intent=${currentIntent}`;
        });
    });
}

// Helper to hide a section
function hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) section.style.display = 'none';
}

// Helper to show content in a section
function showSection(sectionId, content) {
    const section = document.getElementById(sectionId);
    const contentEl = section?.querySelector('.section-content');
    if (contentEl) {
        contentEl.innerHTML = content;
        section.style.display = 'block';
    }
}

async function performSearch() {
    if (!currentQuery) {
        window.location.href = 'index.html';
        return;
    }

    // Fetch instant answer first
    fetchInstantAnswer();

    // Fetch based on intent
    switch (currentIntent) {
        case 'learn':
            fetchWikipedia();
            fetchArxiv();
            fetchRelatedTopics();
            break;
        case 'fix':
            fetchStackOverflow();
            fetchMDN();
            fetchInstantAnswer();
            break;
        case 'build':
            fetchGitHub();
            fetchMDN();
            fetchRelatedTopics();
            break;
        case 'chill':
            fetchWikipedia();
            fetchFunFacts();
            fetchRelatedTopics();
            break;
    }
}

// DuckDuckGo Instant Answer API
async function fetchInstantAnswer() {
    try {
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(currentQuery)}&format=json&no_html=1&skip_disambig=1`);
        const data = await response.json();

        if (data.Abstract || data.Answer) {
            showSection('instantSection', `
                <div class="instant-card">
                    ${data.Image ? `<img src="${data.Image}" alt="" class="instant-image">` : ''}
                    <div class="instant-text">
                        <h3>${data.Heading || currentQuery}</h3>
                        <p>${data.Abstract || data.Answer}</p>
                        ${data.AbstractURL ? `<a href="${data.AbstractURL}" target="_blank" class="result-link">Read more →</a>` : ''}
                    </div>
                </div>
            `);
        } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            const topics = data.RelatedTopics.slice(0, 3).filter(t => t.Text);
            if (topics.length > 0) {
                showSection('instantSection', topics.map(topic => `
                    <div class="result-item">
                        <h4>${topic.Text?.split(' - ')[0] || 'Related'}</h4>
                        <p>${topic.Text || ''}</p>
                        ${topic.FirstURL ? `<a href="${topic.FirstURL}" target="_blank" class="result-link">Learn more →</a>` : ''}
                    </div>
                `).join(''));
            } else {
                hideSection('instantSection');
            }
        } else {
            hideSection('instantSection');
        }
    } catch (err) {
        hideSection('instantSection');
    }
}

// Wikipedia API
async function fetchWikipedia() {
    try {
        const searchRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(currentQuery)}`);

        if (searchRes.ok) {
            const data = await searchRes.json();
            if (data.extract) {
                showSection('primarySection', `
                    <div class="wiki-card">
                        ${data.thumbnail ? `<img src="${data.thumbnail.source}" alt="" class="wiki-thumb">` : ''}
                        <div class="wiki-content">
                            <h3><a href="${data.content_urls?.desktop?.page || '#'}" target="_blank">${data.title}</a></h3>
                            <p>${data.extract}</p>
                        </div>
                    </div>
                `);
                return;
            }
        }

        // Try search
        const searchRes2 = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(currentQuery)}&limit=5&format=json&origin=*`);
        const [, titles, , urls] = await searchRes2.json();

        if (titles && titles.length > 0) {
            showSection('primarySection', titles.map((title, i) => `
                <div class="result-item">
                    <h4><a href="${urls[i]}" target="_blank">${title}</a></h4>
                </div>
            `).join(''));
        } else {
            hideSection('primarySection');
        }
    } catch (err) {
        hideSection('primarySection');
    }
}

// arXiv API
async function fetchArxiv() {
    try {
        const response = await fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(currentQuery)}&start=0&max_results=5`);
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const entries = xml.querySelectorAll('entry');

        if (entries.length > 0) {
            showSection('secondarySection', Array.from(entries).slice(0, 4).map(entry => {
                const title = entry.querySelector('title')?.textContent?.trim() || 'Untitled';
                const summary = entry.querySelector('summary')?.textContent?.trim().slice(0, 200) || '';
                const link = entry.querySelector('id')?.textContent || '#';
                const authors = Array.from(entry.querySelectorAll('author name')).slice(0, 2).map(a => a.textContent).join(', ');

                return `
                    <div class="result-item arxiv-item">
                        <h4><a href="${link}" target="_blank">${title}</a></h4>
                        <p class="result-meta">${authors}</p>
                        <p>${summary}...</p>
                    </div>
                `;
            }).join(''));
        } else {
            hideSection('secondarySection');
        }
    } catch (err) {
        hideSection('secondarySection');
    }
}

// StackOverflow API
async function fetchStackOverflow() {
    try {
        const response = await fetch(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(currentQuery)}&site=stackoverflow&pagesize=5&filter=!nNPvSNPI7A`);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            showSection('primarySection', data.items.map(item => {
                const answered = item.is_answered ? '✓ Answered' : 'Unanswered';
                const answeredClass = item.is_answered ? 'answered' : 'unanswered';
                return `
                    <div class="result-item so-item">
                        <h4><a href="${item.link}" target="_blank">${decodeHtml(item.title)}</a></h4>
                        <div class="so-meta">
                            <span class="so-votes">▲ ${item.score}</span>
                            <span class="so-answers ${answeredClass}">${answered}</span>
                            <span class="so-views">${item.view_count} views</span>
                        </div>
                        <div class="so-tags">${item.tags?.slice(0, 4).map(t => `<span class="tag">${t}</span>`).join('') || ''}</div>
                    </div>
                `;
            }).join(''));
        } else {
            hideSection('primarySection');
        }
    } catch (err) {
        hideSection('primarySection');
    }
}

// MDN Web Docs
async function fetchMDN() {
    try {
        const response = await fetch(`https://api.duckduckgo.com/?q=site:developer.mozilla.org+${encodeURIComponent(currentQuery)}&format=json&no_html=1`);
        const data = await response.json();

        const mdnTopics = data.RelatedTopics?.filter(t =>
            t.FirstURL?.includes('mozilla') || t.FirstURL?.includes('mdn')
        ).slice(0, 3);

        showSection('secondarySection', `
            <div class="result-item mdn-item">
                <h4><a href="https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(currentQuery)}" target="_blank">Search MDN for "${currentQuery}"</a></h4>
                <p>Comprehensive web documentation from Mozilla.</p>
            </div>
            ${mdnTopics?.map(topic => `
                <div class="result-item">
                    <h4><a href="${topic.FirstURL}" target="_blank">${topic.Text?.split(' - ')[0] || 'MDN Doc'}</a></h4>
                </div>
            `).join('') || ''}
        `);
    } catch (err) {
        // Still show MDN link even on error
        showSection('secondarySection', `
            <div class="result-item">
                <h4><a href="https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(currentQuery)}" target="_blank">Search MDN Docs</a></h4>
            </div>
        `);
    }
}

// GitHub Search
async function fetchGitHub() {
    try {
        const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(currentQuery)}&sort=stars&per_page=5`);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            showSection('primarySection', data.items.map(repo => `
                <div class="result-item gh-item">
                    <h4><a href="${repo.html_url}" target="_blank">${repo.full_name}</a></h4>
                    <p>${repo.description || 'No description'}</p>
                    <div class="gh-meta">
                        <span class="gh-stars">⭐ ${formatNumber(repo.stargazers_count)}</span>
                        <span class="gh-forks">🍴 ${formatNumber(repo.forks_count)}</span>
                        <span class="gh-lang">${repo.language || ''}</span>
                    </div>
                </div>
            `).join(''));
        } else {
            hideSection('primarySection');
        }
    } catch (err) {
        hideSection('primarySection');
    }
}

// Related Topics from DuckDuckGo
async function fetchRelatedTopics() {
    try {
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(currentQuery)}&format=json&no_html=1`);
        const data = await response.json();

        const topics = data.RelatedTopics?.filter(t => t.Text && t.FirstURL).slice(0, 4) || [];

        if (topics.length > 0) {
            showSection('tertiarySection', topics.map(topic => `
                <div class="result-item related-item">
                    <a href="${topic.FirstURL}" target="_blank">${topic.Text?.split(' - ')[0] || 'Related'}</a>
                </div>
            `).join(''));
        } else {
            hideSection('tertiarySection');
        }
    } catch (err) {
        hideSection('tertiarySection');
    }
}

// Fun facts for "chill" intent
async function fetchFunFacts() {
    try {
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(currentQuery)}+interesting+facts&format=json&no_html=1`);
        const data = await response.json();

        if (data.Abstract) {
            showSection('secondarySection', `
                <div class="result-item fun-item">
                    <h4>Did you know?</h4>
                    <p>${data.Abstract}</p>
                </div>
            `);
        } else if (data.RelatedTopics?.length > 0) {
            showSection('secondarySection', data.RelatedTopics.slice(0, 3).map(t => `
                <div class="result-item">
                    <p>${t.Text || ''}</p>
                </div>
            `).join(''));
        } else {
            hideSection('secondarySection');
        }
    } catch (err) {
        hideSection('secondarySection');
    }
}

// Utility functions
function decodeHtml(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}
