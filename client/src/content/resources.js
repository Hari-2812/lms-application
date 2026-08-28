/**
 * Editorial content for the "Latest Resources" band.
 *
 * The backend has no blog collection yet, so this is the single place the copy
 * lives. When `GET /api/posts` exists, swap this import in BlogSection for the
 * API call — the shape below is exactly what the component renders.
 */
export const resources = [
  {
    id: 'structure-a-learning-week',
    category: 'Study habits',
    title: 'How to structure a learning week that you actually stick to',
    excerpt:
      'Three short sessions beat one long one. A simple weekly shape that fits around a full-time job.',
    date: '2026-08-12',
    readMinutes: 6,
    accent: 'sky',
  },
  {
    id: 'reading-code-you-did-not-write',
    category: 'Engineering',
    title: 'Reading code you did not write, without getting lost',
    excerpt:
      'A repeatable way to work through an unfamiliar codebase: entry points first, data second, details last.',
    date: '2026-07-29',
    readMinutes: 8,
    accent: 'violet',
  },
  {
    id: 'from-tutorial-to-project',
    category: 'Career',
    title: 'Moving from tutorials to your first real project',
    excerpt:
      'The gap between following along and building alone is smaller than it looks. Here is how to cross it.',
    date: '2026-07-15',
    readMinutes: 5,
    accent: 'emerald',
  },
];

export const faqs = [
  {
    q: 'Do I need an account to start learning?',
    a: 'Yes — create a free account and your enrolled courses, playback position and completed lessons are tied to it, so you can pick up on any device.',
  },
  {
    q: 'Where do the course videos come from?',
    a: 'Every video is stored in a private Google Drive folder. Our Express backend authenticates with a service account and streams the bytes to the player, so no Drive link is ever exposed to the browser.',
  },
  {
    q: 'Does my progress save automatically?',
    a: 'It does. While you watch, the player reports its position back to the API every few seconds, so reopening a lesson resumes exactly where you stopped.',
  },
  {
    q: 'Can I use the platform on my phone?',
    a: 'Yes. The landing page, dashboard, course pages and video player are all fully responsive, with a dedicated mobile navigation drawer.',
  },
];
