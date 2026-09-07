// Deliberately local: no fetch, storage, analytics, or generation calls.
(() => {
  // Keep a sample-detail visit attached to the layout it came from.
  // Only these known local filenames can become a return destination.
  const layouts = ['ask-first', 'featured-question', 'life-and-world', 'life-and-world-v2'];
  const activeLink = document.querySelector('.study-options a[aria-current]');
  const activeLayout = activeLink?.getAttribute('href').replace('.html', '');
  const returnLayout = new URLSearchParams(window.location.search).get('from')
    || (document.body.classList.contains('refined-briefing') ? 'life-and-world-v2' : null);
  if (layouts.includes(activeLayout)) {
    document.querySelectorAll('a[href^="exchange.html"], a[href^="world-briefing.html"], a[href^="world-briefing-v2.html"]').forEach((link) => {
      const destination = new URL(link.getAttribute('href'), document.baseURI);
      link.href = `${destination.pathname.split('/').pop()}?from=${activeLayout}${destination.hash}`;
    });
  } else if (layouts.includes(returnLayout)) {
    document.querySelectorAll('a[href^="ask-first.html"]').forEach((link) => {
      const destination = new URL(link.getAttribute('href'), document.baseURI);
      link.href = `${returnLayout}.html${destination.hash}`;
    });
    document.querySelectorAll('a[href^="exchange.html"]').forEach((link) => {
      const destination = new URL(link.getAttribute('href'), document.baseURI);
      link.href = `exchange.html?from=${returnLayout}${destination.hash}`;
    });
  }

  const form = document.querySelector('.question-form');
  const question = document.querySelector('#question');
  const dialog = document.querySelector('.question-dialog');
  if (!form || !question || !dialog) return;

  const resizeQuestion = () => {
    question.style.height = 'auto';
    question.style.height = `${Math.min(question.scrollHeight, 210)}px`;
    question.setCustomValidity('');
  };

  const context = form.querySelector('.issue-context');
  const issueTitle = 'When a city overheats, who gets protected first?';
  const generalPrompts = ['Is it okay to want a small life?', 'Do I owe the world my attention?'];
  const issuePrompts = ['Who should decide how the budget is spent?', 'Is protecting the most vulnerable always fair?'];
  const sampleLink = dialog.querySelector('.dialog-actions a');
  const defaultSampleHref = sampleLink.getAttribute('href');
  const defaultSampleLabel = sampleLink.innerHTML;

  function setIssue(key, announce = true) {
    if (!context) return;
    const attached = key === 'city-heat';
    form.dataset.issue = attached ? key : '';
    context.hidden = !attached;
    question.placeholder = attached ? 'What would you ask about this issue?' : 'What are you trying to make sense of?';
    question.setAttribute('aria-describedby', attached ? 'privacy-note issue-context' : 'privacy-note');
    document.querySelectorAll('[data-composer-suggestion]').forEach((button, index) => {
      const prompt = (attached ? issuePrompts : generalPrompts)[index];
      button.dataset.prompt = prompt;
      button.textContent = prompt;
    });
    document.querySelector('.suggestions>span').textContent = attached ? 'Explore this issue' : 'Try a question';
    if (announce) {
      document.querySelector('[data-context-status]').textContent = attached
        ? `Issue attached: ${issueTitle}. Your draft and visibility choice are unchanged.`
        : 'Issue removed. You can ask about anything.';
    }
    resizeQuestion();
  }

  if (context) {
    const requestedIssue = new URLSearchParams(window.location.search).get('issue');
    setIssue(requestedIssue === 'city-heat' ? requestedIssue : form.dataset.issue, false);
    document.querySelectorAll('[data-attach-issue]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (link.dataset.attachIssue !== 'city-heat') return;
        event.preventDefault();
        setIssue(link.dataset.attachIssue);
        question.focus({ preventScroll: true });
        document.querySelector('#ask').scrollIntoView({ behavior: 'instant', block: 'center' });
      });
    });
    context.querySelector('[data-remove-issue]').addEventListener('click', () => {
      setIssue('');
      question.focus({ preventScroll: true });
    });
  }

  question.addEventListener('input', resizeQuestion);
  document.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      // A question chosen from another conversation starts without issue context.
      if (context && !button.hasAttribute('data-composer-suggestion')) setIssue('');
      question.value = button.dataset.prompt;
      resizeQuestion();
      question.focus({ preventScroll: true });
      document.querySelector('#ask').scrollIntoView({ behavior: 'instant', block: 'center' });
    });
  });

  form.querySelectorAll('input[name="visibility"]').forEach((input) => {
    input.addEventListener('change', () => {
      document.querySelector('#privacy-note').textContent = input.value === 'private'
        ? 'A conversation just for you.'
        : 'Share anonymously with readers in the Agora.';
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = question.value.trim();
    if (value.length < 10) {
      question.setCustomValidity('Give your question a little more detail (at least 10 characters).');
      question.reportValidity();
      return;
    }
    dialog.querySelector('.submitted-question').textContent = value;
    const isPrivate = form.querySelector('input[name="visibility"]:checked').value === 'private';
    dialog.querySelector('.preview-visibility').textContent = isPrivate ? 'Private conversation' : 'Public · Anonymous';
    const previewContext = dialog.querySelector('.preview-context');
    if (previewContext) {
      const attached = form.dataset.issue === 'city-heat';
      previewContext.hidden = !attached;
      previewContext.querySelector('[data-preview-issue]').textContent = attached ? issueTitle : '';
      if (attached) {
        // Stay in the same design iteration as the attached source links.
        sampleLink.href = previewContext.querySelector('a[href]').getAttribute('href').replace('#sources', '#responses');
        sampleLink.textContent = 'Read the issue’s perspectives →';
      } else {
        sampleLink.setAttribute('href', defaultSampleHref);
        sampleLink.innerHTML = defaultSampleLabel;
      }
    }
    dialog.showModal();
  });

  dialog.querySelectorAll('.dialog-close, .dialog-edit').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('close', () => question.focus({ preventScroll: true }));
})();
