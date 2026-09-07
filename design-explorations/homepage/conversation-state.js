// Shared, pure transitions for the local preview; no persistence or network.
globalThis.PhilagoraConversation = (() => {
  function create({ question, visibility, sample, issue }) {
    return { question, visibility, sample, issue, phase: 'initial', status: 'waiting', count: 0, followup: '', complete: false };
  }
  function transition(state, action) {
    if (action.type === 'retry' && ['slow', 'failed'].includes(state.status)) return { ...state, status: 'waiting' };
    if (action.type === 'followup' && state.status === 'ready' && state.phase === 'initial') {
      return { ...state, phase: 'followup', followup: action.question, count: 0, status: 'waiting' };
    }
    if (state.status !== 'waiting') return state;
    if (action.type === 'slow' || action.type === 'failed') return { ...state, status: action.type };
    if (action.type === 'answer') return { ...state, count: Math.min(3, state.count + 1) };
    if (action.type === 'ready' && state.count === 3) return { ...state, status: 'ready', complete: state.phase === 'followup' };
    return state;
  }
  return { create, transition };
})();
