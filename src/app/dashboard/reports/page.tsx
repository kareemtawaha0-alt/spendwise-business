
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notification-bell";

type ReportMode = "monthly" | "yearly";

type ReportRow = {
  department_id: string;
  department_name: string | null;
  budget_amount?: number | string | null;
  approved_amount?: number | string | null;
  pending_amount?: number | string | null;
  rejected_amount?: number | string | null;
  rejected_count?: number | string | null;
  has_budget?: boolean;
  is_over_budget?: boolean;
  annual_budget?: number | string | null;
  annual_approved?: number | string | null;
  annual_pending?: number | string | null;
  annual_rejected?: number | string | null;
  annual_rejected_count?: number | string | null;
  months_with_budget?: number | string | null;
  has_over_budget_month?: boolean;
};

type PaymentRow = {
  request_id: string;
  amount: number | string;
  paid_at: string;
};

type RequestRow = {
  id: string;
  department_id: string;
  amount: number | string;
  submitted_at: string;
};

type Detail = {
  id: string;
  name: string;
  budget: number;
  approved: number;
  paid: number;
  awaiting: number;
  pending: number;
  rejected: number;
  rejectedCount: number;
  overBudget: boolean;
};

const numberValue = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل",
  "مايو", "يونيو", "يوليو", "أغسطس",
  "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const MONTHS_EN = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const jordanDate = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
};

