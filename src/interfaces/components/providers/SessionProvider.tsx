/**
 * src/interfaces/components/providers/SessionProvider.tsx
 *
 * Client-side wrapper for NextAuth SessionProvider.
 * Must be a client component ("use client") because it uses React context.
 */

'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

interface Props {
  children: React.ReactNode;
}

export function SessionProvider({ children }: Props) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
