/**
 * Hold That Thought - Content Script
 * Shows popup for saving thoughts on any webpage
 */

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
});

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
