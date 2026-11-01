"use client";
import { isOffice } from "@/lib/auth/access";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ImagePlus,
  FileText,
  MapPin,
  ArrowUpRight,
  LockKeyhole,
} from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { CenterBanner, CenterDetails } from "@/components/center-profile";
import { Loading, ErrorBox } from "@/components/ui";
import { RecordForm } from "@/features/resources/resource-manager";
import { resources } from "@/features/resources/config";
import type { SiteSettings, Row, Page, User } from "@/types";

export function DashboardCenterBanner() {
  const query = useQuery({
    queryKey: ["center-public-settings"],
    queryFn: () => api<SiteSettings>("public/settings/"),
  });
  return query.data ? <CenterBanner settings={query.data} dashboard /> : null;
}
export function CenterPage() {
  const query = useQuery({
    queryKey: ["center-public-settings"],
    queryFn: () => api<SiteSettings>("public/settings/"),
  });
  if (query.isLoading) return <Loading />;
  if (query.isError)
    return (
      <ErrorBox
        message={errorText(query.error)}
        retry={() => query.refetch()}
      />
    );
  return (
    <div className="cabinet-center-page">
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Yuksalish Edu / Markaz</span>
          <h1>Markaz haqida</h1>
          <p>Ta’lim, qabul tartibi va bog‘lanish ma’lumotlari.</p>
        </div>
        <Link className="btn secondary" href="/markaz-haqida">
          Ochiq saytda ko‘rish
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <CenterBanner settings={query.data!} dashboard />
      <CenterDetails settings={query.data!} inDashboard />
    </div>
  );
}
const tabs = [
  {
    key: "content",
    title: "Matn va bo‘limlar",
    icon: FileText,
    keys: [
      "headline",
      "introduction",
      "about",
      "mission",
      "teaching_approach",
      "facilities",
      "admission_steps",
    ],
  },
  {
    key: "images",
    title: "Markaz rasmlari",
    icon: ImagePlus,
    keys: ["cover_image", "about_image", "image_caption"],
  },
  {
    key: "contacts",
    title: "Aloqa va e’lonlar",
    icon: MapPin,
    keys: [
      "public_phone",
      "address",
      "working_hours",
      "map_url",
      "telegram_url",
      "instagram_url",
      "linkedin_url",
      "announcement",
    ],
  },
];
export function CenterSettings({ user }: { user: User }) {
  const [tab, setTab] = useState("content");
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["center-settings"],
    queryFn: () => api<Page<Row>>("content/settings/"),
  });
  if (query.isLoading) return <Loading />;
  if (query.isError)
    return (
      <ErrorBox
        message={errorText(query.error)}
        retry={() => query.refetch()}
      />
    );
  const settings = query.data?.results[0];
  const active = tabs.find((item) => item.key === tab)!;
  const fields = resources.settings.fields.filter((field) =>
    active.keys.includes(field.key),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Boshqaruv / Markaz kontenti</span>
          <h1>Markaz ma’lumotlari</h1>
          <p>Sayt va kabinetdagi ma’lumotlarni bir joydan boshqaring.</p>
        </div>
        <Link className="btn secondary" href="/markaz-haqida">
          Saytni ko‘rish
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <nav className="settings-tabs" aria-label="Markaz sozlamalari bo‘limlari">
        {tabs.map(({ key, title, icon: Icon }) => (
          <button
            className={tab === key ? "active" : ""}
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => {
              setTab(key);
              setNotice("");
            }}
          >
            <Icon size={18} aria-hidden="true" />
            {title}
          </button>
        ))}
      </nav>
      <section className="panel settings-editor">
        <h2>{active.title}</h2>
        <p className="muted">
          {tab === "images"
            ? "Banner va markaz ichki muhiti uchun o‘zingizning haqiqiy suratlaringizni yuklang. Rasmlar sayt va kabinetda ko‘rinadi."
            : "Ma’lumotlarni saqlagach, ochiq saytga aks etishi bir daqiqagacha vaqt olishi mumkin."}
        </p>
        {notice && (
          <div className="notice success" role="status">
            {notice}
          </div>
        )}
        {isOffice(user) ? (
          <RecordForm
            key={`${tab}-${settings?.updated_at || "new"}`}
            fields={settings ? fields : resources.settings.fields}
            initial={settings}
            submitLabel="O‘zgarishlarni saqlash"
            onSubmit={async (data) => {
              const filtered = Object.fromEntries(
                Object.entries(data).filter(
                  ([key, value]) =>
                    !(
                      ["cover_image", "about_image"].includes(key) &&
                      !(value instanceof File) &&
                      value !== ""
                    ),
                ),
              );
              const hasFile = Object.values(filtered).some(
                (value) => value instanceof File,
              );
              let body: BodyInit = JSON.stringify(filtered);
              if (hasFile) {
                const form = new FormData();
                for (const [key, value] of Object.entries(filtered))
                  if (value != null)
                    form.append(
                      key,
                      value instanceof File ? value : String(value),
                    );
                body = form;
              }
              await api(
                `content/settings/${settings ? `${settings.id}/` : ""}`,
                { method: settings ? "PATCH" : "POST", body },
              );
              setNotice("Markaz ma’lumotlari saqlandi.");
              await client.invalidateQueries();
            }}
          />
        ) : (
          <div className="notice">
            <LockKeyhole size={18} />
            <p>Ma’lumotlarni tahrirlash uchun rahbar vakolati kerak.</p>
            <Link className="text-link" href="/kabinet/center">
              Markaz ma’lumotlarini ko‘rish
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
