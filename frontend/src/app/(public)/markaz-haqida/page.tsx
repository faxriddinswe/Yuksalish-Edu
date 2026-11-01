import { publicApi, pageMetadata } from "@/lib/api/server";
import { CenterBanner, CenterDetails } from "@/components/center-profile";
import type { SiteSettings } from "@/types";
export const metadata = pageMetadata(
  "Markaz haqida",
  "Yuksalish Edu: markaz, fanlar, ta’limga yondashuv, qabul va ota-onalar uchun imkoniyatlar.",
  "/markaz-haqida",
);
export default async function About() {
  const settings = await publicApi<SiteSettings>("settings/");
  return (
    <div className="container section center-page">
      <CenterBanner settings={settings} />
      <CenterDetails settings={settings} />
    </div>
  );
}
