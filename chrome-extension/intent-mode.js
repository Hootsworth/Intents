/**
 * Intent Mode - Webpage Reader Transformation
 * Transform any webpage into the best possible version for thinking
 */

// Prevent multiple injections
if (window.__INTENT_MODE_LOADED__) {
    // Already loaded, nothing to do
} else {
    window.__INTENT_MODE_LOADED__ = true;

    // Register message listener ONLY ONCE inside the guard
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'activateIntentMode') {
            if (typeof window.__intentModeActivate__ === 'function') {
                window.__intentModeActivate__(request.intent, null, request.scrollTop);
            }
            sendResponse({ success: true });
        }

        if (request.action === 'triggerIsolate') {
            // Get selection more reliably
            const selection = window.getSelection();
            const selectionText = selection ? selection.toString().trim() : '';

            if (selectionText.length > 0) {
                const div = document.createElement('div');
                if (selection.rangeCount > 0) {
                    div.appendChild(selection.getRangeAt(0).cloneContents());
                } else {
                    div.textContent = selectionText;
                }
                if (typeof window.__intentModeActivate__ === 'function') {
                    window.__intentModeActivate__('read', div.innerHTML);
                }
            } else {
                // Show notification instead of blocking alert
                const notif = document.createElement('div');
                notif.className = 'intent-notification';
                notif.textContent = 'Select some text to isolate';
                notif.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(30,30,32,0.95);color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;z-index:100000;';
                document.body.appendChild(notif);
                setTimeout(() => notif.remove(), 2000);
            }
            sendResponse({ success: true });
        }
        return true;
    });

    // Intent configurations
    const INTENTS = {
        read: {
            name: 'Read',
            icon: '📖',
            maxWidth: '720px',
            fontSize: '20px',
            lineHeight: '1.8',
            letterSpacing: '0.01em',
            showToc: false,
            codeEmphasis: false
        },
        learn: {
            name: 'Learn',
            icon: '📚',
            maxWidth: '700px',
            fontSize: '19px',
            lineHeight: '1.75',
            letterSpacing: '0.01em',
            showToc: true,
            codeEmphasis: false
        },
        fix: {
            name: 'Fix',
            icon: '🔧',
            maxWidth: '800px',
            fontSize: '18px',
            lineHeight: '1.7',
            letterSpacing: '0',
            showToc: true,
            codeEmphasis: true
        },
        study: {
            name: 'Study',
            icon: '📝',
            maxWidth: '680px',
            fontSize: '18px',
            lineHeight: '1.75',
            letterSpacing: '0.01em',
            showToc: true,
            codeEmphasis: false
        },
        reflect: {
            name: 'Reflect',
            icon: '🪞',
            maxWidth: '600px',
            fontSize: '21px',
            lineHeight: '1.9',
            letterSpacing: '0.02em',
            showToc: false,
            codeEmphasis: false
        }
    };

    // State
    let currentIntent = null;
    let readerActive = false;
    let fontSizeOffset = 0;
    let currentSelection = '';
    let savedSelection = ''; // Backup selection before click clears it
    let selectionRect = null;
    let hiddenElements = new Map(); // Store hidden elements and their original display style

    // Hold That Thought constants
    const HTT_COLORS = [
        { name: 'Yellow', value: '#fef08a' },
        { name: 'Green', value: '#bbf7d0' },
        { name: 'Blue', value: '#bfdbfe' },
        { name: 'Purple', value: '#ddd6fe' },
        { name: 'Pink', value: '#fbcfe8' },
        { name: 'Orange', value: '#fed7aa' }
    ];

    const HTT_TAGS = ['📚 Read Later', '💡 Idea', '📝 Note', '⭐ Important', '🔗 Reference', '❓ Question'];

    /**
     * Main activation function
     */
    /**
     * Main activation function
     */
    function activateIntentMode(intent, contentOverride = null, resumeScrollTop = null) {
        if (readerActive) {
            // Update intent if already active (ignoring contentOverride in update for simplicity)
            const oldIntent = currentIntent;
            currentIntent = INTENTS[intent] || INTENTS.read;

            // Just update CSS variables if container exists
            const container = document.getElementById('intentModeContainer');
            if (container) {
                const baseFontSize = parseInt(currentIntent.fontSize);
                container.dataset.intent = currentIntent.name.toLowerCase();
                container.style.setProperty('--intent-max-width', currentIntent.maxWidth);
                container.style.setProperty('--intent-line-height', currentIntent.lineHeight);
                container.style.setProperty('--intent-letter-spacing', currentIntent.letterSpacing);
                container.style.setProperty('--intent-font-size', `${baseFontSize + fontSizeOffset}px`);

                // Update badge
                const badge = container.querySelector('.intent-badge');
                if (badge) badge.textContent = `${currentIntent.icon} ${currentIntent.name} Mode`;

                return;
            }
        }

        currentIntent = INTENTS[intent] || INTENTS.read;

        // Extract main content or use override
        let extracted;
        if (contentOverride) {
            // Create temp container to analyze content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = contentOverride;
            const wCount = countWords(tempDiv);

            extracted = {
                title: 'Isolated Selection',
                content: contentOverride,
                byline: 'Selected Text',
                url: window.location.href,
                wordCount: wCount,
                readingTime: Math.ceil(wCount / 200),
                headings: extractHeadings(tempDiv),
                siteName: document.domain,
                publishDate: new Date().toLocaleDateString()
            };
        } else {
            extracted = extractContent();
        }

        if (!extracted || !extracted.content || extracted.content.trim().length < 50) {
            if (!contentOverride) showNotification('Could not extract content from this page.');
            // For isolate, we might persist even if short?
            // If it's override, we respect it.
            if (contentOverride) { /* allow */ } else { return; }
        }

        // Hide original page content (non-destructive)
        hideOriginalContent();

        // Build and inject reader view
        buildReaderView(extracted, !!contentOverride);
        readerActive = true;

        // Resume scroll position if provided (from Continue Reading shelf)
        if (resumeScrollTop && resumeScrollTop > 0) {
            setTimeout(() => {
                window.scrollTo({ top: resumeScrollTop, behavior: 'auto' });
            }, 100);
        }
    }

    /**
     * Deactivate and restore original page
     */
    function deactivateIntentMode() {
        if (!readerActive) return;

        // Remove reader view
        const container = document.getElementById('intentModeContainer');
        if (container) {
            container.remove();
        }

        // Remove style
        document.body.classList.remove('intent-mode-active');

        // Restore original content visibility
        restoreOriginalContent();

        readerActive = false;
        currentIntent = null;
        fontSizeOffset = 0;

        // Remove event listeners
        document.removeEventListener('keydown', handleKeyboard);
        document.removeEventListener('mouseup', handleTextSelection);
    }

    /**
     * Hide original page content
     */
    function hideOriginalContent() {
        hiddenElements.clear();
        Array.from(document.body.children).forEach(child => {
            if (child.id !== 'intentModeContainer' && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
                hiddenElements.set(child, child.style.display);
                child.style.setProperty('display', 'none', 'important');
            }
        });
    }

    /**
     * Restore original page content
     */
    function restoreOriginalContent() {
        hiddenElements.forEach((originalDisplay, element) => {
            if (element && element.style) {
                if (originalDisplay) {
                    element.style.display = originalDisplay;
                } else {
                    element.style.removeProperty('display');
                }
            }
        });
        hiddenElements.clear();
    }

    /**
     * Content extraction - finds and extracts the main readable content
     */
    function extractContent() {
        // Try semantic containers first
        const candidates = [
            document.querySelector('article'),
            document.querySelector('[role="main"]'),
            document.querySelector('main'),
            document.querySelector('.post-content'),
            document.querySelector('.article-content'),
            document.querySelector('.entry-content'),
            document.querySelector('.content'),
            document.querySelector('#content'),
            document.querySelector('.post'),
            document.querySelector('.article')
        ].filter(Boolean);

        let mainElement = null;
        let highestScore = 0;

        // Score each candidate
        for (const candidate of candidates) {
            const score = scoreElement(candidate);
            if (score > highestScore) {
                highestScore = score;
                mainElement = candidate;
            }
        }

        // Fallback: find highest scoring div/section
        if (!mainElement || highestScore < 50) {
            const allContainers = document.querySelectorAll('div, section');
            for (const el of allContainers) {
                const score = scoreElement(el);
                if (score > highestScore) {
                    highestScore = score;
                    mainElement = el;
                }
            }
        }

        if (!mainElement) {
            // Final fallback: Use the body itself if mostly text
            // Clone body but remove scripts/styles first to avoid noise
            const bodyClone = document.body.cloneNode(true);
            cleanContent(bodyClone); // Basic cleaning
            if (bodyClone.textContent.trim().length > 100) {
                mainElement = document.body; // Use real body as source
            } else {
                return null;
            }
        }

        // Extract metadata
        const title = extractTitle();
        const siteName = extractSiteName();
        const publishDate = extractDate();
        const author = extractAuthor();

        // Extract and clean content
        const content = cleanContent(mainElement.cloneNode(true));
        const headings = extractHeadings(content);
        const wordCount = countWords(content);
        const readingTime = Math.ceil(wordCount / 200); // ~200 wpm average

        return {
            title,
            siteName,
            publishDate,
            author,
            content: content.innerHTML,
            headings,
            wordCount,
            readingTime,
            url: window.location.href
        };
    }

    /**
     * Score an element for content likelihood
     */
    function scoreElement(el) {
        if (!el) return 0;

        let score = 0;
        const text = el.textContent || '';
        const textLength = text.length;

        // Text length bonus
        score += Math.min(textLength / 100, 50);

        // Paragraph count bonus
        const paragraphs = el.querySelectorAll('p');
        score += paragraphs.length * 3;

        // Heading presence bonus
        const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
        score += headings.length * 5;

        // Link density penalty (too many links = navigation)
        const links = el.querySelectorAll('a');
        const linkText = Array.from(links).reduce((sum, a) => sum + (a.textContent || '').length, 0);
        const linkDensity = textLength > 0 ? linkText / textLength : 1;
        score -= linkDensity * 50;

        // Negative indicators
        const classList = el.className.toLowerCase();
        const id = (el.id || '').toLowerCase();

        const negativePatterns = ['nav', 'sidebar', 'footer', 'header', 'menu', 'comment', 'social', 'share', 'ad', 'promo', 'related', 'recommended'];
        for (const pattern of negativePatterns) {
            if (classList.includes(pattern) || id.includes(pattern)) {
                score -= 30;
            }
        }

        // Positive indicators
        const positivePatterns = ['article', 'content', 'post', 'entry', 'story', 'body', 'text'];
        for (const pattern of positivePatterns) {
            if (classList.includes(pattern) || id.includes(pattern)) {
                score += 20;
            }
        }

        return score;
    }

    /**
     * Clean content of unwanted elements
     */
    function cleanContent(container) {
        // Remove unwanted elements
        const removeSelectors = [
            'script', 'style', 'noscript', 'iframe', 'object', 'embed',
            'nav', 'aside', 'footer', 'header',
            '.ad', '.ads', '.advertisement', '.promo', '.sponsored',
            '.social', '.share', '.sharing', '.social-share',
            '.related', '.recommended', '.suggestions',
            '.comments', '.comment', '#comments',
            '.newsletter', '.subscribe', '.signup',
            '.popup', '.modal', '.overlay',
            '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
            '.sidebar', '#sidebar',
            'form', 'button:not(.code-copy)',
            '.author-bio', '.bio',
            'svg:not(.inline-svg)', // Remove most SVGs except inline ones
            '.hidden', '[hidden]', '[aria-hidden="true"]'
        ];

        removeSelectors.forEach(selector => {
            container.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Clean attributes but preserve essential ones
        const cleanElement = (el) => {
            const allowedAttrs = ['href', 'src', 'alt', 'title', 'class', 'id', 'lang', 'colspan', 'rowspan'];
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                if (!allowedAttrs.includes(attr.name) && !attr.name.startsWith('data-intent-')) {
                    el.removeAttribute(attr.name);
                }
            });
        };

        container.querySelectorAll('*').forEach(cleanElement);

        // Process images - add loading lazy and constrain
        container.querySelectorAll('img').forEach(img => {
            img.setAttribute('loading', 'lazy');
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
        });

        // Process code blocks
        container.querySelectorAll('pre, code').forEach(code => {
            code.classList.add('intent-code');
        });

        // Remove empty paragraphs
        container.querySelectorAll('p').forEach(p => {
            if (!p.textContent.trim() && !p.querySelector('img')) {
                p.remove();
            }
        });

        return container;
    }

    /**
     * Extract page title
     */
    function extractTitle() {
        return (
            document.querySelector('article h1')?.textContent ||
            document.querySelector('h1.title')?.textContent ||
            document.querySelector('.post-title')?.textContent ||
            document.querySelector('h1')?.textContent ||
            document.querySelector('meta[property="og:title"]')?.content ||
            document.title ||
            'Untitled'
        ).trim();
    }

    /**
     * Extract site name
     */
    function extractSiteName() {
        return (
            document.querySelector('meta[property="og:site_name"]')?.content ||
            document.querySelector('meta[name="application-name"]')?.content ||
            window.location.hostname.replace('www.', '')
        );
    }

    /**
     * Extract publish date
     */
    function extractDate() {
        const dateElement =
            document.querySelector('time[datetime]') ||
            document.querySelector('[class*="date"]') ||
            document.querySelector('[class*="publish"]');

        if (dateElement) {
            const datetime = dateElement.getAttribute('datetime') || dateElement.textContent;
            try {
                const date = new Date(datetime);
                if (!isNaN(date)) {
                    return date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            } catch (e) { }
        }
        return null;
    }

    /**
     * Extract author
     */
    function extractAuthor() {
        return (
            document.querySelector('[rel="author"]')?.textContent ||
            document.querySelector('.author-name')?.textContent ||
            document.querySelector('meta[name="author"]')?.content ||
            document.querySelector('[class*="author"]')?.textContent ||
            null
        )?.trim();
    }

    /**
     * Extract headings for table of contents
     */
    function extractHeadings(container) {
        const headings = [];
        container.querySelectorAll('h1, h2, h3, h4').forEach((h, index) => {
            const text = h.textContent.trim();
            if (text) {
                const id = `intent-heading-${index}`;
                h.id = id;
                headings.push({
                    level: parseInt(h.tagName[1]),
                    text: text.substring(0, 60) + (text.length > 60 ? '...' : ''),
                    id
                });
            }
        });
        return headings;
    }

    /**
     * Count words in content
     */
    function countWords(container) {
        const text = container.textContent || '';
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }

    /**
     * Build the reader view
     */
    function buildReaderView(extracted, isIsolate = false) {
        const intent = currentIntent;
        const baseFontSize = parseInt(intent.fontSize);
        const adjustedFontSize = baseFontSize + fontSizeOffset;

        // Build TOC HTML if needed
        let tocHtml = '';
        if (intent.showToc && extracted.headings.length > 3) {
            tocHtml = `
            <nav class="intent-toc" id="intentToc">
                <div class="intent-toc-header">
                    <span>Contents</span>
                    <button class="intent-toc-toggle" id="intentTocToggle">−</button>
                </div>
                <ul class="intent-toc-list">
                    ${extracted.headings.map(h => `
                        <li class="intent-toc-item level-${h.level}">
                            <a href="#${h.id}">${escapeHtml(h.text)}</a>
                        </li>
                    `).join('')}
                </ul>
            </nav>
        `;
        }

        // Metadata line
        const metaParts = [];
        if (extracted.siteName) metaParts.push(extracted.siteName);
        if (extracted.author) metaParts.push(extracted.author);
        if (extracted.publishDate) metaParts.push(extracted.publishDate);
        const metaHtml = metaParts.length > 0
            ? `<div class="intent-meta">${metaParts.join(' · ')}</div>`
            : '';

        // Build the reader view
        const readerHtml = `
        <div class="intent-mode-container" id="intentModeContainer" 
             data-intent="${intent.name.toLowerCase()}"
             style="--intent-max-width: ${intent.maxWidth}; 
                    --intent-font-size: ${adjustedFontSize}px; 
                    --intent-line-height: ${intent.lineHeight};
                    --intent-letter-spacing: ${intent.letterSpacing};">
            
            <!-- Progress bar -->
            <div class="intent-progress" id="intentProgress">
                <div class="intent-progress-bar" id="intentProgressBar"></div>
            </div>
            
            <!-- Top bar -->
            <div class="intent-topbar" id="intentTopbar">
                <div class="intent-topbar-left">
                    <span class="intent-badge">${intent.icon} ${intent.name} Mode</span>
                    <span class="intent-reading-time">${extracted.readingTime} min read</span>
                </div>
                <div class="intent-topbar-right">
                    <button type="button" class="intent-btn intent-btn-ai" id="intentSummarize" title="AI Summarize (TL;DR)">
                        <span class="ai-stars">✨</span> Summarize
                    </button>
                    <button type="button" class="intent-btn intent-btn-icon" id="intentToggleLinks" title="Disable Links">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </button>
                    <button type="button" class="intent-btn intent-btn-icon" id="intentToggleImages" title="Hide Images">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    </button>
                    <button type="button" class="intent-btn intent-btn-icon" id="intentSettingsToggle" title="Typography Settings">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </button>
                    <button type="button" class="intent-btn" id="intentFontDecrease" title="Decrease font size">A−</button>
                    <button type="button" class="intent-btn" id="intentFontIncrease" title="Increase font size">A+</button>
                    <button type="button" class="close-btn-mac" id="intentClose" title="${isIsolate ? 'Exit Isolation' : 'Exit Intent Mode (Esc)'}" style="width: 20px; height: 20px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Typography Settings Panel -->
            <div class="intent-settings-panel" id="intentSettingsPanel">
                <div class="intent-settings-header">
                    <span>Reading Preferences</span>
                    <button type="button" class="close-btn-mac intent-settings-close-mac" id="intentSettingsClose" style="width: 16px; height: 16px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="intent-settings-body">
                    <div class="intent-setting-group">
                        <label>Theme</label>
                        <div class="intent-theme-options">
                            <button class="intent-theme-btn active" data-theme="dark" title="Dark">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            </button>
                            <button class="intent-theme-btn" data-theme="light" title="Light">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            </button>
                            <button class="intent-theme-btn" data-theme="sepia" title="Sepia">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="intent-setting-group">
                        <label>Font</label>
                        <select id="intentFontSelect" class="intent-select">
                            <option value="system">System (Default)</option>
                            <option value="serif">Serif (Georgia)</option>
                            <option value="mono">Monospace</option>
                            <option value="dyslexic">OpenDyslexic</option>
                        </select>
                    </div>
                    <div class="intent-setting-group">
                        <label>Line Height</label>
                        <input type="range" id="intentLineHeight" class="intent-slider" min="1.4" max="2.4" step="0.1" value="${intent.lineHeight}">
                        <span class="intent-slider-value" id="intentLineHeightValue">${intent.lineHeight}</span>
                    </div>
                    <div class="intent-setting-group">
                        <label>Letter Spacing</label>
                        <input type="range" id="intentLetterSpacing" class="intent-slider" min="0" max="0.1" step="0.01" value="0.01">
                        <span class="intent-slider-value" id="intentLetterSpacingValue">0.01em</span>
                    </div>
                    <div class="intent-setting-group intent-dyslexia-toggle">
                        <button class="intent-dyslexia-btn" id="intentDyslexiaToggle">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 6v6l4 2"/>
                            </svg>
                            <span>Dyslexia-Friendly Mode</span>
                        </button>
                        <span class="intent-dyslexia-hint">OpenDyslexic font + wider spacing</span>
                    </div>
                </div>
            </div>
            
            <!-- Main content area -->
            <div class="intent-reader" id="intentReader">
                ${tocHtml}
                
                <article class="intent-article ${intent.codeEmphasis ? 'code-emphasis' : ''}">
                    <header class="intent-header">
                        <h1 class="intent-title">${escapeHtml(extracted.title)}</h1>
                        ${metaHtml}
                    </header>
                    
                    <div class="intent-content" id="intentContent">
                        ${extracted.content}
                    </div>
                    
                    ${isIsolate ? `
                    <div style="margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--intent-border); text-align: center;">
                        <button type="button" class="intent-btn intent-btn-close" id="intentExitIso" style="padding: 12px 24px; font-size: 15px;">
                            Exit Isolation & Show Website
                        </button>
                    </div>
                    ` : ''}

                    <footer class="intent-footer">
                        <div class="intent-source">
                            <span>Source:</span>
                            <a href="${extracted.url}" target="_blank" rel="noopener">${extracted.url}</a>
                        </div>
                        <div class="intent-word-count">${extracted.wordCount.toLocaleString()} words</div>
                    </footer>
                </article>
            </div>
            
            <!-- Keyboard hint -->
            <div class="intent-hint" id="intentHint">
                Press <kbd>Esc</kbd> to exit · <kbd>↑</kbd><kbd>↓</kbd> to scroll · <kbd>T</kbd> toggle TOC
            </div>
        </div>
    `;

        // Inject container
        document.body.appendChild(document.createRange().createContextualFragment(readerHtml));
        document.body.classList.add('intent-mode-active');

        // Attach event listeners
        attachReaderListeners();

        // Initialize progress tracking
        initProgressTracking();
    }

    /**
     * Attach event listeners to reader view
     */
    function attachReaderListeners() {
        // Close button
        document.getElementById('intentClose')?.addEventListener('click', deactivateIntentMode);
        document.getElementById('intentExitIso')?.addEventListener('click', deactivateIntentMode);

        // Link Disable Toggle
        document.getElementById('intentToggleLinks')?.addEventListener('click', () => {
            const container = document.getElementById('intentModeContainer');
            const content = document.getElementById('intentContent');
            const btn = document.getElementById('intentToggleLinks');
            const isDisabled = container.classList.toggle('intent-links-disabled');

            if (isDisabled && content) {
                // Disable links
                content.querySelectorAll('a').forEach(link => {
                    const href = link.getAttribute('href') || '';
                    const text = link.textContent.trim();

                    // Check if link text is just a URL
                    const isPlainUrl = /^(https?:\/\/|www\.)/i.test(text) || text === href;

                    if (isPlainUrl) {
                        // Plain URL link - hide completely
                        link.style.display = 'none';
                        link.dataset.intentHidden = 'true';
                    } else {
                        // Text link - convert to plain text span
                        link.dataset.intentOriginalHref = href;
                        link.removeAttribute('href');
                        link.style.color = 'inherit';
                        link.style.cursor = 'text';
                        link.style.textDecoration = 'none';
                        link.style.pointerEvents = 'none';
                    }
                });
            } else if (content) {
                // Restore links
                content.querySelectorAll('a').forEach(link => {
                    if (link.dataset.intentHidden === 'true') {
                        link.style.display = '';
                        delete link.dataset.intentHidden;
                    }
                    if (link.dataset.intentOriginalHref) {
                        link.setAttribute('href', link.dataset.intentOriginalHref);
                        link.style.color = '';
                        link.style.cursor = '';
                        link.style.textDecoration = '';
                        link.style.pointerEvents = '';
                        delete link.dataset.intentOriginalHref;
                    }
                });
            }

            if (btn) btn.style.opacity = isDisabled ? '0.5' : '1';
        });

        // Font size controls
        document.getElementById('intentFontDecrease')?.addEventListener('click', () => adjustFontSize(-2));
        document.getElementById('intentFontIncrease')?.addEventListener('click', () => adjustFontSize(2));

        // Summarize button
        document.getElementById('intentSummarize')?.addEventListener('click', generateAISummary);

        // Hide images toggle
        document.getElementById('intentToggleImages')?.addEventListener('click', () => {
            const container = document.getElementById('intentModeContainer');
            const content = document.getElementById('intentContent');
            const btn = document.getElementById('intentToggleImages');
            const isHidden = container.classList.toggle('intent-images-hidden');

            if (isHidden && content) {
                content.querySelectorAll('img, figure, picture, video, iframe').forEach(el => {
                    el.style.display = 'none';
                    el.dataset.intentImageHidden = 'true';
                });
            } else if (content) {
                content.querySelectorAll('[data-intent-image-hidden]').forEach(el => {
                    el.style.display = '';
                    delete el.dataset.intentImageHidden;
                });
            }

            if (btn) btn.style.opacity = isHidden ? '0.5' : '1';
        });

        // Settings panel toggle
        document.getElementById('intentSettingsToggle')?.addEventListener('click', () => {
            document.getElementById('intentSettingsPanel')?.classList.toggle('open');
        });
        document.getElementById('intentSettingsClose')?.addEventListener('click', () => {
            document.getElementById('intentSettingsPanel')?.classList.remove('open');
        });

        // Theme buttons
        document.querySelectorAll('.intent-theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                const container = document.getElementById('intentModeContainer');

                // Remove all theme classes
                container.classList.remove('intent-theme-light', 'intent-theme-sepia');

                // Apply selected theme
                if (theme === 'light') container.classList.add('intent-theme-light');
                if (theme === 'sepia') container.classList.add('intent-theme-sepia');

                // Update active state
                document.querySelectorAll('.intent-theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Font select
        document.getElementById('intentFontSelect')?.addEventListener('change', (e) => {
            const font = e.target.value;
            const container = document.getElementById('intentModeContainer');

            container.classList.remove('intent-font-serif', 'intent-font-mono', 'intent-font-dyslexic');
            if (font === 'serif') container.classList.add('intent-font-serif');
            if (font === 'mono') container.classList.add('intent-font-mono');
            if (font === 'dyslexic') container.classList.add('intent-font-dyslexic');
        });

        // Line height slider
        document.getElementById('intentLineHeight')?.addEventListener('input', (e) => {
            const value = e.target.value;
            const container = document.getElementById('intentModeContainer');
            container.style.setProperty('--intent-line-height', value);
            document.getElementById('intentLineHeightValue').textContent = value;
        });

        // Letter spacing slider
        document.getElementById('intentLetterSpacing')?.addEventListener('input', (e) => {
            const value = e.target.value;
            const container = document.getElementById('intentModeContainer');
            container.style.setProperty('--intent-letter-spacing', value + 'em');
            document.getElementById('intentLetterSpacingValue').textContent = value + 'em';
        });

        // Dyslexia Mode toggle
        document.getElementById('intentDyslexiaToggle')?.addEventListener('click', () => {
            const container = document.getElementById('intentModeContainer');
            const btn = document.getElementById('intentDyslexiaToggle');
            const isEnabled = container.classList.toggle('intent-dyslexia-mode');

            if (isEnabled) {
                // Apply dyslexia-friendly settings
                container.classList.add('intent-font-dyslexic');
                container.style.setProperty('--intent-line-height', '2.0');
                container.style.setProperty('--intent-letter-spacing', '0.05em');
                document.getElementById('intentLineHeight').value = '2.0';
                document.getElementById('intentLineHeightValue').textContent = '2.0';
                document.getElementById('intentLetterSpacing').value = '0.05';
                document.getElementById('intentLetterSpacingValue').textContent = '0.05em';
                document.getElementById('intentFontSelect').value = 'dyslexic';
                btn.classList.add('active');
            } else {
                // Reset to defaults
                container.classList.remove('intent-font-dyslexic');
                container.style.setProperty('--intent-line-height', '1.75');
                container.style.setProperty('--intent-letter-spacing', '0.01em');
                document.getElementById('intentLineHeight').value = '1.75';
                document.getElementById('intentLineHeightValue').textContent = '1.75';
                document.getElementById('intentLetterSpacing').value = '0.01';
                document.getElementById('intentLetterSpacingValue').textContent = '0.01em';
                document.getElementById('intentFontSelect').value = 'system';
                btn.classList.remove('active');
            }
        });

        // Reading Progress Memory - save scroll position
        // Note: We listen on window because the body/window scrolls, not the reader element
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (!readerActive) return;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                saveReadingProgress(window.location.href, window.scrollY);
            }, 500);
        });

        // Check for saved progress and show resume prompt
        checkReadingProgress(window.location.href);


        // TOC toggle
        document.getElementById('intentTocToggle')?.addEventListener('click', toggleToc);

        // TOC link clicks - smooth scroll
        document.querySelectorAll('.intent-toc-item a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Highlight briefly
                    target.classList.add('intent-highlight');
                    setTimeout(() => target.classList.remove('intent-highlight'), 1500);
                }
            });
        });

        // Keyboard navigation
        document.addEventListener('keydown', handleKeyboard);

        // Initialize text selection handling for Hold That Thought
        initSelectionHandling();

        // Hide hint after a few seconds
        setTimeout(() => {
            const hint = document.getElementById('intentHint');
            if (hint) hint.classList.add('fading');
        }, 5000);
    }

    /**
     * Handle keyboard shortcuts
     */
    function handleKeyboard(e) {
        if (!readerActive) return;

        switch (e.key) {
            case 'Escape':
                deactivateIntentMode();
                break;
            case 't':
            case 'T':
                if (!e.ctrlKey && !e.metaKey) {
                    toggleToc();
                }
                break;
            case 'ArrowUp':
                if (!e.ctrlKey && !e.metaKey) {
                    window.scrollBy({ top: -100, behavior: 'smooth' });
                }
                break;
            case 'ArrowDown':
                if (!e.ctrlKey && !e.metaKey) {
                    window.scrollBy({ top: 100, behavior: 'smooth' });
                }
                break;
            case '+':
            case '=':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    adjustFontSize(2);
                }
                break;
            case '-':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    adjustFontSize(-2);
                }
                break;
        }
    }

    /**
     * Toggle table of contents visibility
     */
    function toggleToc() {
        const toc = document.getElementById('intentToc');
        const toggle = document.getElementById('intentTocToggle');
        if (toc && toggle) {
            toc.classList.toggle('collapsed');
            toggle.textContent = toc.classList.contains('collapsed') ? '+' : '−';
        }
    }

    /**
     * Adjust font size
     */
    function adjustFontSize(delta) {
        fontSizeOffset += delta;
        fontSizeOffset = Math.max(-6, Math.min(10, fontSizeOffset)); // Clamp

        const container = document.getElementById('intentModeContainer');
        if (container && currentIntent) {
            const baseFontSize = parseInt(currentIntent.fontSize);
            container.style.setProperty('--intent-font-size', `${baseFontSize + fontSizeOffset}px`);
        }
    }

    /**
     * Initialize reading progress tracking
     */
    function initProgressTracking() {
        const progressBar = document.getElementById('intentProgressBar');
        const reader = document.getElementById('intentReader');

        if (!progressBar || !reader) return;

        const updateProgress = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            progressBar.style.width = `${Math.min(100, progress)}%`;
        };

        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();
    }

    /**
     * Show notification
     */
    function showNotification(message) {
        const existing = document.querySelector('.intent-notification');
        if (existing) existing.remove();

        const notif = document.createElement('div');
        notif.className = 'intent-notification';
        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== Hold That Thought Integration ====================

    /**
     * Initialize text selection handling
     */
    function initSelectionHandling() {
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('keyup', (e) => {
            if (e.shiftKey) handleTextSelection();
        });

        // Hide tooltip on click elsewhere
        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.intent-htt-tooltip') && !e.target.closest('.intent-htt-panel')) {
                hideSelectionTooltip();
            }
        });
    }

    /**
     * Handle text selection
     */
    function handleTextSelection(e) {
        // Ignore if reader not active
        if (!readerActive) return;

        // Ignore clicks inside the tooltip or panel
        if (e && e.target && (e.target.closest('.intent-htt-tooltip') || e.target.closest('.intent-htt-panel'))) {
            return;
        }

        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text.length > 2) { // Minimum selection length lowered to 2 for easier testing
            currentSelection = text;
            const range = selection.getRangeAt(0);
            selectionRect = range.getBoundingClientRect();
            showSelectionTooltip();
        } else {
            // Only hide if we aren't interacting with the tooltip
            // Note: The mousedown handler handles closing on outside clicks, 
            // but we double check here to handle empty selections
            hideSelectionTooltip();
        }
    }

    /**
     * Show the floating tooltip near selection
     */
    function showSelectionTooltip() {
        hideSelectionTooltip(); // Remove existing

        const tooltip = document.createElement('div');
        tooltip.className = 'intent-htt-tooltip';
        tooltip.innerHTML = `
        <button type="button" class="intent-htt-tooltip-btn" id="httTooltipBtn">
            Save thought
        </button>
    `;

        document.body.appendChild(tooltip);

        // Position near selection
        const scrollTop = window.scrollY;
        const scrollLeft = window.scrollX;

        tooltip.style.top = `${selectionRect.top + scrollTop - tooltip.offsetHeight - 8}px`;
        tooltip.style.left = `${selectionRect.left + scrollLeft + (selectionRect.width / 2) - (tooltip.offsetWidth / 2)}px`;

        // Keep within viewport
        const rect = tooltip.getBoundingClientRect();
        if (rect.left < 10) tooltip.style.left = '10px';
        if (rect.right > window.innerWidth - 10) {
            tooltip.style.left = `${window.innerWidth - tooltip.offsetWidth - 10}px`;
        }
        if (rect.top < 60) { // Below selection if too high
            tooltip.style.top = `${selectionRect.bottom + scrollTop + 8}px`;
        }

        // Store the selection text before any click clears it (module-level)
        savedSelection = currentSelection;

        // Attach click handler
        const btn = document.getElementById('httTooltipBtn');

        // Prevent default on mousedown to stop focus stealing/selection clearing
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        // Handle the actual action on click
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Re-verify selection is available, or use saved one
            if (!currentSelection && savedSelection) {
                currentSelection = savedSelection;
            }

            hideSelectionTooltip();
            showHttPanel();
        });

        // Animate in
        requestAnimationFrame(() => tooltip.classList.add('visible'));
    }

    /**
     * Hide the selection tooltip
     */
    function hideSelectionTooltip() {
        const tooltip = document.querySelector('.intent-htt-tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
            setTimeout(() => tooltip.remove(), 150);
        }
    }

    /**
     * Show the integrated HTT panel
     */
    function showHttPanel() {
        hideHttPanel(); // Remove existing

        // Use savedSelection as fallback when currentSelection is empty
        const selectionText = currentSelection || savedSelection || '';
        const pageTitle = document.querySelector('.intent-title')?.textContent || document.title;
        const pageUrl = window.location.href;

        // If no selection, show notification and exit
        if (!selectionText) {
            showNotification('Select some text first');
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'intent-htt-panel';
        panel.id = 'intentHttPanel';
        // Store selection in data attribute for later retrieval
        panel.dataset.selectionText = selectionText;

        panel.innerHTML = `
        <div class="intent-htt-panel-header">
            <h3>Hold That Thought</h3>
            <button type="button" class="close-btn-mac" id="httPanelClose" style="width: 24px; height: 24px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
        
        <div class="intent-htt-panel-content">
            <div class="intent-htt-preview">
                <p class="intent-htt-selected-text">"${escapeHtml(selectionText.substring(0, 120))}${selectionText.length > 120 ? '...' : ''}"</p>
            </div>
            
            <div class="intent-htt-field">
                <label>Tag</label>
                <div class="intent-htt-tags" id="httTags">
                    <button type="button" class="intent-htt-tag active" data-tag="📝 Note">Note</button>
                    <button type="button" class="intent-htt-tag" data-tag="💡 Idea">Idea</button>
                    <button type="button" class="intent-htt-tag" data-tag="📚 Read Later">Read Later</button>
                </div>
            </div>
            
            <div class="intent-htt-field">
                <label>Note</label>
                <textarea id="httContext" placeholder="Why save this?"></textarea>
            </div>
        </div>
        
        <div class="intent-htt-panel-footer">
            <button type="button" class="intent-htt-cancel" id="httCancel">Cancel</button>
            <button type="button" class="intent-htt-save" id="httSave">Save</button>
        </div>
    `;

        document.body.appendChild(panel);

        // Animate in
        requestAnimationFrame(() => panel.classList.add('open'));

        // Attach event listeners
        document.getElementById('httPanelClose').addEventListener('click', hideHttPanel);
        document.getElementById('httCancel').addEventListener('click', hideHttPanel);
        document.getElementById('httSave').addEventListener('click', saveHttThought);

        // Tag selection
        document.querySelectorAll('.intent-htt-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.intent-htt-tag').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Keyboard: Escape to close, Cmd/Ctrl+Enter to save
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                hideHttPanel();
                document.removeEventListener('keydown', keyHandler);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                saveHttThought();
            }
        };
        document.addEventListener('keydown', keyHandler);

        // Focus context textarea
        setTimeout(() => document.getElementById('httContext')?.focus(), 100);
    }

    /**
     * Hide the HTT panel
     */
    function hideHttPanel() {
        const panel = document.getElementById('intentHttPanel');
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => panel.remove(), 200);
        }
        currentSelection = '';
    }

    /**
     * Save the thought via background script
     */
    function saveHttThought() {
        // Get the selection text from the panel's data attribute
        const panel = document.getElementById('intentHttPanel');
        const selectionText = panel?.dataset.selectionText || currentSelection || savedSelection || '';

        const tag = document.querySelector('.intent-htt-tag.active')?.dataset.tag || '📝 Note';
        const context = document.getElementById('httContext')?.value || '';

        const pageTitle = document.querySelector('.intent-title')?.textContent || document.title;
        const pageUrl = window.location.href;

        const thought = {
            text: selectionText,
            pageTitle,
            pageUrl,
            tag,
            color: '#fef08a', // Default yellow
            importance: 'medium',
            context
        };

        chrome.runtime.sendMessage({ action: 'saveThought', thought }, (response) => {
            if (response?.success) {
                hideHttPanel();
                showNotification('Saved');
            } else {
                showNotification('Failed to save');
            }
        });
    }

    // ========== READING PROGRESS MEMORY ==========
    function getReadingProgressKey(url) {
        return 'intent-reading-progress-' + btoa(url).substring(0, 32);
    }

    function saveReadingProgress(url, scrollTop) {
        const key = getReadingProgressKey(url);

        // Calculate progress percentage using document scroll
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progressPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

        // Get page metadata
        const title = document.querySelector('.intent-title')?.textContent || document.title || 'Untitled';
        const favicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
        const readingTime = document.querySelector('.intent-reading-time')?.textContent || '';

        const data = {
            scrollTop,
            timestamp: Date.now(),
            url,
            title: title.substring(0, 100),
            favicon,
            progressPercent,
            readingTime,
            hostname: new URL(url).hostname
        };

        // Save to localStorage for Intent Mode resume prompt
        localStorage.setItem(key, JSON.stringify(data));

        // Also save to chrome.storage.local for the New Tab shelf
        // Only save if significant progress (> 5% and < 95%)
        if (progressPercent > 5 && progressPercent < 95) {
            chrome.storage.local.get(['readingShelf'], (result) => {
                const shelf = result.readingShelf || {};
                shelf[key] = data;
                chrome.storage.local.set({ readingShelf: shelf });
            });
        } else if (progressPercent >= 95) {
            // Remove from shelf if finished
            chrome.storage.local.get(['readingShelf'], (result) => {
                const shelf = result.readingShelf || {};
                delete shelf[key];
                chrome.storage.local.set({ readingShelf: shelf });
            });
        }

        // Clean up old entries (older than 7 days)
        cleanOldReadingProgress();
    }

    function checkReadingProgress(url) {
        const key = getReadingProgressKey(url);
        const saved = localStorage.getItem(key);

        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            const sevenDays = 7 * 24 * 60 * 60 * 1000;

            // Only show if saved within 7 days and scrolled past 200px
            if (Date.now() - data.timestamp < sevenDays && data.scrollTop > 200) {
                showResumePrompt(data.scrollTop);
            }
        } catch (e) {
            localStorage.removeItem(key);
        }
    }

    function showResumePrompt(scrollTop) {
        const container = document.getElementById('intentModeContainer');
        if (!container) return;

        const prompt = document.createElement('div');
        prompt.className = 'intent-resume-prompt';
        prompt.innerHTML = `
            <div class="intent-resume-content">
                <span class="intent-resume-text">Continue where you left off?</span>
                <button class="intent-resume-btn" id="intentResumeYes">Resume</button>
                <button class="close-btn-mac intent-resume-close" id="intentResumeNo" style="width: 14px; height: 14px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;

        container.appendChild(prompt);
        requestAnimationFrame(() => prompt.classList.add('visible'));

        // Resume button
        document.getElementById('intentResumeYes')?.addEventListener('click', () => {
            window.scrollTo({ top: scrollTop, behavior: 'smooth' });
            dismissResumePrompt(prompt);
        });

        // Dismiss button
        document.getElementById('intentResumeNo')?.addEventListener('click', () => {
            dismissResumePrompt(prompt);
            // Clear saved progress for this page
            localStorage.removeItem(getReadingProgressKey(window.location.href));
        });

        // Auto dismiss after 8 seconds
        setTimeout(() => dismissResumePrompt(prompt), 8000);
    }

    function dismissResumePrompt(prompt) {
        if (!prompt) return;
        prompt.classList.remove('visible');
        setTimeout(() => prompt.remove(), 300);
    }

    function cleanOldReadingProgress() {
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('intent-reading-progress-')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (now - data.timestamp > sevenDays) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        }
    }

    async function generateAISummary() {
        const btn = document.getElementById('intentSummarize');
        const content = document.getElementById('intentContent');
        if (!content || (btn && btn.disabled)) return;

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="ai-stars loading">✨</span> Thinking...';
        }

        try {
            // Simulation of AI processing
            await new Promise(r => setTimeout(r, 1500));

            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'intent-ai-summary';
            summaryDiv.innerHTML = `
                <div class="ai-summary-header">
                    <span class="ai-stars">✨</span>
                    <span class="ai-label">AI SUMMARY (TL;DR)</span>
                    <button class="ai-summary-close" id="closeAISummary">&times;</button>
                </div>
                <div class="ai-summary-content">
                    <p><strong>Perspective:</strong> This article exploring ${document.title.split('-')[0].trim()} offers key insights into modern trends.</p>
                    <ul class="ai-points">
                        <li>Focuses on the integration of minimalist design with powerful productivity features.</li>
                        <li>Highlights the importance of user-centric workflows and cognitive focus.</li>
                        <li>Proposes a forward-looking approach to information organization and spatial thinking.</li>
                    </ul>
                </div>
                <div class="ai-summary-footer">
                    <button class="ai-deep-btn" id="aiDeepSearch">Deep Research with AI</button>
                </div>
            `;

            // Existing summary cleanup
            document.querySelector('.intent-ai-summary')?.remove();

            const articleHeader = content.parentElement.querySelector('.intent-header');
            if (articleHeader) {
                articleHeader.after(summaryDiv);
            } else {
                content.prepend(summaryDiv);
            }

            document.getElementById('closeAISummary').onclick = () => summaryDiv.remove();
            document.getElementById('aiDeepSearch').onclick = () => {
                const query = `Provide a deep analysis and detailed summary of: ${window.location.href}`;
                window.open(`https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`, '_blank');
            };

            if (btn) btn.innerHTML = '✨ Summarized';
        } catch (err) {
            if (btn) btn.innerHTML = '✨ Error';
            console.error('AI Summary Error:', err);
        } finally {
            setTimeout(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span class="ai-stars">✨</span> Summarize';
                }
            }, 3000);
        }
    }

    // Expose activateIntentMode globally so the message listener can call it
    window.__intentModeActivate__ = activateIntentMode;

} // End of guard block
