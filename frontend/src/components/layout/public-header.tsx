"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
const links = [
  ["/kurslar", "Kurslar"],
  ["/ustozlar", "Ustozlar"],
  ["/natijalar", "Natijalar"],
  ["/markaz-haqida", "Markaz haqida"],
  ["/boglanish", "Bog‘lanish"],
];
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-header">
      <div className="container header-inner">
        <Link
          className="wordmark"
          href="/"
          aria-label="Yuksalish Edu bosh sahifa"
        >
          Yuksalish<span> Edu</span>
          <small>O‘QUV MARKAZI</small>
        </Link>
        <nav className="desktop-nav" aria-label="Asosiy navigatsiya">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/kirish" className="btn secondary login-link">
          Kabinetga kirish <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
        <button
          className="icon-btn mobile-menu"
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-navigation"
          className="mobile-public-nav"
          aria-label="Telefon navigatsiyasi"
        >
          {links.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Link href="/kirish" onClick={() => setOpen(false)}>
            Kabinetga kirish
          </Link>
        </nav>
      )}
    </header>
  );
}
