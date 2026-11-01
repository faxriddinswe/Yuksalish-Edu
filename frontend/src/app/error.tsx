"use client";
import { ErrorBox } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container section">
      <h1>Ma’lumotni yuklab bo‘lmadi</h1>
      <ErrorBox
        message="Server bilan aloqa uzildi. Birozdan so‘ng qayta urinib ko‘ring."
        retry={reset}
      />
    </main>
  );
}
