import { useCallback, useEffect, useState } from 'react';
import { getCourses, toErrorMessage } from '../api/client';

/**
 * Loads the course catalogue once and shares the request state.
 * Every page that shows courses reads from here rather than re-implementing
 * the same loading / error handling.
 */
export default function useCourses() {
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');

    getCourses()
      .then((data) => {
        if (cancelled) return;
        setCourses(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(toErrorMessage(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(load, [load]);

  return { courses, status, error, reload: load };
}
