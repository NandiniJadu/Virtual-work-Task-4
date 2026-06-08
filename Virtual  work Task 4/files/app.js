/* ══════════════════════════════════════════════════════
   QuoteVault — app.js
   All button logic wired up and working
══════════════════════════════════════════════════════ */

// ── Storage Key ──
const DB_KEY = 'quotevault_db_v2';

// ── In-memory state ──
let currentQuote   = null;   // quote on screen
let db             = loadDB();
let activeView     = 'all';  // 'all' | 'favs'
let toastTimer     = null;
let modalCallback  = null;

// ══════════════════════════════════════════════════════
// DB helpers (localStorage "database")
// ══════════════════════════════════════════════════════
function loadDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
  catch { return []; }
}
function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
function findById(id) { return db.find(q => q.id === id); }

// ══════════════════════════════════════════════════════
// API  — quotable.io (free, no key needed)
// ══════════════════════════════════════════════════════
const TAG_MAP = {
  wisdom:     'wisdom',
  courage:    'courage',
  love:       'love',
  life:       'life',
  philosophy: 'philosophy',
  success:    'success',
  happiness:  'happiness',
  technology: 'technology',
};

async function fetchRandomQuote(tag) {
  const base = 'https://api.quotable.io/random';
  const url  = tag ? `${base}?tags=${tag}` : base;
  const res  = await fetch(url);
  if (!res.ok) throw new Error('Network error ' + res.status);
  const data = await res.json();
  return {
    text:   data.content,
    author: data.author,
    tags:   data.tags || [],
  };
}

// ══════════════════════════════════════════════════════
// DOM refs
// ══════════════════════════════════════════════════════
const qcText      = document.getElementById('qcText');
const qcAuthor    = document.getElementById('qcAuthor');
const qcMeta      = document.getElementById('qcMeta');
const qcTags      = document.getElementById('qcTags');
const qcLoader    = document.getElementById('qcLoader');
const btnGenerate = document.getElementById('btnGenerate');
const btnSave     = document.getElementById('btnSave');
const btnCopy     = document.getElementById('btnCopy');
const btnTweet    = document.getElementById('btnTweet');
const btnFav      = document.getElementById('btnFav');
const btnExport   = document.getElementById('btnExport');
const btnClearAll = document.getElementById('btnClearAll');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const sortSelect  = document.getElementById('sortSelect');
const historyList = document.getElementById('historyList');
const histBadge   = document.getElementById('histBadge');
const tabAll      = document.getElementById('tabAll');
const tabFavs     = document.getElementById('tabFavs');

// ══════════════════════════════════════════════════════
// Generate Quote Button
// ══════════════════════════════════════════════════════
btnGenerate.addEventListener('click', async () => {
  const tag = document.querySelector('.tag-chip.active')?.dataset.tag || '';

  // UI: loading state
  btnGenerate.classList.add('loading');
  btnGenerate.disabled = true;
  [btnSave, btnCopy, btnTweet, btnFav].forEach(b => b.disabled = true);

  qcText.style.opacity = '0';
  qcMeta.style.display = 'none';
  qcLoader.style.display = 'flex';

  try {
    const q = await fetchRandomQuote(tag);
    currentQuote = { ...q, id: Date.now(), savedAt: new Date().toISOString(), fav: false };

    // Show quote with fade
    qcLoader.style.display = 'none';
    qcText.innerHTML = `"${escHtml(q.text)}"`;
    qcText.style.opacity = '1';

    qcAuthor.textContent = q.author;
    qcTags.innerHTML = q.tags.map(t => `<span class="qtag">${escHtml(t)}</span>`).join('');
    qcMeta.style.display = 'flex';

    // Enable action buttons
    [btnCopy, btnTweet].forEach(b => b.disabled = false);
    btnSave.disabled = false;
    btnSave.classList.remove('saved');
    btnSave.innerHTML = saveBtnIcon() + ' Save';
    btnFav.disabled = false;
    btnFav.classList.remove('is-fav');
    btnFav.innerHTML = favBtnIcon(false) + ' Favourite';

  } catch (err) {
    qcLoader.style.display = 'none';
    qcText.innerHTML = '<em>Could not load a quote. Check your internet and try again.</em>';
    qcText.style.opacity = '1';
    toast('Failed to fetch quote — check connection', 'error');
    console.error(err);
  }

  btnGenerate.classList.remove('loading');
  btnGenerate.disabled = false;
});

// ══════════════════════════════════════════════════════
// Save Button
// ══════════════════════════════════════════════════════
btnSave.addEventListener('click', () => {
  if (!currentQuote) return;

  if (db.some(q => q.text === currentQuote.text)) {
    toast('Already saved in history!', 'warn');
    return;
  }

  db.unshift({ ...currentQuote });
  saveDB();
  renderHistory();
  updateStats();

  btnSave.innerHTML = checkIcon() + ' Saved!';
  btnSave.classList.add('saved');
  setTimeout(() => {
    btnSave.innerHTML = saveBtnIcon() + ' Save';
    btnSave.classList.remove('saved');
  }, 2200);

  toast('Quote saved to history ✓', 'success');
});

