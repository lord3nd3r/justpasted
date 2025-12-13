// app.js - extracted from public/index.html
// Main client logic: theme, routing, dashboard, admin hooks, and upload/paste flows

// ---------- Utilities ----------

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const fixed = value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1);
  return fixed + ' ' + units[i];
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncateFileTitle(name) {
  if (!name) return '';
  name = String(name);
  if (name.length <= 10) return name;

  const extIndex = name.lastIndexOf('.');
  if (extIndex > 0 && (name.length - extIndex) <= 5) {
    const ext = name.slice(extIndex);
    const maxBaseLen = Math.max(1, 10 - ext.length);
    return name.slice(0, maxBaseLen) + ext;
  }
  return name.slice(0, 10);
}

// ---------- Theme ----------

const themeOrder = ['dark', 'light', 'terminal'];
let themeTogglesInitialized = false;

(function initThemeFromStorageOrSystem() {
  try {
    const storedTheme = localStorage.getItem('theme');
    const allowedThemes = ['dark', 'light', 'terminal'];
    if (allowedThemes.includes(storedTheme)) {
      document.documentElement.dataset.theme = storedTheme;
    } else {
      document.documentElement.dataset.theme =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark';
    }
  } catch (_) {
    document.documentElement.dataset.theme = 'dark';
  }
})();

function updateThemeButtons() {
  const root = document.documentElement;
  const current = root.dataset.theme || 'dark';
  const idx = themeOrder.indexOf(current);
  const next = themeOrder[(idx + 1) % themeOrder.length];

  let iconText, labelText;
  if (next === 'light') {
    iconText = 'Sun';
    labelText = 'Light';
  } else if (next === 'dark') {
    iconText = 'Moon';
    labelText = 'Dark';
  } else {
    iconText = '⌨︎';
    labelText = 'Terminal';
  }

  document.querySelectorAll('.theme-icon').forEach(el => el.textContent = iconText);
  document.querySelectorAll('.theme-label').forEach(el => el.textContent = labelText);
}

function setupThemeToggles() {
  if (themeTogglesInitialized) {
    updateThemeButtons();
    return;
  }
  themeTogglesInitialized = true;

  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const root = document.documentElement;
      const current = root.dataset.theme || 'dark';
      const idx = themeOrder.indexOf(current);
      const next = themeOrder[(idx + 1) % themeOrder.length];
      root.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch (_) {}
      updateThemeButtons();
    });
  });
  updateThemeButtons();
}

setupThemeToggles();

// ---------- Routing ----------

if (location.pathname === '/dashboard') {
  renderDashboard();
} else if (location.pathname === '/admin') {
  renderAdmin();
} else {
  initApp();
}

// ---------- Dashboard ----------

