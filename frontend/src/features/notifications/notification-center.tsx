"use client";
import { isOffice } from "@/lib/auth/access";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  Megaphone,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { dateTime } from "@/lib/formatting";
import { Loading, Empty, ErrorBox, Modal } from "@/components/ui";
import type { Page, User } from "@/types";

type Notification = {
  id: number;
  title: string;
  message: string;
  kind: string;
  created_at: string;
  read_at: string | null;
};
type Broadcast = {
  id: number;
  title: string;
  message: string;
  sender_name: string;
  recipient_count: number;
  created_at: string;
};

export function NotificationCenter({ user }: { user: User }) {
  const canSend = isOffice(user);
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  const [key, setKey] = useState("");
  const [sending, setSending] = useState(false);
  const [reading, setReading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [notice, setNotice] = useState("");
  const inbox = useQuery({
    queryKey: ["notification-inbox", user.id, page, unread],
    queryFn: () =>
      api<Page<Notification>>(
        `notifications/?page=${page}${unread ? "&unread=true" : ""}`,
      ),
    enabled: tab === "inbox",
    refetchInterval: 60000,
    refetchOnWindowFocus: "always",
  });
  const sent = useQuery({
    queryKey: ["notification-broadcasts", user.id, page],
    queryFn: () =>
      api<Page<Broadcast>>(`notifications/broadcasts/?page=${page}`),
    enabled: canSend && tab === "sent",
  });
  const audience = useQuery({
    queryKey: ["notification-audience", user.id],
    queryFn: () => api<{ recipient_count: number }>("notifications/broadcast/"),
    enabled: canSend && open,
  });
  async function refresh() {
    await client.invalidateQueries();
  }
  async function send() {
    setSendError("");
    setSending(true);
    try {
      const result = await api<Broadcast>("notifications/broadcast/", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ title: title.trim(), message: message.trim() }),
      });
      setNotice(`Xabar ${result.recipient_count} ta akkauntga yuborildi.`);
      setOpen(false);
      setTitle("");
      setMessage("");
      setReview(false);
      await refresh();
    } catch (e) {
      setSendError(errorText(e));
    } finally {
      setSending(false);
    }
  }
  const data = tab === "inbox" ? inbox.data : sent.data;
  const loading = tab === "inbox" ? inbox.isLoading : sent.isLoading;
  const failure = tab === "inbox" ? inbox.isError : sent.isError;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="breadcrumb">Shaxsiy kabinet / Xabarlar</span>
          <h1>Bildirishnomalar</h1>
          <p>Markaz e’lonlari va sizga tegishli xabarlar shu yerda.</p>
        </div>
        {canSend && (
          <button
            className="btn"
            onClick={() => {
              setOpen(true);
              setReview(false);
              setSendError("");
              setKey(crypto.randomUUID());
            }}
          >
            <Send size={18} aria-hidden="true" />
            Hammaga xabar yuborish
          </button>
        )}
      </div>
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {error && <ErrorBox message={error} />}
      <div className="notification-toolbar">
        {canSend && (
          <nav aria-label="Bildirishnoma bo‘limlari">
            <button
              className={`btn ${tab === "inbox" ? "" : "secondary"}`}
              aria-pressed={tab === "inbox"}
              onClick={() => {
                setTab("inbox");
                setPage(1);
              }}
            >
              Kelgan xabarlar
            </button>
            <button
              className={`btn ${tab === "sent" ? "" : "secondary"}`}
              aria-pressed={tab === "sent"}
              onClick={() => {
                setTab("sent");
                setPage(1);
              }}
            >
              Yuborilgan e’lonlar
            </button>
          </nav>
        )}
        {tab === "inbox" && (
          <label className="notification-unread-filter">
            <input
              type="checkbox"
              checked={unread}
              onChange={(e) => {
                setUnread(e.target.checked);
                setPage(1);
              }}
            />
            Faqat o‘qilmaganlar
          </label>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : failure ? (
        <ErrorBox
          message={errorText(tab === "inbox" ? inbox.error : sent.error)}
          retry={() => (tab === "inbox" ? inbox.refetch() : sent.refetch())}
        />
      ) : !data?.count ? (
        <Empty
          text={
            tab === "inbox"
              ? "Bu tanlov bo‘yicha bildirishnomalar yo‘q."
              : "Hali umumiy e’lon yuborilmagan."
          }
        />
      ) : (
        <div className="notification-list">
          {tab === "inbox"
            ? inbox.data?.results.map((item) => (
                <article
                  className={`panel notification-card ${item.read_at ? "" : "unread"}`}
                  key={item.id}
                >
                  <header>
                    <span className="notification-type">
                      {item.kind === "ANNOUNCEMENT" ? (
                        <Megaphone size={18} aria-hidden="true" />
                      ) : (
                        <Bell size={18} aria-hidden="true" />
                      )}
                      {item.kind === "ANNOUNCEMENT"
                        ? "Markaz e’loni"
                        : "Shaxsiy xabar"}
                    </span>
                    <span className="notification-read-state">
                      {item.read_at ? "O‘qilgan" : "Yangi"}
                    </span>
                  </header>
                  <h2>{item.title}</h2>
                  <p className="notification-message">{item.message}</p>
                  <footer>
                    <time dateTime={item.created_at}>
                      {dateTime(item.created_at)}
                    </time>
                    {!item.read_at && (
                      <button
                        className="btn secondary"
                        disabled={reading === item.id}
                        onClick={async () => {
                          setReading(item.id);
                          setError("");
                          try {
                            await api(`notifications/${item.id}/read/`, {
                              method: "POST",
                            });
                            await refresh();
                          } catch (e) {
                            setError(errorText(e));
                          } finally {
                            setReading(null);
                          }
                        }}
                      >
                        <Check size={17} aria-hidden="true" />
                        {reading === item.id ? "Saqlanmoqda…" : "O‘qildi"}
                      </button>
                    )}
                  </footer>
                </article>
              ))
            : sent.data?.results.map((item) => (
                <article className="panel notification-card" key={item.id}>
                  <header>
                    <span className="notification-type">
                      <Megaphone size={18} aria-hidden="true" />
                      {item.recipient_count} ta akkauntga yuborilgan
                    </span>
                    <time dateTime={item.created_at}>
                      {dateTime(item.created_at)}
                    </time>
                  </header>
                  <h2>{item.title}</h2>
                  <p className="notification-message">{item.message}</p>
                  <p className="muted">Yuborgan: {item.sender_name}</p>
                </article>
              ))}
        </div>
      )}
      {data && (data.next || data.previous) && (
        <nav className="pagination" aria-label="Bildirishnoma sahifalari">
          <span>{page}-sahifa</span>
          <button
            className="icon-btn"
            aria-label="Oldingi sahifa"
            disabled={!data.previous}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            className="icon-btn"
            aria-label="Keyingi sahifa"
            disabled={!data.next}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </nav>
      )}
      <Modal
        open={open}
        onClose={() => {
          if (!sending) setOpen(false);
        }}
        title={
          review ? "Umumiy xabarni tasdiqlash" : "Barchaga yangi bildirishnoma"
        }
        description="Xabar barcha faol akkauntlarga, jumladan o‘quvchi, ota-ona va xodimlarga yuboriladi. Saytga keyingi kirishda ham ko‘rinadi."
      >
        {review ? (
          <div className="form-stack">
            <div className="broadcast-preview">
              <h3>{title}</h3>
              <p className="notification-message">{message}</p>
            </div>
            <p>
              Qabul qiluvchilar:{" "}
              <strong>
                {audience.data?.recipient_count ?? "…"} ta faol akkaunt
              </strong>
            </p>
            <p className="muted">
              Qabul qiluvchilar soni yuborish paytidagi faol akkauntlar bo‘yicha
              aniqlanadi.
            </p>
            {sendError && <ErrorBox message={sendError} />}
            <div className="broadcast-actions">
              <button
                className="btn secondary"
                disabled={sending}
                onClick={() => {
                  setReview(false);
                  setSendError("");
                  setKey(crypto.randomUUID());
                }}
              >
                Tahrirlash
              </button>
              <button className="btn" disabled={sending} onClick={send}>
                {sending ? "Yuborilmoqda…" : "Tasdiqlash va yuborish"}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim() && message.trim()) setReview(true);
            }}
          >
            <div className="field">
              <label htmlFor="broadcast-title">Xabar sarlavhasi</label>
              <input
                id="broadcast-title"
                required
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="broadcast-message">Xabar matni</label>
              <textarea
                id="broadcast-message"
                required
                maxLength={5000}
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <small>{message.length} / 5 000 belgi</small>
            </div>
            {audience.isError && (
              <ErrorBox
                message={errorText(audience.error)}
                retry={() => audience.refetch()}
              />
            )}
            <button
              className="btn"
              disabled={!title.trim() || !message.trim() || !audience.data}
            >
              Xabarni tekshirish
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
