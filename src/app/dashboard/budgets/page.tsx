
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";
import { useLanguage } from "@/components/language-provider";

type Role =
  | "owner"
  | "finance_manager"
  | "department_manager"
  | "employee";

type Membership = {
  organization_id: string;
  department_id: string | null;
  role: Role;
};

type Department = {
  id: string;
  name: string;
};

type Budget = {
  id: string;
  organization_id: string;
  department_id: string;
  period_start: string;
  amount: number;
  currency: string;
};

type Usage = {
  organization_id: string;
  department_id: string;
  period_start: string;
  approved_amount: number | null;
  pending_amount: number | null;
};

type DepartmentSummary = {
  id: string;
  name: string;
  budget: number;
  approved: number;
  pending: number;
  remaining: number;
  hasBudget: boolean;
  utilization: number;
  overBudget: boolean;
};

export default function BudgetsPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [orgId, setOrgId] = useState("");
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});

  const [departments, setDepartments] = useState<Department[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);

  const [month, setMonth] = useState("");
  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [amount, setAmount] = useState("");

  const membership = memberships.find(
    (m) => m.organization_id === orgId
  );

  const canManage =
    membership?.role === "owner" ||
    membership?.role === "finance_manager";

  const canView =
    canManage || membership?.role === "department_manager";

  const periodStart = month ? `${month}-01` : "";

  const money = (value: number) =>
    new Intl.NumberFormat(ar ? "ar-JO" : "en-JO", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value) + " JOD";

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const now = new Date();

        const jordanMonth = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Amman",
          year: "numeric",
          month: "2-digit",
        }).format(now);

        if (!cancelled) {
          setMonth(jordanMonth);
        }

        const supabase = createClient();

        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }

        const { data: rows, error: membershipError } =
          await supabase
            .from("memberships")
            .select("organization_id, department_id, role")
            .eq("user_id", auth.user.id)
            .eq("status", "active");

        if (membershipError) throw membershipError;

        if (!rows?.length) {
          router.replace("/onboarding");
          return;
        }

        const items = rows as Membership[];

        const { data: orgs, error: orgError } =
          await supabase
            .from("organizations")
            .select("id, name")
            .in(
              "id",
              items.map((m) => m.organization_id)
            );

        if (orgError) throw orgError;
        if (cancelled) return;

        setMemberships(items);

        setOrgNames(
          Object.fromEntries(
            (orgs ?? []).map((o) => [o.id, o.name])
          )
        );

        // Each account belongs to one organization.
        setOrgId(items[0].organization_id);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load account."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadData = useCallback(async () => {
    if (!orgId || !month || !membership || !canView) {
      setDepartments([]);
      setBudgets([]);
      setUsage([]);
      return;
    }

    setDataLoading(true);
    setError("");

    try {
      const supabase = createClient();

      let departmentQuery = supabase
        .from("departments")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");

      let budgetQuery = supabase
        .from("budgets")
        .select(
          "id, organization_id, department_id, period_start, amount, currency"
        )
        .eq("organization_id", orgId)
        .eq("period_start", periodStart)
        .eq("currency", "JOD");

      let usageQuery = supabase
        .from("expense_budget_usage")
        .select(
          "organization_id,department_id,period_start,approved_amount,pending_amount"
        )
        .eq("organization_id", orgId)
        .eq("period_start", periodStart);

      if (membership.role === "department_manager") {
        if (!membership.department_id) {
          setDepartments([]);
          setBudgets([]);
          setUsage([]);
          return;
        }

        departmentQuery = departmentQuery.eq(
          "id",
          membership.department_id
        );

        budgetQuery = budgetQuery.eq(
          "department_id",
          membership.department_id
        );

        usageQuery = usageQuery.eq(
          "department_id",
          membership.department_id
        );
      }

      const [deptResult, budgetResult, usageResult] =
        await Promise.all([
          departmentQuery,
          budgetQuery,
          usageQuery,
        ]);

      if (deptResult.error) throw deptResult.error;
      if (budgetResult.error) throw budgetResult.error;
      if (usageResult.error) throw usageResult.error;

      setDepartments(
        (deptResult.data ?? []) as Department[]
      );

      setBudgets(
        (budgetResult.data ?? []) as Budget[]
      );

      setUsage(
        (usageResult.data ?? []) as Usage[]
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load budgets."
      );
    } finally {
      setDataLoading(false);
    }
  }, [
    orgId,
    month,
    membership?.role,
    membership?.department_id,
    canView,
    periodStart,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setDepartmentId("");
    setAmount("");
    setFilterDepartmentId("");
    setNotice("");
  }, [orgId]);

  useEffect(() => {
    setDepartmentId("");
    setAmount("");
    setNotice("");
  }, [month]);

  const summaries = useMemo<DepartmentSummary[]>(() => {
    const budgetByDept = new Map(
      budgets.map((b) => [b.department_id, b])
    );

    const usageByDept = new Map(
      usage.map((u) => [u.department_id, u])
    );

    const namesByDept = new Map(
      departments.map((d) => [d.id, d.name])
    );

    const ids = new Set([
      ...namesByDept.keys(),
      ...budgetByDept.keys(),
      ...usageByDept.keys(),
    ]);

    return [...ids]
      .map((id) => {
        const b = budgetByDept.get(id);
        const u = usageByDept.get(id);

        const budget = Number(b?.amount ?? 0);
        const approved = Number(u?.approved_amount ?? 0);
        const pending = Number(u?.pending_amount ?? 0);

        const hasBudget = Boolean(b);
        const remaining = budget - approved;

        const utilization =
          budget > 0 ? (approved / budget) * 100 : 0;

        const overBudget =
          hasBudget && approved > budget;

        return {
          id,
          name:
            namesByDept.get(id) ??
            (ar ? "قسم غير معروف" : "Unknown department"),
          budget,
          approved,
          pending,
          remaining,
          hasBudget,
          utilization,
          overBudget,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, budgets, usage, ar]);

  const visibleSummaries = summaries.filter(
    (s) =>
      !filterDepartmentId ||
      s.id === filterDepartmentId
  );

  const total = visibleSummaries.reduce(
    (sum, s) => sum + s.budget,
    0
  );

  const approved = visibleSummaries.reduce(
    (sum, s) => sum + s.approved,
    0
  );

  const pending = visibleSummaries.reduce(
    (sum, s) => sum + s.pending,
    0
  );

  const budgetCount = visibleSummaries.filter(
    (s) => s.hasBudget
  ).length;

  const overBudgetDepartments = visibleSummaries.filter(
    (s) => s.overBudget
  );

  const totalUtilization =
    total > 0 ? (approved / total) * 100 : 0;

  async function saveBudget(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !canManage ||
      !orgId ||
      !month ||
      !departmentId
    ) {
      return;
    }

    setNotice("");
    setError("");

    const value = Number(amount);

    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      !/^\d+(\.\d{1,3})?$/.test(amount.trim())
    ) {
      setError(
        ar
          ? "أدخل مبلغًا موجبًا بحد أقصى 3 منازل عشرية."
          : "Enter a positive amount with up to 3 decimal places."
      );
      return;
    }

    if (
      !departments.some(
        (d) => d.id === departmentId
      )
    ) {
      setError(
        ar
          ? "اختر قسمًا تابعًا للشركة."
          : "Select a department in this company."
      );
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const existing = budgets.find(
        (b) => b.department_id === departmentId
      );

      if (existing) {
        const { error: updateError } =
          await supabase
            .from("budgets")
            .update({ amount: value })
            .eq("id", existing.id)
            .eq("organization_id", orgId)
            .eq("department_id", departmentId)
            .eq("period_start", periodStart);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } =
          await supabase
            .from("budgets")
            .insert({
              organization_id: orgId,
              department_id: departmentId,
              period_start: periodStart,
              amount: value,
              currency: "JOD",
            });

        if (insertError) throw insertError;
      }

      await loadData();

      setNotice(
        ar
          ? "تم حفظ الميزانية بنجاح."
          : "Budget saved successfully."
      );

      setDepartmentId("");
      setAmount("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save budget."
      );
    } finally {
      setSaving(false);
    }
  }

  const roleLabel =
    membership?.role === "owner"
      ? ar
        ? "مالك الشركة"
        : "Owner"
      : membership?.role === "finance_manager"
      ? ar
        ? "المدير المالي"
        : "Finance Manager"
      : membership?.role === "department_manager"
      ? ar
        ? "مدير القسم"
        : "Department Manager"
      : ar
      ? "موظف"
      : "Employee";

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F5F7FB] text-[#101D35]"
    >
      <DashboardHeader
        title={
          ar
            ? "ميزانيات الأقسام"
            : "Department budgets"
        }
      />

      <div className="mx-auto max-w-6xl space-y-7 px-5 py-9 sm:px-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
            {ar
              ? "الإدارة المالية"
              : "FINANCIAL MANAGEMENT"}
          </p>

          <p className="mt-2 text-slate-500">
            {ar
              ? "راقب الميزانيات والمصروفات لكل قسم على حدة."
              : "Track budgets and spending for each department separately."}
          </p>
        </div>

        {loading ? (
          <p role="status">
            {ar ? "جارٍ التحميل..." : "Loading..."}
          </p>
        ) : (
          <>
            {orgId && (
              <p className="text-sm text-slate-500">
                {orgNames[orgId] ?? orgId} · {roleLabel}
              </p>
            )}

            {orgId && !canView ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                {ar
                  ? "ليس لديك صلاحية لعرض الميزانيات."
                  : "You don't have permission to view budgets."}
              </div>
            ) : orgId ? (
              <>
                {/* Filters */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex max-w-xs flex-col gap-2">
                    <label
                      htmlFor="month"
                      className="text-sm font-semibold"
                    >
                      {ar
                        ? "شهر الميزانية"
                        : "Budget month"}
                    </label>

                    <input
                      id="month"
                      type="month"
                      required
                      value={month}
                      onChange={(e) =>
                        setMonth(e.target.value)
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="filter-department"
                      className="text-sm font-semibold"
                    >
                      {ar
                        ? "عرض ميزانية القسم"
                        : "Filter by department"}
                    </label>

                    <select
                      id="filter-department"
                      value={filterDepartmentId}
                      onChange={(e) =>
                        setFilterDepartmentId(
                          e.target.value
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <option value="">
                        {ar
                          ? "جميع الأقسام"
                          : "All departments"}
                      </option>

                      {summaries.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                        >
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {dataLoading && (
                  <p
                    role="status"
                    className="text-sm text-slate-500"
                  >
                    {ar
                      ? "جارٍ تحديث البيانات..."
                      : "Refreshing data..."}
                  </p>
                )}

                {/* Overview cards */}
                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-500">
                      {ar
                        ? "الميزانية المحددة"
                        : "Selected budget total"}
                    </p>

                    <p
                      className="mt-3 text-3xl font-bold"
                      dir="ltr"
                    >
                      {money(total)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-500">
                      {ar
                        ? "عدد الميزانيات المسجلة"
                        : "Recorded budgets"}
                    </p>

                    <p className="mt-3 text-3xl font-bold">
                      {budgetCount}
                    </p>
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border bg-white p-6">
                    <p className="text-sm text-slate-500">
                      {ar
                        ? "المصروفات المعتمدة"
                        : "Approved spending"}
                    </p>

                    <p
                      className="mt-3 text-2xl font-bold"
                      dir="ltr"
                    >
                      {money(approved)}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-white p-6">
                    <p className="text-sm text-slate-500">
                      {ar
                        ? "الطلبات المعلقة"
                        : "Pending requests"}
                    </p>

                    <p
                      className="mt-3 text-2xl font-bold"
                      dir="ltr"
                    >
                      {money(pending)}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-white p-6">
                    <p className="text-sm text-slate-500">
                      {ar
                        ? "المتبقي من الميزانية"
                        : "Remaining budget"}
                    </p>

                    <p
                      className={`mt-3 text-2xl font-bold ${
                        total - approved < 0
                          ? "text-red-600"
                          : "text-emerald-700"
                      }`}
                      dir="ltr"
                    >
                      {money(total - approved)}
                    </p>
                  </div>
                </section>

                {/* Over-budget warning */}
                {overBudgetDepartments.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900"
                  >
                    <p className="font-bold">
                      {ar
                        ? "تحذير: تجاوز الميزانية"
                        : "Warning: Budget exceeded"}
                    </p>

                    <p className="mt-2 text-sm">
                      {ar
                        ? `تجاوزت الأقسام التالية الميزانية المحددة: ${overBudgetDepartments
                            .map((s) => s.name)
                            .join("، ")}. يمكن الاستمرار في الموافقات، لكن يُنصح بمراجعة الإنفاق.`
                        : `The following departments exceeded their allocated budgets: ${overBudgetDepartments
                            .map((s) => s.name)
                            .join(", ")}. Approvals remain allowed, but spending should be reviewed.`}
                    </p>
                  </div>
                )}

                {/* Overall utilization */}
                {total > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {ar
                          ? "استهلاك الميزانية الإجمالية"
                          : "Overall budget utilization"}
                      </p>

                      <p
                        className={`font-bold ${
                          totalUtilization > 100
                            ? "text-red-600"
                            : "text-blue-700"
                        }`}
                        dir="ltr"
                      >
                        {totalUtilization.toFixed(2)}%
                      </p>
                    </div>

                    <div
                      className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={
                        ar
                          ? "استهلاك الميزانية"
                          : "Budget utilization"
                      }
                      aria-valuenow={Math.min(
                        100,
                        totalUtilization
                      )}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full rounded-full ${
                          totalUtilization > 100
                            ? "bg-red-500"
                            : totalUtilization >= 80
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            totalUtilization
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <Link
                  href="/dashboard/approvals"
                  className="inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  {ar
                    ? "عرض الطلبات والموافقات"
                    : "View requests & approvals"}
                </Link>

                {/* Budget management */}
                {canManage && (
                  <form
                    onSubmit={(e) => void saveBudget(e)}
                    className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div>
                      <h2 className="text-xl font-bold">
                        {ar
                          ? "إضافة أو تعديل ميزانية"
                          : "Add or update budget"}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {ar
                          ? "إذا كان للقسم ميزانية بنفس الشهر، سيتم تعديل مبلغها فقط."
                          : "If a budget already exists for the selected department and month, only its amount will be updated."}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="department"
                          className="block text-sm font-semibold"
                        >
                          {ar ? "القسم" : "Department"}
                        </label>

                        <select
                          id="department"
                          required
                          value={departmentId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setDepartmentId(id);

                            const current = budgets.find(
                              (b) =>
                                b.department_id === id
                            );

                            setAmount(
                              current
                                ? String(current.amount)
                                : ""
                            );
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <option value="">
                            {ar
                              ? "اختر القسم"
                              : "Choose department"}
                          </option>

                          {departments.map((d) => (
                            <option
                              key={d.id}
                              value={d.id}
                            >
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="amount"
                          className="block text-sm font-semibold"
                        >
                          {ar
                            ? "الميزانية (JOD)"
                            : "Budget amount (JOD)"}
                        </label>

                        <input
                          id="amount"
                          type="number"
                          min="0.001"
                          step="0.001"
                          required
                          value={amount}
                          onChange={(e) =>
                            setAmount(e.target.value)
                          }
                          placeholder="1000.000"
                          dir="ltr"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !departmentId}
                      className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving
                        ? ar
                          ? "جارٍ الحفظ..."
                          : "Saving..."
                        : ar
                        ? "حفظ الميزانية"
                        : "Save budget"}
                    </button>
                  </form>
                )}

                {/* Department breakdown */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-6 py-5">
                    <h2 className="text-lg font-bold">
                      {ar
                        ? "تفاصيل ميزانيات الأقسام"
                        : "Department budget breakdown"}
                    </h2>
                  </div>

                  {visibleSummaries.length === 0 ? (
                    <p className="px-6 py-10 text-center text-slate-500">
                      {ar
                        ? "لا توجد بيانات لهذا الشهر."
                        : "No department data for this month."}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-5 py-4 text-start">
                              {ar ? "القسم" : "Department"}
                            </th>
                            <th className="px-5 py-4 text-start">
                              {ar ? "الميزانية" : "Budget"}
                            </th>
                            <th className="px-5 py-4 text-start">
                              {ar ? "المعتمد" : "Approved"}
                            </th>
                            <th className="px-5 py-4 text-start">
                              {ar ? "المعلق" : "Pending"}
                            </th>
                            <th className="px-5 py-4 text-start">
                              {ar ? "المتبقي" : "Remaining"}
                            </th>
                            <th className="px-5 py-4 text-start">
                              {ar
                                ? "الاستهلاك / الحالة"
                                : "Utilization / status"}
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {visibleSummaries.map((s) => (
                            <tr
                              key={s.id}
                              className="border-t border-slate-100"
                            >
                              <td className="px-5 py-4 font-semibold">
                                {s.name}

                                {!s.hasBudget && (
                                  <span className="block text-xs font-normal text-amber-700">
                                    {ar
                                      ? "لا توجد ميزانية مسجلة"
                                      : "No budget recorded"}
                                  </span>
                                )}
                              </td>

                              <td
                                className="whitespace-nowrap px-5 py-4"
                                dir="ltr"
                              >
                                {money(s.budget)}
                              </td>

                              <td
                                className="whitespace-nowrap px-5 py-4"
                                dir="ltr"
                              >
                                {money(s.approved)}
                              </td>

                              <td
                                className="whitespace-nowrap px-5 py-4"
                                dir="ltr"
                              >
                                {money(s.pending)}
                              </td>

                              <td
                                className={`whitespace-nowrap px-5 py-4 font-bold ${
                                  s.remaining < 0
                                    ? "text-red-600"
                                    : "text-emerald-700"
                                }`}
                                dir="ltr"
                              >
                                {money(s.remaining)}
                              </td>

                              <td className="min-w-48 px-5 py-4">
                                {s.hasBudget ? (
                                  <>
                                    <div className="flex items-center justify-between gap-3">
                                      <span
                                        className={`font-bold ${
                                          s.overBudget
                                            ? "text-red-600"
                                            : "text-slate-800"
                                        }`}
                                        dir="ltr"
                                      >
                                        {s.utilization.toFixed(2)}%
                                      </span>

                                      {s.overBudget && (
                                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                          {ar
                                            ? "تجاوز الميزانية"
                                            : "Over budget"}
                                        </span>
                                      )}
                                    </div>

                                    <div
                                      className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                                      role="progressbar"
                                      aria-label={`${s.name} utilization`}
                                      aria-valuenow={Math.min(
                                        100,
                                        s.utilization
                                      )}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                    >
                                      <div
                                        className={`h-full rounded-full ${
                                          s.overBudget
                                            ? "bg-red-500"
                                            : s.utilization >= 80
                                            ? "bg-amber-500"
                                            : "bg-blue-600"
                                        }`}
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            s.utilization
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    {ar
                                      ? "غير محدد"
                                      : "Not set"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>

                        {visibleSummaries.length > 1 && (
                          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                            <tr>
                              <td className="px-5 py-4">
                                {ar ? "الإجمالي" : "Total"}
                              </td>

                              <td
                                className="whitespace-nowrap px-5 py-4"
                                dir="ltr"
                              >
                                {money(total)}
                              </td>

                              <td
                                className="whitespace-nowrap px-5 py-4"
                                dir="ltr"
                              >
                                {money(approved)}
                              </td>

                              <td
                                className="whitespace-nowrap px-5 py-4"
                                dir="ltr"
                              >
                                {money(pending)}
                              </td>

                              <td
                                className="whitespace-nowrap px-5 py-4"
                                dir="ltr"
                              >
                                {money(total - approved)}
                              </td>

                              <td
                                className="px-5 py-4"
                                dir="ltr"
                              >
                                {total > 0
                                  ? `${totalUtilization.toFixed(2)}%`
                                  : "—"}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </section>

                <p className="text-xs text-slate-500">
                  {ar
                    ? "المتبقي = ميزانية القسم - طلباته المعتمدة نهائيًا. الطلبات المعلقة لا تُخصم. تُحسب المصروفات المعتمدة حسب شهر الموافقة النهائية بتوقيت الأردن."
                    : "Remaining = department budget minus fully approved requests. Pending requests are not deducted. Approved spending is assigned to the final approval month in Jordan time."}
                </p>
              </>
            ) : null}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {notice && (
              <p
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
              >
                {notice}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
