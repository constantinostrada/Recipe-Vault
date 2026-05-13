/**
 * src/app/(main)/layout.tsx
 *
 * Layout for all main content pages (not auth pages).
 * Wraps content with the Navbar and Footer.
 */

import { Footer } from '@/interfaces/components/layout/Footer';
import { Navbar } from '@/interfaces/components/layout/Navbar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
