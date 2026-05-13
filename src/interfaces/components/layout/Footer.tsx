/**
 * src/interfaces/components/layout/Footer.tsx
 *
 * Application footer.
 */

export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-100 bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-stone-400">
          © {new Date().getFullYear()} Recipe Vault. All rights reserved.
        </p>
        <p className="text-xs text-stone-300">
          Built with Next.js 14, Prisma &amp; Tailwind CSS
        </p>
      </div>
    </footer>
  );
}
