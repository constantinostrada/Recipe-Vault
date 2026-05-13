/**
 * src/app/layout.tsx
 *
 * Root layout — applies global styles, fonts, and the session provider.
 */

import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';

import { SessionProvider } from '@/interfaces/components/providers/SessionProvider';

import '../interfaces/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Recipe Vault',
    default: 'Recipe Vault',
  },
  description: 'Discover, create, and share your favourite recipes.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-stone-50 text-stone-900 font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
