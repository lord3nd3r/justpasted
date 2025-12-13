// Simple include loader: fetch all elements with data-include and insert HTML,
// then load app script.
(function(){
  async function loadIncludes() {
    const nodes = Array.from(document.querySelectorAll('[data-include]'));
    await Promise.all(nodes.map(async n => {
      const url = n.getAttribute('data-include');
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const text = await res.text();
        n.innerHTML = text;
      } catch (e) {
        console.error('Include load error for', url, e);
        n.innerHTML = '<div style="color:var(--danger);">Error loading ' + url + '</div>';
      }
    }));
  }

  // load includes and then dynamically add app.js
  (async function() {
    await loadIncludes();
    const s = document.createElement('script');
    s.src = '/js/app.js';
    s.defer = true;
    document.body.appendChild(s);
  })();
})();