function renderDashboard() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('view').style.display = 'block';

  const vtitle = document.getElementById('vtitle');
  const vmeta  = document.getElementById('vmeta');
  const vcontent = document.getElementById('vcontent');

  vtitle.textContent = 'My Shares';
  vmeta.innerHTML = '';
  vcontent.innerHTML = `
    <div id="dashStats" style="margin-bottom:1rem;font-size:0.95rem;color:var(--text-muted);"></div>
    <div id="dashTableContainer" style="text-align:center;color:var(--text-muted)">Loading…</div>
  `;
  document.title = 'My Shares — Pastebin';

  const statsEl = document.getElementById('dashStats');
  const tableContainer = document.getElementById('dashTableContainer');

  fetch('/api/usage')
    .then(r => {
      if (r.status === 401) {
        tableContainer.innerHTML = '<div class="empty">You must be logged in to view your shares.</div>';
        throw new Error('unauth');
      }
      if (!r.ok) throw new Error('usage_failed');
      return r.json();
    })
    .then(stats => {
      const used = formatBytes(stats.usedBytes);
      const quota = formatBytes(stats.quotaBytes);
      const left = formatBytes(stats.remainingBytes);
      statsEl.textContent =
        `You have ${stats.fileCount} file${stats.fileCount === 1 ? '' : 's'}, using ${used} of ${quota} (${left} remaining).`;
      return fetch('/api/shares');
    })
    .then(r => {
      if (!r) return;
      if (r.status === 401) {
        tableContainer.innerHTML = '<div class="empty">You must be logged in to view your shares.</div>';
        return null;
      }
      if (!r.ok) throw new Error('shares_failed');
      return r.json();
    })
    .then(list => {
      if (!list) return;
      if (!list.length) {
        tableContainer.innerHTML = '<div class="empty">No shares yet — go make some magic!</div>';
        return;
      }

      tableContainer.innerHTML = `
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Title</th>
              <th>Type</th>
              <th>Views</th>
              <th>Size</th>
              <th>Created</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(s => {
              const type = s.type === 'paste' ? 'paste' : 'file';
              const href = `/${type === 'paste' ? 'p' : 'f'}/${encodeURIComponent(s.id)}`;
              const views = typeof s.views === 'number' ? s.views : 0;
              const sizeLabel = type === 'file' ? formatBytes(s.size || 0) : '—';
              let expiresLabel = '<span class="never">Never</span>';
              if (s.expires) {
                const ex = new Date(s.expires);
                if (!isNaN(ex)) {
                  expiresLabel = escapeHtml(ex.toLocaleString());
                }
              }

              const rawTitle = s.title || (type === 'file' ? 'file' : 'paste');
              const displayTitle = type === 'file'
                ? truncateFileTitle(rawTitle)
                : rawTitle;
              // Thumbnail HTML (only for image files)
              let thumbHtml = '';
              try {
                if (type === 'file' && s.mime && s.mime.indexOf('image/') === 0 && s.filename) {
                  const url = `/uploads/${encodeURIComponent(s.filename)}`;
                  thumbHtml = `<div class="thumb"><img src="${url}" alt="thumb" loading="lazy"></div>`;
                }
              } catch (e) { thumbHtml = ''; }

              return `
                <tr data-id="${escapeHtml(s.id)}" data-type="${type}">
                  <td style="width:56px">${thumbHtml}</td>
                  <td>
                    <a href="${href}" target="_blank" rel="noopener">
                      ${escapeHtml(displayTitle)}
                    </a>
                  </td>
                  <td>${escapeHtml(type)}</td>
                  <td>${views}</td>
                  <td>${sizeLabel}</td>
                  <td>${escapeHtml(new Date(s.created).toLocaleString())}</td>
                  <td>${expiresLabel}</td>
                  <td>
                    <button class="btn btn-sm btn-outline dash-copy">Copy link</button>
                    <button class="btn btn-sm btn-danger dash-delete">Delete</button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;

      const rows = tableContainer.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const id = row.getAttribute('data-id');
        const type = row.getAttribute('data-type');
        const href = `/${type === 'paste' ? 'p' : 'f'}/${id}`;
        const fullUrl = location.origin + href;

        const copyBtn = row.querySelector('.dash-copy');
        const delBtn  = row.querySelector('.dash-delete');

        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(fullUrl)
                .then(() => {
                  copyBtn.textContent = 'Copied!';
                  setTimeout(() => (copyBtn.textContent = 'Copy link'), 1200);
                })
                .catch(() => {
                  alert('Link: ' + fullUrl);
                });
            } else {
              alert('Link: ' + fullUrl);
            }
          });
        }

        if (delBtn) {
          delBtn.addEventListener('click', () => {
            if (!confirm('Delete this share? This cannot be undone.')) return;

            fetch(`/api/share/${type}/${id}`, { method: 'DELETE' })
              .then(r => r.json())
              .then(data => {
                if (data && data.ok) {
                  row.remove();
                  if (!tableContainer.querySelector('tbody tr')) {
                    tableContainer.innerHTML = '<div class="empty">No shares left.</div>';
                    statsEl.textContent = '';
                  }
                } else if (data && data.error) {
                  alert('Error deleting: ' + data.error);
                } else {
                  alert('Error deleting share.');
                }
              })
              .catch(() => {
                alert('Error deleting share.');
              });
          });
        }
      });
    })
    .catch(err => {
      if (err && err.message === 'unauth') return;
      console.error('Error loading dashboard:', err);
      tableContainer.innerHTML = '<div class="empty">Error loading shares.</div>';
    });

  setupThemeToggles();
}

// ---------- Admin Panel ----------

