import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { SocialLinks } from "@/components/social-links";
import { publicApi } from "@/lib/api/server";
import type { SiteSettings } from "@/types";
export const dynamic = "force-dynamic";
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await publicApi<SiteSettings>("settings/").catch(() => null);
  return (
    <>
      <PublicHeader />
      <main id="main">{children}</main>
      <footer className="public-footer">
        <div className="container footer-grid">
          <div>
            <Link className="wordmark light" href="/">
              Yuksalish<span> Edu</span>
            </Link>
            <p>Bilim va maqsad sari birga.</p>
            <SocialLinks settings={settings} />
          </div>
          <div>
            <h2>O‘rganish</h2>
            <Link href="/kurslar">Kurslar</Link>
            <Link href="/ustozlar">Ustozlar</Link>
            <Link href="/natijalar">Natijalar</Link>
          </div>
          <div>
            <h2>Markaz</h2>
            <Link href="/markaz-haqida">Markaz haqida</Link>
            <Link href="/boglanish">Bog‘lanish</Link>
            <Link href="/kirish">Shaxsiy kabinet</Link>
          </div>
          <div>
            <h2>Shaxsiy kabinet</h2>
            <p>Jadval, davomat va to‘lovlarni bir joyda kuzating.</p>
            <Link href="/faollashtirish">Kabinetni faollashtirish ↗</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Yuksalish Edu</span>
          <span>Bilim olishga qo‘yilgan har qadam muhim.</span>
        </div>
      </footer>
    </>
  );
}