// ══════════════════════════════════════════════════════
// Copy Button
// ══════════════════════════════════════════════════════
btnCopy.addEventListener('click', async () => {
  if (!currentQuote) return;
  const text = `"${currentQuote.text}" — ${currentQuote.author}`;
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard!', 'success');
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Copied!', 'success');
  }
});

// ══════════════════════════════════════════════════════
// Tweet Button
// ══════════════════════════════════════════════════════
btnTweet.addEventListener('click', () => {
  if (!currentQuote) return;
  const text = `"${currentQuote.text}" — ${currentQuote.author}`;
  const url  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
});

// ══════════════════════════════════════════════════════
// Favourite Button (current quote)
// ══════════════════════════════════════════════════════
btnFav.addEventListener('click', () => {
  if (!currentQuote) return;
  currentQuote.fav = !currentQuote.fav;

  // Sync if already saved in DB
  const dbEntry = db.find(q => q.id === currentQuote.id);
  if (dbEntry) {
    dbEntry.fav = currentQuote.fav;
    saveDB();
    renderHistory();
  }

  const isFav = currentQuote.fav;
  btnFav.classList.toggle('is-fav', isFav);
  btnFav.innerHTML = favBtnIcon(isFav) + (isFav ? ' Unfavourite' : ' Favourite');
  toast(isFav ? '⭐ Added to favourites' : 'Removed from favourites', isFav ? 'success' : '');
});

// ══════════════════════════════════════════════════════
// Export Button
// ══════════════════════════════════════════════════════
btnExport.addEventListener('click', () => {
  if (!db.length) { toast('Nothing to export yet', 'warn'); return; }

  const lines = db.map((q, i) =>
    `${i + 1}. "${q.text}"\n   — ${q.author}${q.tags?.length ? '  [' + q.tags.join(', ') + ']' : ''}\n   Saved: ${new Date(q.savedAt).toLocaleString()}${q.fav ? '  ⭐' : ''}`
  ).join('\n\n');

  const header = `QuoteVault Export\nGenerated: ${new Date().toLocaleString()}\nTotal quotes: ${db.length}\n${'─'.repeat(50)}\n\n`;
  const blob   = new Blob([header + lines], { type: 'text/plain' });
  const a      = document.createElement('a');
  a.href       = URL.createObjectURL(blob);
  a.download   = `quotevault-export-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Exported ${db.length} quotes ✓`, 'success');
});

// ══════════════════════════════════════════════════════
// Clear All Button
// ══════════════════════════════════════════════════════
btnClearAll.addEventListener('click', () => {
  if (!db.length) { toast('History is already empty', 'warn'); return; }
  openModal(
    `Delete all ${db.length} saved quote${db.length > 1 ? 's' : ''}? This cannot be undone.`,
    () => {
      db = [];
      saveDB();
      renderHistory();
      updateStats();
      toast('History cleared', 'success');
    }
  );
});

// ══════════════════════════════════════════════════════
// Search Input
// ══════════════════════════════════════════════════════
searchInput.addEventListener('input', () => {
  clearSearch.style.display = searchInput.value ? 'block' : 'none';
  renderHistory();
});
clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  clearSearch.style.display = 'none';
  renderHistory();
});

// ══════════════════════════════════════════════════════
// Sort Select
// ══════════════════════════════════════════════════════
sortSelect.addEventListener('change', renderHistory);

// ══════════════════════════════════════════════════════
// View Tabs (All / Favourites)
// ══════════════════════════════════════════════════════
tabAll.addEventListener('click', () => {
  activeView = 'all';
  tabAll.classList.add('active');
  tabFavs.classList.remove('active');
  renderHistory();
});
tabFavs.addEventListener('click', () => {
  activeView = 'favs';
  tabFavs.classList.add('active');
  tabAll.classList.remove('active');
  renderHistory();
});

// ══════════════════════════════════════════════════════
// Tag Chips
// ══════════════════════════════════════════════════════
document.querySelectorAll('.tag-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// ══════════════════════════════════════════════════════
// Theme Toggle
// ══════════════════════════════════════════════════════
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.getElementById('themeIcon');
let isDark = localStorage.getItem('qv_theme') !== 'light';

function applyTheme() {
  document.body.classList.toggle('light', !isDark);
  themeIcon.textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('qv_theme', isDark ? 'dark' : 'light');
}
applyTheme();

themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  applyTheme();
  toast(isDark ? 'Dark mode on' : 'Light mode on');
});

