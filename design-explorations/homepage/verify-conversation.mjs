// Check meaningful state invariants without a browser or live application.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const sandbox = {};
runInNewContext(await readFile(new URL('conversation-state.js', import.meta.url), 'utf8'), sandbox);
const { create, transition } = sandbox.PhilagoraConversation;
const make = (visibility = 'private', sample = 'personal') => create({ question: 'A question with enough detail?', visibility, sample, issue: sample === 'world' ? 'city-heat' : '' });
const complete = (state) => {
  for (let index = state.count; index < 3; index += 1) state = transition(state, { type: 'answer' });
  return transition(state, { type: 'ready' });
};

for (const visibility of ['private', 'public']) {
  for (const sample of ['personal', 'world']) {
    let state = make(visibility, sample);
    // A synthesis or follow-up cannot precede the three responses.
    assert.equal(transition(state, { type: 'ready' }), state);
    assert.equal(transition(state, { type: 'followup', question: 'Too early?' }), state);
    state = transition(state, { type: 'answer' });
    state = transition(state, { type: 'failed' });
    const interrupted = state;
    assert.equal(transition(state, { type: 'answer' }), state);
    state = transition(state, { type: 'retry' });
    assert.equal(state.count, 1, 'Recovery retains the delivered answer');
    assert.equal(state.question, interrupted.question);
    state = complete(state);
    state = transition(state, { type: 'followup', question: 'But what if the group disagrees?' });
    assert.equal(state.visibility, visibility, 'A follow-up inherits visibility');
    assert.equal(state.sample, sample, 'A follow-up keeps the entire original group');
    assert.equal(state.issue, sample === 'world' ? 'city-heat' : '', 'Source context carries forward');
    assert.equal(state.phase, 'followup');
    assert.equal(state.count, 0, 'The follow-up has its own arrival count');
    assert.equal(transition(state, { type: 'followup', question: 'Duplicate submission?' }), state);
    state = transition(state, { type: 'slow' });
    state = transition(state, { type: 'retry' });
    state = complete(state);
    assert.equal(state.complete, true);
    assert.equal(transition(state, { type: 'followup', question: 'A second follow-up?' }), state);
  }
}
console.log('Conversation state checks passed: ordering, recovery, privacy, group/context continuity, and one follow-up.');
