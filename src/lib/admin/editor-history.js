// Snapshots share unchanged serialized records. No timer: even rapid edits are separate steps.
export function createEditorHistory(initial, { limit = 2000 } = {}) {
  const encode = (snapshot, previous = {}) => Object.fromEntries(Object.entries(snapshot).map(([key, value]) => {
    const serialized = JSON.stringify(value);
    return [key, previous[key] === serialized ? previous[key] : serialized];
  }));
  let current = encode(initial);
  const entries = [];
  let index = 0;
  let transaction = null;
  const equal = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => a[key] === b[key]);
  const decode = (snapshot) => Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, JSON.parse(value)]));
  function append(before, after, context) {
    if (equal(before, after)) return false;
    entries.splice(index);
    entries.push({ before, after, context });
    if (entries.length > limit) entries.shift();
    index = entries.length;
    return true;
  }
  return {
    record(snapshot, context) {
      const next = encode(snapshot, current);
      const previous = current;
      if (equal(previous, next)) return false;
      current = next;
      if (transaction) {
        transaction.context = transaction.context ? { ...context, beforeFocus: transaction.context.beforeFocus } : context;
        return false;
      }
      return append(previous, next, context);
    },
    begin() { if (!transaction) transaction = { before: current, context: null }; },
    end() {
      if (!transaction) return;
      const { before, context } = transaction;
      transaction = null;
      append(before, current, context);
    },
    undo() {
      this.end();
      if (!index) return null;
      const entry = entries[--index];
      current = entry.before;
      return { snapshot: decode(current), context: entry.context };
    },
    redo() {
      this.end();
      if (index === entries.length) return null;
      const entry = entries[index++];
      current = entry.after;
      return { snapshot: decode(current), context: entry.context };
    },
    get canUndo() { return index > 0 || Boolean(transaction && !equal(transaction.before, current)); },
    get canRedo() { return index < entries.length; },
    get position() { return index; },
    get length() { return entries.length; },
    rebase(transform) {
      const cache = new Map();
      const update = (snapshot) => {
        if (!cache.has(snapshot)) cache.set(snapshot, encode(transform(decode(snapshot))));
        return cache.get(snapshot);
      };
      current = update(current);
      for (const entry of entries) { entry.before = update(entry.before); entry.after = update(entry.after); }
    },
    mediaPaths() {
      const paths = new Set();
      const visited = new Set();
      const visit = (value) => {
        if (typeof value === 'string' && /^(?:images|videos)\//.test(value)) paths.add(value);
        else if (value && typeof value === 'object') Object.values(value).forEach(visit);
      };
      for (const snapshot of [current, ...entries.flatMap(({ before, after }) => [before, after])]) {
        for (const serialized of Object.values(snapshot)) {
          if (visited.has(serialized)) continue;
          visited.add(serialized);
          visit(JSON.parse(serialized));
        }
      }
      return [...paths];
    },
  };
}
