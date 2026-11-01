"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

type Organization = { organization_id: string; role: string };

export default function OnboardingPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || !user) {
          window.location.replace("/login");
          return;
        }

        const { data, error: memberError } = await supabase
          .from("memberships")
          .select("organization_id, role")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1);

        if (!active) return;

        if (memberError) {
          setError(
            ar
              ? "تعذر التحقق من عضويتك. حاول تحديث الصفحة."
              : "Could not check your membership. Please refresh."
          );
          return;
        }

        if ((data as Organization[] | null)?.length) {
          window.location.replace("/dashboard");
          return;
        }
      } catch (cause) {
        console.error("Session check failed:", cause);
        if (active) {
          setError(
            ar
              ? "حدث خطأ في الاتصال. حاول تحديث الصفحة."
              : "Connection error. Please refresh."
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [ar]);

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 160) {
      setError(
        ar
          ? "اسم الشركة لازم يكون بين حرفين و160 حرفًا."
          : "Company name must be 2–160 characters."
      );
      return;
    }

    setError("");
    setSaving(true);

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc(
        "spendwise_create_organization",
        { p_name: cleanName }
      );

      if (rpcError) throw rpcError;
      if (typeof data !== "string") {
        throw new Error("Unexpected organization response");
      }

      // Navigate only after Supabase confirms organization creation.
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      console.error("Organization creation failed:", cause);
      setError(
        ar
          ? "تعذر إنشاء الشركة. تأكد من تسجيل الدخول وصلاحيات قاعدة البيانات."
          : "Could not create the company. Check your session and database permissions."
      );
      setSaving(false);
    }
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F8FAFC] text-slate-900"
    >
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 sm:px-12">
        <Link href="/" className="flex items-center gap-3" dir="ltr">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
            S
          </span>
          <span className="text-2xl font-bold tracking-tight">
            spendwise<span className="text-blue-600">.</span>
          </span>
        </Link>
        <LanguageSwitcher />
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-90px)] max-w-3xl flex-col justify-center px-6 py-16">
        <div className="mb-8">
          <span className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
            {ar ? "إعداد مساحة العمل" : "WORKSPACE SETUP"}
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            {ar ? "خلّينا نجهّز شركتك" : "Let's set up your company"}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-500">
            {ar
              ? "أنشئ مساحة عمل خاصة بشركتك لإدارة المصروفات والموافقات والميزانيات من مكان واحد."
              : "Create a secure workspace for your business spending, approvals and budgets."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          {checking ? (
            <p className="text-slate-500">
              {ar ? "جارٍ التحقق من حسابك..." : "Checking your account..."}
            </p>
          ) : (
            <form onSubmit={createOrganization} className="space-y-6">
              <div>
                <label
                  htmlFor="organizationName"
                  className="mb-2 block text-sm font-semibold"
                >
                  {ar ? "اسم الشركة" : "Company name"}
                </label>
                <input
                  id="organizationName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={160}
                  autoComplete="organization"
                  placeholder={
                    ar ? "مثال: شركة الأفق للتقنية" : "e.g. Horizon Technology"
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {ar
                    ? "بتقدر تعدّل الاسم لاحقًا."
                    : "You can change this later."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">
                    {ar ? "الدولة" : "Country"}
                  </p>
                  <p className="mt-1 font-semibold">
                    {ar ? "الأردن" : "Jordan"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">
                    {ar ? "العملة" : "Currency"}
                  </p>
                  <p className="mt-1 font-semibold">
                    JOD — {ar ? "دينار أردني" : "Jordanian Dinar"}
                  </p>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || checking}
                className="w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? ar
                    ? "جارٍ إنشاء الشركة..."
                    : "Creating company..."
                  : ar
                    ? "إنشاء الشركة"
                    : "Create organization"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          © 2026 Spendwise Business
        </p>
      </section>
    </main>
  );
}