export default function ReportsPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [currentYear, setCurrentYear] = useState(2026);
  const [generatedDate, setGeneratedDate] = useState("");

  const [mode, setMode] = useState<ReportMode>("monthly");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(1);
  const [department, setDepartment] = useState("all");

  const [organizationName, setOrganizationName] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const today = new Date();
    const local = jordanDate(today);
    const [y, m] = local.split("-").map(Number);

    setCurrentYear(y);
    setYear(y);
    setMonth(m);
    setGeneratedDate(local);
    setReady(true);
  }, []);

  const money = (value: number) =>
    `${value.toLocaleString(ar ? "ar-JO" : "en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} JOD`;

  const months = ar ? MONTHS_AR : MONTHS_EN;

  const period =
    mode === "monthly"
      ? `${months[month - 1]} ${year}`
      : String(year);

  const reportTitle =
    mode === "monthly"
      ? ar ? "التقرير المالي الشهري" : "Monthly Financial Report"
      : ar ? "التقرير المالي السنوي" : "Annual Financial Report";

  useEffect(() => {
    if (!ready) return;

    let active = true;

    async function load() {
      setLoading(true);
      setAuthorized(false);
      setError("");

      try {
        const supabase = createClient();

        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (!active) return;

        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }

        const { data: membership, error: memberError } =
          await supabase
            .from("memberships")
            .select("organization_id,role")
            .eq("user_id", auth.user.id)
            .eq("status", "active")
            .single();

        if (!active) return;
        if (memberError || !membership) {
          throw memberError ?? new Error("Membership missing");
        }

        if (
          membership.role !== "owner" &&
          membership.role !== "finance_manager"
        ) {
          router.replace("/dashboard");
          return;
        }

        const organizationId = membership.organization_id;

        const { data: organization, error: orgError } =
          await supabase
            .from("organizations")
            .select("name")
            .eq("id", organizationId)
            .single();

        if (orgError) throw orgError;

        const view =
          mode === "monthly"
            ? "spendwise_monthly_reports"
            : "spendwise_yearly_reports";

        let reportQuery = supabase
          .from(view)
          .select("*")
          .eq("organization_id", organizationId)
          .eq("report_year", year);

        if (mode === "monthly") {
          reportQuery = reportQuery.eq("report_month", month);
        }

        const { data: reportData, error: reportError } =
          await reportQuery;

        if (reportError) throw reportError;

        async function fetchAll<T>(
          table: "expense_payments" | "expense_requests",
          columns: string,
          status?: string
        ): Promise<T[]> {
          const result: T[] = [];
          const size = 500;

          for (let offset = 0; ; offset += size) {
            let query = supabase
              .from(table)
              .select(columns)
              .eq("organization_id", organizationId)
              .range(offset, offset + size - 1);

            if (status) query = query.eq("status", status);

            const response = await query;
            if (response.error) throw response.error;

            const batch = (response.data ?? []) as unknown as T[];
            result.push(...batch);

            if (batch.length < size) break;
          }

          return result;
        }

        const [paymentData, requestData] = await Promise.all([
          fetchAll<PaymentRow>(
            "expense_payments",
            "request_id,amount,paid_at"
          ),
          fetchAll<RequestRow>(
            "expense_requests",
            "id,department_id,amount,submitted_at",
            "approved"
          ),
        ]);

        const departmentMap = new Map(
          requestData.map((request) => [
            request.id,
            request.department_id,
          ])
        );

        const missingIds = paymentData
          .map((payment) => payment.request_id)
          .filter((id) => !departmentMap.has(id));

        for (let i = 0; i < missingIds.length; i += 100) {
          const { data, error: missingError } = await supabase
            .from("expense_requests")
            .select("id,department_id")
            .eq("organization_id", organizationId)
            .in("id", missingIds.slice(i, i + 100));

          if (missingError) throw missingError;

          for (const request of data ?? []) {
            departmentMap.set(request.id, request.department_id);
          }
        }

        if (!active) return;

        setOrganizationName(organization.name);
        setRows((reportData ?? []) as ReportRow[]);
        setPayments(
          paymentData.map((payment) => ({
            ...payment,
            department_id: departmentMap.get(payment.request_id),
          }))
        );
        setRequests(requestData);
        setPaidIds(
          new Set(paymentData.map((payment) => payment.request_id))
        );
        setAuthorized(true);
      } catch (err) {
        console.error("Reports error:", err);

        if (active) {
          setRows([]);
          setPayments([]);
          setRequests([]);
          setPaidIds(new Set());
          setError(
            ar
              ? "تعذر تحميل التقارير. تحقق من الاتصال والصلاحيات."
              : "Unable to load reports. Check connection and permissions."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [ready, mode, year, month, refresh, router, ar]);

  const departments = useMemo(
    () =>
      rows.map((row) => ({
        id: row.department_id,
        name: row.department_name || "—",
      })),
    [rows]
  );

  const startDate =
    mode === "monthly"
      ? `${year}-${String(month).padStart(2, "0")}-01`
      : `${year}-01-01`;

  const endDate =
    mode === "monthly"
      ? month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`
      : `${year + 1}-01-01`;

  const inPeriod = (date: string) => {
    const local = jordanDate(date);
    return local >= startDate && local < endDate;
  };

  const paidByDepartment = new Map<string, number>();

  for (const payment of payments) {
    const item = payment as PaymentRow & {
      department_id?: string;
    };

    if (!item.department_id || !inPeriod(item.paid_at)) continue;

    paidByDepartment.set(
      item.department_id,
      (paidByDepartment.get(item.department_id) ?? 0) +
        numberValue(item.amount)
    );
  }

  const awaitingByDepartment = new Map<string, number>();

  for (const request of requests) {
    if (paidIds.has(request.id) || !inPeriod(request.submitted_at)) {
      continue;
    }

    awaitingByDepartment.set(
      request.department_id,
      (awaitingByDepartment.get(request.department_id) ?? 0) +
        numberValue(request.amount)
    );
  }

  const details: Detail[] = rows
    .filter(
      (row) =>
        department === "all" ||
        row.department_id === department
    )
    .map((row) => {
      const yearly = mode === "yearly";

      return {
        id: row.department_id,
        name: row.department_name || "—",
        budget: numberValue(
          yearly ? row.annual_budget : row.budget_amount
        ),
        approved: numberValue(
          yearly ? row.annual_approved : row.approved_amount
        ),
        pending: numberValue(
          yearly ? row.annual_pending : row.pending_amount
        ),
        rejected: numberValue(
          yearly ? row.annual_rejected : row.rejected_amount
        ),
        rejectedCount: numberValue(
          yearly
            ? row.annual_rejected_count
            : row.rejected_count
        ),
        paid: paidByDepartment.get(row.department_id) ?? 0,
        awaiting:
          awaitingByDepartment.get(row.department_id) ?? 0,
        overBudget: yearly
          ? Boolean(row.has_over_budget_month)
          : Boolean(row.is_over_budget),
      };
    });

  const totals = details.reduce(
    (total, row) => ({
      budget: total.budget + row.budget,
      approved: total.approved + row.approved,
      paid: total.paid + row.paid,
      awaiting: total.awaiting + row.awaiting,
      pending: total.pending + row.pending,
      rejected: total.rejected + row.rejected,
      rejectedCount: total.rejectedCount + row.rejectedCount,
    }),
    {
      budget: 0,
      approved: 0,
      paid: 0,
      awaiting: 0,
      pending: 0,
      rejected: 0,
      rejectedCount: 0,
    }
  );

  const remaining = totals.budget - totals.approved;

  const utilization =
    totals.budget > 0
      ? (totals.approved / totals.budget) * 100
      : null;

  const overBudgetDepartments = details.filter(
    (row) => row.overBudget
  );

  const selectedDepartmentName =
    department === "all"
      ? ar ? "جميع الأقسام" : "All Departments"
      : departments.find((item) => item.id === department)?.name ??
        "—";

  const cards = [
    {
      title: ar ? "إجمالي الميزانيات" : "Total Budget",
      value: money(totals.budget),
    },
    {
      title: ar ? "المصروفات المعتمدة" : "Approved Expenses",
      value: money(totals.approved),
    },
    {
      title: ar ? "المبالغ المصروفة فعليًا" : "Actually Paid",
      value: money(totals.paid),
    },
    {
      title: ar ? "معتمد وبانتظار الصرف" : "Approved, Awaiting Payment",
      value: money(totals.awaiting),
    },
    {
      title: ar ? "الطلبات المعلقة" : "Pending Requests",
      value: money(totals.pending),
    },
    {
      title: ar ? "المصروفات المرفوضة" : "Rejected Expenses",
      value: money(totals.rejected),
    },
    {
      title: ar ? "المتبقي من الميزانية" : "Remaining Budget",
      value: money(remaining),
    },
    {
      title: ar ? "نسبة استهلاك الميزانية" : "Budget Utilization",
      value:
        utilization === null
          ? "—"
          : `${utilization.toFixed(1)}%`,
    },
  ];

  const canExport =
    authorized && !loading && !error && details.length > 0;

  function exportCsv() {
    if (!canExport) return;

    const headers = [
      "Department",
      "Budget JOD",
      "Approved JOD",
      "Paid in Period JOD",
      "Approved Unpaid (Submitted in Period) JOD",
      "Pending JOD",
      "Rejected JOD",
      "Rejected Count",
      "Remaining JOD",
      "Utilization %",
      "Over Budget",
    ];

    const data = details.map((row) => [
      row.name,
      row.budget,
      row.approved,
      row.paid,
      row.awaiting,
      row.pending,
      row.rejected,
      row.rejectedCount,
      row.budget - row.approved,
      row.budget > 0
        ? ((row.approved / row.budget) * 100).toFixed(2)
        : "",
      row.overBudget ? "Yes" : "No",
    ]);

    const csv = [headers, ...data]
      .map((line) =>
        line
          .map(
            (cell) =>
              `"${String(cell).replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const filename =
      `Spendwise_${mode}_${year}` +
      (mode === "monthly"
        ? `_${String(month).padStart(2, "0")}`
        : "");

    link.href = url;
    link.download = `${filename}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportPdf() {
    if (!canExport) return;
    setGeneratedDate(jordanDate(new Date()));
    window.setTimeout(() => window.print(), 100);
  }

  const headings = [
    ar ? "القسم" : "Department",
    ar ? "الميزانية" : "Budget",
    ar ? "المعتمد" : "Approved",
    ar ? "المصروف" : "Paid",
    ar ? "بانتظار الصرف" : "Awaiting",
    ar ? "المعلق" : "Pending",
    ar ? "المرفوض" : "Rejected",
    ar ? "المتبقي" : "Remaining",
    ar ? "الاستهلاك" : "Utilization",
  ];

  const percentage = (approved: number, budget: number) =>
    budget > 0
      ? `${((approved / budget) * 100).toFixed(1)}%`
      : "—";

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F5F7FB] text-[#101D35]"
    >
      <style>{`
        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .screen-only {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-area {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-area > * + * {
            margin-top: 8px !important;
          }

          .report-section {
            margin-top: 8px !important;
            box-shadow: none !important;
            break-inside: auto !important;
          }

          .report-section.grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 7px !important;
          }

          .report-card {
            padding: 9px !important;
            border: 1px solid #dbe3ee !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            break-inside: avoid !important;
          }

          .report-card p {
            margin-top: 3px !important;
            font-size: 9px !important;
            line-height: 1.3 !important;
          }

          .report-card p:last-child {
            font-size: 13px !important;
            font-weight: 700 !important;
          }

          .report-table {
            overflow: visible !important;
            box-shadow: none !important;
            break-inside: auto !important;
          }

          .report-table > div {
            padding: 8px !important;
          }

          .report-table .overflow-x-auto {
            overflow: visible !important;
          }

          .report-table table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
            font-size: 8px !important;
          }

          .report-table th,
          .report-table td {
            padding: 6px 4px !important;
            overflow-wrap: anywhere !important;
          }

          .report-table thead {
            display: table-header-group !important;
          }

          .report-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .report-footer {
            margin-top: 10px !important;
            padding-top: 8px !important;
            border-top: 1px solid #cbd5e1;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <header className="screen-only border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {ar ? "العودة" : "Back"}
            </Link>

            <div>
              <p className="text-xs font-semibold text-blue-600">
                Spendwise Business
              </p>
              <h1 className="text-2xl font-bold">
                {ar ? "التقارير المالية" : "Financial Reports"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="print-area mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="print-only">
          <div className="flex items-start justify-between gap-6 border-b-2 border-[#102544] pb-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102544] text-xl font-bold text-white">
                  S
                </div>
                <div>
                  <p className="text-xl font-extrabold text-[#102544]">
                    spendwise.
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                    Business Financial Reports
                  </p>
                </div>
              </div>

              <h1 className="mt-3 text-xl font-bold text-[#102544]">
                {reportTitle}
              </h1>
              <p className="mt-1 text-sm font-semibold">
                {organizationName}
              </p>
              <p className="text-xs text-slate-600">{period}</p>
            </div>

            <div className="rounded-lg bg-slate-50 px-4 py-2 text-xs">
              <p className="text-slate-500">
                {ar ? "تاريخ الإصدار" : "Issue Date"}
              </p>
              <p dir="ltr" className="font-bold">
                {generatedDate}
              </p>
              <p className="mt-2 text-slate-500">
                {ar ? "العملة" : "Currency"}
              </p>
              <p className="font-bold">JOD</p>
              <p className="mt-2 text-slate-500">
                {ar ? "عدد الأقسام" : "Departments"}
              </p>
              <p className="font-bold">{details.length}</p>
            </div>
          </div>

          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-[#102544]">
            <strong>
              {ar ? "نطاق التقرير:" : "Report Scope:"}
            </strong>{" "}
            {selectedDepartmentName}
          </p>
        </section>

        <section className="screen-only rounded-2xl bg-[#102544] p-7 text-white shadow-sm">
          <p className="text-sm text-blue-300">
            {organizationName}
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            {ar ? "التقارير المالية" : "Financial Reports"}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {ar
              ? "تابع أداء الشركة المالي شهريًا وسنويًا، وصدّر تقاريرك للاحتفاظ بها أو مشاركتها."
              : "Track financial performance and export monthly or annual reports."}
          </p>
        </section>

        <section className="screen-only rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-2 text-sm">
              {ar ? "نوع التقرير" : "Report Type"}
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as ReportMode);
                  setDepartment("all");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5"
              >
                <option value="monthly">
                  {ar ? "شهري" : "Monthly"}
                </option>
                <option value="yearly">
                  {ar ? "سنوي" : "Yearly"}
                </option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              {ar ? "السنة" : "Year"}
              <select
                value={year}
                onChange={(event) => {
                  setYear(Number(event.target.value));
                  setDepartment("all");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5"
              >
                {Array.from(
                  { length: 10 },
                  (_, index) => currentYear + 2 - index
                ).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            {mode === "monthly" && (
              <label className="flex flex-col gap-2 text-sm">
                {ar ? "الشهر" : "Month"}
                <select
                  value={month}
                  onChange={(event) => {
                    setMonth(Number(event.target.value));
                    setDepartment("all");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5"
                >
                  {months.map((name, index) => (
                    <option key={index} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-2 text-sm">
              {ar ? "القسم" : "Department"}
              <select
                value={department}
                onChange={(event) =>
                  setDepartment(event.target.value)
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5"
              >
                <option value="all">
                  {ar ? "كل الأقسام" : "All Departments"}
                </option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
              className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              {ar ? "تحديث" : "Refresh"}
            </button>

            <button
              type="button"
              onClick={exportPdf}
              disabled={!canExport}
              className="rounded-xl bg-[#102544] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {ar ? "حفظ التقرير PDF" : "Save Report as PDF"}
            </button>

            <button
              type="button"
              onClick={exportCsv}
              disabled={!canExport}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {ar ? "تنزيل CSV" : "Download CSV"}
            </button>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
            {ar ? "جارٍ تحميل التقارير..." : "Loading reports..."}
          </div>
        ) : authorized && !error ? (
          <>
            <section className="report-section grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <div
                  key={card.title}
                  className="report-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {card.title}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-3 text-xl font-bold text-[#102544]"
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </section>

            <p className="report-section text-xs leading-5 text-slate-500">
              {ar
                ? "المصروف فعليًا حسب تاريخ الدفع خلال الفترة المحددة. بانتظار الصرف يشمل الطلبات المعتمدة المقدمة خلال الفترة والتي لم تُدفع حتى الآن. استهلاك الميزانية يُحسب حسب المبالغ المعتمدة."
                : "Paid amounts use payment dates within the selected period. Awaiting payment includes currently unpaid approved requests submitted during the period. Budget utilization uses approved amounts."}
            </p>

            <section className="report-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-bold">
                  {ar ? "استهلاك الميزانية" : "Budget Utilization"}
                </h3>
                <span className="font-semibold">
                  {utilization === null
                    ? "—"
                    : `${utilization.toFixed(1)}%`}
                </span>
              </div>

              <div
                dir="ltr"
                className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className={`h-full ${
                    remaining < 0 ? "bg-red-500" : "bg-blue-600"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, utilization ?? 0)
                    )}%`,
                  }}
                />
              </div>

              {totals.budget === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  {ar
                    ? "لا توجد ميزانية مسجلة للفترة المختارة."
                    : "No budget recorded for this period."}
                </p>
              )}
            </section>

            {overBudgetDepartments.length > 0 && (
              <section className="report-section rounded-2xl border border-red-200 bg-red-50 p-4">
                <h3 className="font-bold text-red-800">
                  {ar ? "تنبيه: تجاوز الميزانية" : "Budget Exceeded"}
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {ar
                    ? mode === "yearly"
                      ? "الأقسام التالية تجاوزت الميزانية في شهر واحد على الأقل:"
                      : "الأقسام التالية تجاوزت الميزانية خلال الشهر:"
                    : mode === "yearly"
                      ? "Departments exceeded their budget in at least one month:"
                      : "Departments exceeded their monthly budget:"}
                </p>
                <p className="mt-1 text-sm font-semibold text-red-800">
                  {overBudgetDepartments
                    .map((row) => row.name)
                    .join("، ")}
                </p>
              </section>
            )}

            <section className="report-table overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-lg font-bold">
                  {ar
                    ? "التفاصيل المالية حسب القسم"
                    : "Financial Breakdown by Department"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {period} · {selectedDepartmentName}
                </p>
              </div>

              {details.length === 0 ? (
                <p className="p-8 text-center text-slate-500">
                  {ar
                    ? "لا توجد بيانات للفترة المختارة."
                    : "No data for the selected period."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1150px] text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {headings.map((heading) => (
                          <th
                            key={heading}
                            className="px-3 py-3 text-start font-semibold"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {details.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-3 font-semibold">
                            {row.name}
                          </td>
                          <td className="px-3 py-3">
                            {money(row.budget)}
                          </td>
                          <td className="px-3 py-3">
                            {money(row.approved)}
                          </td>
                          <td className="px-3 py-3">
                            {money(row.paid)}
                          </td>
                          <td className="px-3 py-3">
                            {money(row.awaiting)}
                          </td>
                          <td className="px-3 py-3">
                            {money(row.pending)}
                          </td>
                          <td className="px-3 py-3">
                            {money(row.rejected)}
                          </td>
                          <td className="px-3 py-3">
                            {money(row.budget - row.approved)}
                          </td>
                          <td className="px-3 py-3">
                            {percentage(row.approved, row.budget)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                      <tr>
                        <td className="px-3 py-3">
                          {ar ? "الإجمالي" : "Total"}
                        </td>
                        <td className="px-3 py-3">
                          {money(totals.budget)}
                        </td>
                        <td className="px-3 py-3">
                          {money(totals.approved)}
                        </td>
                        <td className="px-3 py-3">
                          {money(totals.paid)}
                        </td>
                        <td className="px-3 py-3">
                          {money(totals.awaiting)}
                        </td>
                        <td className="px-3 py-3">
                          {money(totals.pending)}
                        </td>
                        <td className="px-3 py-3">
                          {money(totals.rejected)}
                        </td>
                        <td className="px-3 py-3">
                          {money(remaining)}
                        </td>
                        <td className="px-3 py-3">
                          {utilization === null
                            ? "—"
                            : `${utilization.toFixed(1)}%`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <footer className="print-only report-footer text-xs leading-5 text-slate-500">
              <p className="font-semibold text-[#102544]">
                Spendwise Business
              </p>
              <p>
                {ar
                  ? "يعكس هذا التقرير المعلومات المسجلة في Spendwise Business للفترة المحددة وقت إصداره."
                  : "This report reflects data recorded in Spendwise Business for the selected period at the time of generation."}
              </p>
              <p>
                {ar
                  ? "لأغراض الإدارة الداخلية فقط، ولا يمثل قوائم مالية مدققة."
                  : "For internal management purposes only. Not an audited financial statement."}
              </p>
              <p className="mt-1">© Spendwise Business</p>
            </footer>
          </>
        ) : null}
      </div>
    </main>
  );
}
