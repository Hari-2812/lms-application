import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import CourseThumbnail from './CourseThumbnail.jsx';

/**
 * The course's public preview reel, as set by the admin in the course
 * content editor.
 *
 * Deliberately separate from components/VideoPlayer.jsx: that one streams
 * private lesson video through our own API and must never expose a URL,
 * whereas an intro is marketing material the admin wants shared. So this
 * takes a plain URL and handles the three shapes one can arrive in —
 * YouTube, Vimeo, or a direct file.
 *
 * Nothing loads until the student presses play: an iframe embed would
 * otherwise let the video host set cookies on every catalogue visit.
 */

/** Recognised hosts → the embed URL for a given id. */
function toEmbed(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return null;

  let parsed;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;

  const host = parsed.hostname.replace(/^www\./, '');

  // youtu.be/<id> and youtube.com/{watch?v=,embed/,shorts/}<id>
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    return id ? { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      parsed.searchParams.get('v') ||
      parsed.pathname.match(/^\/(?:embed|shorts|v)\/([^/?]+)/)?.[1];
    return id ? { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parsed.pathname.match(/(\d+)/)?.[1];
    return id ? { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` } : null;
  }

  // Anything that looks like a media file plays in a native <video>.
  if (/\.(mp4|webm|ogg|ogv|m4v|mov)(\?|$)/i.test(parsed.pathname)) {
    return { kind: 'file', src: parsed.href };
  }

  // An unrecognised host could be anything, so it gets a plain link rather
  // than being embedded.
  return { kind: 'link', src: parsed.href };
}

export default function IntroVideo({ course, className = '' }) {
  const [playing, setPlaying] = useState(false);
  const embed = toEmbed(course?.introVideoUrl);

  if (!embed) return null;

  if (embed.kind === 'link') {
    return (
      <a
        href={embed.src}
        target="_blank"
        rel="noopener noreferrer"
        className={`group relative block aspect-video overflow-hidden rounded-xl bg-ink-900 ${className}`}
      >
        <CourseThumbnail course={course} className="opacity-60" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-ink-900 shadow-lg">
            <PlayCircle className="h-5 w-5" aria-hidden="true" />
            Watch the preview
          </span>
        </span>
      </a>
    );
  }

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`Play the preview for ${course.title}`}
        className={`group relative block aspect-video w-full overflow-hidden rounded-xl bg-ink-900 ${className}`}
      >
        <CourseThumbnail course={course} className="opacity-70 transition group-hover:opacity-50" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-primary-700 shadow-lg transition group-hover:scale-105">
            <PlayCircle className="h-8 w-8" aria-hidden="true" />
          </span>
        </span>
        <span className="absolute bottom-3 left-3 rounded-md bg-ink-900/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          Course preview
        </span>
      </button>
    );
  }

  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl bg-black ${className}`}>
      {embed.kind === 'iframe' ? (
        <iframe
          src={`${embed.src}?autoplay=1&rel=0`}
          title={`${course.title} preview`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- admin-supplied preview, no caption track available
        <video src={embed.src} controls autoPlay playsInline className="h-full w-full" />
      )}
    </div>
  );
}
