/**
 * A tiny signal for "user data changed" (a tone was saved, a song uploaded),
 * so open Studio windows showing lists can refetch. Outside the Studio
 * nothing listens and it's a no-op.
 */
const EVENT = "resoniq:data-changed";

export function notifyDataChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onDataChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
