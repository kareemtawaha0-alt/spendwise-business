
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

export default function ResetPasswordPage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();

    let active = true;

    async function checkRecovery() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      // The user must have an authenticated session.
      // The recovery callback creates this session.
      setAuthorized(!error && Boolean(data.user));
      setChecking(false);
    }

    checkRecovery();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");

    if (!authorized) {
      setErrorMessage(
        ar
          ? "رابط الاستعادة غير صالح أو انتهت صلاحيته."
          : "Invalid or expired recovery link."
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        ar
          ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
          : "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        ar
          ? "كلمتا المرور غير متطابقتين."
          : "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      // End the recovery session after changing the password.
      await supabase.auth.signOut();
    } catch {
      setErrorMessage(
        ar
          ? "تعذر تحديث كلمة المرور. حاول مرة أخرى."
          : "Unable to update your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6 py-12"
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
            spendwise<span className="text-blue-600">.</span>
          </span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900">
          {ar ? "تعيين كلمة مرور جديدة" : "Set a new password"}
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          {ar
            ? "أدخل كلمة المرور الجديدة لحسابك في Spendwise."
            : "Enter a new password for your Spendwise account."}
        </p>

        {checking ? (
          <p className="mt-8 text-sm text-slate-500">
            {ar ? "جاري التحقق من الجلسة..." : "Checking session..."}
          </p>
        ) : success ? (
          <div className="mt-8 space-y-5">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              {ar
                ? "تم تغيير كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن."
                : "Password updated successfully! You can now sign in."}
            </div>

            <Link
              href="/login"
              className="block rounded-xl bg-blue-600 px-5 py-4 text-center font-semibold text-white hover:bg-blue-700"
            >
              {ar ? "تسجيل الدخول" : "Sign in"}
            </Link>
          </div>
        ) : !authorized ? (
          <div className="mt-8 space-y-5">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {ar
                ? "الرابط غير صالح أو انتهت صلاحيته. اطلب رابط استعادة جديد."
                : "This link is invalid or expired. Request a new recovery link."}
            </div>

            <Link
              href="/forgot-password"
              className="block text-center font-semibold text-blue-600 hover:underline"
            >
              {ar ? "طلب رابط جديد" : "Request a new link"}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                {ar ? "كلمة المرور الجديدة" : "New password"}
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 px-4 py-4 pe-20 text-slate-900 outline-none focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-600"
                >
                  {showPassword
                    ? ar ? "إخفاء" : "Hide"
                    : ar ? "إظهار" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                {ar ? "تأكيد كلمة المرور" : "Confirm password"}
              </label>

              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-4 py-4 text-slate-900 outline-none focus:border-blue-500"
              />
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
              className="w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading
                ? ar ? "جاري الحفظ..." : "Saving..."
                : ar ? "حفظ كلمة المرور" : "Save new password"}
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-slate-100 pt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            {ar ? "العودة لتسجيل الدخول" : "Back to sign in"}
          </Link>
        </div>
      </div>
    </main>
  );
}
