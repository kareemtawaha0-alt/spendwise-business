
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

export default function ForgotPasswordPage() {
  const { locale } = useLanguage();
  const isArabic = locale === "ar";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const redirectTo = new URL(
        "/auth/confirm",
        window.location.origin
      );

      redirectTo.searchParams.set("next", "/reset-password");

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: redirectTo.toString(),
        }
      );

      if (error) {
        throw error;
      }

      setSent(true);
    } catch (error: unknown) {
      console.error("Password recovery error:", error);

      const message =
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر إرسال رابط الاستعادة. حاول مرة أخرى."
            : "Unable to send the recovery link. Please try again.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="relative flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6 py-12"
    >
      <div className="absolute end-6 top-6">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3" dir="ltr">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
            S
          </div>

          <span className="text-2xl font-bold text-slate-900">
            spendwise
            <span className="text-blue-600">.</span>
          </span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900">
          {isArabic
            ? "نسيت كلمة المرور؟"
            : "Forgot your password?"}
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          {isArabic
            ? "أدخل بريدك الإلكتروني وسنرسل لك رابطًا لتعيين كلمة مرور جديدة."
            : "Enter your email address and we'll send you a link to reset your password."}
        </p>

        {sent ? (
          <div className="mt-8 space-y-5">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-7 text-green-800">
              {isArabic
                ? "إذا كان البريد الإلكتروني مسجلًا، ستصلك رسالة تحتوي على رابط استعادة كلمة المرور. تحقق من صندوق الوارد والرسائل غير المرغوب فيها."
                : "If the email is registered, you'll receive a password reset link. Check your inbox and spam folder."}
            </div>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setErrorMessage("");
              }}
              className="w-full rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {isArabic
                ? "استخدام بريد إلكتروني آخر"
                : "Use another email"}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                {isArabic
                  ? "البريد الإلكتروني"
                  : "Email address"}
              </label>

              <input
                id="email"
                type="email"
                required
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
              >
                <p className="font-semibold">
                  {isArabic
                    ? "تعذر إرسال رابط الاستعادة"
                    : "Password recovery failed"}
                </p>

                <p className="mt-2 break-words" dir="auto">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? isArabic
                  ? "جاري الإرسال..."
                  : "Sending..."
                : isArabic
                  ? "إرسال رابط الاستعادة"
                  : "Send recovery link"}
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-slate-100 pt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            {isArabic
              ? "العودة إلى تسجيل الدخول"
              : "Back to sign in"}
          </Link>
        </div>
      </div>
    </main>
  );
}
