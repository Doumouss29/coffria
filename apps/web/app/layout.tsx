import './globals.css';
import './marketing.css';
import './marketing-v2.css';
import './innovations.css';
import './mobile-explorer.css';
import './explorer-spaces.css';
import './viewer-fixes.css';
import './viewer-mobile.css';
import './pricing-legal.css';
import './pricing-harmonization.css';
import './mfa.css';
import './mobile-shell.css';
import './signature-controls.css';
import './desktop-readability.css';
import './branding-admin.css';
import './white-label-fixes.css';
import AnalyticsTracker from '../components/AnalyticsTracker';
import SignatureInteractionControls from '../components/SignatureInteractionControls';

export const metadata = {
  title: 'Coffria',
  description: 'Archivage documentaire intelligent et sécurisé',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body><AnalyticsTracker /><SignatureInteractionControls />{children}</body>
    </html>
  );
}
