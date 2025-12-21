/**
 * Hold That Thought - Content Script
 * Shows popup for saving thoughts on any webpage
 */

(function () {
    // Prevent multiple injections
    if (window.HTT_CONTENT_LOADED) return;
    window.HTT_CONTENT_LOADED = true;

    let currentSelection = '';
    let currentPageTitle = '';
    let currentPageUrl = '';

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'showThoughtPopup') {
            showPopup(request.selectedText, request.pageTitle, request.pageUrl);
        }

        if (request.action === 'triggerHoldThought') {
            const selection = window.getSelection().toString().trim();
            if (selection) {
                showPopup(selection, document.title, window.location.href);
            } else {
                showNotification('Select some text first!');
            }
        }

        if (request.action === 'showPingBar') {
            createPingBar();
        }

        if (request.action === 'showAIBar') {
            createAIBar();
        }

        if (request.action === 'showFootstepsPanel') {
            createFootstepsPanel();
        }

        if (request.action === 'toggleDarkMode') {
            toggleGlobalDarkMode(request.enabled);
        }
    });

    function toggleGlobalDarkMode(enabled) {
        const existingStyle = document.getElementById('intent-force-dark-mode');

        if (enabled) {
            // Check if page is already dark to avoid double inversion
            if (isPageDark()) {
                console.log('Page is already dark, skipping inversion.');
                return;
            }

            if (!existingStyle) {
                const style = document.createElement('style');
                style.id = 'intent-force-dark-mode';
                style.textContent = `
                    html {
                        background-color: white !important; /* Force base to be white so it inverts to black */
                        filter: invert(1) hue-rotate(180deg) !important;
                    }
                    img, video, canvas, svg, iframe, [style*="background-image"] {
                        filter: invert(1) hue-rotate(180deg) !important;
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            if (existingStyle) {
                existingStyle.remove();
            }
        }
    }

    function isPageDark() {
        // Quick check for dark mode media query preference (some sites respect this)
        // logic: if site supports dark mode AND user prefers it, we assume it's dark.
        // But many sites ignore this. So we check computed background color.

        const bgColor = window.getComputedStyle(document.body).backgroundColor;
        const htmlColor = window.getComputedStyle(document.documentElement).backgroundColor;

        const isDark = (color) => {
            const rgb = color.match(/\d+/g);
            if (!rgb) return false; // transparent or invalid
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            return brightness < 128;
        };

        // If body or html has a dark background color, assume page is dark
        if ((bgColor !== 'rgba(0, 0, 0, 0)' && isDark(bgColor)) ||
            (htmlColor !== 'rgba(0, 0, 0, 0)' && isDark(htmlColor))) {
            return true;
        }

        return false;
    }

    // Check initial state
    chrome.storage.local.get(['forceDarkMode'], (result) => {
        if (result.forceDarkMode) {
            toggleGlobalDarkMode(true);
        }
    });

    // ... (rest of code) ...

    function createPingBar() {
        if (document.getElementById('htt-ping-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'htt-ping-overlay';
        overlay.className = 'htt-ping-overlay';

        overlay.innerHTML = `
            <div class="htt-ping-bar">
                <input type="text" class="htt-ping-input" id="httPingInput" placeholder="Remind me to..." autocomplete="off">
                <div class="htt-ping-actions">
                    <button type="button" class="htt-ping-btn" data-time="15">15m</button>
                    <button type="button" class="htt-ping-btn" data-time="60">1h</button>
                    <button type="button" class="htt-ping-btn" data-time="180">3h</button>
                    <button type="button" class="htt-ping-btn" data-time="tomorrow">Tmrw</button>
                    <label class="htt-ping-toggle">
                        <input type="checkbox" id="httPingLink"> Link page
                    </label>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector('#httPingInput');
        requestAnimationFrame(() => input.focus());

        let selectedMinutes = null;
        const timeBtns = overlay.querySelectorAll('.htt-ping-btn');

        timeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const wasActive = btn.classList.contains('active');
                timeBtns.forEach(b => b.classList.remove('active'));

                if (!wasActive) {
                    btn.classList.add('active');
                    if (btn.dataset.time === 'tomorrow') {
                        selectedMinutes = 24 * 60;
                    } else {
                        selectedMinutes = parseInt(btn.dataset.time);
                    }
                } else {
                    selectedMinutes = null;
                }
                input.focus();
            });
        });

        const close = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                e.stopPropagation(); // Stop bubbling to prevent double-trigger

                const link = overlay.querySelector('#httPingLink').checked;
                const text = input.value.trim();

                // Immediately disable to prevent double-submit
                input.disabled = true;

                // Smart Time Parsing
                let minutes = selectedMinutes;
                if (!minutes) {
                    const match = text.match(/\b(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs|d|day|days)\b/i);
                    if (match) {
                        const val = parseFloat(match[1]);
                        const unit = match[2].toLowerCase()[0];
                        if (unit === 'm') minutes = val;
                        else if (unit === 'h') minutes = val * 60;
                        else if (unit === 'd') minutes = val * 1440;
                    }
                }

                chrome.runtime.sendMessage({
                    action: 'createPing',
                    thought: {
                        text: text,
                        context: link ? document.title : '',
                        pageUrl: link ? window.location.href : '',
                        pageTitle: document.title,
                        tag: '⏰ Reminder',
                        importance: 'medium',
                        color: '#7c7cf8'
                    },
                    minutes: minutes
                }, (res) => {
                    close();
                    if (res && res.success) {
                        showNotification(minutes ? 'Ping set for later! ⏰' : 'Note saved! 💭');
                    }
                });
            }
        });
    }
    function showFriendlyPing(thought) {
        if (document.getElementById('htt-friendly-ping')) return;

        const overlay = document.createElement('div');
        overlay.className = 'htt-friendly-overlay';
        overlay.id = 'htt-friendly-ping-overlay';

        const container = document.createElement('div');
        container.className = 'htt-friendly-ping';
        container.id = 'htt-friendly-ping';
        container.innerHTML = `
            <div class="htt-fp-icon">🌥️</div>
            <div class="htt-fp-header">Thinking of you</div>
            <div class="htt-fp-text">"${escapeHtml(thought.text)}"</div>
            <div class="htt-fp-actions">
                <button class="htt-fp-btn secondary" id="httFpSnooze">Snooze (5m)</button>
                <button class="htt-fp-btn primary" id="httFpAck">Got it, thanks!</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(container);

        // Gentle ding sound
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            // Soft sine wave
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6

            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } catch (e) { }

        const close = () => {
            container.style.transition = 'all 0.3s ease';
            overlay.style.transition = 'all 0.3s ease';

            container.style.opacity = '0';
            container.style.transform = 'translate(-50%, -45%) scale(0.95)';
            overlay.style.opacity = '0';

            setTimeout(() => {
                container.remove();
                overlay.remove();
            }, 300);
        };

        container.querySelector('#httFpAck').addEventListener('click', close);

        container.querySelector('#httFpSnooze').addEventListener('click', () => {
            chrome.runtime.sendMessage({
                action: 'createPing',
                thought: { ...thought },
                minutes: 5 // Snooze time
            }, () => {
                close();
                showNotification('Snoozed for 5m 💤');
            });
        });
    }

    function createAIBar() {
        if (document.getElementById('htt-ai-overlay')) return;

        // Check for API Key first
        chrome.runtime.sendMessage({ action: 'checkAIKey' }, (res) => {
            if (!res || !res.hasKey) {
                showKeyInput();
            } else {
                showAIQueryOverlay();
            }
        });
    }

    function showKeyInput() {
        if (document.getElementById('htt-key-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'htt-key-overlay';
        overlay.className = 'htt-ping-overlay';

        overlay.innerHTML = `
            <div class="htt-ping-bar" style="border-left: 4px solid #10a37f; padding: 20px; max-width: 400px;">
                <div style="font-weight: bold; margin-bottom: 10px; font-size: 1.1em;">Setup Quick AI</div>
                <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 15px;">Please enter your OpenAI API Key to continue. It will be stored securely on your device.</div>
                
                <input type="password" id="httKeyInput" class="htt-ping-input" placeholder="sk-..." style="margin-bottom: 15px; font-family: monospace;">
                
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="httKeyCancel" style="padding: 6px 12px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="httKeySave" style="padding: 6px 12px; background: #10a37f; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Save & Continue</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        const input = overlay.querySelector('#httKeyInput');
        input.focus();

        const close = () => overlay.remove();

        overlay.querySelector('#httKeyCancel').addEventListener('click', close);

        const save = () => {
            const key = input.value.trim();
            if (key.startsWith('sk-')) {
                chrome.runtime.sendMessage({ action: 'saveAIKey', key: key }, (res) => {
                    close();
                    showAIQueryOverlay();
                });
            } else {
                input.style.borderColor = '#ff4444';
            }
        };

        overlay.querySelector('#httKeySave').addEventListener('click', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') close();
        });
    }

    function showAIQueryOverlay() {
        if (document.getElementById('htt-ai-overlay')) return;

        const selection = window.getSelection().toString().trim();
        const context = selection ? selection.substring(0, 300) : '';

        const overlay = document.createElement('div');
        overlay.id = 'htt-ai-overlay';
        overlay.className = 'htt-ping-overlay';

        // Context: Minimal, muted (Hidden during morph usually, but we keep structure)
        const contextHtml = context ? `<div id="httAIContext" style="font-size: 0.85em; opacity: 0.6; margin-bottom: 12px; font-style: italic; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 10px; max-height: 60px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; transition: opacity 0.3s ease;">${escapeHtml(context)}</div>` : '';

        // UI: Minimal, Dark, Intentional
        // The container that will morph
        overlay.innerHTML = `
            <div id="httAIContainer" class="htt-ping-bar" style="
                border: 1px solid rgba(255,255,255,0.1); 
                background: #1e1e1e; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.5); 
                padding: 15px 20px;
                width: 400px;
                min-height: 60px;
                transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); /* Smooth expansion */
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: center;
            ">
                ${contextHtml}
                <div id="httAIInputWrapper" style="display: flex; align-items: center; gap: 10px; width: 100%; transition: opacity 0.3s ease;">
                    <input type="text" class="htt-ping-input" id="httAIInput" placeholder="Ask..." autocomplete="off" style="font-size: 1.1em; letter-spacing: 0.02em; width: 100%;">
                </div>
                <div id="httAIResponseContent" style="display: none; opacity: 0; transition: opacity 0.5s ease 0.2s;">
                    <!-- Response injected here -->
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const container = overlay.querySelector('#httAIContainer');
        const input = overlay.querySelector('#httAIInput');
        const contextEl = overlay.querySelector('#httAIContext');
        const wrapper = overlay.querySelector('#httAIInputWrapper');
        const responseContent = overlay.querySelector('#httAIResponseContent');

        requestAnimationFrame(() => input.focus());

        const close = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                e.stopPropagation();

                const prompt = input.value.trim();

                // 1. Thinking State
                input.disabled = true;
                input.classList.add('htt-thinking');
                input.value = 'Thinking...';

                // 2. Prepare for Morph
                // We don't shrink yet, just wait for text

                chrome.runtime.sendMessage({
                    action: 'askAI',
                    prompt: prompt,
                    context: context
                }, (response) => {
                    if (response && response.answer) {
                        morphToAnswer(response.answer);
                    } else {
                        input.value = response?.error || 'Error. Try again.';
                        setTimeout(close, 2000);
                    }
                });
            }
        });

        function morphToAnswer(text) {
            // Hide Input & Context
            wrapper.style.opacity = '0';
            if (contextEl) contextEl.style.opacity = '0';

            setTimeout(() => {
                wrapper.style.display = 'none';
                if (contextEl) contextEl.style.display = 'none';

                // Prepare Content
                const formatted = escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                responseContent.innerHTML = `
                    <div class="htt-fp-header" style="text-align: left; padding-left: 0; color: #10a37f; margin-bottom: 12px; font-size: 0.8em; letter-spacing: 0.1em; text-transform: uppercase; font-family: monospace;">Answer</div>
                    <div class="htt-fp-text typewriter-cursor" id="htt-typewriter" style="font-size: 1.05em; line-height: 1.7; text-align: left; padding: 0; margin-bottom: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"></div>
                    <div style="text-align: right;">
                        <button id="httAIClose" class="close-btn-mac">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                `;
                responseContent.style.display = 'block';

                // Calculate natural height
                const approxHeight = Math.min(600, 150 + (text.length / 2));
                container.style.height = approxHeight + 'px';

                requestAnimationFrame(() => {
                    responseContent.style.opacity = '1';

                    // Premium Typewriter
                    const target = responseContent.querySelector('#htt-typewriter');
                    const tokens = formatted.split(/(<[^>]+>)/g);
                    let tokenIndex = 0;

                    function type() {
                        if (tokenIndex >= tokens.length) {
                            target.classList.remove('typewriter-cursor');
                            container.style.height = 'auto';
                            return;
                        }

                        const token = tokens[tokenIndex];
                        if (token.startsWith('<')) {
                            target.innerHTML += token;
                            tokenIndex++;
                            // HTML tags render instantly
                            requestAnimationFrame(type);
                        } else {
                            // Text typing with variable speed
                            let charIndex = 0;
                            function typeChar() {
                                if (charIndex < token.length) {
                                    target.innerHTML += token[charIndex];
                                    charIndex++;
                                    // Randomize delay between 10ms and 30ms for natural feel
                                    setTimeout(typeChar, Math.random() * 20 + 10);
                                } else {
                                    tokenIndex++;
                                    type();
                                }
                            }
                            typeChar();
                        }
                    }
                    type();
                });

                responseContent.querySelector('#httAIClose').addEventListener('click', close);
            }, 300);
        }
    }

    // Color options
    const COLORS = [
        { name: 'Yellow', value: '#fef08a' },
        { name: 'Green', value: '#bbf7d0' },
        { name: 'Blue', value: '#bfdbfe' },
        { name: 'Purple', value: '#ddd6fe' },
        { name: 'Pink', value: '#fbcfe8' },
        { name: 'Orange', value: '#fed7aa' }
    ];

    // Tag presets
    const TAGS = ['📚 Read Later', '💡 Idea', '📝 Note', '⭐ Important', '🔗 Reference', '❓ Question'];

    function showPopup(text, title, url) {
        currentSelection = text;
        currentPageTitle = title;
        currentPageUrl = url;

        // Remove existing popup if any
        const existing = document.getElementById('htt-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'htt-popup';
        popup.innerHTML = `
            <div class="htt-overlay" id="httOverlay"></div>
            <div class="htt-modal">
                <div class="htt-header">
                    <h3>Hold That Thought</h3>
                    <button class="close-btn-mac" id="httClose">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <div class="htt-content">
                    <div class="htt-preview">
                        <p class="htt-selected-text">"${escapeHtml(text.substring(0, 150))}${text.length > 150 ? '...' : ''}"</p>
                        <span class="htt-source">${escapeHtml(title)}</span>
                    </div>
                    
                    <div class="htt-field">
                        <label>Tag</label>
                        <div class="htt-tags" id="httTags">
                            <button class="htt-tag active" data-tag="📝 Note">Note</button>
                            <button class="htt-tag" data-tag="💡 Idea">Idea</button>
                            <button class="htt-tag" data-tag="📚 Read Later">Read Later</button>
                        </div>
                    </div>
                    
                    <div class="htt-field">
                        <label>Note</label>
                        <textarea id="httContext" placeholder="Why save this?"></textarea>
                    </div>
                </div>
                
                <div class="htt-footer">
                    <button class="htt-cancel" id="httCancel">Cancel</button>
                    <button class="htt-save" id="httSave">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Event listeners
        document.getElementById('httOverlay').addEventListener('click', closePopup);
        document.getElementById('httClose').addEventListener('click', closePopup);
        document.getElementById('httCancel').addEventListener('click', closePopup);
        document.getElementById('httSave').addEventListener('click', saveThought);

        // Tag selection
        document.querySelectorAll('.htt-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.htt-tag').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Keyboard: Escape to close, Cmd/Ctrl+Enter to save
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                closePopup();
                document.removeEventListener('keydown', keyHandler);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                saveThought();
            }
        };
        document.addEventListener('keydown', keyHandler);

        // Focus
        document.getElementById('httContext').focus();
    }

    function closePopup() {
        const popup = document.getElementById('htt-popup');
        if (popup) {
            popup.classList.add('closing');
            setTimeout(() => popup.remove(), 200);
        }
    }

    function saveThought() {
        const tag = document.querySelector('.htt-tag.active')?.dataset.tag || '📝 Note';
        const context = document.getElementById('httContext')?.value || '';

        const thought = {
            text: currentSelection,
            pageTitle: currentPageTitle,
            pageUrl: currentPageUrl,
            tag,
            color: '#fef08a', // Default yellow
            importance: 'medium',
            context
        };

        chrome.runtime.sendMessage({ action: 'saveThought', thought }, (response) => {
            if (response?.success) {
                closePopup();
                showNotification('Saved');
            } else {
                showNotification('Failed to save');
            }
        });
    }

    function showNotification(message) {
        const existing = document.querySelector('.htt-notification');
        if (existing) existing.remove();

        const notif = document.createElement('div');
        notif.className = 'htt-notification';
        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 300);
        }, 2000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // FOOTSTEPS - Browsing Trail Panel
    // ============================================

    function createFootstepsPanel() {
        // Toggle if already open
        const existing = document.getElementById('footsteps-panel');
        if (existing) {
            closeFootstepsPanel();
            return;
        }

        // Request footsteps data from background
        chrome.runtime.sendMessage({ action: 'getFootsteps' }, (response) => {
            if (!response) return;
            renderFootstepsPanel(response.footsteps || []);
        });
    }

    function renderFootstepsPanel(footsteps) {
        // Remove existing panel if any (for re-render after clear)
        document.getElementById('footsteps-panel')?.remove();
        document.getElementById('footsteps-overlay')?.remove();

        // Create overlay - very subtle
        const overlay = document.createElement('div');
        overlay.id = 'footsteps-overlay';
        overlay.className = 'footsteps-overlay';

        // Create panel - minimal container
        const panel = document.createElement('div');
        panel.id = 'footsteps-panel';
        panel.className = 'footsteps-panel';

        // Header - ultra minimal
        const header = document.createElement('div');
        header.className = 'footsteps-header';
        header.innerHTML = `
            <span class="footsteps-title">Trail</span>
            <div class="footsteps-header-actions">
                <button class="footsteps-action-btn" id="footstepsClear" title="Clear">
                    Clear
                </button>
                <button class="close-btn-mac" id="footstepsClose" title="Close" style="width: 20px; height: 20px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;

        // Trail container
        const trail = document.createElement('div');
        trail.className = 'footsteps-trail';

        if (footsteps.length === 0) {
            trail.innerHTML = `
                <div class="footsteps-empty">
                    <span class="footsteps-empty-text">No trail yet</span>
                </div>
            `;
        } else {
            footsteps.forEach((step, index) => {
                const item = document.createElement('div');
                item.className = 'footsteps-item';
                item.dataset.url = step.url;

                const isCurrentPage = step.url === window.location.href;
                if (isCurrentPage) {
                    item.classList.add('current');
                }

                // Step number for visual hierarchy
                const stepNum = index + 1;

                item.innerHTML = `
                    <span class="footsteps-item-num">${stepNum}</span>
                    <img class="footsteps-item-favicon" src="${step.favicon}" alt="" onerror="this.style.display='none'">
                    <div class="footsteps-item-info">
                        <span class="footsteps-item-title">${escapeHtml(step.title || step.domain)}</span>
                        <span class="footsteps-item-meta">${escapeHtml(step.domain)} · ${formatRelativeTime(step.timestamp)}</span>
                    </div>
                `;

                // Click to navigate
                item.addEventListener('click', () => {
                    chrome.runtime.sendMessage({ action: 'navigateToFootstep', url: step.url });
                    closeFootstepsPanel();
                });

                trail.appendChild(item);
            });
        }

        // Footer with shortcut hint
        const footer = document.createElement('div');
        footer.className = 'footsteps-footer';
        footer.innerHTML = `<span class="footsteps-hint">alt+b to toggle</span>`;

        // Assemble panel
        panel.appendChild(header);
        panel.appendChild(trail);
        panel.appendChild(footer);

        // Add to page
        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        // Force reflow for animation
        panel.offsetHeight;
        overlay.classList.add('visible');
        panel.classList.add('visible');

        // Event listeners
        overlay.addEventListener('click', closeFootstepsPanel);
        document.getElementById('footstepsClose').addEventListener('click', closeFootstepsPanel);
        document.getElementById('footstepsClear').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'clearFootsteps' }, () => {
                renderFootstepsPanel([]);
            });
        });

        // Escape to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeFootstepsPanel();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    function closeFootstepsPanel() {
        const panel = document.getElementById('footsteps-panel');
        const overlay = document.getElementById('footsteps-overlay');

        if (panel) {
            panel.classList.remove('visible');
            panel.classList.add('closing');
        }
        if (overlay) {
            overlay.classList.remove('visible');
            overlay.classList.add('closing');
        }

        setTimeout(() => {
            panel?.remove();
            overlay?.remove();
        }, 300);
    }

    function formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    }

})();
