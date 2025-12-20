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
                const link = overlay.querySelector('#httPingLink').checked;
                const text = input.value.trim();

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

        // Context: Minimal, muted
        const contextHtml = context ? `<div style="font-size: 0.85em; opacity: 0.6; margin-bottom: 12px; font-style: italic; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 10px; max-height: 60px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${escapeHtml(context)}</div>` : '';

        // UI: Minimal, Dark, Intentional
        // No emoji, just clean typography
        overlay.innerHTML = `
            <div class="htt-ping-bar" style="border: 1px solid rgba(255,255,255,0.1); background: #1e1e1e; box-shadow: 0 10px 40px rgba(0,0,0,0.5); padding: 15px 20px;">
                ${contextHtml}
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="text" class="htt-ping-input" id="httAIInput" placeholder="Ask..." autocomplete="off" style="font-size: 1.1em; letter-spacing: 0.02em;">
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector('#httAIInput');
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
                const prompt = input.value.trim();

                // Loading state: minimalistic
                input.disabled = true;
                input.style.opacity = '0.5';
                input.value = 'Thinking...';

                chrome.runtime.sendMessage({
                    action: 'askAI',
                    prompt: prompt,
                    context: context
                }, (response) => {
                    close();
                    if (response && response.answer) {
                        showAIResponse(response.answer);
                    } else if (response && response.error) {
                        showNotification(response.error);
                    }
                });
            }
        });
    }

    function showAIResponse(text) {
        if (document.getElementById('htt-ai-response')) return;

        const overlay = document.createElement('div');
        overlay.className = 'htt-friendly-overlay';

        const container = document.createElement('div');
        container.className = 'htt-friendly-ping';
        container.id = 'htt-ai-response';
        // Minimal, Clean styling - Intentional
        container.style.border = '1px solid rgba(255,255,255,0.1)';
        container.style.background = '#1a1a1a';
        container.style.boxShadow = '0 20px 50px rgba(0,0,0,0.4)';
        container.style.borderRadius = '12px';
        container.style.padding = '20px';
        container.style.maxWidth = '400px';
        container.style.width = '100%';

        // Prepare HTML (Bold Logic)
        const formatted = escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        container.innerHTML = `
            <div class="htt-fp-header" style="text-align: left; padding-left: 0; color: #10a37f; margin-bottom: 12px; font-size: 0.8em; letter-spacing: 0.1em; text-transform: uppercase; font-family: monospace;">Answer</div>
            <div class="htt-fp-text" id="htt-typewriter" style="font-size: 1.05em; line-height: 1.7; text-align: left; padding: 0; margin-bottom: 20px; min-height: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"></div>
            <div class="htt-fp-actions" style="justify-content: flex-end; padding-right: 0; gap: 0;">
                <button class="htt-fp-btn" id="httAIAck" style="
                    background: transparent; 
                    border: 1px solid rgba(255,255,255,0.1); 
                    color: rgba(255,255,255,0.7); 
                    border-radius: 6px; 
                    padding: 8px 16px; 
                    font-size: 0.8em; 
                    cursor: pointer; 
                    transition: all 0.2s ease;
                    outline: none;
                ">Close</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(container);

        // Hover Effect specific to this button
        const btn = container.querySelector('#httAIAck');
        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = 'rgba(255,255,255,0.4)';
            btn.style.color = '#fff';
            btn.style.background = 'rgba(255,255,255,0.05)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.borderColor = 'rgba(255,255,255,0.1)';
            btn.style.color = 'rgba(255,255,255,0.7)';
            btn.style.background = 'transparent';
        });

        // Typewriter Effect
        const target = container.querySelector('#htt-typewriter');
        const tokens = formatted.split(/(<[^>]+>)/g);
        let tokenIndex = 0;
        let charIndex = 0;

        function type() {
            if (tokenIndex >= tokens.length) return;

            const token = tokens[tokenIndex];

            if (token.startsWith('<')) {
                // HTML Tag - Append instantly
                target.innerHTML += token;
                tokenIndex++;
                requestAnimationFrame(type);
            } else {
                // Text - Type chars
                if (charIndex < token.length) {
                    target.innerHTML += token[charIndex];
                    charIndex++;
                    setTimeout(type, 10); // Typing speed
                } else {
                    tokenIndex++;
                    charIndex = 0;
                    requestAnimationFrame(type);
                }
            }
        }

        // Start typing
        type();

        const close = () => {
            container.style.opacity = '0';
            container.style.transform = 'translate(-50%, -45%) scale(0.95)';
            overlay.style.opacity = '0';
            setTimeout(() => {
                container.remove();
                overlay.remove();
            }, 300);
        };

        btn.addEventListener('click', close);
        overlay.addEventListener('click', close);
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
                    <h3>💭 Hold That Thought</h3>
                    <button class="htt-close" id="httClose">&times;</button>
                </div>
                
                <div class="htt-content">
                    <div class="htt-preview">
                        <p class="htt-selected-text">"${escapeHtml(text.substring(0, 200))}${text.length > 200 ? '...' : ''}"</p>
                        <span class="htt-source">${escapeHtml(title)}</span>
                    </div>
                    
                    <div class="htt-field">
                        <label>Tag</label>
                        <div class="htt-tags" id="httTags">
                            ${TAGS.map((tag, i) => `
                                <button class="htt-tag ${i === 0 ? 'active' : ''}" data-tag="${tag}">${tag}</button>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="htt-field">
                        <label>Color</label>
                        <div class="htt-colors" id="httColors">
                            ${COLORS.map((c, i) => `
                                <button class="htt-color ${i === 0 ? 'active' : ''}" data-color="${c.value}" style="background: ${c.value}" title="${c.name}"></button>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="htt-field">
                        <label>Importance</label>
                        <div class="htt-importance" id="httImportance">
                            <button class="htt-imp active" data-imp="low">Low</button>
                            <button class="htt-imp" data-imp="medium">Medium</button>
                            <button class="htt-imp" data-imp="high">High ⚡</button>
                        </div>
                    </div>
                    
                    <div class="htt-field">
                        <label>Add Context (optional)</label>
                        <textarea id="httContext" placeholder="Why is this important? Any notes?"></textarea>
                    </div>
                </div>
                
                <div class="htt-footer">
                    <button class="htt-cancel" id="httCancel">Cancel</button>
                    <button class="htt-save" id="httSave">Save Thought</button>
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

        // Color selection
        document.querySelectorAll('.htt-color').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.htt-color').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Importance selection
        document.querySelectorAll('.htt-imp').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.htt-imp').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Focus trap
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
        const tag = document.querySelector('.htt-tag.active')?.dataset.tag || TAGS[0];
        const color = document.querySelector('.htt-color.active')?.dataset.color || COLORS[0].value;
        const importance = document.querySelector('.htt-imp.active')?.dataset.imp || 'low';
        const context = document.getElementById('httContext')?.value || '';

        const thought = {
            text: currentSelection,
            pageTitle: currentPageTitle,
            pageUrl: currentPageUrl,
            tag,
            color,
            importance,
            context
        };

        chrome.runtime.sendMessage({ action: 'saveThought', thought }, (response) => {
            if (response?.success) {
                closePopup();
                showNotification('Thought saved! 💭');
            } else {
                showNotification('Failed to save thought');
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

})();
