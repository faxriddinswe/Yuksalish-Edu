"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Check } from "lucide-react";
import { api, errorText } from "@/lib/api/client";
import { useDebounce } from "@/features/resources/resource-manager";
import { ErrorBox } from "@/components/ui";
import type { Page, Row } from "@/types";

export function StudentPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const term = useDebounce(text.trim().replace(/\s+/g, " "), 180);
  const waiting = term !== text.trim().replace(/\s+/g, " ");
  const query = useQuery({
    queryKey: ["payment-student-search", term],
    queryFn: ({ signal }) =>
      api<Page<Row>>(
        `students/?page_size=10&search=${encodeURIComponent(term)}`,
        { signal },
      ),
    enabled: open,
    staleTime: 10000,
  });
  const rows = waiting ? [] : query.data?.results || [];
  function choose(row: Row) {
    onChange(String(row.id));
    setText(String(row.full_name));
    setOpen(false);
  }
  return (
    <div className="student-picker">
      <label htmlFor={id}>O‘quvchini qidirish</label>
      <div className="student-search-input">
        <Search size={18} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-results`}
          aria-activedescendant={
            open && rows[active] ? `${id}-option-${active}` : undefined
          }
          placeholder="Ism, familiya yoki telefon…"
          value={text}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            if (
              !event.currentTarget.parentElement?.parentElement?.contains(
                event.relatedTarget,
              )
            )
              setOpen(false);
          }}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
            setOpen(true);
            if (value) onChange("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                Math.max(
                  0,
                  Math.min(
                    rows.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (event.key === "Enter" && open && rows[active]) {
              event.preventDefault();
              choose(rows[active]);
            }
          }}
        />
      </div>
      <small className="muted">
        Katta-kichik harflar farq qilmaydi. Natijani bosing yoki Enter bilan
        tanlang.
      </small>
      {open && (
        <div className="student-search-results">
          {(waiting || query.isFetching) && <p role="status">Qidirilmoqda…</p>}
          {query.isError && (
            <ErrorBox
              message={errorText(query.error)}
              retry={() => query.refetch()}
            />
          )}
          <div
            id={`${id}-results`}
            role="listbox"
            aria-label="Topilgan o‘quvchilar"
          >
            {rows.map((row, index) => (
              <button
                type="button"
                role="option"
                id={`${id}-option-${index}`}
                aria-selected={String(row.id) === value}
                className={index === active ? "highlighted" : ""}
                key={row.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(row)}
              >
                <span>
                  <strong>{String(row.full_name)}</strong>
                  <small>
                    {String(
                      row.phone || row.contact_phone || "Telefon kiritilmagan",
                    )}{" "}
                    · ID {row.id}
                  </small>
                </span>
                {String(row.id) === value && (
                  <Check size={18} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          {!waiting &&
            !query.isFetching &&
            !query.isError &&
            rows.length === 0 && (
              <p>O‘quvchi topilmadi. Ism yoki telefonni tekshiring.</p>
            )}
          {!!query.data && query.data.count > 10 && (
            <p className="muted">
              {query.data.count} ta natija. Ism yoki telefonni aniqroq yozing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
