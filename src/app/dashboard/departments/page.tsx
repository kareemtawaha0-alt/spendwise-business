"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";
import { useLanguage } from "@/components/language-provider";

type Department = { id: string; name: string; organization_id: string; created_at: string };
type Membership = { organization_id: string; role: string };

export default function DepartmentsPage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const canManage = membership?.role === "owner" || membership?.role === "finance_manager";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        window.location.replace("/login");
        return;
      }
      const { data: memberships, error: membershipError } = await supabase
        .from("memberships")
        .select("organization_id, role")
        .eq("user_id", auth.user.id)
        .eq("status", "active")
        .limit(1);
      if (membershipError) throw membershipError;
      const current = (memberships as Membership[] | null)?.[0];
      if (!current) {
        window.location.replace("/onboarding");
        return;
      }
      setMembership(current);
      const [organizationResult, departmentsResult] = await Promise.all([
        supabase.from("organizations").select("name").eq("id", current.organization_id).single(),
        supabase.from("departments")
          .select("id, name, organization_id, created_at")
          .eq("organization_id", current.organization_id)
          .order("name", { ascending: true }),
      ]);
      if (organizationResult.error) throw organizationResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      setCompanyName(organizationResult.data?.name ?? "Spendwise Business");
      setDepartments((departmentsResult.data ?? []) as Department[]);
    } catch (cause) {
      console.error("Failed to load departments:", cause);
      setError(ar ? "تعذر تحميل الأقسام. تحقق من صلاحيات Data API وRLS ثم حاول مرة ثانية." : "Could not load departments. Check Data API and RLS permissions, then try again.");
    } finally {
      setLoading(false);
    }
  }, [ar]);

  useEffect(() => { void load(); }, [load]);

  async function addDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || !canManage || working) return;
    const clean = newName.trim();
    if (clean.length < 2 || clean.length > 100) {
      setError(ar ? "اسم القسم لازم يكون بين حرفين و100 حرف." : "Department name must be 2–100 characters.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("departments").insert({
        organization_id: membership.organization_id,
        name: clean,
      });
      if (insertError) throw insertError;
      setNewName("");
      setNotice(ar ? "تمت إضافة القسم بنجاح." : "Department added successfully.");
      await load();
    } catch (cause) {
      console.error("Department insert failed:", cause);
      setError(ar ? "تعذرت إضافة القسم. تأكد من صلاحياتك وحاول مرة ثانية." : "Could not add the department. Check your permissions and try again.");
    } finally {
      setWorking(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || !canManage || !editingId || working) return;
    const clean = editName.trim();
    if (clean.length < 2 || clean.length > 100) {
      setError(ar ? "اسم القسم لازم يكون بين حرفين و100 حرف." : "Department name must be 2–100 characters.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase.from("departments")
        .update({ name: clean })
        .eq("id", editingId)
        .eq("organization_id", membership.organization_id)
        .select("id");
      if (updateError) throw updateError;
      if (!data?.length) throw new Error("No department was updated");
      setEditingId(null);
      setNotice(ar ? "تم تعديل القسم بنجاح." : "Department updated successfully.");
      await load();
    } catch (cause) {
      console.error("Department update failed:", cause);
      setError(ar ? "تعذر تعديل القسم. تحقق من صلاحياتك وحاول مرة ثانية." : "Could not update the department. Check your permissions and try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[#F8FAFC] text-[#0B1930]">
      <DashboardHeader title={ar ? "الأقسام" : "Departments"} />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="mb-8">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{ar ? "إدارة الشركة" : "COMPANY MANAGEMENT"}</span>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{ar ? "الأقسام" : "Departments"}</h1>
          <p className="mt-3 text-slate-500">{ar ? "أنشئ أقسام شركتك وعدّل أسماءها من مكان واحد." : "Create and manage your company's departments in one place."}</p>
          {companyName && <p className="mt-2 text-sm font-semibold text-blue-700">{companyName}</p>}
        </div>

        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {notice && !error && <div role="status" className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div>}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-slate-500">{ar ? "جارٍ تحميل الأقسام..." : "Loading departments..."}</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">{ar ? "إضافة قسم جديد" : "Add a department"}</h2>
              {canManage ? (
                <form onSubmit={addDepartment} className="mt-5 space-y-4">
                  <label htmlFor="new-department" className="block text-sm font-semibold">{ar ? "اسم القسم" : "Department name"}</label>
                  <input id="new-department" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} required placeholder={ar ? "مثال: قسم التسويق" : "e.g. Marketing"} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                  <button disabled={working} type="submit" className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{working ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "إضافة القسم" : "Add department")}</button>
                </form>
              ) : (
                <p className="mt-4 text-sm leading-7 text-slate-500">{ar ? "إضافة الأقسام متاحة لصاحب الشركة والمدير المالي فقط." : "Only owners and finance managers can add departments."}</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{ar ? "أقسام الشركة" : "Company departments"}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{departments.length}</span>
              </div>
              {departments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">{ar ? "ما في أقسام لحد الآن. أضف أول قسم لشركتك." : "No departments yet. Add your first department."}</div>
              ) : (
                <div className="space-y-3">
                  {departments.map((department) => (
                    <div key={department.id} className="rounded-xl border border-slate-200 p-4">
                      {editingId === department.id ? (
                        <form onSubmit={saveEdit} className="flex flex-col gap-3 sm:flex-row">
                          <input aria-label={ar ? "اسم القسم" : "Department name"} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} required className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" />
                          <button type="submit" disabled={working} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{ar ? "حفظ" : "Save"}</button>
                          <button type="button" disabled={working} onClick={() => setEditingId(null)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{ar ? "إلغاء" : "Cancel"}</button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0"><p className="break-words font-semibold">{department.name}</p><p className="mt-1 text-xs text-slate-400">{ar ? "قسم فعّال" : "Active department"}</p></div>
                          {canManage && <button type="button" onClick={() => { setEditingId(department.id); setEditName(department.name); setError(""); setNotice(""); }} className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">{ar ? "تعديل" : "Edit"}</button>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
        <p className="mt-8 text-xs text-slate-400">{ar ? "الحذف والأرشفة غير متاحين حاليًا للحفاظ على السجلات." : "Deletion and archiving are not available yet to preserve records."}</p>
      </div>
    </main>
  );
}
