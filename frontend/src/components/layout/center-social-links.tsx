"use client";

import { useQuery } from "@tanstack/react-query";
import { SocialLinks } from "@/components/social-links";
import { api } from "@/lib/api/client";
import type { SiteSettings } from "@/types";

export function CenterSocialLinks({ compact = false }: { compact?: boolean }) {
  const query = useQuery({
    queryKey: ["center-public-settings"],
    queryFn: () => api<SiteSettings>("public/settings/"),
  });
  if (query.isPending)
    return (
      <p className="social-message" role="status">
        Ijtimoiy tarmoqlar yuklanmoqda…
      </p>
    );
  if (query.isError)
    return (
      <div className="social-message" role="status">
        Havolalarni yuklab bo‘lmadi.{" "}
        <button className="text-button" onClick={() => query.refetch()}>
          Qayta urinish
        </button>
      </div>
    );
  return <SocialLinks settings={query.data} compact={compact} />;
}
