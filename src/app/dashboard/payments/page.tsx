"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notification-bell";

type Expense = {
  id: string;
  title: string;
  requester_id: string;
  department_id: string;
  amount: number | string;
  currency: string;
  status: string;
  submitted_at: string;
};
type Payment = {
  id: string;
  request_id: string;
  amount: number | string;
  currency: string;
  payment_method: string;
  payment_reference: string | null;
  note: string | null;
  paid_at: string;
};
type Department = { id: string; name: string };
type Profile = { id: string; full_name: string | null };

const toAmount = (value: number | string) => Number(value) || 0;

export default function PaymentsPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [company, setCompany] = useState("");
  const [requests, setRequests] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"awaiting" | "history">("awaiting");
  const [refresh, setRefresh] = useState(0);

  const money = (value: number | string, currency = "JOD") =>
    `${toAmount(value).toLocaleString(ar ? "ar-JO" : "en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} ${currency}`;
  const date = (value: string) =>
    new Intl.DateTimeFormat(ar ? "ar-JO" : "en-GB", {
      timeZone: "Asia/Amman", year: "numeric", month: "short", day: "numeric",
    }).format(new Date(value));
  const methodName = (value: string) => ({
    cash: ar ? "نقدًا" : "Cash",
    bank_transfer: ar ? "تحويل بنكي" : "Bank transfer",
    other: ar ? "أخرى" : "Other",
  }[value] ?? value);

  const load = useCallback(async (active: () => boolean) => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!active()) return;
      if (authError || !auth.user) { router.replace("/login"); return; }

      const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .select("organization_id, role")
        .eq("user_id", auth.user.id)
        .eq("status", "active")
        .single();
      if (!active()) return;
      if (membershipError || !membership) throw membershipError ?? new Error("No membership");
      if (membership.role !== "owner" && membership.role !== "finance_manager") {
        router.replace("/dashboard"); return;
      }

      const orgId = membership.organization_id;
      const [orgResult, requestResult, paymentResult, departmentResult] = await Promise.all([
        supabase.from("organizations").select("name").eq("id", orgId).single(),
        supabase.from("expense_requests")
          .select("id, title, requester_id, department_id, amount, currency, status, submitted_at")
          .eq("organization_id", orgId)
          .eq("status", "approved")
          .order("submitted_at", { ascending: false }),
        supabase.from("expense_payments")
          .select("id, request_id, amount, currency, payment_method, payment_reference, note, paid_at")
          .eq("organization_id", orgId)
          .order("paid_at", { ascending: false }),
        supabase.from("departments").select("id, name").eq("organization_id", orgId),
      ]);
      if (!active()) return;
      if (orgResult.error) throw orgResult.error;
      if (requestResult.error) throw requestResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (departmentResult.error) throw departmentResult.error;

      const requestRows = (requestResult.data ?? []) as Expense[];
      const paymentRows = (paymentResult.data ?? []) as Payment[];
      const requesterIds = [...new Set(requestRows.map(r => r.requester_id))];
      let profileRows: Profile[] = [];
      if (requesterIds.length) {
        const result = await supabase.from("profiles").select("id, full_name").in("id", requesterIds);
        if (!active()) return;
        // Names are optional: the payment workflow must still work if profiles are restricted.
        if (!result.error) profileRows = (result.data ?? []) as Profile[];
      }
      setCompany(orgResult.data.name);
      setRequests(requestRows);
      setPayments(paymentRows);
      setDepartments((departmentResult.data ?? []) as Department[]);
      setProfiles(profileRows);
    } catch (err) {
      console.error("Payments load error:", err);
      if (active()) setError(ar ? "تعذر تحميل المدفوعات. تحقق من صلاحيات قاعدة البيانات." : "Could not load payments. Check database permissions.");
    } finally {
      if (active()) setLoading(false);
    }
  }, [router, ar]);

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load, refresh]);

  const paidIds = useMemo(() => new Set(payments.map(p => p.request_id)), [payments]);
  const awaiting = useMemo(() => requests.filter(r => !paidIds.has(r.id)), [requests, paidIds]);
  const requestMap = useMemo(() => new Map(requests.map(r => [r.id, r])), [requests]);
  const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p.full_name])), [profiles]);
  const totalAwaiting = awaiting.reduce((sum, r) => sum + toAmount(r.amount), 0);
  const totalPaid = payments.reduce((sum, p) => sum + toAmount(p.amount), 0);

  function openPayment(request: Expense) {
    setSelected(request);
    setMethod("bank_transfer");
    setReference("");
    setNote("");
    setError("");
    setSuccess("");
  }

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("spendwise_record_payment", {
        p_request_id: selected.id,
        p_payment_method: method,
        p_payment_reference: reference.trim() || null,
        p_note: note.trim() || null,
      });
      if (rpcError) throw rpcError;
      setSelected(null);
      setSuccess(ar ? "تم تسجيل الصرف بنجاح. لم يتم تحويل أموال من خلال Spendwise." : "Payment recorded successfully. No money was transferred by Spendwise.");
      setRefresh(v => v + 1);
    } catch (err) {
      console.error("Record payment error:", err);
      setError(ar ? "فشل تسجيل الصرف. تأكد أن الطلب معتمد ولم يُصرف سابقًا، ثم حاول مرة أخرى." : "Could not record payment. Ensure this request is approved and not already paid, then retry.");
      setRefresh(v => v + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[#F5F7FB] text-[#101D35]">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">{ar ? "العودة" : "Back"}</Link>
            <div><p className="text-xs font-semibold text-blue-600">Spendwise Business</p><h1 className="text-2xl font-bold">{ar ? "المدفوعات" : "Payments"}</h1></div>
          </div>
          <div className="flex items-center gap-3"><NotificationBell /><LanguageSwitcher /></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="rounded-2xl bg-[#102544] p-7 text-white">
          <p className="text-sm text-blue-300">{company || "Spendwise Business"}</p>
          <h2 className="mt-2 text-2xl font-bold">{ar ? "إدارة صرف الطلبات المعتمدة" : "Approved Request Payments"}</h2>
          <p className="mt-2 text-sm text-slate-300">{ar ? "سجّل المدفوعات التي أجرتها الشركة خارج النظام. الموافقة وحدها لا تعني استلام المبلغ." : "Record payments made by the company outside Spendwise. Approval does not mean the funds were received."}</p>
        </section>

        {success && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">{ar ? "بانتظار الصرف" : "Awaiting Payment"}</p><p className="mt-2 text-3xl font-bold">{loading ? "—" : awaiting.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">{ar ? "مبالغ بانتظار الصرف" : "Awaiting Amount"}</p><p className="mt-2 text-xl font-bold">{loading ? "—" : money(totalAwaiting)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">{ar ? "إجمالي الصرف المسجل" : "Recorded Payments"}</p><p className="mt-2 text-xl font-bold">{loading ? "—" : money(totalPaid)}</p></div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setTab("awaiting")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === "awaiting" ? "bg-blue-600 text-white" : "border border-slate-200 bg-white"}`}>{ar ? "بانتظار الصرف" : "Awaiting Payment"} ({loading ? "…" : awaiting.length})</button>
          <button type="button" onClick={() => setTab("history")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === "history" ? "bg-blue-600 text-white" : "border border-slate-200 bg-white"}`}>{ar ? "سجل المدفوعات" : "Payment History"} ({loading ? "…" : payments.length})</button>
          <button type="button" disabled={loading} onClick={() => setRefresh(v => v + 1)} className="ms-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{ar ? "تحديث" : "Refresh"}</button>
        </div>

        {loading ? <div className="rounded-2xl bg-white p-12 text-center text-slate-500">{ar ? "جارٍ تحميل المدفوعات..." : "Loading payments..."}</div> : !error || success ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-6"><h3 className="text-lg font-bold">{tab === "awaiting" ? (ar ? "طلبات معتمدة لم تُصرف" : "Approved, Unpaid Requests") : (ar ? "سجل الصرف" : "Payment History")}</h3></div>
            {tab === "awaiting" ? awaiting.length === 0 ? <p className="p-8 text-center text-slate-500">{ar ? "لا توجد طلبات بانتظار الصرف." : "No approved requests awaiting payment."}</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{[ar ? "الطلب" : "Request", ar ? "الموظف" : "Employee", ar ? "القسم" : "Department", ar ? "المبلغ" : "Amount", ar ? "تاريخ الطلب" : "Submitted", ar ? "الإجراء" : "Action"].map(h => <th key={h} className="px-5 py-4 text-start">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{awaiting.map(r => <tr key={r.id}><td className="px-5 py-4 font-semibold">{r.title}</td><td className="px-5 py-4">{profileMap.get(r.requester_id) || "—"}</td><td className="px-5 py-4">{departmentMap.get(r.department_id) || "—"}</td><td className="px-5 py-4 font-semibold" dir="ltr">{money(r.amount, r.currency)}</td><td className="px-5 py-4">{date(r.submitted_at)}</td><td className="px-5 py-4"><button type="button" onClick={() => openPayment(r)} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">{ar ? "تسجيل الصرف" : "Mark as Paid"}</button></td></tr>)}</tbody></table></div>
            ) : payments.length === 0 ? <p className="p-8 text-center text-slate-500">{ar ? "لا توجد عمليات صرف مسجلة." : "No recorded payments."}</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{[ar ? "الطلب" : "Request", ar ? "المبلغ" : "Amount", ar ? "طريقة الدفع" : "Method", ar ? "المرجع" : "Reference", ar ? "تاريخ الصرف" : "Paid Date", ar ? "ملاحظات" : "Notes"].map(h => <th key={h} className="px-5 py-4 text-start">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{payments.map(p => <tr key={p.id}><td className="px-5 py-4 font-semibold">{requestMap.get(p.request_id)?.title || p.request_id.slice(0, 8)}</td><td className="px-5 py-4" dir="ltr">{money(p.amount, p.currency)}</td><td className="px-5 py-4">{methodName(p.payment_method)}</td><td className="px-5 py-4">{p.payment_reference || "—"}</td><td className="px-5 py-4">{date(p.paid_at)}</td><td className="px-5 py-4">{p.note || "—"}</td></tr>)}</tbody></table></div>
            )}
          </section>
        ) : null}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="payment-dialog-title" className="text-xl font-bold">{ar ? "تأكيد تسجيل الصرف" : "Confirm Payment Record"}</h2>
            <p className="mt-2 text-sm text-slate-600">{selected.title} — <strong>{money(selected.amount, selected.currency)}</strong></p>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-800">{ar ? "اضغط تأكيد فقط بعد أن تكون الشركة قد دفعت المبلغ فعلًا خارج Spendwise. هذا الإجراء لا يحوّل الأموال." : "Confirm only after the company has actually paid outside Spendwise. This action does not transfer funds."}</p>
            <form onSubmit={event => void recordPayment(event)} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">{ar ? "طريقة الدفع" : "Payment Method"}<select required value={method} onChange={e => setMethod(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3"><option value="bank_transfer">{ar ? "تحويل بنكي" : "Bank Transfer"}</option><option value="cash">{ar ? "نقدًا" : "Cash"}</option><option value="other">{ar ? "أخرى" : "Other"}</option></select></label>
              <label className="block text-sm font-semibold">{ar ? "رقم المرجع (اختياري)" : "Payment Reference (optional)"}<input value={reference} maxLength={200} onChange={e => setReference(e.target.value)} placeholder={ar ? "مثال: رقم الحوالة" : "e.g. transfer number"} className="mt-2 w-full rounded-xl border border-slate-200 p-3" /></label>
              <label className="block text-sm font-semibold">{ar ? "ملاحظات (اختياري)" : "Notes (optional)"}<textarea value={note} maxLength={1000} onChange={e => setNote(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3" /></label>
              <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={saving} onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 font-semibold disabled:opacity-50">{ar ? "إلغاء" : "Cancel"}</button><button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? (ar ? "جارٍ التسجيل..." : "Saving...") : (ar ? "تأكيد تسجيل الصرف" : "Confirm Payment")}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