// ══════════════════════════════════════════════════════
// RENDER HISTORY
// ══════════════════════════════════════════════════════
function renderHistory() {
  const q   = searchInput.value.toLowerCase().trim();
  const ord = sortSelect.value;

  let items = [...db];

  // filter: view tab
  if (activeView === 'favs') items = items.filter(i => i.fav);

  // filter: search
  if (q) {
    items = items.filter(i =>
      i.text.toLowerCase().includes(q) ||
      (i.author && i.author.toLowerCase().includes(q)) ||
      (i.tags && i.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  // sort
  if (ord === 'oldest')       items.reverse();
  else if (ord === 'author')  items.sort((a,b) => (a.author||'').localeCompare(b.author||''));
  else if (ord === 'favs')    items.sort((a,b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
  // 'newest' is default (already newest-first from unshift)

  histBadge.textContent = db.length;
  document.getElementById('hs-total').textContent = db.length;

  if (!items.length) {
    historyList.innerHTML = `
      <div class="empty-state">
        <span class="es-icon">${q ? '🔍' : activeView === 'favs' ? '⭐' : '📜'}</span>
        <p>${q ? 'No quotes match your search.' : activeView === 'favs' ? 'No favourites yet. Star some quotes!' : 'No quotes saved yet. Generate one above!'}</p>
      </div>`;
    return;
  }

  historyList.innerHTML = items.map((item, idx) => `
    <div class="history-item ${item.fav ? 'is-fav' : ''}" id="hi-${item.id}">
      <div class="hi-num">${idx + 1}</div>
      <div class="hi-body">
        <div class="hi-text">"${escHtml(item.text)}"</div>
        <div class="hi-meta">
          ${item.author ? `<span class="hi-author">${escHtml(item.author)}</span>` : ''}
          ${item.author && item.savedAt ? '<span class="hi-sep">·</span>' : ''}
          ${item.savedAt ? `<span class="hi-time">${relTime(item.savedAt)}</span>` : ''}
          ${item.fav ? '<span class="hi-fav-star">⭐</span>' : ''}
          ${(item.tags||[]).slice(0,2).map(t => `<span class="hi-tag">${escHtml(t)}</span>`).join('')}
        </div>
      </div>
      <div class="hi-actions">
        <button class="hi-btn copy-btn" onclick="hiCopy(${item.id})" title="Copy">
          <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="hi-btn fav-btn ${item.fav ? 'active' : ''}" onclick="hiToggleFav(${item.id})" title="${item.fav ? 'Unfavourite' : 'Favourite'}">
          <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
        <button class="hi-btn del-btn" onclick="hiDelete(${item.id})" title="Delete">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

// ── History item actions ──
window.hiCopy = async (id) => {
  const item = findById(id);
  if (!item) return;
  const text = `"${item.text}" — ${item.author}`;
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied!', 'success');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Copied!', 'success');
  }
};

window.hiToggleFav = (id) => {
  const item = findById(id);
  if (!item) return;
  item.fav = !item.fav;
  saveDB();
  renderHistory();
  updateStats();
  toast(item.fav ? '⭐ Added to favourites' : 'Removed from favourites', item.fav ? 'success' : '');
};

window.hiDelete = (id) => {
  openModal('Delete this quote from history?', () => {
    db = db.filter(q => q.id !== id);
    saveDB();
    renderHistory();
    updateStats();
    toast('Quote deleted', 'success');
  });
};

// ══════════════════════════════════════════════════════
// Stats
// ══════════════════════════════════════════════════════
function updateStats() {
  const total = db.length;
  const today = new Date().toDateString();
  const todayCount = db.filter(q => new Date(q.savedAt).toDateString() === today).length;
  const tags  = new Set(db.flatMap(q => q.tags || []));

  document.getElementById('hs-total').textContent = total;
  document.getElementById('hs-today').textContent = todayCount;
  document.getElementById('hs-cats').textContent  = tags.size;
  histBadge.textContent = total;
}

// ══════════════════════════════════════════════════════
// Toast
// ══════════════════════════════════════════════════════
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ══════════════════════════════════════════════════════
// Confirm Modal
// ══════════════════════════════════════════════════════
const overlay  = document.getElementById('modalOverlay');
const modalMsg = document.getElementById('modalMsg');
const modalOk  = document.getElementById('modalOk');
const modalCan = document.getElementById('modalCancel');

function openModal(msg, onConfirm) {
  modalMsg.textContent = msg;
  modalCallback = onConfirm;
  overlay.classList.add('open');
}
function closeModal() { overlay.classList.remove('open'); modalCallback = null; }

modalOk.addEventListener('click', () => { closeModal(); if (modalCallback) modalCallback(); });
modalCan.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ══════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function relTime(iso) {
  const d    = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 60000)     return 'just now';
  if (diff < 3600000)   return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000)  return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
}

// SVG icon snippets for buttons
function saveBtnIcon() {
  return `<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
}
function checkIcon() {
  return `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
}
function favBtnIcon(active) {
  return `<svg viewBox="0 0 24 24" ${active ? 'style="fill:currentColor"' : ''}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
renderHistory();
updateStats();
