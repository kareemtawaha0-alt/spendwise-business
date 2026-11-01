"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

export default function SignupPage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [returnTo, setReturnTo] = useState("");

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("next") || "";
    // Only allow an invitation acceptance path, never an external redirect.
    try {
      const parsed = new URL(candidate, window.location.origin);
      if (
        candidate.startsWith("/invite/accept?") &&
        parsed.origin === window.location.origin &&
        /^\/[a-z]/.test(parsed.pathname) &&
        parsed.pathname === "/invite/accept" &&
        /^[0-9a-f]{64}$/.test(parsed.searchParams.get("token") || "")
      ) {
        setReturnTo(parsed.pathname + parsed.search);
      }
    } catch { /* Invalid return URL: ignore it. */ }
  }, []);

  const loginHref = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login";

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    if (name.trim().length < 2) {
      setErrorMessage(ar ? "الاسم لازم يكون حرفين على الأقل." : "Please enter at least two characters for your name.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage(ar ? "كلمة المرور لازم تكون 8 أحرف على الأقل." : "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(ar ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccess(true);
      }
    } catch {
      setErrorMessage(ar ? "حدث خطأ غير متوقع. حاول مرة ثانية." : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[#091321] text-white lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#0B1930] p-12 lg:flex xl:p-16">
        <div className="pointer-events-none absolute -right-36 top-20 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="relative flex items-center gap-3" dir="ltr">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold shadow-lg shadow-blue-900/40">S</div>
          <span className="text-2xl font-bold tracking-tight">spendwise<span className="text-blue-400">.</span></span>
        </div>
        <div className="relative max-w-xl space-y-7 pt-12">
          <span className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold tracking-widest text-blue-300">
            {ar ? "إدارة مصروفات الأعمال بذكاء" : "SMART SPEND MANAGEMENT"}
          </span>
          <h1 className="text-5xl font-bold leading-[1.15] tracking-tight xl:text-6xl">
            {ar ? <>ابدأ بوضوح.<br /><span className="text-blue-400">وتحكّم بكل مصروف.</span></> : <>Spend smarter.<br /><span className="text-blue-400">Grow with clarity.</span></>}
          </h1>
          <p className="max-w-md text-lg leading-8 text-slate-400">
            {ar ? "أنشئ حسابك وابدأ بتنظيم طلبات الصرف والموافقات والميزانيات في مكان واحد." : "Create your account to bring spending requests, approvals and budgets together in one place."}
          </p>
          <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl backdrop-blur-sm">
            <p className="mb-5 text-sm font-semibold text-slate-200">{ar ? "منصة واحدة لفريقك" : "One workspace for your team"}</p>
            {[
              ar ? "طلبات مصروفات منظمة" : "Organized spending requests",
              ar ? "موافقات واضحة" : "Clear approval workflows",
              ar ? "رؤية أفضل للميزانيات" : "Better budget visibility",
            ].map((item) => (
              <div key={item} className="mb-3 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-between text-sm text-slate-500">
          <span>© 2026 Spendwise</span>
          <span>{ar ? "مصمم للأعمال الحديثة" : "Built for modern businesses"}</span>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col bg-[#F8FAFC] px-6 py-8 text-slate-900 sm:px-12 lg:justify-center lg:px-16 xl:px-24">
        <div className="absolute right-6 top-6 z-50 sm:right-10 sm:top-8"><LanguageSwitcher /></div>
        <div className="mb-12 flex items-center gap-3 lg:hidden" dir="ltr">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">S</div>
          <span className="text-2xl font-bold">spendwise.</span>
        </div>
        <div className="mx-auto w-full max-w-md py-8 lg:py-0">
          {success ? (
            <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl text-blue-600">✉</div>
              <h1 className="text-3xl font-bold tracking-tight">{ar ? "افتح بريدك الإلكتروني" : "Check your email"}</h1>
              <p className="mt-4 leading-7 text-slate-500">
                {ar ? "إذا كان التسجيل متاحًا لهذا البريد، ستصلك رسالة لتأكيد الحساب. افتح الرابط الموجود فيها لإكمال التسجيل." : "If registration is available for this address, you'll receive a confirmation email. Open its link to complete your registration."}
              </p>
              <p className="mt-3 break-all font-semibold text-slate-800" dir="ltr">{email.trim()}</p>
              <Link href={loginHref} className="mt-8 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">
                {ar ? "العودة لتسجيل الدخول" : "Back to sign in"}
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <p className="mb-3 text-sm font-semibold text-blue-600">{ar ? "ابدأ الآن" : "GET STARTED"}</p>
                <h1 className="text-4xl font-bold tracking-tight">{ar ? "أنشئ حساب Spendwise" : "Create your account"}</h1>
                <p className="mt-3 leading-7 text-slate-500">{ar ? "أنشئ حسابك لتبدأ إدارة مصروفات أعمالك." : "Get started with a smarter way to manage business spending."}</p>
              </div>
              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label htmlFor="fullName" className="mb-2 block text-sm font-semibold">{ar ? "الاسم الكامل" : "Full name"}</label>
                  <input id="fullName" type="text" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? "اكتب اسمك الكامل" : "Your full name"} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold">{ar ? "البريد الإلكتروني للعمل" : "Work email"}</label>
                  <input id="email" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold">{ar ? "كلمة المرور" : "Password"}</label>
                  <div className="relative">
                    <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={ar ? "8 أحرف على الأقل" : "At least 8 characters"} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 pe-20 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute end-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-600 hover:text-blue-700">
                      {showPassword ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold">{ar ? "تأكيد كلمة المرور" : "Confirm password"}</label>
                  <input id="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={ar ? "أعد كتابة كلمة المرور" : "Repeat your password"} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                </div>
                {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>}
                <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? (ar ? "جارٍ إنشاء الحساب..." : "Creating account...") : (ar ? "إنشاء الحساب" : "Create account")}
                </button>
              </form>
              <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
                {ar ? "عندك حساب بالفعل؟" : "Already have an account?"}{" "}
                <Link href={loginHref} className="font-semibold text-blue-600 hover:underline">{ar ? "تسجيل الدخول" : "Sign in"}</Link>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
