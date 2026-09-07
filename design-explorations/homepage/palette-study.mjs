// The same approved markup, with review controls and colour tokens only.
export const palettes = [
  {
    id: 'clay', name: 'Paper & clay', short: 'Clay',
    note: 'Warm and approachable. The closest to the current direction, with a quiet paper background and a terracotta accent.',
    tokens: { paper:'#faf9f6', white:'#ffffff', ink:'#282923', muted:'#65665d', accent:'#a34e36', 'accent-dark':'#803b28', line:'#d9d9d1', soft:'#f0eee8', tint:'#f5ebe6', 'field-border':'#bbbcb2', placeholder:'#72746a', 'context-border':'#d9bbb0', 'context-hover':'#e9d1c7', selection:'#e8c8b9' },
  },
  {
    id: 'blue', name: 'Chalk & blue', short: 'Blue',
    note: 'Clear and editorial. A neutral chalk background, deep blue ink and a restrained blue accent give the questions a more contemporary feel.',
    tokens: { paper:'#f7f8fa', white:'#ffffff', ink:'#252c36', muted:'#606975', accent:'#315e7d', 'accent-dark':'#22455e', line:'#d7dce2', soft:'#eceff3', tint:'#e9f0f5', 'field-border':'#b4bec9', placeholder:'#6a7380', 'context-border':'#b6cbdc', 'context-hover':'#d8e5ee', selection:'#cfdfeb' },
  },
  {
    id: 'wine', name: 'Ivory & wine', short: 'Wine',
    note: 'Literary and considered. Pale ivory, dark plum ink and a muted wine accent bring a little more character to the same quiet layout.',
    tokens: { paper:'#faf8f7', white:'#ffffff', ink:'#30272d', muted:'#6c6269', accent:'#854158', 'accent-dark':'#663045', line:'#ded7da', soft:'#f0ebed', tint:'#f4e9ed', 'field-border':'#c0b4ba', placeholder:'#796d74', 'context-border':'#d5b8c4', 'context-hover':'#e9d5de', selection:'#e7cdd8' },
  },
];

export function renderPaletteStudy(html, title) {
  const toolbar = `<nav class="palette-toolbar" aria-label="Colour study controls">
    <a class="palette-back" href="life-and-world-v2.html" data-leave-study aria-label="Back to the original C refinement">← <span>Layout C</span></a>
    <span class="palette-study-label">Colour study</span>
    <fieldset class="palette-picker"><legend class="sr-only">Choose a colour palette</legend>${palettes.map((p, i) => `<label><input type="radio" name="palette" value="${p.id}" ${i === 0 ? 'checked' : ''}><span class="palette-dot" style="background:${p.tokens.accent}" aria-hidden="true"></span><span>${p.short}</span></label>`).join('')}</fieldset>
    <details class="palette-notes"><summary>Notes <span aria-hidden="true">⌄</span></summary><div class="palette-notes-panel"><p class="eyebrow">Palette notes</p><h2 data-palette-name>${palettes[0].name}</h2><p data-palette-note>${palettes[0].note}</p><dl class="palette-token-list">${[['paper','Background'],['ink','Text'],['accent','Accent'],['soft','Soft surface'],['line','Dividers']].map(([token,label]) => `<div><dt><span class="token-swatch" style="background:var(--${token})" aria-hidden="true"></span>${label}</dt><dd data-token-value="${token}">${palettes[0].tokens[token]}</dd></div>`).join('')}</dl><p class="sample-note">The layout, type and content stay the same. The accent is used for actions and small details.</p></div></details>
    <span class="sr-only" role="status" data-palette-status></span>
  </nav>`;
  const originalBar = /<nav class="study-bar[^\"]*"[^>]*>[\s\S]*?<\/nav>/;
  if (!originalBar.test(html)) throw new Error('Expected the prototype review navigation.');
  return html
    .replace(originalBar, toolbar)
    .replace(/<title>[^<]+<\/title>/, `<title>${title} — Philagora colour study</title>`)
    .replace('<body class="', '<body data-palette="clay" class="palette-study ')
    .replace('</head>', '<link rel="stylesheet" href="palette-study.css"><script src="palette-controls.js" defer></script></head>')
    .replace('</body>', `<script id="palette-data" type="application/json">${JSON.stringify(palettes)}</script></body>`);
}
