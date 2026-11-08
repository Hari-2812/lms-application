import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatDuration } from '../utils/format.js';

/**
 * Reusable HTML5 player.
 *
 * `src` is always our own API route (/api/videos/:lessonId/stream).
 * The Google Drive URL never reaches this component — the browser only ever
 * requests bytes from our backend, which is what makes seeking work through
 * HTTP Range requests handled server-side.
 *
 * Controls are custom (no `controls` attribute) so there is no browser
 * download button in the overflow menu.
 */
/**
 * A <video> element only reports "it failed", never why. When it does, ask
 * the same URL for its first byte and read the server's JSON error, which
 * names the actual cause (no access, Drive not shared, downloads disabled…).
 * Learners get plain wording; staff (`showDetails`) also see the cause.
 */
async function explainFailure(src, showDetails) {
  const contactSupport = 'Please try again later, or contact support if it keeps happening.';
  let res;
  const controller = new AbortController();
  try {
    res = await fetch(src, { headers: { Range: 'bytes=0-0' }, signal: controller.signal });
  } catch {
    return { title: 'Could not reach the server.', detail: 'Check your internet connection and reload the page.' };
  }
  if (res.ok) {
    const type = res.headers.get('content-type') || 'unknown';
    controller.abort();
    return {
      title: 'This video file cannot be played in your browser.',
      detail: showDetails ? `The server sent "${type}". Upload the lesson as an MP4 (H.264) file.` : contactSupport,
    };
  }
  let message = '';
  try {
    message = (await res.json())?.error || '';
  } catch {
    /* not JSON */
  }
  if (res.status === 401) return { title: 'Your session has expired.', detail: 'Sign in again to keep watching.' };
  if (res.status === 403 && /access to this course/i.test(message)) {
    return { title: message, detail: 'Enrol in the course, or contact support if you think this is a mistake.' };
  }
  return {
    title: 'This video is not available right now.',
    detail: showDetails && message ? `${message} (HTTP ${res.status})` : contactSupport,
  };
}

