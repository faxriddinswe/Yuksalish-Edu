"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";

export function ImageUpload({
  label,
  value,
  onChange,
  inputId,
}: {
  inputId?: string;
  label: string;
  value: unknown;
  onChange: (value: File | string) => void;
}) {
  const generatedId = useId();
  const id = inputId || generatedId;
  const input = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);
  const preview =
    value instanceof File
      ? localPreview
      : typeof value === "string" && value
        ? `/api/v1/content/image-preview/?path=${encodeURIComponent(value.replace(/^\/media\//, ""))}`
        : "";
  return (
    <div className="image-upload">
      <div className={`upload-preview ${preview ? "has-image" : ""}`}>
        {preview ? (
          <Image
            unoptimized
            src={preview}
            alt={`${label}: tanlangan rasm`}
            width={640}
            height={400}
          />
        ) : (
          <div>
            <ImagePlus size={32} aria-hidden="true" />
            <span>Rasm tanlanmagan</span>
          </div>
        )}
      </div>
      <input
        ref={input}
        id={id}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        aria-describedby={`${id}-help`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (
            !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
            file.size > 5 * 1024 * 1024
          ) {
            setError(
              "JPEG, PNG yoki WebP rasm tanlang. Hajmi 5 MB dan oshmasin.",
            );
            event.target.value = "";
            return;
          }
          setError("");
          setLocalPreview(URL.createObjectURL(file));
          onChange(file);
        }}
      />
      <div className="upload-actions">
        <button
          type="button"
          className="btn secondary"
          onClick={() => input.current?.click()}
        >
          <Upload size={17} aria-hidden="true" />
          {preview ? "Rasmni almashtirish" : "Rasm yuklash"}
        </button>
        {preview && (
          <button
            type="button"
            className="btn text-button"
            onClick={() => {
              onChange("");
              setLocalPreview("");
              if (input.current) input.current.value = "";
            }}
          >
            <X size={17} aria-hidden="true" />
            Rasmni olib tashlash
          </button>
        )}
      </div>
      <small id={`${id}-help`} className="muted">
        JPEG, PNG yoki WebP · 5 MB gacha · 5000 × 5000 px gacha. Saqlash tugmasi
        bosilgach yuklanadi.
      </small>
      {value instanceof File && (
        <small className="selected-file">
          {value.name} · {(value.size / 1024 / 1024).toFixed(1)} MB
        </small>
      )}
      {error && (
        <span role="alert" className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
