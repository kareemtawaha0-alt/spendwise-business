
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { useLanguage } from "@/components/language-provider";

type DashboardHeaderProps = {
  title?: string;
  showBackLink?: boolean;
  showSignOut?: boolean;
};

export function DashboardHeader({
  title,
  showBackLink = true,
  showSignOut = false,
}: DashboardHeaderProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    setError("");

    const { error: signOutError } =
      await createClient().auth.signOut();

    if (signOutError) {
      setError(
        ar
          ? "تعذر تسجيل الخروج. حاول مرة ثانية."
          : "Could not sign out. Please try again."
      );
      setSigningOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      dir={ar ? "rtl" : "ltr"}
      className="border-b border-slate-200 bg-white px-6 py-5 lg:px-10"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div>
          {showBackLink ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              {ar ? "← لوحة التحكم" : "← Dashboard"}
            </Link>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              {ar ? "لوحة التحكم" : "DASHBOARD"}
            </p>
          )}

          {title && (
            <h1 className="mt-1 text-xl font-bold text-[#101D35] sm:text-2xl">
              {title}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <LanguageSwitcher />

          {showSignOut && (
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {signingOut
                ? ar
                  ? "جارٍ الخروج..."
                  : "Signing out..."
                : ar
                  ? "تسجيل الخروج"
                  : "Sign out"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </header>
  );
}
