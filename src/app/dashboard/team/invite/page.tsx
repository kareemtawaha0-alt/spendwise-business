"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";
import { useLanguage } from "@/components/language-provider";

type Department = { id: string; name: string };
type Role = "finance_manager" | "department_manager" | "employee";

export default function InviteMemberPage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [myRole, setMyRole] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.replace("/login"); return; }
        const { data: memberships, error: membershipError } = await supabase
          .from("memberships").select("organization_id,role")
          .eq("user_id", user.id).eq("status", "active").limit(1);
        if (membershipError) throw membershipError;
        const membership = memberships?.[0];
        if (!membership) { window.location.replace("/onboarding"); return; }
        if (!active) return;
        setOrganizationId(membership.organization_id);
        setMyRole(membership.role);
        if (!["owner", "finance_manager"].includes(membership.role)) return;
        const [org, depts] = await Promise.all([
          supabase.from("organizations").select("name").eq("id", membership.organization_id).single(),
          supabase.from("departments").select("id,name").eq("organization_id", membership.organization_id).order("name"),
        ]);
        if (org.error) throw org.error;
        if (depts.error) throw depts.error;
        if (active) {
          setOrganizationName(org.data.name);
          setDepartments(depts.data ?? []);
        }
      } catch (cause) {
        console.error(cause);
        if (active) setError(ar ? "تعذر تحميل البيانات." : "Could not load company details.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [ar]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(""); setUrl(""); setSaving(true);
    try {
      const response = await fetch("/api/invitations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, email, role, departmentId: departmentId || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create invitation.");
      setUrl(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create invitation.");
    } finally { setSaving(false); }
  }

  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[#F8FAFC] text-[#0B1930]">
      <DashboardHeader title={ar ? "دعوة عضو للفريق" : "Invite a team member"} />
      <section className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/dashboard/team" className="text-sm font-semibold text-blue-600">{ar ? "← العودة للفريق" : "← Back to team"}</Link>
        <p className="mt-4 text-slate-500">{organizationName || (ar ? "مساحة العمل" : "Workspace")}</p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          {loading ? <p>{ar ? "جارٍ التحميل..." : "Loading..."}</p> : !["owner", "finance_manager"].includes(myRole) ? (
            <p className="text-amber-700">{ar ? "ليس لديك صلاحية إرسال الدعوات." : "You do not have permission to invite members."}</p>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor="invite-email" className="mb-2 block text-sm font-semibold">{ar ? "البريد الإلكتروني" : "Email address"}</label>
                <input id="invite-email" type="email" required maxLength={320} value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@example.com" dir="ltr" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="invite-role" className="mb-2 block text-sm font-semibold">{ar ? "الدور" : "Role"}</label>
                <select id="invite-role" value={role} onChange={e => setRole(e.target.value as Role)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <option value="employee">{ar ? "موظف" : "Employee"}</option>
                  <option value="department_manager">{ar ? "مدير قسم" : "Department Manager"}</option>
                  {myRole === "owner" && <option value="finance_manager">{ar ? "مدير مالي" : "Finance Manager"}</option>}
                </select>
              </div>
              <div>
                <label htmlFor="invite-department" className="mb-2 block text-sm font-semibold">{ar ? "القسم" : "Department"}</label>
                <select id="invite-department" value={departmentId} onChange={e => setDepartmentId(e.target.value)} required={role === "department_manager"} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <option value="">{ar ? "بدون قسم" : "No department"}</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {role === "department_manager" && <p className="mt-2 text-xs text-slate-500">{ar ? "مدير القسم لازم تختار له قسمًا." : "A department is required for department managers."}</p>}
              </div>
              {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? (ar ? "جارٍ الإنشاء..." : "Creating...") : (ar ? "إنشاء رابط الدعوة" : "Create invitation link")}</button>
            </form>
          )}
          {url && <div className="mt-6 space-y-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-green-800">{ar ? "تم إنشاء الدعوة. انسخ الرابط وأرسله للشخص المقصود." : "Invitation created. Copy the link and share it with the intended person."}</p>
            <input aria-label="Invitation link" readOnly value={url} dir="ltr" className="w-full rounded-lg border border-green-200 bg-white p-3 text-xs" onFocus={e => e.target.select()} />
            <button type="button" onClick={() => void navigator.clipboard.writeText(url)} className="rounded-lg bg-[#0B1930] px-4 py-2 text-sm font-semibold text-white">{ar ? "نسخ الرابط" : "Copy link"}</button>
            <p className="text-xs text-green-800">{ar ? "الرابط صالح لمدة 7 أيام. احتفظ به الآن؛ لن نعرض الرمز الأصلي مرة ثانية." : "Valid for 7 days. Save it now; the original token will not be shown again."}</p>
          </div>}
        </div>
      </section>
    </main>
  );
}
