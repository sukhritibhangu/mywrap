/**
 * Lightweight in-memory store for favourite product ids so every heart on the
 * menu reflects the same state without extra requests per card. The server
 * remains the source of truth; this is only a UI cache.
 */
const listeners = new Set();
let ids = new Set();

const emit = () => listeners.forEach((listener) => listener(ids));

export const favouriteStore = {
  hydrate(list) {
    ids = new Set((list || []).map((item) => String(item?._id || item)));
    emit();
  },
  has(productId) {
    return ids.has(String(productId));
  },
  add(productId) {
    ids = new Set(ids);
    ids.add(String(productId));
    emit();
  },
  remove(productId) {
    ids = new Set(ids);
    ids.delete(String(productId));
    emit();
  },
  toggle(productId) {
    if (ids.has(String(productId))) this.remove(productId);
    else this.add(productId);
    return ids.has(String(productId));
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
