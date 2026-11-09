import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="w-full border-t border-[var(--border)] bg-[var(--background)] py-8 text-xs text-[var(--muted-foreground)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/Code0.png"
            alt="Code0 Logo"
            width={48}
            height={24}
            className="h-4 w-auto object-contain opacity-80"
          />
          <span>&copy; {new Date().getFullYear()} Code0. Isolated Code Execution Platform.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/problems"
            className="hover:text-[var(--foreground)] transition-colors"
          >
            Problems
          </Link>
          <a
            href="/api-v1/health"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--foreground)] transition-colors"
          >
            System Status
          </a>
        </div>
      </div>
    </footer>
  );
}

