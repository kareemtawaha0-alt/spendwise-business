"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [token, setToken] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
    let active = true;

    async function check() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      setSignedIn(Boolean(user) && !authError);
      setLoading(false);
    }

    void check();
    return () => { active = false; };
  }, []);

  const returnTo = `/invite/accept?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(returnTo)}`;
  const signupHref = `/signup?next=${encodeURIComponent(returnTo)}`;

  async function accept() {
    if (saving || !/^[0-9a-f]{64}$/.test(token)) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not accept invitation.");
      }
      setSuccess(true);
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not accept invitation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[#F8FAFC] text-[#0B1930]">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            spendwise<span className="text-blue-600">.</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <section className="mx-auto max-w-xl px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">
            {ar ? "الانضمام إلى الشركة" : "Join a company"}
          </h1>
          <p className="mt-3 text-slate-500">
            {ar
              ? "استخدم الحساب المرتبط بإيميل الدعوة، وتأكد من تفعيل الإيميل قبل قبولها."
              : "Use the account associated with the invitation email and verify your email before accepting."}
          </p>

          {loading ? (
            <p className="mt-6">{ar ? "جارٍ التحقق..." : "Checking..."}</p>
          ) : success ? (
            <div className="mt-6 space-y-4">
              <p className="font-semibold text-green-700">
                {ar ? "تم قبول الدعوة! جارٍ تحويلك إلى لوحة التحكم..." : "Invitation accepted! Redirecting to your dashboard..."}
              </p>
              <Link href="/dashboard" className="inline-block rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">
                {ar ? "الذهاب إلى لوحة التحكم" : "Go to dashboard"}
              </Link>
            </div>
          ) : !/^[0-9a-f]{64}$/.test(token) ? (
            <p className="mt-6 text-red-700">
              {ar ? "رابط الدعوة غير صالح." : "Invalid invitation link."}
            </p>
          ) : !signedIn ? (
            <div className="mt-6 space-y-3">
              <p>
                {ar
                  ? "سجّل دخولك أو أنشئ حسابًا. سنحتفظ برابط الدعوة لإكمال الانضمام بعد الدخول."
                  : "Sign in or create an account. Your invitation link will be preserved so you can finish joining."}
              </p>
              <Link href={loginHref} className="inline-block rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">
                {ar ? "تسجيل الدخول" : "Sign in"}
              </Link>
              <p className="text-sm text-slate-500">
                {ar ? "ما عندك حساب؟ " : "New here? "}
                <Link href={signupHref} className="text-blue-600 underline">
                  {ar ? "إنشاء حساب" : "Sign up"}
                </Link>
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => void accept()}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? (ar ? "جارٍ القبول..." : "Accepting...")
                  : (ar ? "قبول الدعوة" : "Accept invitation")}
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
