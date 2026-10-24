import { connection } from 'next/server';
import AppLinks from '@/components/AppLinks.jsx';
import '@/styles/fonts.css';
import '@/styles/arcade.css';

export const metadata = {
  title: 'WNI · Why not, indeed?',
  description: 'WNI: fourteen quick browser games, four opponents and one panic button. Why not, indeed?'
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }) {
  // Every page is rendered per request so it can carry a fresh CSP nonce (see proxy.js).
  await connection();
  return (
    <html lang="en">
      <body>
        <AppLinks />
        {children}
      </body>
    </html>
  );
}
