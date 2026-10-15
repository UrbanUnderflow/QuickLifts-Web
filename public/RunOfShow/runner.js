(function(root) {
  const api = {
    reorder(state, id, targetIndex) {
      const from = state.segments.findIndex(s => s.id === id);
      const locked = state.completed.length + (state.active ? 1 : 0);
      if (from < locked || from < 0 || !Number.isInteger(targetIndex) || targetIndex < locked || targetIndex >= state.segments.length) return state;
      const segments = [...state.segments];
      const [segment] = segments.splice(from, 1);
      segments.splice(targetIndex, 0, segment);
      return {...state, segments};
    },
    normalize(state, now) {
      if (state.active && now >= state.active.end) {
        return {...state, completed: [...state.completed, {...state.active, end: state.active.end}], active: null};
      }
      return state;
    },
    start(state, now) {
      state = api.normalize(state, now);
      if (state.active || state.completed.length >= state.segments.length) return state;
      const segment = state.segments[state.completed.length];
      return {...state, active: {id: segment.id, start: now, end: now + segment.minutes * 60000}};
    },
    finish(state, now) {
      state = api.normalize(state, now);
      return state.active ? {...state, completed: [...state.completed, {...state.active, end: now}], active: null} : state;
    },
    timeline(state, now) {
      state = api.normalize(state, now);
      let cursor = state.completed.length || state.active ? now : state.planned;
      return state.segments.map((segment, index) => {
        const actual = state.completed[index] || (index === state.completed.length ? state.active : null);
        const start = actual ? actual.start : cursor;
        const end = actual ? actual.end : start + segment.minutes * 60000;
        cursor = Math.max(end, index < state.completed.length ? now : end);
        return {...segment, start, end, status: index < state.completed.length ? 'done' : actual ? 'live' : 'next'};
      });
    }
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Runner = api;
})(typeof window !== 'undefined' ? window : globalThis);
