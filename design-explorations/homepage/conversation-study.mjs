// A self-contained interaction study built on the approved homepage.
// All responses are authored samples. Nothing connects to the live Agora.
const samples = {
  personal: {
    question: 'Why am I never satisfied? Even when something goes well, I’m already thinking about what’s missing.',
    subject: 'wanting more',
    people: [
      ['seneca', 'Seneca', 'On knowing what is enough'],
      ['nietzsche', 'Nietzsche', 'On choosing what to want'],
      ['camus', 'Camus', 'On living with incompleteness'],
    ],
    answers: [
      ['Give “enough” a meaning of your own.', 'If every achievement moves the threshold, examine the threshold. Which of your desires serves a life you value, and which merely keeps pace with other people?', 'Try describing a good ordinary day without mentioning status or possessions. A limit chosen thoughtfully can give ambition a purpose, rather than letting ambition set every limit.'],
      ['Ask whose ambition you are pursuing.', 'Seneca asks you to set a limit. I would first ask whether the thing you are reaching for is yours. Restlessness can reveal a borrowed ambition, but it can also reveal a possibility you have not yet dared to pursue.', 'Which work would still matter to you without recognition? Do not abandon that desire simply because it is demanding.'],
      ['Let the present count, even while you want more.', 'Both answers risk making today a preparation for a better version of yourself. You may never feel entirely settled. That need not make this afternoon a waiting room.', 'You can work towards something and still attend to what is here: a conversation, a walk, a task done with care. What has your search made difficult to notice?'],
    ],
    synthesis: ['Three different tests for your ambition.', 'Seneca asks you to define enough. Nietzsche asks whether your desires are your own. Camus asks what your pursuit costs the present. Their disagreement is whether dissatisfaction needs a boundary, a direction, or room to coexist with a worthwhile life.'],
    prompts: ['If I stop pushing myself, won’t I become complacent?', 'How do I tell my own ambitions from ones I have borrowed?'],
    followup: [
      ['A boundary does not end effort.', 'You fear that enough will become an excuse. Give it a concrete meaning: keep the work you respect, and stop using comparison as its measure. Discipline can serve a chosen commitment without continually raising the price of self-respect.'],
      ['Keep the effort. Question its master.', 'I agree that comparison is a poor master, but a comfortable boundary can also conceal fear. Try pursuing something difficult that brings no prestige. Your willingness to continue may tell you more than another achievement does.'],
      ['Try living without making it another test.', 'Both proposals ask you to examine yourself again. Leave some room for an activity that proves nothing. One unmeasured hour need not destroy your ambition; it may show whether your ambition has left space for a life.'],
    ],
    nextSynthesis: ['Effort can remain; the measure can change.', 'All three leave room for effort. Seneca would bound it, Nietzsche would test its purpose, and Camus would protect time outside it. A small experiment could help: keep one meaningful commitment this week, and notice what happens when you stop comparing its result.'],
  },
  world: {
    question: 'In a city with a limited heat-protection budget, is protecting the most vulnerable always fair?',
    subject: 'fairness and a city’s heat-protection budget',
    people: [
      ['marcus-aurelius', 'Marcus Aurelius', 'On public duty'],
      ['hannah-arendt', 'Hannah Arendt', 'On shared decisions'],
      ['russell', 'Bertrand Russell', 'On evidence and consequences'],
    ],
    answers: [
      ['Start with those who cannot protect themselves.', 'In this hypothetical city, equal spending would not necessarily mean equal protection. Public duty asks us to attend to people whose circumstances leave them most exposed.', 'Begin with urgent need, and explain the principle openly. That still leaves a difficult question: how should the city identify need without overlooking people who are less visible?'],
      ['People must have a voice in their protection.', 'Marcus identifies a duty, but the people called vulnerable must not become merely the objects of someone else’s plan. Who defines their needs, and who can challenge the decision?', 'Immediate protection and public participation need not wait for each other. The city could act on urgent needs while giving affected residents a continuing role in revising its priorities.'],
      ['Test the effect of the proposed protection.', 'A fair intention does not tell us which intervention will help. Compare the options, state what is uncertain, and check the results. A measure that sounds universal can still fail the people who most need it.', 'I would ask Marcus and Arendt to make their proposals testable: who can use the service, what harm might it prevent, and what evidence would make us change course?'],
    ],
    synthesis: ['Need, voice, and effect are different tests of fairness.', 'Marcus starts with unequal need. Arendt asks who has a say. Russell asks what the intervention achieves. A policy can pass one test and fail another. The unresolved choice is how to act urgently while keeping priorities open to challenge.'],
    prompts: ['What if residents vote against helping the most vulnerable first?', 'How can the city act quickly without excluding people from the decision?'],
    followup: [
      ['A majority does not erase a duty.', 'If a vote leaves people without basic protection, officials still have a responsibility to them. Set out a minimum duty of care, then invite public judgment about how to meet it. Explain both the protection and the tradeoff.'],
      ['Ask what kind of public decision produced that vote.', 'Participation is more than counting preferences. Were the people most affected heard? Could residents question the options? A vote may close a discussion too early. Protecting a minimum and continuing deliberation can belong to the same public process.'],
      ['Make the consequences visible before fixing the choice.', 'Ask residents to consider the likely effects of each option, including the uncertainty. Evidence cannot decide which values should win, but it can expose a disagreement based on mistaken expectations. Revisit the decision when the evidence changes.'],
    ],
    nextSynthesis: ['A minimum protection, with the choices still open.', 'Marcus would establish a duty that a vote cannot erase. Arendt would widen the process through which priorities are formed. Russell would make consequences available for scrutiny. They still differ on who should set the minimum and how it can be challenged.'],
  },
};

