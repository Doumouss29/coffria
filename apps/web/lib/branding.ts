export type Branding = {
  tenantId?: string | null;
  isEnabled: boolean;
  appName: string;
  customDomain?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  loginTitle?: string | null;
  loginSubtitle?: string | null;
  poweredByCoffria: boolean;
  effective?: 'CUSTOM' | 'COFFRIA';
};

export const DEFAULT_BRANDING: Branding = {
  tenantId: null,
  isEnabled: false,
  appName: 'Coffria',
  customDomain: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#14213D',
  accentColor: '#C97A3D',
  backgroundColor: '#F5F1EA',
  loginTitle: 'Votre patrimoine documentaire, sécurisé et maîtrisé',
  loginSubtitle: 'Votre espace documentaire sécurisé et intelligent',
  poweredByCoffria: true,
  effective: 'COFFRIA',
};

function darken(hex: string, factor = 0.7) {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#0D1B2A';
  const parts = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(i, i + 2), 16) * factor))));
  return `#${parts.map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function normalizeBranding(value: any): Branding {
  if (!value?.isEnabled) return { ...DEFAULT_BRANDING };
  return {
    ...DEFAULT_BRANDING,
    ...value,
    isEnabled: true,
    appName: value.appName || DEFAULT_BRANDING.appName,
    primaryColor: value.primaryColor || DEFAULT_BRANDING.primaryColor,
    accentColor: value.accentColor || DEFAULT_BRANDING.accentColor,
    backgroundColor: value.backgroundColor || DEFAULT_BRANDING.backgroundColor,
  };
}

export function applyBranding(value: Branding) {
  if (typeof document === 'undefined') return;
  const branding = normalizeBranding(value);
  const root = document.documentElement;
  root.style.setProperty('--navy', branding.primaryColor);
  root.style.setProperty('--navy2', darken(branding.primaryColor));
  root.style.setProperty('--orange', branding.accentColor);
  root.style.setProperty('--bg', branding.backgroundColor);
  document.title = branding.appName || 'Coffria';

  let favicon = document.querySelector<HTMLLinkElement>('link[data-coffria-branding-favicon="1"]');
  if (branding.faviconUrl) {
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.dataset.coffriaBrandingFavicon = '1';
      document.head.appendChild(favicon);
    }
    favicon.href = branding.faviconUrl;
  } else if (favicon) {
    favicon.remove();
  }
}
