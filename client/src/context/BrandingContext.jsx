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
    logoUrl: '',
    supportEmail: '',
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