export function renderConversationStudy(home) {
  const review = `<div class="journey-review">
    <nav aria-label="Design review"><a href="typography-study.html">← Homepage study</a><strong>Ask → answers → follow-up</strong><span>Signed-in experience</span></nav>
    <details><summary>Prototype controls</summary><div class="journey-controls">
      <div><span class="control-label">Try an example</span><button type="button" data-example="personal">Personal dilemma</button><button type="button" data-example="world">Question about the world</button></div>
      <label>Waiting scenario<select id="wait-scenario"><option value="normal">Normal arrival</option><option value="slow">Taking longer</option><option value="failed">Interrupted after one answer</option><option value="rejected">Submission not accepted</option></select></label>
      <div><span class="control-label">Jump ahead</span><button type="button" data-review="answers">First answers</button><button type="button" data-review="followup">Completed follow-up</button></div>
      <p>Sample content and accelerated waiting. Controls apply to the next submission. Nothing is sent or saved; reloading clears the preview.</p>
    </div></details>
    <p class="prototype-notice">Interactive prototype · Fixed sample responses · Nothing sent or saved</p>
  </div>`;
  const thread = `<section id="conversation-screen" class="conversation-screen" hidden aria-labelledby="conversation-title">
    <div class="thread-topline"><button type="button" class="text-link" data-home>← Back to the Agora</button><span class="thread-visibility"></span></div>
    <header class="thread-heading"><p class="eyebrow">Your conversation in the Agora</p><h1 id="conversation-title" tabindex="-1"></h1><p class="thread-context" hidden>From <a href="typography-briefing.html">When a city overheats, who gets protected first? ↗</a></p><p class="thread-privacy"></p></header>
    <div class="thread-group"><div class="group-portraits" aria-hidden="true"></div><p><strong class="group-names"></strong><span>The same three thinkers throughout · AI interpretations</span></p></div>
    <aside class="fixed-content-note"><strong>Sample conversation</strong><p data-sample-note></p></aside>
    <nav class="round-nav" aria-label="Conversation rounds"><a href="#first-round">Your question</a><a href="#followup-round" data-followup-link hidden>Your follow-up</a><button type="button" data-resume>Continue waiting</button></nav>
    <section id="first-round" class="conversation-round" aria-labelledby="first-round-title"><div class="round-heading"><h2 id="first-round-title">First perspectives</h2><span data-round-count="initial">0 of 3 responses</span></div><div data-answers="initial"></div><section data-synthesis="initial" class="round-synthesis" hidden></section></section>
    <section id="followup-round" class="conversation-round" aria-labelledby="followup-title" hidden><div class="followup-question"><p class="eyebrow">You · Follow-up to the group</p><h2 id="followup-title" tabindex="-1"></h2><p class="followup-visibility"></p></div><div class="round-heading"><h3>The group responds</h3><span data-round-count="followup">0 of 3 responses</span></div><div data-answers="followup"></div><section data-synthesis="followup" class="round-synthesis" hidden></section></section>
    <section class="wait-panel" id="waiting" hidden aria-labelledby="waiting-title"><div class="wait-heading"><span class="status-dot" aria-hidden="true"></span><h2 id="waiting-title" tabindex="-1"></h2></div><p data-wait-copy></p><ul class="waiting-people"></ul><p class="wait-secondary">Responses appear here as they are ready.</p><div class="wait-actions"><button type="button" class="button-outline" data-retry hidden>Try again</button><button type="button" class="text-link" data-home>Browse the Agora while you wait →</button></div></section>
    <section id="followup-composer" class="followup-composer" hidden aria-labelledby="followup-heading"><p class="eyebrow">Keep the conversation going</p><h2 id="followup-heading">What would you like to explore further?</h2><p class="followup-intro">Add context, challenge an idea, or ask for something more concrete. All three will respond with this conversation in mind.</p><form id="followup-form" action="#followup-composer"><label for="followup-text">Your follow-up to the group</label><textarea id="followup-text" rows="3" minlength="10" maxlength="500" required placeholder="What feels unresolved?" aria-describedby="followup-privacy followup-limit followup-error"></textarea><p id="followup-privacy"></p><div class="followup-actions"><span id="followup-limit">One follow-up per conversation · <span data-followup-count>0</span>/500</span><button type="submit" class="button-primary" disabled>Ask the group →</button></div><p id="followup-error" class="form-error" role="alert" hidden></p></form><div class="followup-prompts" aria-label="Example follow-ups"></div></section>
    <section id="conversation-end" class="conversation-end" hidden><p class="eyebrow">A place to leave it</p><h2>You can return to these perspectives.</h2><p>This conversation includes one follow-up. If another question has emerged, you can begin a new conversation.</p><button type="button" class="button-outline" data-new>Ask another question →</button></section>
    <p class="conversation-footnote">Illustrative AI interpretations, not historical quotations.</p>
  </section>`;

  let result = home
    .replace(/<nav class="study-bar[^"]*"[^>]*>[\s\S]*?<\/nav>/, review)
    .replace('<script src="interactions.js" defer></script>', '<script src="conversation-state.js" defer></script><script src="conversation-controls.js" defer></script>')
    .replace(/<dialog class="question-dialog"[\s\S]*?<\/dialog>/, '')
    .replace('<body class="', '<body class="journey-study ')
    .replace('</head>', '<link rel="stylesheet" href="conversation-study.css"></head>')
    .replace(/<title>[^<]+<\/title>/, '<title>Ask, reflect, continue — Philagora explorations</title>')
    .replace('<main id="main" class="page-shell">', '<main id="main" class="page-shell"><div id="home-screen"><div class="resume-banner" hidden><span data-resume-copy></span><button type="button" class="text-link" data-resume>Return to your conversation →</button></div>')
    .replace('</main>', `</div>${thread}</main><p id="journey-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p><noscript><p class="no-script">This interactive study needs JavaScript. <a href="typography-exchange.html">Read the static sample conversation →</a></p></noscript>`)
    .replace('maxlength="600"', 'maxlength="500"')
    .replace('action="typography-exchange.html"', 'action="#ask"')
    .replace('<button class="button-primary" type="submit">', '<button class="button-primary" type="submit" disabled>')
    .replace('</form>', '<p class="question-limit"><span data-question-count>0</span>/500</p><p id="question-error" class="form-error" role="alert" hidden></p></form>')
    .replace('</body>', `<script type="application/json" id="conversation-samples">${JSON.stringify(samples).replace(/</g, '\\u003c')}</script></body>`);
  if (!result.includes('id="home-screen"')) throw new Error('Expected the typography homepage shell.');
  return result;
}
