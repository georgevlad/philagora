(() => {
  const data = document.querySelector('#palette-data');
  if (!data) return;
  const palettes = JSON.parse(data.textContent);
  const choices = document.querySelectorAll('input[name="palette"]');
  const pageMap = {
    'ask-first.html': 'palette-study.html',
    'life-and-world-v2.html': 'palette-study.html',
    'world-briefing-v2.html': 'palette-briefing.html',
    'exchange.html': 'palette-exchange.html',
    'palette-study.html': 'palette-study.html',
    'palette-briefing.html': 'palette-briefing.html',
    'palette-exchange.html': 'palette-exchange.html',
  };
  let selected = palettes[0];

  function updateLink(link) {
    const raw = link.getAttribute('href');
    if (!raw || raw.startsWith('#') || link.hasAttribute('data-leave-study')) return;
    const url = new URL(raw, document.baseURI);
    if (url.origin !== window.location.origin) return;
    const target = pageMap[url.pathname.split('/').pop()];
    if (!target) return;
    url.searchParams.set('palette', selected.id);
    link.setAttribute('href', `${target}${url.search}${url.hash}`);
  }

  function applyPalette(id, announce = true) {
    selected = palettes.find(p => p.id === id) || palettes[0];
    document.body.dataset.palette = selected.id;
    for (const [name, value] of Object.entries(selected.tokens)) {
      document.body.style.setProperty(`--${name}`, value);
    }
    choices.forEach(input => { input.checked = input.value === selected.id; });
    document.querySelector('[data-palette-name]').textContent = selected.name;
    document.querySelector('[data-palette-note]').textContent = selected.note;
    document.querySelectorAll('[data-token-value]').forEach(element => {
      element.textContent = selected.tokens[element.dataset.tokenValue].toUpperCase();
    });
    document.querySelector('meta[name="theme-color"]').content = selected.tokens.paper;
    if (announce) document.querySelector('[data-palette-status]').textContent = `${selected.name} palette applied.`;
    document.querySelectorAll('a[href]').forEach(updateLink);
    // A fixed palette identifier is shareable; drafts never enter the URL.
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const url = new URL(window.location.href);
      url.searchParams.set('palette', selected.id);
      window.history.replaceState(null, '', url);
    }
  }

  applyPalette(new URLSearchParams(window.location.search).get('palette'), false);
  choices.forEach(input => input.addEventListener('change', () => applyPalette(input.value)));
  // Also cover sample links that the question preview changes after submission.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (link) updateLink(link);
  }, true);
})();
