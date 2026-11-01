import type { Metadata, Viewport } from "next";
import { Providers, PwaRegistration } from "@/components/layout/providers";
import "@/styles/globals.css";
const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: "Yuksalish Edu — bilim va maqsad sari",
    template: "%s | Yuksalish Edu",
  },
  description:
    "Yuksalish Edu o‘quv markazi: fanlar, kurslar va shaxsiy kabinet.",
  manifest: "/manifest.webmanifest",
  applicationName: "Yuksalish Edu",
  appleWebApp: { capable: true, title: "Yuksalish Edu" },
  icons: { icon: "/brand/favicon.svg", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14213D",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Asosiy mazmunga o‘tish
        </a>
        <Providers>
          {children}
          <PwaRegistration />
        </Providers>
      </body>
    </html>
  );
}