function renderAdmin() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('view').style.display = 'block';

  const vtitle = document.getElementById('vtitle');
  const vmeta  = document.getElementById('vmeta');
  const vcontent = document.getElementById('vcontent');

  vtitle.textContent = 'Admin Panel';
  vmeta.innerHTML = '';
  document.title = 'Admin — Pastebin';

  vcontent.innerHTML = document.getElementById('adminContent') ? '' : '';

  fetch('/api/me')
    .then(r => {
      if (!r.ok) throw new Error('me_failed');
      return r.json();
    })
    .then(me => {
      if (!me.loggedIn || !me.isAdmin) {
        const guardEl = document.getElementById('adminGuard');
        if (guardEl) {
          guardEl.textContent = 'Admin only. Log in as an administrator to access this panel.';
          const adminContent = document.getElementById('adminContent'); if (adminContent) adminContent.style.display = 'none';
        }
        return;
      }
      const guardEl = document.getElementById('adminGuard');
      if (guardEl) {
        guardEl.textContent = 'Signed in as ' + (me.email || '') + ' — Admin';
        const adminContent = document.getElementById('adminContent'); if (adminContent) adminContent.style.display = 'block';
      }
      if (typeof setupAdminHandlers === 'function') {
        try { setupAdminHandlers(); if (typeof loadAdminStats==='function') loadAdminStats(); if (typeof loadBlockedIps==='function') loadBlockedIps(); } catch(e) { console.warn('admin handlers failed', e); }
      }
    })
    .catch(err => {
      console.error('Error verifying admin:', err);
      const guardEl = document.getElementById('adminGuard'); if (guardEl) guardEl.textContent = 'Error verifying admin.';
    });

  setupThemeToggles();
}

function setupAdminHandlers() {
  // The admin handlers were moved to /js/admin.js for the standalone admin page.
  // When using the legacy in-page admin we keep compatibility by delegating to global functions if present.
  if (window.loadAdminStats && typeof window.loadAdminStats === 'function') window.loadAdminStats();
  if (window.loadBlockedIps && typeof window.loadBlockedIps === 'function') window.loadBlockedIps();
}

function loadAdminStats() {}
function loadBlockedIps() {}

// ---------- Main App ----------

