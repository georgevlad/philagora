// C, refined. Kept separate so the original three designs remain comparable.
export function renderIterationTwo({ documentPage, feature, questionRows, feedAndDebate, person, right, arrow, lock }) {
  const issueTitle = 'When a city overheats, who gets protected first?';
  const issuePrompts = ['Who should decide how the budget is spent?', 'Is protecting the most vulnerable always fair?'];
  const generalPrompts = ['Is it okay to want a small life?', 'Do I owe the world my attention?'];

  function composer({ attached = false } = {}) {
    return `<section class="composer-section" id="ask" aria-label="Ask the philosophers">
      <form class="question-form" action="${attached ? 'world-briefing-v2.html#responses' : 'exchange.html'}" data-contextual data-issue="${attached ? 'city-heat' : ''}">
        <div class="issue-context" id="issue-context" ${attached ? '' : 'hidden'}>
          <div><span class="context-label">Asking about</span><span data-issue-title>${issueTitle}</span></div>
          <button type="button" data-remove-issue aria-label="Remove issue context">×</button>
        </div>
        <label class="sr-only" for="question">Your question for the philosophers</label>
        <textarea id="question" placeholder="${attached ? 'What would you ask about this issue?' : 'What are you trying to make sense of?'}" minlength="10" maxlength="600" required rows="2" aria-describedby="privacy-note${attached ? ' issue-context' : ''}"></textarea>
        <div class="composer-actions"><fieldset class="privacy-choice"><legend class="sr-only">Question visibility</legend><label><input type="radio" name="visibility" value="private" checked>${lock} Private</label><label><input type="radio" name="visibility" value="public"><span aria-hidden="true">◎</span> Public</label></fieldset><button class="button-primary" type="submit">Ask the philosophers ${right}</button></div>
      </form>
      <div class="composer-footnote"><p class="privacy-note" id="privacy-note">${lock} A conversation just for you.</p><span>Three perspectives on your question</span></div>
      <div class="suggestions" aria-label="Suggested questions"><span>${attached ? 'Explore this issue' : 'Try a question'}</span>${(attached ? issuePrompts : generalPrompts).map(prompt => `<button type="button" data-prompt="${prompt}" data-composer-suggestion>${prompt}</button>`).join('')}</div>
      <p class="sr-only" data-context-status role="status"></p>
    </section>`;
  }

  function worldCard() {
    return `<section class="revision-world" id="world" aria-labelledby="world-heading">
      <div class="section-heading"><h2 id="world-heading">The questions we share</h2><span class="section-aside">An issue in focus</span></div>
      <p class="eyebrow">Climate & public life <span class="sample-badge">Sample issue</span></p>
      <h3>${issueTitle}</h3>
      <p class="world-description">A city has a limited budget to protect people from extreme heat. Whose needs should come first?</p>
      <div class="issue-path" aria-label="Inside this issue"><span>The situation</span><span aria-hidden="true">→</span><span>Possible responses</span><span aria-hidden="true">→</span><span>Your question</span></div>
      <div class="issue-byline"><div class="avatar-group" aria-hidden="true"><img src="assets/avatars/marcus-aurelius.webp" width="28" height="28" alt=""><img src="assets/avatars/hannah-arendt.webp" width="28" height="28" alt=""><img src="assets/avatars/russell.webp" width="28" height="28" alt=""></div><p>Marcus Aurelius, Hannah Arendt<br>and Bertrand Russell</p></div>
      <div class="source-line"><span>Background reading</span><a href="https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health" target="_blank" rel="noreferrer">WHO ${arrow}</a><a href="https://www.ipcc.ch/report/ar6/syr/" target="_blank" rel="noreferrer">IPCC ${arrow}</a></div>
      <div class="issue-actions"><a class="button-outline" href="world-briefing-v2.html">Explore the issue ${right}</a><a class="text-link" href="life-and-world-v2.html?issue=city-heat#ask" data-attach-issue="city-heat">Ask about this ${arrow}</a></div>
    </section>`;
  }

  const home = documentPage({
    title: 'C · Life & the world · Iteration two', active: 'life-and-world-v2', bodyClass: 'layout-c refined-home', stylesheet: 'refinement.css', contextual: true,
    main: `<main id="main" class="page-shell">
      <section class="shared-hero refined-hero"><div><p class="eyebrow">Welcome to the Agora</p><h1>What’s on<br class="desktop-break"> your mind?</h1><p class="hero-intro">About your life. About the world we share.<br>Find a different way to think it through.</p><p class="ai-note">With AI interpretations of historical philosophers.</p></div>${composer()}</section>
      <div class="revision-grid">
        <section class="life-column revision-personal" id="agora" aria-labelledby="personal-heading"><div class="section-heading"><h2 id="personal-heading">The questions we live with</h2><span class="section-aside">Personal dilemmas</span></div>${feature()}</section>
        ${worldCard()}
      </div>
      <section class="revision-recent" aria-labelledby="recent-heading"><div class="section-heading"><h2 id="recent-heading">More conversations in the Agora</h2><span class="section-aside">Something on your mind?</span></div>${questionRows()}</section>
      ${feedAndDebate()}
    </main>`,
  });

  const proposals = [
    { id: 'marcus-aurelius', name: 'Marcus Aurelius', title: 'Begin with those most exposed.', text: 'Prioritise immediate protection for people least able to escape the heat. Treat public service as a duty that starts with the needs directly before you.', test: 'Does concentrating on the urgent leave the city unprepared for the next summer?' },
    { id: 'hannah-arendt', name: 'Hannah Arendt', title: 'Make protection a public responsibility.', text: 'Give affected residents and workers a real role in deciding how the city responds. Build shared institutions that can be held accountable.', test: 'How can deliberation make room for people without delaying immediate help?' },
    { id: 'russell', name: 'Bertrand Russell', title: 'Ask which measures will actually work.', text: 'Compare the likely effects of each intervention, publish the assumptions, and revise the response when evidence changes.', test: 'Which needs could disappear from view because they are difficult to measure?' },
  ];

  const briefing = documentPage({
    title: 'An issue in focus · Iteration two', active: 'world-briefing-v2', detail: true, home: 'life-and-world-v2.html', bodyClass: 'detail-page refined-briefing', stylesheet: 'refinement.css', contextual: true,
    main: `<main id="main" class="reading-shell briefing-shell">
      <a class="back-link" href="life-and-world-v2.html#world">← Back to the world</a>
      <p class="eyebrow">Climate & public life <span class="sample-badge">Illustrative briefing</span></p>
      <h1>${issueTitle}</h1><p class="reading-deck">A shared problem. A limited budget. Different ideas of what we owe each other.</p>
      <p class="briefing-disclosure">This is a hypothetical city, used to explore the proposed format. The sources below provide background, not reporting on a specific event.</p>
      <nav class="reading-nav" aria-label="Briefing sections"><a href="#situation">The situation</a><a href="#responses">Possible responses</a><a href="#sources">Sources</a><a href="#ask">Your question ${right}</a></nav>
      <section id="situation"><p class="eyebrow">01 / The situation</p><h2>The heat is shared. The exposure is not.</h2>
        <p>Age, health, working conditions and access to cooling affect vulnerability to heat. Outdoor workers and people in poor-quality housing can face particular exposure. <a class="source-ref" href="https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health" target="_blank" rel="noreferrer">WHO: Heat and health ${arrow}</a></p>
        <p>Now imagine a city with a limited adaptation budget. It could open cooling spaces immediately, protect people working outdoors, or improve housing for future summers. How should it decide?</p>
        <div class="briefing-facts"><div><h3>What the evidence addresses</h3><p>Heat exposure, unequal vulnerability and measures that can reduce risk.</p></div><div><h3>What we would need locally</h3><p>Neighbourhood temperatures, housing conditions, costs, service access and residents’ priorities.</p></div><div><h3>The value judgment</h3><p>How to balance urgent need, long-term protection and a fair voice in the decision.</p></div></div>
      </section>
      <section id="responses"><p class="eyebrow">02 / Possible responses</p><h2>Three proposals. Three tests.</h2><p class="sample-note">Illustrative proposals inspired by the thinkers; not historical quotations or expert policy recommendations.</p>${proposals.map(p => `<article class="proposal">${person(p.id, p.name)}<h3>${p.title}</h3><p>${p.text}</p><p><strong>The test:</strong> ${p.test}</p></article>`).join('')}</section>
      <section class="synthesis"><p class="eyebrow">03 / The unresolved choice</p><h2>Who sets the priorities—and what counts as success?</h2><p>Urgency, participation and evidence can support each other. A limited budget still forces choices between them. The disagreement is a starting point for public judgment.</p></section>
      <section class="issue-followup" aria-labelledby="followup-heading"><p class="eyebrow">Your turn in the Agora</p><h2 id="followup-heading">What would you ask about this?</h2><p class="followup-intro">Challenge a proposal, bring in your own experience, or follow a different question. This issue stays attached for context.</p>${composer({attached:true})}</section>
      <section id="sources" class="sources"><p class="eyebrow">Background reading</p><a href="https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health" target="_blank" rel="noreferrer"><span><strong>World Health Organization</strong><span>Heat and health · Exposure, vulnerability and prevention</span></span>${arrow}</a><a href="https://www.ipcc.ch/report/ar6/syr/" target="_blank" rel="noreferrer"><span><strong>Intergovernmental Panel on Climate Change</strong><span>AR6 Synthesis Report · Climate impacts and adaptation</span></span>${arrow}</a><p class="sample-note">A published edition would also need dated, local reporting and primary evidence tied to each factual claim.</p></section>
    </main>`,
  });

  const showcase = `<section class="latest-iteration" aria-labelledby="latest-heading"><div><p class="eyebrow">Current direction / C</p><h2 id="latest-heading">From a question to a conversation.</h2><p>The Paper & clay homepage now leads into a complete interaction study: ask, wait for perspectives, and follow up with the same group.</p><div class="latest-actions"><a class="button-primary" href="conversation-study.html">Try the conversation flow ${right}</a><a class="text-link" href="typography-study.html">Typography & spacing ${arrow}</a><a class="text-link" href="palette-study.html">Compare colour palettes ${arrow}</a></div></div><ol class="mobile-sequence" aria-label="The conversation journey"><li><span>01</span> Ask a question</li><li><span>02</span> Wait for the group</li><li><span>03</span> Read their perspectives</li><li><span>04</span> Continue with everyone</li></ol></section><h2 class="original-options-heading">The original explorations</h2>`;
  return { home, briefing, showcase };
}
