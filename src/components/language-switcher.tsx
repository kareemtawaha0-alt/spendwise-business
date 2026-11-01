
"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher() {
  const { locale, changeLanguage } = useLanguage();

  return (
    <div
      dir="ltr"
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => changeLanguage("en")}
        aria-pressed={locale === "en"}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          locale === "en"
            ? "bg-blue-600 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => changeLanguage("ar")}
        aria-pressed={locale === "ar"}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          locale === "ar"
            ? "bg-blue-600 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        عربي
      </button>
    </div>
  );
}
