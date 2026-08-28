import { Cloud, Lock, MonitorPlay, Server, ShieldCheck } from 'lucide-react';

const steps = [
  {
    icon: Cloud,
    title: 'Private Google Drive',
    subtitle: 'course-video.mp4',
    body: 'Videos live in a Drive folder that is not public. It is shared only with our service account — a Drive link alone will not open it.',
    tone: 'bg-amber-50 text-amber-600 ring-amber-100',
  },
  {
    icon: Server,
    title: 'Node.js Backend',
    subtitle: 'Secure Video API',
    body: 'Express looks the lesson up in MongoDB, reads its Drive file id, and calls the Drive API with the service account credentials.',
    tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  },
  {
    icon: MonitorPlay,
    title: 'React LMS Player',
    subtitle: '/api/videos/:lessonId/stream',
    body: 'The browser requests bytes from our own API only. Range requests are forwarded to Drive so seeking works without exposing anything.',
    tone: 'bg-primary-50 text-primary-600 ring-primary-100',
  },
];

const guarantees = [
  'Drive files and folder stay private — no "anyone with the link" sharing',
  'The Drive file id is stored server-side and stripped from every API response',
  'webViewLink / webContentLink are never requested or returned',
  'Credentials live in server/.env and are never bundled into the React app',
  'The player has no download button and the native context menu is disabled',
  'Every stream carries the student’s name as an on-video watermark',
];

export default function HowItWorks({ compact = false }) {
  return (
    <section className="card p-6">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-900 text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink-900">How video delivery works</h2>
          <p className="text-sm text-ink-500">
            The student never talks to Google. Every byte is proxied by our backend.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="relative rounded-xl border border-ink-100 bg-surface-muted p-5">
            <span className={`grid h-10 w-10 place-items-center rounded-lg ring-4 ${step.tone}`}>
              <step.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink-900">{step.title}</p>
            <p className="font-mono text-[11px] text-ink-500">{step.subtitle}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{step.body}</p>

            {index < steps.length - 1 && (
              <span className="absolute -right-2.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 place-items-center rounded-full border border-ink-200 bg-white text-[10px] text-ink-400 lg:grid">
                ▶
              </span>
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl bg-ink-900 p-5">
            <pre className="font-mono text-[12px] leading-relaxed text-ink-300">
{`Student clicks a lesson
      │
      ▼
GET  /api/videos/:lessonId/stream        (Range: bytes=0-)
      │
      ▼
Express  ──▶  MongoDB: find lesson ──▶ videoFileId
      │
      ▼
Google Drive Service  ──▶  drive.files.get({ fileId, alt: 'media' })
      │                                   + forwarded Range header
      ▼
Private MP4 byte stream  ──▶  206 Partial Content
      │
      ▼
React <video src="/api/videos/:lessonId/stream">`}
            </pre>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-ink-500" />
              <h3 className="text-sm font-semibold text-ink-900">What this protects</h3>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {guarantees.map((item) => (
                <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800">
              <strong>Honest limitation:</strong> no web player can stop OS-level screen recording
              or a phone camera. This design stops link sharing, direct downloads and Drive access —
              screen-capture prevention needs DRM (Widevine/FairPlay), which is out of scope for
              this MVP.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
