import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getPublicSettings } from '../api/client';

/**
 * Platform branding and payment options from Settings, readable anywhere.
 *
 * Loaded once from the public settings endpoint. The defaults match the
 * server's, so the UI renders correctly before (or without) the response.
 * The admin Settings page calls `refresh` after saving.
 */

const DEFAULTS = {
  branding: {
    platformName: 'AnalyticsAvenue',
    tagline: 'EduTech',
    supportEmail: '',
  },
  // Left panel of the sign-in / sign-up pages (Settings → Sign-in page).
  loginPage: {
    heading: 'Learning that remembers where you left off.',
    description:
      'Structured lessons, secure video delivery and progress tracking that keeps every course moving forward.',
    points: [
      'Pick up any lesson exactly where you stopped',
      'Track completion across every enrolled course',
      'Earn a certificate when a course is finished',
    ].join('\n'),
    imageUrl: '',
    imageAlt: '',
  },
  // Landing page hero image (Settings → Homepage). Empty = the built-in photo.
  homepage: {
    heroImageUrl: '',
    heroImageAlt: 'Analytics Avenue data expert',
    heroImageLink: '',
  },
  certificate: {
    companyName: 'Analytics Avenue',
    tagline: 'Building Smarter Teams with AI and L&D',
    title: 'Course Completion Certificate',
    issuerName: 'Subramani',
    issuerTitle: 'Data Scientist',
    issuerRole: 'Chief Data Scientist Mentor',
  },
  payments: { gateway: 'manual', currency: 'INR', razorpayKeyId: '', upiId: '', bankDetails: '', instructions: '' },
  learning: { certificateCompletionPercent: 100, accessDurationDays: 0 },
};

const BrandingContext = createContext({ ...DEFAULTS, refresh: () => {} });

export function BrandingProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  const refresh = useCallback(
    () =>
      getPublicSettings()
        .then((data) =>
          setSettings({
            branding: { ...DEFAULTS.branding, ...data.branding },
            loginPage: { ...DEFAULTS.loginPage, ...data.loginPage },
            homepage: { ...DEFAULTS.homepage, ...data.homepage },
            certificate: { ...DEFAULTS.certificate, ...data.certificate },
            payments: { ...DEFAULTS.payments, ...data.payments },
            learning: { ...DEFAULTS.learning, ...data.learning },
          })
        )
        // Branding is cosmetic — keep the defaults if the API is unreachable.
        .catch(() => {}),
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const { platformName, tagline } = settings.branding;
    document.title = tagline ? `${platformName} ${tagline}` : platformName;
  }, [settings.branding]);

  const value = useMemo(() => ({ ...settings, refresh }), [settings, refresh]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