function initApp() {
  document.getElementById('app').style.display = 'block';
  document.getElementById('view').style.display = 'none';
  document.title = 'Pastebin';

  const authStatusEl = document.getElementById('authStatus');
  const loggedOutView = document.getElementById('loggedOutView');
  const loggedInView = document.getElementById('loggedInView');
  const userLabel = document.getElementById('userLabel');
  const mainContent = document.getElementById('mainContent');
  const loggedOutHint = document.getElementById('loggedOutHint');
  const adminBtn = document.getElementById('openAdmin');

  function setLoggedIn(me) {
    loggedOutView.style.display = 'none';
    loggedInView.style.display = 'flex';
    userLabel.textContent = me.email;
    mainContent.style.display = 'block';
    loggedOutHint.style.display = 'none';
    authStatusEl.textContent = '';
    authStatusEl.className = 'auth-status';
    if (me.isAdmin) {
      adminBtn.style.display = 'inline-flex';
    } else {
      adminBtn.style.display = 'none';
    }
    startHeartbeat();
  }

  function setLoggedOut() {
    loggedOutView.style.display = 'block';
    loggedInView.style.display = 'none';
    mainContent.style.display = 'none';
    loggedOutHint.style.display = 'block';
    authStatusEl.textContent = '';
    authStatusEl.className = 'auth-status';
    adminBtn.style.display = 'none';
    stopHeartbeat();
  }

  // Heartbeat to mark session active (reduces reliance on other requests)
  let _heartbeatInterval = null;
  function startHeartbeat(){
    if (_heartbeatInterval) return;
    // fire immediately then every 30s
    fetch('/api/ping', { method: 'POST' }).catch(()=>{});
    _heartbeatInterval = setInterval(()=>{ fetch('/api/ping', { method: 'POST' }).catch(()=>{}); }, 30000);
  }
  function stopHeartbeat(){ if(_heartbeatInterval){ clearInterval(_heartbeatInterval); _heartbeatInterval = null; } }

  fetch('/api/me')
    .then(r => {
      if (!r.ok) throw new Error('me_failed');
      return r.json();
    })
    .then(me => {
      if (me.loggedIn) {
        setLoggedIn(me);
      } else {
        setLoggedOut();
      }
    })
    .catch(err => {
      console.error('Error fetching /api/me:', err);
      setLoggedOut();
    });

  document.getElementById('loginBtn').addEventListener('click', () => {
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      authStatusEl.textContent = 'Email and password are required.';
      authStatusEl.className = 'auth-status error';
      return;
    }

    authStatusEl.textContent = 'Logging in…';
    authStatusEl.className = 'auth-status';

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          authStatusEl.textContent = data.error;
          authStatusEl.className = 'auth-status error';
          return;
        }
        authStatusEl.textContent = 'Logged in!';
        authStatusEl.className = 'auth-status ok';
        fetch('/api/me')
          .then(r => r.json())
          .then(me => {
            setLoggedIn(me);
          });
        passwordInput.value = '';
        passwordInput.blur();
      })
      .catch(err => {
        console.error('Error logging in:', err);
        authStatusEl.textContent = 'Error logging in.';
        authStatusEl.className = 'auth-status error';
      });
  });

  document.getElementById('registerBtn').addEventListener('click', () => {
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      authStatusEl.textContent = 'Email and password are required.';
      authStatusEl.className = 'auth-status error';
      return;
    }
    if (password.length < 6) {
      authStatusEl.textContent = 'Password must be at least 6 characters.';
      authStatusEl.className = 'auth-status error';
      return;
    }

    authStatusEl.textContent = 'Creating account…';
    authStatusEl.className = 'auth-status';

    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          authStatusEl.textContent = data.error;
          authStatusEl.className = 'auth-status error';
          return;
        }
        authStatusEl.textContent = 'Account created & logged in!';
        authStatusEl.className = 'auth-status ok';
        fetch('/api/me')
          .then(r => r.json())
          .then(me => {
            setLoggedIn(me);
          });
        passwordInput.value = '';
        passwordInput.blur();
      })
      .catch(err => {
        console.error('Error creating account:', err);
        authStatusEl.textContent = 'Error creating account.';
        authStatusEl.className = 'auth-status error';
      });
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    fetch('/api/logout', { method: 'POST' })
      .then(() => {
        setLoggedOut();
      })
      .catch(err => {
        console.error('Error logging out:', err);
        setLoggedOut();
      });
  });

  document.getElementById('openDashboard').addEventListener('click', () => {
    location.href = '/dashboard';
  });

  document.getElementById('openAdmin').addEventListener('click', () => {
    // Redirect to standalone admin page
    location.href = '/admin';
  });

  const setMode = m => {
    const filesBtn = document.getElementById('modeFilesBtn');
    const pasteBtn = document.getElementById('modePasteBtn');
    if (!filesBtn || !pasteBtn) return;

    filesBtn.classList.toggle('active', m === 'files');
    pasteBtn.classList.toggle('active', m === 'paste');

    document.getElementById('fileDropzone').style.display =
      m === 'files' ? 'block' : 'none';
    document.getElementById('pasteContainer').style.display =
      m === 'paste' ? 'block' : 'none';

    try {
      localStorage.setItem('mode', m);
    } catch (_) {}
  };

  document.getElementById('modeFilesBtn').addEventListener('click', () => setMode('files'));
  document.getElementById('modePasteBtn').addEventListener('click', () => setMode('paste'));

  let initialMode = 'files';
  try {
    const storedMode = localStorage.getItem('mode');
    if (storedMode === 'paste' || storedMode === 'files') {
      initialMode = storedMode;
    }
  } catch (_) {}
  setMode(initialMode);

  document.querySelectorAll('.expiry-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.expiry-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  });

  const getExpiry = () => {
    const active = document.querySelector('.expiry-btn.active');
    if (!active) return null;
    const v = active.dataset.expiry;
    return v === 'never' ? null : v;
  };

  const fileInput = document.getElementById('fileInput');
  const dropzone  = document.getElementById('fileDropzone');
  const statusEl  = document.getElementById('status');

  document.getElementById('browseBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => handleFiles(e.target.files));

  function handleFiles(files) {
    if (!files || !files.length) return;

    const expiry = getExpiry();
    statusEl.textContent = 'Uploading…';

    const uploads = Array.from(files).map(file => {
      const fd = new FormData();
      fd.append('file', file);
      if (expiry) fd.append('expiry', expiry);

      return fetch('/upload', {
        method: 'POST',
        body: fd
      })
        .then(r => {
          if (r.status === 401) {
            return { _unauth: true };
          }
          if (!r.ok) {
            return { _error: true };
          }
          return r.json();
        })
        .catch(err => {
          console.error('Upload error:', err);
          return { _error: true };
        });
    });

    Promise.all(uploads).then(results => {
      if (results.some(r => r && r._unauth)) {
        statusEl.textContent = 'You must be logged in to upload.';
        return;
      }

      const success = results.filter(r => r && !r._unauth && !r._error && !r.error && r.url);
      if (!success.length) {
        console.error('Upload responses:', results);
        statusEl.textContent = 'Upload failed.';
        return;
      }

      const countLabel = success.length > 1 ? `${success.length} files` : '1 file';

      statusEl.textContent = '';
      const header = document.createElement('div');
      header.textContent = `Uploaded ${countLabel}!`;
      statusEl.appendChild(header);

      success.forEach((r, idx) => {
        const url = r.url;
        const line = document.createElement('div');
        if (success.length > 1) {
          const prefix = document.createTextNode(`${idx + 1}. `);
          line.appendChild(prefix);
        }
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.fontSize = '1.1rem';
        link.style.fontWeight = '600';
        link.textContent = url;
        line.appendChild(link);
        statusEl.appendChild(line);
      });
    });
  }

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.style.borderColor = 'var(--accent)';
    });
  });

  ['dragleave', 'dragend', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.style.borderColor = 'var(--border)';
    });
  });

  dropzone.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    handleFiles(files);
  });

  dropzone.addEventListener('click', () => fileInput.click());

  document.getElementById('pasteSubmitBtn').addEventListener('click', () => {
    const pasteInput = document.getElementById('pasteInput');
    const text = pasteInput.value.trim();
    if (!text) return;

    statusEl.textContent = 'Saving…';

    const expiry = getExpiry();
    let url = '/paste';
    if (expiry) {
      const params = new URLSearchParams({ expiry });
      url += '?' + params.toString();
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text
    })
      .then(r => {
        if (r.status === 401) {
          statusEl.textContent = 'You must be logged in to save pastes.';
          return null;
        }
        if (!r.ok) {
          throw new Error('paste_failed');
        }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.error) {
          statusEl.textContent = 'Error: ' + data.error;
          return;
        }
        const pasteUrl = data.url;
        let expiryLabel = '';
        if (expiry) {
          const map = {
            '1h': ' (expires in 1 hour)',
            '1d': ' (expires in 1 day)',
            '7d': ' (expires in 7 days)',
            '30d': ' (expires in 30 days)'
          };
          expiryLabel = map[expiry] || '';
        }

        statusEl.textContent = '';
        const line1 = document.createElement('div');
        line1.textContent = `Paste ready${expiryLabel}!`;
        statusEl.appendChild(line1);

        const link = document.createElement('a');
        link.href = pasteUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.fontSize = '1.4rem';
        link.style.fontWeight = '600';
        link.textContent = pasteUrl;
        statusEl.appendChild(link);

        pasteInput.value = '';
      })
      .catch(err => {
        console.error('Error saving paste:', err);
        statusEl.textContent = 'Error saving paste.';
      });
  });

  // Admin controls have moved to /admin — only attach handlers if present on this page
  const cfgTestBtn = document.getElementById('cfg_test_smtp');
  if (cfgTestBtn) cfgTestBtn.addEventListener('click', testSmtp);
  const cfgShow = document.getElementById('cfg_mail_show_pass');
  if (cfgShow) cfgShow.addEventListener('change', e => {
    const pass = document.getElementById('cfg_mail_pass');
    if (pass) pass.type = e.target.checked ? 'text' : 'password';
  });
  const cfgSave = document.getElementById('cfg_save'); if (cfgSave) cfgSave.addEventListener('click', saveAdminConfig);
  const cfgReload = document.getElementById('cfg_reload'); if (cfgReload) cfgReload.addEventListener('click', loadAdminConfig);

  setupThemeToggles();
}

// Exported helpers used by standalone admin.js paths
window.app_helpers = window.app_helpers || {};
window.app_helpers.formatBytes = formatBytes;
window.app_helpers.escapeHtml = escapeHtml;
