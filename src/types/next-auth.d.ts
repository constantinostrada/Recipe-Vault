/**
 * src/types/next-auth.d.ts
 *
 * Augments NextAuth types to include the user's database id on the session.
 * This id is populated by the session callback in authOptions.
 */

import type { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
  }
}
