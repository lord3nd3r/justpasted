// Standalone admin UI script for /admin
(function(){
  // Theme helper (minimal copy)
  const themeOrder = ['dark','light','terminal'];
  function initTheme(){
    try{
      const stored = localStorage.getItem('theme');
      if(['dark','light','terminal'].includes(stored)) document.documentElement.dataset.theme = stored;
    }catch(e){}
    document.querySelectorAll('[data-theme-toggle]').forEach(btn=>btn.addEventListener('click',()=>{
      const root = document.documentElement; const cur = root.dataset.theme||'dark'; const idx = themeOrder.indexOf(cur); const next = themeOrder[(idx+1)%themeOrder.length]; root.dataset.theme = next; try{localStorage.setItem('theme', next)}catch(e){}
    }));
  }

  function escapeHtml(s){ if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,"&#039;"); }
  function formatBytes(bytes){ if(!bytes||bytes<=0) return '0 B'; const u=['B','KB','MB','GB','TB']; let i=0; let v=bytes; while(v>=1024 && i<u.length-1){v/=1024;i++} const fixed = v>=10||i===0? v.toFixed(0): v.toFixed(1); return fixed+' '+u[i]; }

  function renderAdminShell(){
    const root = document.getElementById('adminRoot');
    // Render only the inner admin UI into #adminRoot.
    // Do NOT create duplicate elements with IDs that exist in the outer page
    // (like `adminGuard` and `adminContent`) to avoid duplicate-ID conflicts.
    root.innerHTML = `
        <div style="display:grid;grid-template-columns:1.1fr 1.1fr;gap:1.5rem;flex-wrap:wrap;">
          <section style="border:1px solid var(--border);border-radius:1rem;padding:1rem;">
            <h2 style="margin-bottom:0.8rem;font-size:1.05rem;">Stats</h2>
            <div id="adminStats">Loading…</div>
          </section>
          <section style="border:1px solid var(--border);border-radius:1rem;padding:1rem;">
            <h2 style="margin-bottom:0.8rem;font-size:1.05rem;">Share Lookup</h2>
            <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.8rem;">
              <input id="adminShareId" placeholder="Share ID (file or paste)" style="flex:1;padding:0.4rem 0.6rem;border-radius:0.6rem;border:1px solid var(--border);background:var(--bg-soft);color:var(--text-primary);">
              <button id="adminShareSearchBtn" class="btn btn-sm">Search</button>
            </div>
            <div id="adminShareResult" style="font-size:0.9rem;color:var(--text-muted);"></div>
          </section>
        </div>

        <section style="border:1px solid var(--border);border-radius:1rem;padding:1rem;margin-top:1.5rem;">
          <h2 style="margin-bottom:0.8rem;font-size:1.05rem;">User Search / All Users</h2>
          <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.6rem;flex-wrap:wrap;">
            <input id="adminUserQuery" placeholder="Search by email" style="flex:1;min-width:180px;padding:0.4rem 0.6rem;border-radius:0.6rem;border:1px solid var(--border);background:var(--bg-soft);color:var(--text-primary);">
            <button id="adminUserSearchBtn" class="btn btn-sm">Search</button>
            <button id="adminUserListAllBtn" class="btn btn-sm btn-outline">List all users</button>
          </div>
          <div id="adminUserResults" style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:0.8rem;padding:0.5rem;font-size:0.9rem;"></div>
          <div id="adminUserDetail" style="margin-top:1rem;font-size:0.9rem;"></div>
        </section>

        <section style="border:1px solid var(--border);border-radius:1rem;padding:1rem;margin-top:1.5rem;">
          <h2 style="margin-bottom:0.8rem;font-size:1.05rem;">Blocked IPs</h2>
          <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.8rem;flex-wrap:wrap;">
            <input id="adminIpInput" placeholder="IP to block" style="flex:1;min-width:150px;padding:0.4rem 0.6rem;border-radius:0.6rem;border:1px solid var(--border);background:var(--bg-soft);color:var(--text-primary);">
            <input id="adminIpReason" placeholder="Reason (optional)" style="flex:2;min-width:180px;padding:0.4rem 0.6rem;border-radius:0.6rem;border:1px solid var(--border);background:var(--bg-soft);color:var(--text-primary);">
            <button id="adminAddIpBtn" class="btn btn-sm">Block IP</button>
          </div>
          <div id="adminIpList" style="max-height:220px;overflow:auto;font-size:0.9rem;border:1px solid var(--border);border-radius:0.8rem;padding:0.5rem;"></div>
        </section>

        <section style="border:1px solid var(--border);border-radius:1rem;padding:1rem;margin-top:1.5rem;">
          <h2 style="margin-bottom:0.8rem;font-size:1.05rem;">Settings</h2>
          <div style="display:flex;flex-direction:column;gap:0.6rem;max-width:700px">
            <label><input type="checkbox" id="cfg_email_verification"> Require email verification</label>
            <label><input type="checkbox" id="cfg_enable_admin_reg"> Enable admin registration</label>
            <label>Quota bytes: <input id="cfg_quota_bytes" type="number" style="width:200px"></label>
            <div style="border:1px dashed var(--border);padding:0.6rem;border-radius:0.5rem;">
              <strong>SMTP settings</strong>
              <div style="font-size:0.9rem;color:var(--text-muted);">Moved to a separate page to avoid blocking saves: <a href="/admin/smtp.html">SMTP settings</a></div>
            </div>
            <div style="display:flex;gap:0.6rem">
              <button id="cfg_save" class="btn btn-success btn-sm">Save</button>
              <button id="cfg_reload" class="btn btn-outline btn-sm">Reload</button>
              <div id="cfg_status" style="align-self:center;color:var(--text-muted)"></div>
            </div>
          </div>
        </section>
    `;
  }

  // Apply SITE_NAME branding to header in admin shell (if present)
  fetch('/api/config').then(r=>r.json()).then(cfg=>{
    try{
      const name = cfg && cfg.SITE_NAME ? cfg.SITE_NAME : 'JustPasted';
      const brandEls = document.querySelectorAll('.brand');
      brandEls.forEach(b=>{ if(b.children && b.children.length>1) b.children[1].textContent = b.children[1].textContent.replace(/Pastebin/g, name); });
      if(document.title && document.title.indexOf('JustPasted')===-1) document.title = document.title.replace(/Pastebin/g, name);
    }catch(e){}
  }).catch(()=>{});

  // Helper: fetch JSON with error handling
  function jfetch(url, opts){ return fetch(url, opts).then(r=>r.json()); }

  function attachHandlers(){
    const shareIdInput = document.getElementById('adminShareId');
    const shareSearchBtn = document.getElementById('adminShareSearchBtn');
    const shareResultEl = document.getElementById('adminShareResult');
    const userQuery = document.getElementById('adminUserQuery');
    const userSearchBtn = document.getElementById('adminUserSearchBtn');
    const userListAllBtn = document.getElementById('adminUserListAllBtn');
    const userResultsEl = document.getElementById('adminUserResults');
    const userDetailEl = document.getElementById('adminUserDetail');
    const ipInput = document.getElementById('adminIpInput');
    const ipReason = document.getElementById('adminIpReason');
    const addIpBtn = document.getElementById('adminAddIpBtn');
    const ipList = document.getElementById('adminIpList');
    const statsEl = document.getElementById('adminStats');

    shareSearchBtn.addEventListener('click', ()=>{
      const id = shareIdInput.value.trim(); if(!id){ shareResultEl.textContent='Enter a share ID.'; return; }
      shareResultEl.textContent='Searching…';
      jfetch('/api/admin/share/'+encodeURIComponent(id)).then(data=>{
        if(!data||data.error){ shareResultEl.textContent='Not found.'; return; }
        const type=data.type; const s=data.share; const href=`/${type==='paste'?'p':'f'}/${encodeURIComponent(s.id)}`;
        const info=[`<strong>Type:</strong> ${escapeHtml(type)}`,`<strong>ID:</strong> ${escapeHtml(s.id)}`,`<strong>User ID:</strong> ${escapeHtml(String(s.user_id))}`];
        if(s.user_email) info.push(`<strong>User email:</strong> ${escapeHtml(s.user_email)}`);
        info.push(`<strong>Created:</strong> ${new Date(s.created).toLocaleString()}`);
        info.push(`<strong>Views:</strong> ${s.views||0}`);
        if(type==='file'){ info.push(`<strong>Size:</strong> ${formatBytes(s.size||0)}`); info.push(`<strong>MIME:</strong> ${escapeHtml(s.mime||'')}`); }
        shareResultEl.innerHTML=`<div style="margin-bottom:0.6rem;">${info.join('<br>')}</div><div style="margin-bottom:0.6rem;"><a href="${href}" target="_blank" rel="noopener">Open</a></div><button id="adminDeleteShareDirectBtn" class="btn btn-sm btn-danger">Delete share</button>`;
        const del = document.getElementById('adminDeleteShareDirectBtn'); del.addEventListener('click', ()=>{
          if(!confirm(`Delete this ${type} share ${s.id}? This cannot be undone.`)) return;
          jfetch(`/api/share/${type}/${s.id}`,{method:'DELETE'}).then(resp=>{ if(resp&&resp.ok){ alert('Share deleted.'); shareResultEl.textContent='Share deleted.' } else alert('Error deleting: '+(resp&&resp.error||'unknown')) }).catch(e=>{alert('Error deleting share.')});
        });
      }).catch(e=>{ shareResultEl.textContent='Error looking up share.'; });
    });

    function renderUsersTable(list,label){ if(!Array.isArray(list)||!list.length){ userResultsEl.innerHTML='<div style="color:var(--text-muted);">No users found.</div>'; return;} const labelHtml = label?`<div style="margin-bottom:0.3rem;font-size:0.8rem;color:var(--text-muted);">${label} (${list.length})</div>`:''; userResultsEl.innerHTML = labelHtml + `<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><thead><tr><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">ID</th><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">Email</th><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">Role</th><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">Banned</th></tr></thead><tbody>${list.map(u=>{const pillClass = u.is_banned?'pill pill-banned':(u.role==='admin'?'pill pill-admin':(u.role==='mod'?'pill pill-mod':'pill')); const bannedText = u.is_banned?'Yes':'No'; return `<tr data-user-id="${u.id}" class="admin-user-row" style="cursor:pointer;"><td style="padding:0.3rem;border-bottom:1px solid var(--border);">${u.id}</td><td style="padding:0.3rem;border-bottom:1px solid var(--border);">${escapeHtml(u.email)}</td><td style="padding:0.3rem;border-bottom:1px solid var(--border);"><span class="${pillClass}">${escapeHtml(u.role||'user')}</span></td><td style="padding:0.3rem;border-bottom:1px solid var(--border);">${bannedText}</td></tr>`; }).join('')}</tbody></table>`; userResultsEl.querySelectorAll('.admin-user-row').forEach(row=>row.addEventListener('click',()=>showUserDetail(row.getAttribute('data-user-id')))); }

    userSearchBtn.addEventListener('click', ()=>{ const q = userQuery.value.trim(); if(!q){ userResultsEl.innerHTML='<div style="color:var(--text-muted);">Enter an email fragment to search.</div>'; userDetailEl.innerHTML=''; return;} userResultsEl.textContent='Searching…'; userDetailEl.innerHTML=''; jfetch('/api/admin/users?q='+encodeURIComponent(q)).then(list=>renderUsersTable(list,'Search results')).catch(e=>{ userResultsEl.innerHTML='<div style="color:var(--danger);">Error searching users.</div>'; }); });
    userQuery.addEventListener('keydown', e=>{ if(e.key==='Enter') userSearchBtn.click(); });
    userListAllBtn.addEventListener('click', ()=>{ userResultsEl.textContent='Loading all users…'; userDetailEl.innerHTML=''; jfetch('/api/admin/users-all').then(list=>renderUsersTable(list,'All registered users')).catch(e=>{ userResultsEl.innerHTML='<div style="color:var(--danger);">Error loading users.</div>' }); });

    function showUserDetail(userId){ userDetailEl.innerHTML='Loading user detail…'; Promise.all([ jfetch('/api/admin/user/'+encodeURIComponent(userId)+'/shares'), jfetch('/api/admin/users?q='+encodeURIComponent(userId)).catch(()=>[]) ]).then(([shares,userList])=>{ const user = Array.isArray(userList)? userList.find(u=>String(u.id)===String(userId)):null; const role = user? (user.role||'user') : 'user'; const banned = user? !!user.is_banned : false; const verified = user? !!user.email_verified : false; let html=''; html+=`<div style="margin-bottom:0.6rem;"><strong>User ID:</strong> ${escapeHtml(userId)}</div>`; if(user){ html+=`<div style="margin-bottom:0.6rem;"><strong>Email:</strong> ${escapeHtml(user.email)}</div>`; html+=`<div style="margin-bottom:0.6rem;"><strong>Role:</strong> ${escapeHtml(role)}</div>`; html+=`<div style="margin-bottom:0.6rem;"><strong>Banned:</strong> ${banned? 'Yes':'No'}</div>`; html+=`<div style="margin-bottom:0.6rem;"><strong>Verified:</strong> ${verified? 'Yes' : 'No'}</div>`; } html+=`<div style="margin-bottom:0.8rem;"><label style="font-size:0.85rem;margin-right:0.4rem;">Set role:</label><select id="adminRoleSelect" style="padding:0.2rem 0.4rem;border-radius:0.4rem;border:1px solid var(--border);background:var(--bg-soft);color:var(--text-primary);"><option value="user"${role==='user'?' selected':''}>user</option><option value="mod"${role==='mod'?' selected':''}>mod</option><option value="admin"${role==='admin'?' selected':''}>admin</option></select><button id="adminRoleSaveBtn" class="btn btn-sm" style="margin-left:0.4rem;">Save</button></div><div style="margin-bottom:0.8rem;"><button id="adminBanToggleBtn" class="btn btn-sm ${banned? 'btn-success' : 'btn-danger'}">${banned? 'Unban user' : 'Ban user'}</button> <button id="adminVerifyToggleBtn" class="btn btn-sm ${verified? 'btn-success' : 'btn-outline'}" style="margin-left:0.6rem;">${verified? 'Unverify email' : 'Verify email'}</button></div>`;
      if(Array.isArray(shares)&&shares.length){ html+=`<div style="margin-top:0.8rem;"><strong>Shares:</strong></div>`; html+=`<table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-top:0.3rem;"><thead><tr><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">ID</th><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">Type</th><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">Title</th><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">Views</th><th style="border-bottom:1px solid var(--border);padding:0.3rem;text-align:left;">Actions</th></tr></thead><tbody>${shares.map(s=>{ const type = s.type==='paste'?'paste':'file'; const href = `/${type==='paste'?'p':'f'}/${encodeURIComponent(s.id)}`; const title = s.title|| (type==='file'?'file':'paste'); return `<tr data-share-id="${s.id}" data-share-type="${type}"><td style="padding:0.3rem;border-bottom:1px solid var(--border);">${escapeHtml(s.id)}</td><td style="padding:0.3rem;border-bottom:1px solid var(--border);">${type}</td><td style="padding:0.3rem;border-bottom:1px solid var(--border);"><a href="${href}" target="_blank" rel="noopener">${escapeHtml(title)}</a></td><td style="padding:0.3rem;border-bottom:1px solid var(--border);">${s.views||0}</td><td style="padding:0.3rem;border-bottom:1px solid var(--border);"><button class="btn btn-sm btn-danger admin-delete-share-btn">Delete</button></td></tr>` }).join('')}</tbody></table>`; } else { html += '<div style="margin-top:0.6rem;color:var(--text-muted);">No shares for this user.</div>'; }
      userDetailEl.innerHTML = html;
      const roleSelect = document.getElementById('adminRoleSelect'); const roleSaveBtn = document.getElementById('adminRoleSaveBtn'); const banToggleBtn = document.getElementById('adminBanToggleBtn');
      if(roleSaveBtn){ roleSaveBtn.addEventListener('click', ()=>{ const newRole = roleSelect.value; fetch('/api/admin/user/role',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, role: newRole }) }).then(r=>r.json()).then(data=>{ if(data&&data.ok){ alert('Role updated.'); userSearchBtn.click(); } else alert('Error updating role: '+(data&&data.error||'unknown')) }).catch(e=>{ alert('Error updating role.'); }); }); }
      if(banToggleBtn){ banToggleBtn.addEventListener('click', ()=>{ const newBanned = !banned; if(newBanned && !confirm('Ban this user? This will also block their future logins.')) return; fetch('/api/admin/user/ban',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, banned: newBanned }) }).then(r=>r.json()).then(data=>{ if(data&&data.ok){ alert(newBanned?'User banned.':'User unbanned.'); userSearchBtn.click(); showUserDetail(userId); } else alert('Error updating ban status: '+(data&&data.error||'unknown')); }).catch(e=>{ alert('Error updating ban status.'); }); }); }
      const verifyBtn = document.getElementById('adminVerifyToggleBtn');
      if(verifyBtn){ verifyBtn.addEventListener('click', ()=>{ const newVerified = !verified; const proceed = newVerified ? true : confirm('Mark email as unverified? This may require the user to re-verify.'); if(!proceed) return; fetch('/api/admin/user/verify',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, verified: newVerified }) }).then(r=>r.json()).then(data=>{ if(data&&data.ok){ alert(newVerified? 'Email marked verified.':'Email unverified.'); userSearchBtn.click(); showUserDetail(userId); } else alert('Error updating verification status: '+(data&&data.error||'unknown')); }).catch(e=>{ alert('Error updating verification status.'); }); }); }
      userDetailEl.querySelectorAll('.admin-delete-share-btn').forEach(btn=>btn.addEventListener('click', ()=>{ const row = btn.closest('tr'); const shareId = row.getAttribute('data-share-id'); const shareType = row.getAttribute('data-share-type'); if(!confirm(`Delete this ${shareType} share ${shareId}? This cannot be undone.`)) return; fetch(`/api/share/${shareType}/${shareId}`,{ method:'DELETE' }).then(r=>r.json()).then(data=>{ if(data&&data.ok){ alert('Share deleted.'); row.remove(); } else alert('Error deleting share: '+(data&&data.error||'unknown')); }).catch(e=>{ alert('Error deleting share.'); }); }));
    }).catch(e=>{ userDetailEl.innerHTML = '<div style="color:var(--danger);">Error loading user detail.</div>'; }); }

    addIpBtn.addEventListener('click', ()=>{ const ip = ipInput.value.trim(); const reason = ipReason.value.trim(); if(!ip){ alert('IP is required.'); return; } fetch('/api/admin/blocked-ips',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ip, reason }) }).then(r=>r.json()).then(data=>{ if(data&&data.ok){ ipInput.value=''; ipReason.value=''; loadBlockedIps(); } else alert('Error blocking IP: '+(data&&data.error||'unknown')); }).catch(e=>{ alert('Error blocking IP.'); }); });

    function loadBlockedIps(){ ipList.textContent='Loading…'; jfetch('/api/admin/blocked-ips').then(list=>{ if(!Array.isArray(list)||!list.length){ ipList.innerHTML = '<div style="color:var(--text-muted);">No blocked IPs.</div>'; return;} ipList.innerHTML = list.map(row=>{ const created = new Date(row.created).toLocaleString(); const reason = row.reason? escapeHtml(row.reason):'(no reason)'; return `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding:0.25rem 0;"><div><div><strong>${escapeHtml(row.ip)}</strong></div><div style="font-size:0.8rem;color:var(--text-muted);">${reason} — ${created}</div></div><button class="btn btn-sm btn-danger admin-unblock-ip-btn" data-ip="${escapeHtml(row.ip)}">Unblock</button></div>`; }).join(''); ipList.querySelectorAll('.admin-unblock-ip-btn').forEach(btn=>btn.addEventListener('click', ()=>{ const ip = btn.getAttribute('data-ip'); if(!confirm('Unblock '+ip+'?')) return; fetch('/api/admin/blocked-ips/'+encodeURIComponent(ip),{ method:'DELETE' }).then(r=>r.json()).then(data=>{ if(data&&data.ok) loadBlockedIps(); else alert('Error unblocking IP: '+(data&&data.error||'unknown')); }).catch(e=>{ alert('Error unblocking IP.'); }); })); }).catch(e=>{ ipList.innerHTML = '<div style="color:var(--danger);">Error loading blocked IPs.</div>'; }); }

    function loadAdminStats(){ statsEl.textContent='Loading…'; jfetch('/api/admin/stats').then(stats=>{ if(!stats||stats.error){ statsEl.textContent='Error loading stats.'; return; } const totalSize = formatBytes(stats.totalFilesSize||0); statsEl.innerHTML = `<div><strong>Admins:</strong> ${stats.adminCount||0} &nbsp; <strong>Online:</strong> ${stats.onlineCount||0}</div><div><strong>Total users:</strong> ${stats.totalUsers}</div><div><strong>Total files:</strong> ${stats.totalFiles} (${totalSize})</div><div><strong>Total pastes:</strong> ${stats.totalPastes}</div><div><strong>Blocked IPs:</strong> ${stats.blockedIps}</div><div><strong>Open reports:</strong> ${stats.openReports||0}</div>`; }).catch(e=>{ statsEl.textContent='Error loading stats.'; }); }

    // Refresh stats periodically (every 10s)
    let statsInterval = null;
    function startStatsPoll(){ if(statsInterval) clearInterval(statsInterval); statsInterval = setInterval(loadAdminStats, 10000); }

    // Settings load/save/test

    function loadAdminConfig(){ const status = document.getElementById('cfg_status'); status.textContent='Loading…'; jfetch('/api/admin/config').then(cfg=>{ document.getElementById('cfg_email_verification').checked = !!cfg.EMAIL_VERIFICATION_ENABLED; document.getElementById('cfg_enable_admin_reg').checked = !!cfg.ENABLE_ADMIN_REGISTRATION; document.getElementById('cfg_quota_bytes').value = cfg.QUOTA_BYTES||''; status.textContent=''; }).catch(e=>{ status.textContent='Error loading config'; }); }

    function saveAdminConfig(){ const status = document.getElementById('cfg_status'); status.textContent='Saving…'; const payload = { EMAIL_VERIFICATION_ENABLED: document.getElementById('cfg_email_verification').checked, ENABLE_ADMIN_REGISTRATION: document.getElementById('cfg_enable_admin_reg').checked, QUOTA_BYTES: Number(document.getElementById('cfg_quota_bytes').value)||undefined }; fetch('/api/admin/config',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()).then(resp=>{ if(resp&&resp.ok){ status.textContent='Saved.'; setTimeout(()=>status.textContent='',2000); } else status.textContent = 'Save failed: '+(resp&&resp.error?resp.error:'unknown'); }).catch(err=>{ status.textContent='Save error'; }); }

    function testSmtp(){ const status = document.getElementById('cfg_status'); status.textContent='Testing…'; const mail = { HOST: document.getElementById('cfg_mail_host').value||undefined, PORT: Number(document.getElementById('cfg_mail_port').value)||undefined, SECURE: document.getElementById('cfg_mail_secure').checked, AUTH_USER: document.getElementById('cfg_mail_user').value||undefined, AUTH_PASS: document.getElementById('cfg_mail_pass').value||undefined, FROM: document.getElementById('cfg_mail_from').value||undefined }; fetch('/api/admin/test-smtp',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ MAIL: mail }) }).then(r=>r.json()).then(resp=>{ if(resp&&resp.ok) status.textContent='SMTP OK.'; else status.textContent='SMTP failed: '+(resp&&resp.error?resp.error:'unknown'); }).catch(e=>{ status.textContent='SMTP test error'; }); }

    document.getElementById('cfg_save').addEventListener('click', saveAdminConfig);
    document.getElementById('cfg_reload').addEventListener('click', loadAdminConfig);

    // initial loads
    loadAdminStats(); loadBlockedIps(); startStatsPoll();
  }

  // Entry: check /api/me for admin privileges then render
  function init(){ initTheme(); const guard = document.getElementById('adminGuard') || document.getElementById('adminGuard'); if(!guard){ renderAdminShell(); attachHandlers(); return; } fetch('/api/me').then(r=>{ if(!r.ok) throw new Error('me_failed'); return r.json(); }).then(me=>{ renderAdminShell(); if(!me.loggedIn||!me.isAdmin){ document.getElementById('adminGuard').textContent = 'Admin only. Log in as an administrator to access this panel.'; document.getElementById('adminContent').style.display='none'; return; } document.getElementById('adminGuard').textContent = 'Signed in as '+(me.email||'')+' — Admin'; document.getElementById('adminContent').style.display='block'; attachHandlers(); }).catch(e=>{ renderAdminShell(); document.getElementById('adminGuard').textContent = 'Error verifying admin.'; document.getElementById('adminContent').style.display='none'; console.error('Admin auth check failed', e); }); }

  // Ping interval for admin page as well
  let _adminPing = null;
  function startAdminPing(){ if(_adminPing) return; fetch('/api/ping',{method:'POST'}).catch(()=>{}); _adminPing = setInterval(()=>fetch('/api/ping',{method:'POST'}).catch(()=>{}),30000); }
  function stopAdminPing(){ if(_adminPing){ clearInterval(_adminPing); _adminPing = null; } }

  document.addEventListener('DOMContentLoaded', init);
  // start admin ping when page visible
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') startAdminPing(); else stopAdminPing(); });
  // start immediately
  startAdminPing();
})();
