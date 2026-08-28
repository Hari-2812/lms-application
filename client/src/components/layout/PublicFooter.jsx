import { Link } from 'react-router-dom';
import { Github, Linkedin, Mail, Twitter, Youtube } from 'lucide-react';
import Logo from '../common/Logo.jsx';

const columns = [
  {
    title: 'Platform',
    links: [
      { label: 'Courses', to: '/courses' },
      { label: 'Categories', to: '/courses?view=categories' },
      { label: 'Instructors', to: '/#instructors' },
      { label: 'Pricing', to: '/courses' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', to: '/how-it-works' },
      { label: 'Contact', to: '/#contact' },
      { label: 'FAQ', to: '/#faq' },
      { label: 'How it works', to: '/how-it-works' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/#legal' },
      { label: 'Terms of Service', to: '/#legal' },
      { label: 'Refund Policy', to: '/#legal' },
      { label: 'Accessibility', to: '/#legal' },
    ],
  },
];

const social = [
  { label: 'Twitter', icon: Twitter, href: '#' },
  { label: 'LinkedIn', icon: Linkedin, href: '#' },
  { label: 'YouTube', icon: Youtube, href: '#' },
  { label: 'GitHub', icon: Github, href: '#' },
];

export default function PublicFooter() {
  return (
    <footer id="contact" className="scroll-mt-20 border-t border-ink-800 bg-ink-900 text-ink-300">
      <div className="container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8 lg:py-16">
        <div className="lg:col-span-2">
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
            A learning platform built around structured lessons, secure video delivery and progress
            that is remembered — so you always know exactly where to pick back up.
          </p>
          <a
            href="mailto:hello@analyticsavenue.example"
            className="mt-5 inline-flex items-center gap-2 text-sm text-ink-300 transition hover:text-white"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            hello@analyticsavenue.example
          </a>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="text-sm font-semibold text-white">{column.title}</h3>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-ink-400 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-ink-800">
        <div className="container flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <p className="text-xs text-ink-500">
            &copy; {new Date().getFullYear()} AnalyticsAvenue EduTech. All rights reserved.
          </p>
          <ul className="flex items-center gap-1">
            {social.map(({ label, icon: Icon, href }) => (
              <li key={label}>
                <a
                  href={href}
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-800 hover:text-white"
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
