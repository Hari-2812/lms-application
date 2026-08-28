/** 600 -> "10:00", 3725 -> "1:02:05" */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
}
