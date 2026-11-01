import { Send, Instagram, Linkedin } from "lucide-react";
import type { SocialSettings } from "@/types";

const networks = [
  {
    key: "telegram_url",
    name: "Telegram",
    Icon: Send,
    hosts: ["t.me", "telegram.me"],
  },
  {
    key: "instagram_url",
    name: "Instagram",
    Icon: Instagram,
    hosts: ["instagram.com", "www.instagram.com"],
  },
  {
    key: "linkedin_url",
    name: "LinkedIn",
    Icon: Linkedin,
    hosts: ["linkedin.com", "www.linkedin.com"],
  },
] as const;

function safeUrl(value: string | undefined, hosts: readonly string[]) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      hosts.includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function SocialLinks({
  settings,
  compact = false,
}: {
  settings?: Partial<SocialSettings> | null;
  compact?: boolean;
}) {
  return (
    <div
      className={`social-links ${compact ? "compact" : ""}`}
      role="group"
      aria-label="Ijtimoiy tarmoqlar"
    >
      {networks.map(({ key, name, Icon, hosts }) => {
        const href = safeUrl(settings?.[key], hosts);
        const content = (
          <>
            <Icon size={19} aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>{name}</span>
          </>
        );
        return href ? (
          <a
            className="social-link"
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${name} — yangi oynada ochiladi`}
            title={`${name} — yangi oynada ochiladi`}
          >
            {content}
          </a>
        ) : (
          <span
            className="social-link unavailable"
            key={key}
            role="link"
            aria-disabled="true"
            aria-label={`${name}: havola hali kiritilmagan`}
            title={`${name}: havola hali kiritilmagan`}
          >
            {content}
            {!compact && <small>Havola kiritilmagan</small>}
          </span>
        );
      })}
    </div>
  );
}
