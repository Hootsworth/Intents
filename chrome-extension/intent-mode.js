/**
 * Intent Mode - Webpage Reader Transformation
 * Transform any webpage into the best possible version for thinking
 */

// Listen for messages from background script - ALWAYS register this
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'activateIntentMode') {
        if (typeof window.__intentModeActivate__ === 'function') {
            window.__intentModeActivate__(request.intent);
        }
        sendResponse({ success: true });
    }

    if (request.action === 'triggerIsolate') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            const div = document.createElement('div');
            div.appendChild(selection.getRangeAt(0).cloneContents());
            if (typeof window.__intentModeActivate__ === 'function') {
                window.__intentModeActivate__('read', div.innerHTML);
            }
        } else {
            alert('Please select some text to isolate.');
        }
    }
    return true;
});

// Prevent multiple injections of the main code
if (window.__INTENT_MODE_LOADED__) {
    // Already loaded, nothing to do
} else {
    window.__INTENT_MODE_LOADED__ = true;

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
    function activateIntentMode(intent, contentOverride = null) {
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
                    ${intent.name === 'Reflect' ? '<button type="button" class="intent-btn" id="intentToggleLinks" title="Show/Blur Links">👁️</button>' : ''}
                    <button type="button" class="intent-btn" id="intentFontDecrease" title="Decrease font size">A−</button>
                    <button type="button" class="intent-btn" id="intentFontIncrease" title="Increase font size">A+</button>
                    <button type="button" class="intent-btn intent-btn-close" id="intentClose" title="${isIsolate ? 'Exit Isolation' : 'Exit Intent Mode (Esc)'}">${isIsolate ? 'Exit' : '✕'}</button>
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

        // Reflect Link Toggle
        document.getElementById('intentToggleLinks')?.addEventListener('click', () => {
            const container = document.getElementById('intentModeContainer');
            container.classList.toggle('intent-links-visible');
            const btn = document.getElementById('intentToggleLinks');
            if (btn) btn.style.opacity = container.classList.contains('intent-links-visible') ? '1' : '0.6';
        });

        // Font size controls
        document.getElementById('intentFontDecrease')?.addEventListener('click', () => adjustFontSize(-2));
        document.getElementById('intentFontIncrease')?.addEventListener('click', () => adjustFontSize(2));

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
            💭 Hold That Thought
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

        // Store the selection text before any click clears it
        const savedSelection = currentSelection;

        // Attach click handler
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

        // Store the selection text at this moment
        const selectionText = currentSelection || '';
        const pageTitle = document.querySelector('.intent-title')?.textContent || document.title;
        const pageUrl = window.location.href;

        const panel = document.createElement('div');
        panel.className = 'intent-htt-panel';
        panel.id = 'intentHttPanel';
        // Store selection in data attribute for later retrieval
        panel.dataset.selectionText = selectionText;

        panel.innerHTML = `
        <div class="intent-htt-panel-header">
            <h3>💭 Hold That Thought</h3>
            <button type="button" class="intent-htt-panel-close" id="httPanelClose">✕</button>
        </div>
        
        <div class="intent-htt-panel-content">
            <div class="intent-htt-preview">
                <p class="intent-htt-selected-text">"${escapeHtml(selectionText.substring(0, 200))}${selectionText.length > 200 ? '...' : ''}"</p>
            </div>
            
            <div class="intent-htt-field">
                <label>Tag</label>
                <div class="intent-htt-tags" id="httTags">
                    ${HTT_TAGS.map((tag, i) => `
                        <button type="button" class="intent-htt-tag ${i === 0 ? 'active' : ''}" data-tag="${tag}">${tag}</button>
                    `).join('')}
                </div>
            </div>
            
            <div class="intent-htt-field">
                <label>Color</label>
                <div class="intent-htt-colors" id="httColors">
                    ${HTT_COLORS.map((c, i) => `
                        <button type="button" class="intent-htt-color ${i === 0 ? 'active' : ''}" data-color="${c.value}" style="background: ${c.value}" title="${c.name}"></button>
                    `).join('')}
                </div>
            </div>
            
            <div class="intent-htt-field">
                <label>Importance</label>
                <div class="intent-htt-importance" id="httImportance">
                    <button type="button" class="intent-htt-imp active" data-imp="low">Low</button>
                    <button type="button" class="intent-htt-imp" data-imp="medium">Medium</button>
                    <button type="button" class="intent-htt-imp" data-imp="high">High ⚡</button>
                </div>
            </div>
            
            <div class="intent-htt-field">
                <label>Context (optional)</label>
                <textarea id="httContext" placeholder="Why is this important? Add a note..."></textarea>
            </div>
        </div>
        
        <div class="intent-htt-panel-footer">
            <button type="button" class="intent-htt-cancel" id="httCancel">Cancel</button>
            <button type="button" class="intent-htt-save" id="httSave">Save Thought</button>
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

        // Color selection
        document.querySelectorAll('.intent-htt-color').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.intent-htt-color').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Importance selection
        document.querySelectorAll('.intent-htt-imp').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.intent-htt-imp').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

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
        const selectionText = panel?.dataset.selectionText || currentSelection || '';

        const tag = document.querySelector('.intent-htt-tag.active')?.dataset.tag || HTT_TAGS[0];
        const color = document.querySelector('.intent-htt-color.active')?.dataset.color || HTT_COLORS[0].value;
        const importance = document.querySelector('.intent-htt-imp.active')?.dataset.imp || 'low';
        const context = document.getElementById('httContext')?.value || '';

        const pageTitle = document.querySelector('.intent-title')?.textContent || document.title;
        const pageUrl = window.location.href;

        const thought = {
            text: selectionText,
            pageTitle,
            pageUrl,
            tag,
            color,
            importance,
            context
        };

        chrome.runtime.sendMessage({ action: 'saveThought', thought }, (response) => {
            if (response?.success) {
                hideHttPanel();
                showNotification('Thought saved! 💭');
            } else {
                showNotification('Failed to save thought');
            }
        });
    }

    // Expose activateIntentMode globally so the message listener can call it
    window.__intentModeActivate__ = activateIntentMode;

} // End of guard block
