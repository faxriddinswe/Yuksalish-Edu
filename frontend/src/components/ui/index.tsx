"use client";
import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Inbox, LoaderCircle, AlertCircle } from "lucide-react";
import { statusLabels } from "@/lib/formatting";
export function Status({ value }: { value: unknown }) {
  const v = String(value || "");
  return (
    <span
      className={`status ${["PAID", "PRESENT", "POSTED", "ACTIVE", "PUBLISHED", "CONFIRMED"].includes(v) ? "success" : ["OVERDUE", "ABSENT", "FAILED", "VOID"].includes(v) ? "danger" : ["PENDING", "PARTIAL", "WAITING", "LATE"].includes(v) ? "warning" : ""}`}
    >
      {statusLabels[v] || v || "—"}
    </span>
  );
}
export function Loading() {
  return (
    <div role="status" className="state">
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>Ma’lumotlar yuklanmoqda…</p>
    </div>
  );
}
export function Empty({ text = "Hozircha yozuvlar yo‘q." }: { text?: string }) {
  return (
    <div className="state">
      <Inbox size={32} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="notice error">
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <p>{message}</p>
        {retry && (
          <button className="btn secondary" onClick={retry}>
            Qayta urinish
          </button>
        )}
      </div>
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal"
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Oynani yopish">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">
            {description || "Ma’lumotlarni tekshirib, saqlashni tasdiqlang."}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
