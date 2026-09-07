// Local interaction demo. No API calls, storage, authentication, or generation.
(() => {
  const samples = JSON.parse(document.querySelector('#conversation-samples').textContent);
  const { create, transition } = globalThis.PhilagoraConversation;
  const find = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const home = find('#home-screen');
  const screen = find('#conversation-screen');
  const form = find('.question-form');
  const question = find('#question');
  const followupForm = find('#followup-form');
  const followup = find('#followup-text');
  const scenario = find('#wait-scenario');
  const context = find('.issue-context');
  let current = null;
  let timer = null;
  let generation = 0;
  let issue = '';
  let renderedSample = '';
  let renderedQuestion = '';
  const signatures = {};

  const announce = (message) => { find('#journey-announcement').textContent = message; };
  const error = (selector, message = '') => {
    const element = find(selector);
    element.textContent = message;
    element.hidden = !message;
  };
  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function portrait(id) {
    const img = el('img');
    img.src = `assets/avatars/${id}.webp`;
    img.alt = '';
    img.width = 28;
    img.height = 28;
    return img;
  }
  function author(person) {
    const result = el('div', 'person');
    const info = el('div');
    info.append(el('span', 'person-name', person[1]), el('span', 'person-note', person[2]));
    result.append(portrait(person[0]), info);
    return result;
  }
  function clearTimer() {
    generation += 1;
    window.clearTimeout(timer);
    timer = null;
  }
  function updateInput(input, counter) {
    input.setCustomValidity('');
    input.style.height = 'auto';
    input.style.height = `${Math.min(240, Math.max(96, input.scrollHeight))}px`;
    find(counter).textContent = input.value.length;
  }
  function setIssue(value, shouldAnnounce = false) {
    issue = value === 'city-heat' ? value : '';
    context.hidden = !issue;
    form.dataset.issue = issue;
    question.placeholder = issue ? 'What would you ask about this issue?' : 'What are you trying to make sense of?';
    question.setAttribute('aria-describedby', issue ? 'privacy-note issue-context question-error' : 'privacy-note question-error');
    all('[data-composer-suggestion]').forEach((button, index) => {
      const prompts = issue ? [samples.world.question, 'How should people have a say in protecting their city from heat?'] : [samples.personal.question, samples.world.question];
      button.dataset.prompt = prompts[index];
      button.textContent = index === 0 ? (issue ? 'Is protecting the most vulnerable always fair?' : 'Why am I never satisfied?') : (issue ? prompts[index] : 'Who should a city protect first?');
    });
    if (shouldAnnounce) announce(issue ? 'The city heat briefing is attached.' : 'Issue removed. Your draft is unchanged.');
  }
  function visibilityCopy() {
    const isPrivate = form.querySelector('input[name="visibility"]:checked').value === 'private';
    find('#privacy-note').textContent = isPrivate
      ? 'Only you can read this conversation and its follow-up.'
      : 'Your question, responses, and follow-up will be public. Your name won’t be shown.';
  }
  function showHome(focusQuestion = false) {
    home.hidden = false;
    screen.hidden = true;
    document.body.classList.remove('viewing-conversation');
    if (focusQuestion) {
      question.focus({ preventScroll: true });
      find('#ask').scrollIntoView({ block: 'center' });
    } else {
      const heading = home.querySelector('h1');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      find('#main').scrollIntoView({ block: 'start' });
    }
  }
  function showThread(focusTarget = '#conversation-title') {
    home.hidden = true;
    screen.hidden = false;
    document.body.classList.add('viewing-conversation');
    const target = find(focusTarget);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  }
  function takeScenario() {
    const value = scenario.value;
    scenario.value = 'normal';
    return value;
  }
  function renderAnswers(phase, count, complete) {
    const signature = `${current.sample}:${count}:${complete}`;
    if (signatures[phase] === signature) return;
    const previousSample = signatures[phase]?.split(':')[0];
    signatures[phase] = signature;
    const sample = samples[current.sample];
    const container = find(`[data-answers="${phase}"]`);
    if (previousSample !== current.sample || container.children.length > count) container.replaceChildren();
    // Append new responses without replacing text the reader may be selecting.
    const startIndex = container.children.length;
    (phase === 'initial' ? sample.answers : sample.followup).slice(startIndex, count).forEach((answer, offset) => {
      const index = startIndex + offset;
      const article = el('article', 'thread-answer');
      article.append(author(sample.people[index]), el('h3', '', answer[0]));
      answer.slice(1).forEach((paragraph) => article.append(el('p', '', paragraph)));
      container.append(article);
    });
    find(`[data-round-count="${phase}"]`).textContent = `${count} of 3 responses`;
    const synthesis = find(`[data-synthesis="${phase}"]`);
    synthesis.hidden = !complete;
    if (complete) {
      const content = phase === 'initial' ? sample.synthesis : sample.nextSynthesis;
      synthesis.replaceChildren(el('p', 'eyebrow', phase === 'initial' ? 'Where they differ' : 'What the follow-up brings into focus'), el('h3', '', content[0]), el('p', '', content[1]));
    }
  }
  function render() {
    if (!current) return;
    const sample = samples[current.sample];
    const isFollowup = current.phase === 'followup';
    const isReady = current.status === 'ready';
    const isPrivate = current.visibility === 'private';
    find('#conversation-title').textContent = current.question;
    find('.thread-visibility').textContent = isPrivate ? 'Private · Just for you' : 'Public · Anonymous';
    find('.thread-privacy').textContent = isPrivate ? 'Only you can read this conversation and its follow-up.' : 'Anyone can read this conversation and its follow-up. Your name is not shown.';
    find('.thread-context').hidden = !current.issue;
    find('[data-sample-note]').textContent = `These are fixed examples about ${sample.subject}. They do not change to answer the text you enter.`;
    if (renderedSample !== current.sample) {
      renderedSample = current.sample;
      find('.group-portraits').replaceChildren(...sample.people.map((person) => portrait(person[0])));
      find('.group-names').textContent = sample.people.map((person) => person[1]).join(' · ');
      const prompts = sample.prompts.map((prompt) => {
        const button = el('button', '', prompt);
        button.type = 'button';
        button.addEventListener('click', () => {
          followup.value = prompt;
          updateInput(followup, '[data-followup-count]');
          error('#followup-error');
          followup.focus({ preventScroll: true });
        });
        return button;
      });
      find('.followup-prompts').replaceChildren(...prompts);
    }
    renderAnswers('initial', isFollowup ? 3 : current.count, isFollowup || isReady);
    find('#followup-round').hidden = !isFollowup;
    find('[data-followup-link]').hidden = !isFollowup;
    if (isFollowup) {
      if (renderedQuestion !== current.followup) {
        renderedQuestion = current.followup;
        find('#followup-title').textContent = current.followup;
      }
      find('.followup-visibility').textContent = `${isPrivate ? 'Private, like your original question.' : 'Public, like your original question.'} Sample replies illustrate: “${sample.prompts[0]}”`;
      renderAnswers('followup', current.count, isReady);
    }
    find('#followup-composer').hidden = !(isReady && !isFollowup);
    find('#followup-privacy').textContent = isPrivate ? 'This follow-up stays private, with the same three thinkers.' : 'This follow-up will be public too. Your name stays hidden; avoid details you don’t want to share.';
    find('#conversation-end').hidden = !current.complete;
    const waiting = find('#waiting');
    waiting.hidden = isReady;
    waiting.dataset.status = current.status;
    find('.round-nav [data-resume]').hidden = isReady;
    if (!isReady) {
      const failed = current.status === 'failed';
      const slow = current.status === 'slow';
      const done = current.count === 3;
      find('#waiting-title').textContent = failed ? 'The conversation was interrupted.' : slow ? 'This is taking a little longer.' : done ? 'Bringing the perspectives together…' : isFollowup ? 'The group is considering your follow-up.' : 'Your question is with the group.';
      find('[data-wait-copy]').textContent = failed ? 'The responses already here are still available. Try again to continue the remaining responses.' : slow ? 'Your question is still here. There’s no need to send it again.' : done ? 'All three responses are here. Next comes a short synthesis of their differences.' : isFollowup ? 'The same three thinkers will respond to your new question in the context of the first round.' : 'Three perspectives, then a synthesis of where they agree and differ.';
      const people = sample.people.map((person, index) => {
        const li = el('li');
        li.append(el('span', '', person[1]), el('span', '', index < current.count ? 'Response ready' : failed ? 'Interrupted' : slow ? 'Still waiting' : 'Preparing a response'));
        return li;
      });
      find('.waiting-people').replaceChildren(...people);
      const retry = find('[data-retry]');
      retry.hidden = !failed && !slow;
      retry.textContent = slow ? 'Keep waiting' : 'Try again';
    }
    find('.resume-banner').hidden = false;
    find('[data-resume-copy]').textContent = isReady ? (isFollowup ? 'Your follow-up is ready.' : 'Your three perspectives are ready.') : current.status === 'failed' ? 'Your conversation needs attention.' : 'Your conversation is in progress.';
  }
  function advance(action) {
    const next = transition(current, action);
    if (next === current) return;
    current = next;
    render();
    if (action.type === 'answer') announce(`${samples[current.sample].people[current.count - 1][1]}’s response is ready. ${current.count} of 3 responses.`);
    else if (action.type === 'ready') announce(current.phase === 'initial' ? 'All three responses and the synthesis are ready. You can now follow up with the group.' : 'The group’s follow-up responses and synthesis are ready.');
    else if (action.type === 'slow' || action.type === 'failed') announce(find('#waiting-title').textContent);
  }
  function play(mode = 'normal') {
    clearTimer();
    const run = generation;
    const step = () => {
      if (run !== generation || !current || current.status !== 'waiting') return;
      if (mode === 'slow') { advance({ type: 'slow' }); return; }
      if (mode === 'failed' && current.count >= 1) { advance({ type: 'failed' }); return; }
      if (current.count < 3) {
        advance({ type: 'answer' });
        timer = window.setTimeout(step, 1800);
      } else advance({ type: 'ready' });
    };
    timer = window.setTimeout(step, 2000);
  }
  function start(value, mode = 'normal') {
    clearTimer();
    current = create({ question: value, visibility: form.querySelector('input[name="visibility"]:checked').value, sample: issue ? 'world' : 'personal', issue });
    signatures.initial = '';
    signatures.followup = '';
    renderedQuestion = '';
    followup.value = '';
    updateInput(followup, '[data-followup-count]');
    error('#followup-error');
    render();
    showThread('#waiting-title');
    announce('Question received in the preview. Waiting for three sample responses.');
    play(mode);
  }
  function validate(input, selector) {
    const value = input.value.trim();
    if (value.length < 10 || value.length > 500) {
      error(selector, 'Please write between 10 and 500 characters.');
      input.focus();
      return null;
    }
    error(selector);
    return value;
  }
  function finishRound() {
    if (current.status === 'failed' || current.status === 'slow') current = transition(current, { type: 'retry' });
    while (current.count < 3) current = transition(current, { type: 'answer' });
    current = transition(current, { type: 'ready' });
    render();
  }

  form.noValidate = true;
  followupForm.noValidate = true;
  form.querySelector('[type="submit"]').disabled = false;
  followupForm.querySelector('[type="submit"]').disabled = false;
  question.addEventListener('input', () => { updateInput(question, '[data-question-count]'); error('#question-error'); });
  followup.addEventListener('input', () => { updateInput(followup, '[data-followup-count]'); error('#followup-error'); });
  all('input[name="visibility"]').forEach((input) => input.addEventListener('change', visibilityCopy));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = validate(question, '#question-error');
    if (!value) return;
    const mode = takeScenario();
    if (mode === 'rejected') {
      error('#question-error', 'Your question couldn’t be submitted. Your draft and privacy choice are still here. Please try again.');
      question.focus();
      return;
    }
    start(value, mode);
  });
  followupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!current || current.phase !== 'initial' || current.status !== 'ready') return;
    const value = validate(followup, '#followup-error');
    if (!value) return;
    const mode = takeScenario();
    if (mode === 'rejected') {
      error('#followup-error', 'Your follow-up couldn’t be submitted. Your draft is still here. Please try again.');
      followup.focus();
      return;
    }
    current = transition(current, { type: 'followup', question: value });
    render();
    showThread('#followup-title');
    announce('Your follow-up is with the whole group.');
    play(mode);
  });
  find('[data-retry]').addEventListener('click', () => {
    if (!current) return;
    current = transition(current, { type: 'retry' });
    render();
    find('#waiting-title').focus({ preventScroll: true });
    announce('Continuing the remaining responses.');
    play();
  });
  all('[data-home]').forEach((button) => button.addEventListener('click', () => showHome()));
  all('[data-resume]').forEach((button) => button.addEventListener('click', () => {
    if (current) showThread(current.status === 'ready' ? (current.phase === 'initial' ? '#conversation-title' : '#followup-title') : '#waiting-title');
  }));
  find('[data-new]').addEventListener('click', () => {
    clearTimer();
    current = null;
    find('.resume-banner').hidden = true;
    question.value = '';
    setIssue('');
    updateInput(question, '[data-question-count]');
    showHome(true);
  });
  all('[data-example]').forEach((button) => button.addEventListener('click', () => {
    setIssue(button.dataset.example === 'world' ? 'city-heat' : '');
    question.value = samples[button.dataset.example].question;
    updateInput(question, '[data-question-count]');
    error('#question-error');
    showHome(true);
  }));
  all('[data-review]').forEach((button) => button.addEventListener('click', () => {
    if (!current) start(samples[issue ? 'world' : 'personal'].question);
    clearTimer();
    finishRound();
    if (button.dataset.review === 'followup' && current.phase === 'initial') {
      current = transition(current, { type: 'followup', question: samples[current.sample].prompts[0] });
      finishRound();
    }
    showThread(button.dataset.review === 'followup' ? '#followup-title' : '#conversation-title');
    announce('Showing the sample conversation.');
  }));
  all('[data-prompt]').forEach((button) => button.addEventListener('click', () => {
    const prompt = button.dataset.prompt;
    if (!button.hasAttribute('data-composer-suggestion')) setIssue('');
    if (prompt === samples.world.question) setIssue('city-heat');
    question.value = prompt;
    updateInput(question, '[data-question-count]');
    error('#question-error');
    showHome(true);
  }));
  all('[data-attach-issue]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    setIssue('city-heat', true);
    showHome(true);
  }));
  find('[data-remove-issue]').addEventListener('click', () => { setIssue('', true); question.focus(); });
  all('.site-header a[href^="#"]').forEach((link) => link.addEventListener('click', () => {
    showHome(link.hash === '#ask');
    find('.mobile-menu').open = false;
  }));
  const requestedIssue = new URLSearchParams(window.location.search).get('issue');
  setIssue(requestedIssue);
  visibilityCopy();
  // Cancel scheduled demo work when the document actually leaves.
  window.addEventListener('pagehide', clearTimer);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && current?.status === 'waiting') play();
  });
})();