export default function VideoPlayer({
  src,
  poster,
  startAt = 0,
  watermark,
  onProgress,
  onEnded,
  showDetails = false,
}) {
  const videoRef = useRef(null);
  const shellRef = useRef(null);
  const hideControlsTimer = useRef(null);
  const resumeApplied = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState(null);

  // A new lesson means a new stream — reset the resume guard.
  useEffect(() => {
    resumeApplied.current = false;
    setError(null);
    setIsWaiting(true);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const seekBy = useCallback((delta) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + delta), video.duration);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else shell.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Keyboard shortcuts, ignored while the user types in the search box.
  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (event.code === 'Space' || event.key === 'k') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowRight') seekBy(10);
      else if (event.key === 'ArrowLeft') seekBy(-10);
      else if (event.key === 'f') toggleFullscreen();
      else if (event.key === 'm') {
        const video = videoRef.current;
        if (video) {
          video.muted = !video.muted;
          setMuted(video.muted);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seekBy, togglePlay, toggleFullscreen]);

  const revealControls = () => {
    setShowControls(true);
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2600);
  };

  useEffect(() => () => clearTimeout(hideControlsTimer.current), []);

  const handleLoadedMetadata = (event) => {
    const video = event.currentTarget;
    setDuration(video.duration || 0);
    setIsWaiting(false);

    // Resume where the student stopped. Works because the backend answers
    // Range requests, so the browser can jump straight to that byte offset.
    if (!resumeApplied.current && startAt > 0 && startAt < video.duration - 5) {
      video.currentTime = startAt;
    }
    resumeApplied.current = true;
  };

  const handleTimeUpdate = (event) => {
    const video = event.currentTarget;
    setCurrent(video.currentTime);
    onProgress?.(video.currentTime, video.duration);

    if (video.buffered.length) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }
  };

  const handleSeek = (event) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(event.target.value);
    setCurrent(video.currentTime);
  };

  const handleVolume = (event) => {
    const video = videoRef.current;
    const next = Number(event.target.value);
    setVolume(next);
    setMuted(next === 0);
    if (video) {
      video.volume = next;
      video.muted = next === 0;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const progressPercent = duration ? (current / duration) * 100 : 0;
  const bufferedPercent = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={shellRef}
      onMouseMove={revealControls}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black select-none"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        // Basic protection: no native menu, no download entry, no PiP handoff.
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        className="h-full w-full"
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => {
          setIsPlaying(true);
          revealControls();
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
          onProgress?.(videoRef.current?.currentTime ?? 0, videoRef.current?.duration ?? 0, true);
        }}
        onWaiting={() => setIsWaiting(true)}
        onPlaying={() => setIsWaiting(false)}
        onCanPlay={() => setIsWaiting(false)}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
          // Report the real media duration so the lesson is marked complete
          // even when the seeded `duration` metadata differs from the file.
          const video = videoRef.current;
          if (video?.duration) onProgress?.(video.duration, video.duration, true);
          onEnded?.();
        }}
        onError={() => {
          setError({ title: 'Video could not be loaded.', detail: '' });
          explainFailure(src, showDetails).then((reason) => {
            if (videoRef.current?.currentSrc && reason) setError(reason);
          });
        }}
      />

      {/* Watermark — deliberately visible, tied to the signed-in student. */}
      {watermark && (
        <div className="pointer-events-none absolute right-4 top-4 select-none text-right leading-tight">
          <p className="text-sm font-semibold text-white/70 drop-shadow">{watermark.name}</p>
          <p className="text-[11px] uppercase tracking-widest text-white/50 drop-shadow">
            {watermark.label}
          </p>
        </div>
      )}

      {isWaiting && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/80" />
        </div>
      )}

      {!isPlaying && !isWaiting && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center bg-black/20 transition hover:bg-black/30"
          aria-label="Play"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 shadow-lg">
            <Play className="ml-1 h-7 w-7 text-ink-900" fill="currentColor" />
          </span>
        </button>
      )}

      {error && (
        <div role="alert" className="absolute inset-0 grid place-items-center bg-ink-900 px-8 text-center">
          <div className="max-w-lg">
            <p className="text-sm font-semibold leading-relaxed text-white">{error.title}</p>
            {error.detail && <p className="mt-2 text-[13px] leading-relaxed text-ink-300">{error.detail}</p>}
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3 pt-10 transition-opacity duration-200 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Seek bar with buffered track underneath */}
        <div className="relative mb-2">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-white/35" style={{ width: `${bufferedPercent}%` }} />
            <div
              className="absolute inset-y-0 left-0 bg-primary-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="any"
            value={current}
            onChange={handleSeek}
            aria-label="Seek"
            className="player-range relative bg-transparent"
          />
        </div>

        <div className="flex items-center gap-3 text-white">
          <button onClick={togglePlay} className="transition hover:text-primary-300" aria-label="Play/Pause">
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={() => seekBy(-10)} className="transition hover:text-primary-300" aria-label="Back 10s">
            <RotateCcw className="h-[18px] w-[18px]" />
          </button>
          <button onClick={() => seekBy(10)} className="transition hover:text-primary-300" aria-label="Forward 10s">
            <RotateCw className="h-[18px] w-[18px]" />
          </button>

          <div className="group/vol flex items-center gap-2">
            <button onClick={toggleMute} className="transition hover:text-primary-300" aria-label="Mute">
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolume}
              aria-label="Volume"
              className="player-range w-0 opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100"
            />
          </div>

          <span className="text-xs tabular-nums text-white/85">
            {formatDuration(current)} / {formatDuration(duration)}
          </span>

          <button
            onClick={toggleFullscreen}
            className="ml-auto transition hover:text-primary-300"
            aria-label="Fullscreen"
          >
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
