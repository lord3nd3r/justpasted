// Minimal SMTP admin page script
(function(){
  function e(s){ return String(s||'').replace(/[&<>"]+/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c)); }
  const root = document.getElementById('smtpRoot');
  root.innerHTML = `
    <div style="border:1px solid var(--border);padding:1rem;border-radius:0.6rem;">
      <label>Host: <input id="smtp_host" style="width:100%"></label>
      <label>Port: <input id="smtp_port" style="width:120px"></label>
      <label><input type="checkbox" id="smtp_secure"> Secure (SSL)</label>
      <label>Auth user: <input id="smtp_user" style="width:100%"></label>
      <label>Auth pass: <input id="smtp_pass" type="password" style="width:100%"></label>
      <label>From: <input id="smtp_from" style="width:100%"></label>
      <div style="margin-top:0.6rem;display:flex;gap:0.6rem;align-items:center;">
        <button id="smtp_test" class="btn btn-sm">Test SMTP</button>
        <button id="smtp_save" class="btn btn-success btn-sm">Save SMTP</button>
        <div id="smtp_status" style="color:var(--text-muted)"></div>
      </div>
    </div>
  `;

  function jfetch(url, opts){ return fetch(url, opts).then(r=>r.json()); }

  function load(){ jfetch('/api/admin/config').then(cfg=>{
    const m = cfg.MAIL||{};
    document.getElementById('smtp_host').value = m.HOST||'';
    document.getElementById('smtp_port').value = m.PORT||'';
    document.getElementById('smtp_secure').checked = !!m.SECURE;
    document.getElementById('smtp_user').value = m.AUTH_USER||'';
    document.getElementById('smtp_from').value = m.FROM||'';
  }).catch(()=>{ document.getElementById('smtp_status').textContent='Could not load config'; }); }

  function test(){ const status = document.getElementById('smtp_status'); status.textContent='Testing…'; const mail = {
    HOST: document.getElementById('smtp_host').value||undefined,
    PORT: Number(document.getElementById('smtp_port').value)||undefined,
    SECURE: document.getElementById('smtp_secure').checked,
    AUTH_USER: document.getElementById('smtp_user').value||undefined,
    AUTH_PASS: document.getElementById('smtp_pass').value||undefined,
    FROM: document.getElementById('smtp_from').value||undefined
  };
  fetch('/api/admin/test-smtp',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ MAIL: mail }) }).then(r=>r.json()).then(resp=>{ if(resp&&resp.ok) status.textContent='SMTP OK.'; else status.textContent='SMTP failed: '+(resp&&resp.error||'unknown'); }).catch(()=>status.textContent='SMTP test error'); }

  function save(){ const status = document.getElementById('smtp_status'); status.textContent='Saving…'; const mail = {
    HOST: document.getElementById('smtp_host').value||undefined,
    PORT: Number(document.getElementById('smtp_port').value)||undefined,
    SECURE: document.getElementById('smtp_secure').checked,
    AUTH_USER: document.getElementById('smtp_user').value||undefined,
    AUTH_PASS: document.getElementById('smtp_pass').value||undefined,
    FROM: document.getElementById('smtp_from').value||undefined
  };
  fetch('/api/admin/config',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ MAIL: mail }) }).then(r=>r.json()).then(resp=>{ if(resp&&resp.ok) status.textContent='Saved.'; else status.textContent='Save failed: '+(resp&&resp.error||'unknown'); }).catch(()=>status.textContent='Save error'); }

  document.addEventListener('DOMContentLoaded', load);
  document.getElementById('smtp_test').addEventListener('click', test);
  document.getElementById('smtp_save').addEventListener('click', save);
})();
