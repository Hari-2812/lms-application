import { useCallback, useEffect, useState } from 'react';

/**
 * Saved-for-later list.
 *
 * The API has no wishlist endpoint yet, so it is kept per-browser. The shape
 * (an array of course ids) matches what a `GET /api/wishlist` would return,
 * so swapping in the API later is a change to this hook alone.
 */
const STORAGE_KEY = 'lms.wishlist';
const EVENT = 'lms:wishlist-change';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function useWishlist() {
  const [ids, setIds] = useState(read);

  // Keep every mounted copy of the hook in sync, including across tabs.
  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((courseId) => {
    const current = read();
    const next = current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
    window.dispatchEvent(new Event(EVENT));
    return next;
  }, []);

  const has = useCallback((courseId) => ids.includes(courseId), [ids]);

  return { ids, has, toggle, count: ids.length };
}
