
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";

type ReportRow = {
  report_year: number | string;
  report_month: number | string;
  department_id: string;
  department_name: string | null;
  budget_amount: number | string | null;
  approved_amount: number | string | null;
};

type FinancialChartsProps = {
  organizationId: string;
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل",
  "مايو", "يونيو", "يوليو", "أغسطس",
  "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr",
  "May", "Jun", "Jul", "Aug",
  "Sep", "Oct", "Nov", "Dec",
];

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function jordanYearMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  return { year, month };
}

function getLastSixMonths() {
  const { year, month } = jordanYearMonth();

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(year, month - 1 - (5 - index), 1)
    );

    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
    };
  });
}

export function FinancialCharts({
  organizationId,
}: FinancialChartsProps) {
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const periods = useMemo(() => getLastSixMonths(), []);

  useEffect(() => {
    let active = true;

    async function loadCharts() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();

        const years = [
          ...new Set(periods.map((period) => period.year)),
        ];

        const { data, error: reportError } = await supabase
          .from("spendwise_monthly_reports")
          .select(
            "report_year,report_month,department_id,department_name,budget_amount,approved_amount"
          )
          .eq("organization_id", organizationId)
          .in("report_year", years);

        if (!active) return;

        if (reportError) {
          throw reportError;
        }

        const allowedPeriods = new Set(
          periods.map(
            (period) => `${period.year}-${period.month}`
          )
        );

        const filtered = ((data ?? []) as ReportRow[]).filter(
          (row) =>
            allowedPeriods.has(
              `${Number(row.report_year)}-${Number(row.report_month)}`
            )
        );

        setRows(filtered);
      } catch (err) {
        console.error("Financial charts error:", err);

        if (active) {
          setError(
            ar
              ? "تعذر تحميل الرسوم البيانية."
              : "Unable to load financial charts."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCharts();

    return () => {
      active = false;
    };
  }, [organizationId, periods, ar]);

  const monthlyData = periods.map((period) => {
    const matchingRows = rows.filter(
      (row) =>
        Number(row.report_year) === period.year &&
        Number(row.report_month) === period.month
    );

    const approved = matchingRows.reduce(
      (sum, row) => sum + toNumber(row.approved_amount),
      0
    );

    return {
      key: `${period.year}-${period.month}`,
      label: ar
        ? MONTHS_AR[period.month - 1]
        : MONTHS_EN[period.month - 1],
      year: period.year,
      approved,
    };
  });

  const currentPeriod = periods[periods.length - 1];

  const currentRows = rows.filter(
    (row) =>
      Number(row.report_year) === currentPeriod.year &&
      Number(row.report_month) === currentPeriod.month
  );

  const departmentMap = new Map<
    string,
    {
      id: string;
      name: string;
      budget: number;
      approved: number;
    }
  >();

  for (const row of currentRows) {
    const existing = departmentMap.get(row.department_id);

    if (existing) {
      existing.budget += toNumber(row.budget_amount);
      existing.approved += toNumber(row.approved_amount);
    } else {
      departmentMap.set(row.department_id, {
        id: row.department_id,
        name: row.department_name || "—",
        budget: toNumber(row.budget_amount),
        approved: toNumber(row.approved_amount),
      });
    }
  }

  const departments = Array.from(departmentMap.values()).sort(
    (a, b) => a.name.localeCompare(b.name)
  );

  const maxMonthly = Math.max(
    1,
    ...monthlyData.map((item) => item.approved)
  );

  const maxDepartment = Math.max(
    1,
    ...departments.flatMap((item) => [
      item.budget,
      item.approved,
    ])
  );

  const money = (value: number) =>
    `${value.toLocaleString(ar ? "ar-JO" : "en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} JOD`;

  if (loading) {
    return (
      <section
        role="status"
        className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
      >
        {ar
          ? "جارٍ تحميل الرسوم البيانية..."
          : "Loading financial charts..."}
      </section>
    );
  }

  if (error) {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800"
      >
        {error}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#102544]">
          {ar ? "التحليلات المالية" : "Financial Analytics"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {ar
            ? "نظرة على المصروفات المعتمدة والميزانيات"
            : "An overview of approved expenses and budgets"}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Monthly spending trend */}
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#102544]">
            {ar
              ? "اتجاه المصروفات الشهرية"
              : "Monthly Spending Trend"}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {ar
              ? "المصاريف المعتمدة خلال آخر 6 أشهر"
              : "Approved expenses over the last 6 months"}
          </p>

          <div
            className="mt-8 flex h-60 items-end gap-3 border-b border-slate-200 pb-2"
            dir="ltr"
          >
            {monthlyData.map((item) => {
              const height =
                item.approved > 0
                  ? Math.max(
                      4,
                      (item.approved / maxMonthly) * 100
                    )
                  : 0;

              return (
                <div
                  key={item.key}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                >
                  <div className="flex h-full w-full items-end justify-center">
                    <div
                      title={`${item.label} ${item.year}: ${money(item.approved)}`}
                      className="w-full max-w-12 rounded-t-lg bg-blue-600 transition-colors hover:bg-blue-700"
                      style={{
                        height: `${height}%`,
                      }}
                    />
                  </div>

                  <span className="mt-2 text-[11px] font-medium text-slate-500">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-xs text-slate-500">
            {ar
              ? "الإجمالي خلال الفترة:"
              : "Total for the period:"}{" "}
            <span className="font-bold text-[#102544]">
              {money(
                monthlyData.reduce(
                  (sum, item) => sum + item.approved,
                  0
                )
              )}
            </span>
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {monthlyData.map((item) => (
              <div
                key={item.key}
                className="rounded-lg bg-slate-50 px-2 py-2 text-xs"
              >
                <p className="text-slate-500">
                  {item.label} {item.year}
                </p>
                <p className="mt-1 break-words font-semibold text-[#102544]">
                  {money(item.approved)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Budget vs actual */}
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#102544]">
            {ar
              ? "الميزانية مقابل المصروفات"
              : "Budget vs Actual Spending"}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {ar
              ? "مقارنة حسب القسم للشهر الحالي"
              : "Department comparison for the current month"}
          </p>

          <div className="mt-5 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-slate-300" />
              {ar ? "الميزانية" : "Budget"}
            </span>

            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-blue-600" />
              {ar ? "المصروفات المعتمدة" : "Approved"}
            </span>
          </div>

          {departments.length === 0 ? (
            <p className="mt-10 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              {ar
                ? "لا توجد بيانات مالية للأقسام خلال الشهر الحالي."
                : "No department financial data for the current month."}
            </p>
          ) : (
            <div className="mt-7 max-h-96 space-y-6 overflow-y-auto pe-1">
              {departments.map((item) => (
                <div key={item.id} className="space-y-2">
                  <p className="truncate text-sm font-semibold text-[#102544]">
                    {item.name}
                  </p>

                  <div className="space-y-2">
                    <div
                      className="h-3 overflow-hidden rounded-full bg-slate-100"
                      dir="ltr"
                    >
                      <div
                        className="h-full rounded-full bg-slate-300"
                        style={{
                          width: `${
                            (item.budget / maxDepartment) * 100
                          }%`,
                        }}
                      />
                    </div>

                    <div
                      className="h-3 overflow-hidden rounded-full bg-slate-100"
                      dir="ltr"
                    >
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{
                          width: `${
                            (item.approved / maxDepartment) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {ar ? "الميزانية:" : "Budget:"}{" "}
                      {money(item.budget)}
                    </span>

                    <span>
                      {ar ? "المعتمد:" : "Approved:"}{" "}
                      {money(item.approved)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        {ar
          ? "تُحسب المصروفات حسب المبالغ المعتمدة، وليس المبالغ المدفوعة فعليًا. البيانات مأخوذة من التقارير الشهرية."
          : "Spending is based on approved amounts, not actual payments. Data comes from monthly reports."}
      </p>
    </section>
  );
}
