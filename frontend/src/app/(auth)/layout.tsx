import Link from "next/link";
import { CenterSocialLinks } from "@/components/layout/center-social-links";
export const metadata = { robots: { index: false, follow: false } };
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link className="wordmark light" href="/">
          Yuksalish<span> Edu</span>
        </Link>
        <div>
          <span className="eyebrow">SHAXSIY KABINET</span>
          <h2>
            Ta’lim yo‘lingiz,
            <br />
            bir joyda.
          </h2>
          <p>Jadval, davomat va hisoblaringizni qulay kuzating.</p>
        </div>
        <small>Bilim va maqsad sari birga.</small>
      </aside>
      <main id="main" className="auth-main">
        <Link className="text-link" href="/">
          ← Saytga qaytish
        </Link>
        <div className="auth-card">{children}</div>
        <footer className="auth-social-footer">
          <CenterSocialLinks />
        </footer>
      </main>
    </div>
  );
}
