import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Mail } from 'lucide-react';
import Logo from '../common/Logo.jsx';

const WHATSAPP_NUMBER = '917550279838';

/** Lucide has no WhatsApp glyph — simple-icons path, drawn with currentColor. */
function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

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
  { label: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/subu_datascientist/' },
  { label: 'LinkedIn', icon: Linkedin, href: 'https://www.linkedin.com/company/analytics-avenue-and-advanced-analytics/' },
  { label: 'WhatsApp', icon: WhatsAppIcon, href: `https://wa.me/${WHATSAPP_NUMBER}` },
];

export default function PublicFooter() {
  return (
    <footer id="contact" className="scroll-mt-20 border-t border-ink-800 bg-ink-900 text-ink-300">
      <div className="container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8 lg:py-16">
        <div className="lg:col-span-2">
          <Logo tone="light" variant="full" size="2xl" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
            A learning platform built around structured lessons, secure video delivery and progress
            that is remembered — so you always know exactly where to pick back up.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-fit items-center gap-2 text-sm text-ink-300 transition hover:text-white"
          >
            <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
            +91 75502 79838
          </a>
          <a
            href="mailto:supportteam@analyticsavenue.in"
            className="mt-3 flex w-fit items-center gap-2 text-sm text-ink-300 transition hover:text-white"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            supportteam@analyticsavenue.in
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
                  target="_blank"
                  rel="noopener noreferrer"
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
