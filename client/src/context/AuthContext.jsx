import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/client';
import { getMe, setAuthToken } from '../api/client';

/**
 * Single source of truth for "who is signed in".
 *
 * The current Express backend uses mock authentication (middleware/mockAuth.js)
 * and exposes no /api/auth/* routes, so this provider works in two modes:
 *
 *   1. Real backend  — POST /api/auth/login|register returns { student, token }.
 *   2. Demo fallback — those routes 404, so we establish the session from
 *      GET /api/me (the mocked demo student) instead.
 *
 * Either way the rest of the app only ever reads this context, so swapping in
 * real auth later requires no changes outside this file.
 */

const STORAGE_KEY = 'lms.session';

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private browsing — the session simply won't survive a reload */
  }
}

/** True when the auth route does not exist on this backend yet. */
const isMissingRoute = (err) => !err?.response || err.response.status === 404;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const [initialising, setInitialising] = useState(true);

  // Re-hydrate on boot: re-attach the token and refresh the student record.
  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setInitialising(false);
      return;
    }

    setAuthToken(stored.token);
    getMe()
      .then((student) => {
        // Keep any locally edited profile fields the backend doesn't store yet.
        const next = { ...stored, student: { ...student, ...stored.student } };
        setSession(next);
        writeStoredSession(next);
      })
      .catch(() => {
        /* keep the stored session; the API may just be offline */
      })
      .finally(() => setInitialising(false));
  }, []);

  const establish = useCallback((student, token = null) => {
    const next = { student, token };
    setAuthToken(token);
    setSession(next);
    writeStoredSession(next);
    return next;
  }, []);

  const signIn = useCallback(
    async ({ email, password, remember = true }) => {
      try {
        const data = await authApi.login({ email, password });
        const next = establish(data.student ?? data.user ?? data, data.token);
        if (!remember) writeStoredSession(null);
        return next.student;
      } catch (err) {
        if (!isMissingRoute(err)) throw err;

        // Demo fallback: the backend has no credential check, so we sign the
        // student in against the mocked /api/me record and keep the address
        // they typed.
        const demo = await getMe().catch(() => ({
          id: 'demo-student-1',
          name: 'Demo Student',
          email,
        }));
        const next = establish({ ...demo, email: email || demo.email });
        if (!remember) writeStoredSession(null);
        return next.student;
      }
    },
    [establish]
  );

  const signUp = useCallback(
    async ({ firstName, lastName, email, password }) => {
      const name = `${firstName} ${lastName}`.trim();
      try {
        const data = await authApi.register({ firstName, lastName, name, email, password });
        return establish(data.student ?? data.user ?? data, data.token).student;
      } catch (err) {
        if (!isMissingRoute(err)) throw err;

        const demo = await getMe().catch(() => ({ id: 'demo-student-1' }));
        return establish({ ...demo, name: name || demo.name, email }).student;
      }
    },
    [establish]
  );

  const signOut = useCallback(() => {
    authApi.logout().catch(() => {});
    setAuthToken(null);
    setSession(null);
    writeStoredSession(null);
  }, []);

  /** Local profile edits — persisted to the session until the API supports it. */
  const updateProfile = useCallback((patch) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, student: { ...prev.student, ...patch } };
      writeStoredSession(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      student: session?.student ?? null,
      isAuthenticated: Boolean(session?.student),
      initialising,
      signIn,
      signUp,
      signOut,
      updateProfile,
    }),
    [session, initialising, signIn, signUp, signOut, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Convenience accessor for components that only render the student.
 * Falls back to a neutral placeholder so public pages can use it safely.
 */
export function useStudent() {
  const { student } = useAuth();
  return student ?? { id: null, name: 'Guest', email: '' };
}
