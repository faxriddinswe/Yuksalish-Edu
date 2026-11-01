import type { MetadataRoute } from "next";
import { publicApi, siteUrl } from "@/lib/api/server";
import type { Course, Teacher, Page } from "@/types";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    "",
    "/markaz-haqida",
    "/kurslar",
    "/ustozlar",
    "/natijalar",
    "/boglanish",
  ].map((p) => ({ url: `${siteUrl}${p}` }));
  for (const [kind, path] of [
    ["courses", "kurslar"],
    ["teachers", "ustozlar"],
  ]) {
    let page = 1;
    while (true) {
      const data: Page<Course | Teacher> = await publicApi<
        Page<Course | Teacher>
      >(`${kind}/?page_size=50&page=${page}`);
      routes.push(
        ...data.results.map((r) => ({ url: `${siteUrl}/${path}/${r.slug}` })),
      );
      if (!data.next) break;
      page++;
    }
  }
  return routes;
}
