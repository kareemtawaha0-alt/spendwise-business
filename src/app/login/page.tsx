
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

export default function LoginPage() {
  const t = useTranslations("Login");
  const { locale } = useLanguage();
  const isArabic = locale === "ar";

  const [returnTo, setReturnTo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const requested =
      new URLSearchParams(window.location.search).get("next") || "";

    // Only allow valid invitation acceptance destinations.
    if (
      requested.startsWith("/invite/accept?") &&
      !requested.startsWith("//")
    ) {
      try {
        const parsed = new URL(requested, window.location.origin);
        const token = parsed.searchParams.get("token") || "";

        if (
          parsed.origin === window.location.origin &&
          /^[0-9a-f]{64}$/.test(token)
        ) {
          setReturnTo(`/invite/accept?token=${token}`);
        }
      } catch {
        // Ignore invalid return destinations.
      }
    }
  }, []);

  const signupHref = returnTo
    ? `/signup?next=${encodeURIComponent(returnTo)}`
    : "/signup";

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(
          isArabic
            ? "تعذر تسجيل الدخول. تأكد من البريد الإلكتروني وكلمة المرور."
            : "Unable to sign in. Check your credentials and try again."
        );
        return;
      }

      window.location.assign(returnTo || "/");
    } catch {
      setErrorMessage(
        isArabic
          ? "حدث خطأ في الاتصال. حاول مرة أخرى."
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-[#091321] text-white lg:grid lg:grid-cols-2"
    >
      {/* Brand section */}
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#0B1930] p-12 lg:flex xl:p-16">
        <div className="pointer-events-none absolute -right-36 top-20 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />

        <div className="relative flex items-center gap-3" dir="ltr">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold shadow-lg shadow-blue-900/40">
            S
          </div>
          <span className="text-2xl font-bold tracking-tight">
            spendwise<span className="text-blue-400">.</span>
          </span>
        </div>

        <div className="relative max-w-xl space-y-7 pt-12">
          <span className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold tracking-widest text-blue-300">
            {isArabic
              ? "إدارة مصروفات الأعمال بذكاء"
              : "SMART SPEND MANAGEMENT"}
          </span>

          <h1 className="text-5xl font-bold leading-[1.15] tracking-tight xl:text-6xl">
            {isArabic ? (
              <>
                كل مصروف.
                <br />
                <span className="text-blue-400">برؤية أوضح.</span>
              </>
            ) : (
              <>
                Every expense.
                <br />
                <span className="text-blue-400">
                  One clear picture.
                </span>
              </>
            )}
          </h1>

          <p className="max-w-md text-lg leading-8 text-slate-400">
            {isArabic
              ? "تحكم بمصروفات شركتك، والموافقات، والميزانيات، والعمليات المالية من مكان واحد."
              : "Take control of business spending, approvals, budgets and financial workflows — all from one place."}
          </p>

          <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {isArabic
                  ? "نظرة عامة على المصروفات"
                  : "Spending overview"}
              </span>
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                {isArabic ? "معاينة" : "Preview"}
              </span>
            </div>

            <div className="text-3xl font-bold" dir="ltr">
              JOD 24,850
            </div>

            <div
              className="mt-6 flex h-28 items-end gap-2"
              dir="ltr"
            >
              {[35, 52, 44, 68, 57, 74, 61, 85, 72, 96].map(
                (height, index) => (
                  <div
                    key={index}
                    className={`flex-1 rounded-t-md ${
                      index === 9
                        ? "bg-blue-400"
                        : "bg-blue-500/30"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                )
              )}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              {isArabic
                ? "بيانات توضيحية وليست بيانات حقيقية"
                : "Illustrative product preview"}
            </p>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-sm text-slate-500">
          <span>© 2026 Spendwise</span>
          <span>
            {isArabic
              ? "مصمم للأعمال الحديثة"
              : "Built for modern businesses"}
          </span>
        </div>
      </section>

      {/* Login section */}
      <section className="relative flex min-h-screen flex-col bg-[#F8FAFC] px-6 py-8 text-slate-900 sm:px-12 lg:justify-center lg:px-16 xl:px-24">
        <div
          className="mb-12 flex items-center gap-3 lg:hidden"
          dir="ltr"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">
            S
          </div>
          <span className="text-2xl font-bold">
            spendwise.
          </span>
        </div>

        <div className="absolute right-6 top-6 z-10 sm:right-10 sm:top-8">
          <LanguageSwitcher />
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-10">
            <p className="mb-3 text-sm font-semibold text-blue-600">
              {t("welcome")}
            </p>

            <h2 className="text-4xl font-bold tracking-tight">
              {t("title")}
            </h2>

            <p className="mt-3 leading-7 text-slate-500">
              {t("description")}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold"
              >
                {t("email")}
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold"
                >
                  {t("password")}
                </label>

                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {isArabic
                    ? "نسيت كلمة المرور؟"
                    : "Forgot password?"}
                </Link>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isArabic
                      ? "أدخل كلمة المرور"
                      : "Enter your password"
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 pe-20 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  {showPassword
                    ? isArabic
                      ? "إخفاء"
                      : "Hide"
                    : isArabic
                      ? "إظهار"
                      : "Show"}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("loading") : t("submit")}
            </button>
          </form>

          <div className="mt-10 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
            {t("noAccount")}{" "}
            <Link
              href={signupHref}
              className="font-semibold text-blue-600 hover:underline"
            >
              {t("createAccount")}
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            {isArabic
              ? "تسجيل الدخول محمي بواسطة Supabase Auth"
              : "Authentication powered by Supabase"}
          </p>
        </div>
      </section>
    </main>
  );
}
