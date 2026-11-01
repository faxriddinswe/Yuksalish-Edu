import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="container section">
      <span className="eyebrow">404</span>
      <h1>Sahifa topilmadi</h1>
      <p>Havola o‘zgargan yoki sahifa mavjud emas.</p>
      <Link className="btn" href="/">
        Bosh sahifaga
      </Link>
    </main>
  );
}
