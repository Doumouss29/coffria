import './globals.css';
import './marketing.css';
import './marketing-v2.css';
import './innovations.css';

export const metadata = {
  title: 'Coffria',
  description: 'Archivage documentaire intelligent et sécurisé',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
