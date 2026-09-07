// Typography and spacing refinements on the selected Paper & clay design.
// The earlier markup remains available for a direct before/after comparison.
export function renderTypographyStudy(html, kind = 'home') {
  const destinations = {
    'ask-first': 'typography-study',
    'life-and-world-v2': 'typography-study',
    'world-briefing-v2': 'typography-briefing',
    exchange: 'typography-exchange',
  };
  const views = {
    home: { before: 'life-and-world-v2.html', after: 'typography-study.html', title: 'C · Paper & clay · Type & spacing' },
    briefing: { before: 'world-briefing-v2.html', after: 'typography-briefing.html', title: 'An issue in focus · Type & spacing' },
    exchange: { before: 'exchange.html', after: 'typography-exchange.html', title: 'A conversation · Type & spacing' },
  };
  const view = views[kind];
  if (!view) throw new Error(`Unknown typography view: ${kind}`);
  const reviewBar = `<nav class="study-bar type-review-bar" aria-label="Typography comparison"><a class="study-home" href="index.html" aria-label="All explorations"><span aria-hidden="true">←</span> <span>All explorations</span></a><div class="study-options"><a href="${view.before}">Before</a><a href="${view.after}" aria-current="page">Type & spacing</a><a href="conversation-study.html">Conversation flow →</a></div><span class="study-caption">Paper & clay</span></nav>`;
  const originalBar = /<nav class="study-bar[^\"]*"[^>]*>[\s\S]*?<\/nav>/;
  if (!originalBar.test(html)) throw new Error('Expected the review navigation.');

  let result = html
    .replace(/(href|action)="(ask-first|life-and-world-v2|world-briefing-v2|exchange)\.html([^\"]*)"/g, (_, attr, page, suffix) => `${attr}="${destinations[page]}.html${suffix}"`)
    .replace(originalBar, reviewBar)
    .replace(/<title>[^<]+<\/title>/, `<title>${view.title} — Philagora explorations</title>`)
    .replace('<body class="', `<body class="type-refinement type-${kind} `)
    .replace('</head>', '<link rel="stylesheet" href="typography-study.css"></head>')
    .replace('<span>Three perspectives on your question</span>', '');

  if (kind === 'home') {
    const originalIntro = '<p class="hero-intro">About your life. About the world we share.<br>Find a different way to think it through.</p><p class="ai-note">With AI interpretations of historical philosophers.</p>';
    if (!result.includes(originalIntro)) throw new Error('Expected the current C introduction.');
    result = result.replace(originalIntro, '<p class="hero-intro">Ask about your life or the world.</p><p class="ai-note">Three AI interpretations of historical thinkers.</p>');
  }
  return result;
}
