
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";
import { useLanguage } from "@/components/language-provider";

type Expense = {
  id: string;
  organization_id: string;
  department_id: string;
  requester_id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  submitted_at: string;
  decided_at: string | null;
};

type Approval = {
  id: string;
  stage: "department" | "finance";
  decision: "approved" | "rejected";
  actor_id: string;
  note: string | null;
  created_at: string;
};

type Membership = {
  organization_id: string;
  department_id: string | null;
  role: string;
};

const statusText: Record<string, [string, string]> = {
  pending_department: [
    "بانتظار موافقة مدير القسم",
    "Pending department approval",
  ],
  pending_finance: [
    "بانتظار القرار النهائي",
    "Pending final approval",
  ],
  approved: ["معتمد نهائيًا", "Fully approved"],
  rejected: ["مرفوض", "Rejected"],
};

export default function ExpenseRequestDetailsClient() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [request, setRequest] = useState<Expense | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [department, setDepartment] = useState("");
  const [organization, setOrganization] = useState("");

  const [viewer, setViewer] = useState<Membership | null>(null);
  const [userId, setUserId] = useState("");

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRequest = useCallback(async () => {
    if (!id) {
      throw new Error("Invalid request ID");
    }

    const supabase = createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      router.replace("/login");
      return;
    }

    const { data: memberships, error: memberError } =
      await supabase
        .from("memberships")
        .select("organization_id,department_id,role")
        .eq("user_id", auth.user.id)
        .eq("status", "active");

    if (memberError) throw memberError;

    if (!memberships?.length) {
      router.replace("/onboarding");
      return;
    }

    const { data: expense, error: requestError } =
      await supabase
        .from("expense_requests")
        .select(
          "id,organization_id,department_id,requester_id,title,description,amount,currency,status,submitted_at,decided_at"
        )
        .eq("id", id)
        .maybeSingle();

    if (requestError) throw requestError;

    if (!expense) {
      throw new Error(
        ar
          ? "الطلب غير موجود أو لا تملك صلاحية مشاهدته."
          : "Request not found or access denied."
      );
    }

    const membership = (memberships as Membership[]).find(
      (m) => m.organization_id === expense.organization_id
    );

    if (!membership) {
      throw new Error(
        ar
          ? "لا تملك صلاحية مشاهدة هذا الطلب."
          : "You cannot view this request."
      );
    }

    const [history, dept, org] = await Promise.all([
      supabase
        .from("expense_approvals")
        .select("id,stage,decision,actor_id,note,created_at")
        .eq("request_id", id)
        .order("created_at", { ascending: true }),

      supabase
        .from("departments")
        .select("name")
        .eq("id", expense.department_id)
        .eq("organization_id", expense.organization_id)
        .maybeSingle(),

      supabase
        .from("organizations")
        .select("name")
        .eq("id", expense.organization_id)
        .maybeSingle(),
    ]);

    if (history.error) throw history.error;
    if (dept.error) throw dept.error;
    if (org.error) throw org.error;

    const rows = (history.data ?? []) as Approval[];

    const userIds = [
      ...new Set([
        expense.requester_id,
        ...rows.map((approval) => approval.actor_id),
      ]),
    ];

    const profileResult = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", userIds);

    const displayNames = profileResult.error
      ? {}
      : Object.fromEntries(
          (profileResult.data ?? []).map((profile) => [
            profile.id,
            profile.full_name?.trim() || "",
          ])
        );

    setRequest(expense as Expense);
    setApprovals(rows);
    setNames(displayNames);
    setDepartment(dept.data?.name ?? "");
    setOrganization(org.data?.name ?? "");
    setViewer(membership);
    setUserId(auth.user.id);
  }, [id, router, ar]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        await loadRequest();
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load request"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [loadRequest]);

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(ar ? "ar-JO" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Amman",
        }).format(new Date(value))
      : "—";

  const money = (value: number) =>
    new Intl.NumberFormat(ar ? "ar-JO" : "en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value) + " JOD";

  const canDecide = (() => {
    if (!request || !viewer || !userId) return false;

    // Nobody can approve or reject their own request.
    if (request.requester_id === userId) return false;

    if (request.status === "pending_department") {
      return (
        viewer.role === "department_manager" &&
        viewer.department_id !== null &&
        viewer.department_id === request.department_id
      );
    }

    if (request.status === "pending_finance") {
      return (
        viewer.role === "finance_manager" ||
        viewer.role === "owner"
      );
    }

    return false;
  })();

  async function handleRefresh() {
    if (refreshing || busy) return;

    setRefreshing(true);
    setError("");
    setNotice("");

    try {
      await loadRequest();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : ar
            ? "تعذر تحديث الطلب."
            : "Unable to refresh request."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function decide(decision: "approved" | "rejected") {
    if (!request || !canDecide || busy || refreshing) return;

    const trimmedNote = note.trim();

    if (decision === "rejected" && !trimmedNote) {
      setError(
        ar
          ? "يجب كتابة سبب الرفض."
          : "Rejection reason is required."
      );
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { error: rpcError } = await createClient().rpc(
        "decide_expense_request",
        {
          p_request_id: request.id,
          p_decision: decision,
          p_note: trimmedNote || null,
        }
      );

      if (rpcError) throw rpcError;

      setNote("");
      await loadRequest();

      setNotice(
        ar
          ? "تم تسجيل القرار وتحديث حالة الطلب بنجاح."
          : "Decision recorded and request updated successfully."
      );

      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : ar
            ? "تعذر تسجيل القرار."
            : "Unable to record decision.";

      setError(
        message.includes("Request already decided")
          ? ar
            ? "تم اتخاذ قرار لهذا الطلب مسبقًا، وتم تحديث بياناته."
            : "This request was already decided. Its details have been refreshed."
          : message
      );

      try {
        await loadRequest();
      } catch (refreshError) {
        console.error(
          "Unable to refresh request after decision:",
          refreshError
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const departmentApproval = approvals.find(
    (approval) => approval.stage === "department"
  );

  const financeApproval = approvals.find(
    (approval) => approval.stage === "finance"
  );

  // If the request reached finance without a department approval,
  // its first stage was bypassed according to the workflow.
  const departmentSkipped =
    !departmentApproval &&
    Boolean(
      financeApproval ||
      request?.status === "pending_finance" ||
      request?.status === "approved"
    );

  const stages = [
    {
      key: "department",
      label: ar
        ? "موافقة مدير القسم"
        : "Department approval",
      record: departmentApproval,
    },
    {
      key: "finance",
      label: ar
        ? "القرار النهائي: المدير المالي أو صاحب الشركة"
        : "Final decision: Finance manager or owner",
      record: financeApproval,
    },
  ];

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F5F7FB] text-[#101D35]"
    >
      <DashboardHeader
        title={
          ar
            ? "تفاصيل طلب المصروف"
            : "Expense request details"
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {ar ? "المصروفات" : "EXPENSE REQUEST"}
          </p>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading || refreshing || busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing
              ? ar
                ? "جارٍ التحديث..."
                : "Refreshing..."
              : ar
                ? "تحديث الطلب"
                : "Refresh request"}
          </button>
        </div>

        {loading ? (
          <p
            role="status"
            className="rounded-2xl bg-white p-8"
          >
            {ar ? "جارٍ التحميل..." : "Loading..."}
          </p>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800"
              >
                {notice}
              </div>
            )}

            {request && (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {request.title}
                      </h2>

                      <p className="mt-2 text-sm text-slate-500">
                        {organization} · {department}
                      </p>
                    </div>

                    <div className="text-start sm:text-end">
                      <p
                        className="text-2xl font-bold"
                        dir="ltr"
                      >
                        {money(Number(request.amount))}
                      </p>

                      <p
                        className={`mt-2 text-sm font-semibold ${
                          request.status === "approved"
                            ? "text-green-700"
                            : request.status === "rejected"
                              ? "text-red-700"
                              : "text-blue-700"
                        }`}
                      >
                        {statusText[request.status]?.[
                          ar ? 0 : 1
                        ] ?? request.status}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-slate-500">
                        {ar ? "مقدم الطلب" : "Requested by"}
                      </p>
                      <p className="mt-1 font-semibold">
                        {names[request.requester_id] ||
                          (ar
                            ? "اسم غير متاح"
                            : "Name unavailable")}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        {ar ? "تاريخ التقديم" : "Submitted"}
                      </p>
                      <p className="mt-1 font-semibold">
                        {formatDate(request.submitted_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        {ar ? "القسم" : "Department"}
                      </p>
                      <p className="mt-1 font-semibold">
                        {department || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        {ar
                          ? "تاريخ القرار النهائي"
                          : "Final decision"}
                      </p>
                      <p className="mt-1 font-semibold">
                        {formatDate(request.decided_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <h3 className="font-bold">
                      {ar
                        ? "الوصف والسبب"
                        : "Description"}
                    </h3>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {request.description}
                    </p>
                  </div>
                </section>

                {canDecide && (
                  <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="mb-5">
                      <h2 className="text-xl font-bold">
                        {ar
                          ? "اتخاذ قرار بشأن الطلب"
                          : "Review this request"}
                      </h2>

                      <p className="mt-2 text-sm text-slate-500">
                        {request.status === "pending_department"
                          ? ar
                            ? "أنت مسؤول عن مراجعة هذا الطلب بصفة مدير القسم."
                            : "You are reviewing this request as department manager."
                          : ar
                            ? "يمكنك اتخاذ القرار النهائي بصفة المدير المالي أو صاحب الشركة."
                            : "You can make the final decision as finance manager or owner."}
                      </p>
                    </div>

                    <label className="block text-sm font-medium">
                      {ar
                        ? "ملاحظة / سبب الرفض"
                        : "Note / rejection reason"}

                      <textarea
                        value={note}
                        onChange={(event) =>
                          setNote(event.target.value)
                        }
                        maxLength={2000}
                        rows={3}
                        disabled={busy || refreshing}
                        placeholder={
                          ar
                            ? "أضف ملاحظة، أو اكتب سبب الرفض..."
                            : "Add a note or enter a rejection reason..."
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500 disabled:opacity-60"
                      />
                    </label>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void decide("approved")}
                        disabled={busy || refreshing}
                        className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busy
                          ? ar
                            ? "جارٍ التنفيذ..."
                            : "Processing..."
                          : ar
                            ? "موافقة"
                            : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void decide("rejected")}
                        disabled={busy || refreshing}
                        className="rounded-xl border border-red-300 px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {ar ? "رفض" : "Reject"}
                      </button>
                    </div>

                    <p className="mt-4 text-xs text-slate-500">
                      {ar
                        ? "سبب الرفض إلزامي. لا يمكن الموافقة على طلبك الشخصي، ولا يمكن اتخاذ قرار ثانٍ بعد انتهاء الطلب."
                        : "A rejection reason is required. You cannot decide your own request or decide an already completed request."}
                    </p>
                  </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <h2 className="text-xl font-bold">
                    {ar
                      ? "سجل الموافقات"
                      : "Approval history"}
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    {ar
                      ? "القرارات المسجلة في قاعدة البيانات، مرتبة حسب المرحلة."
                      : "Decisions recorded in the database, in workflow order."}
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <p className="font-semibold">
                        {ar
                          ? "تم تقديم الطلب"
                          : "Request submitted"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(request.submitted_at)}
                      </p>
                    </div>

                    {stages.map((stage, index) => {
                      const record = stage.record;

                      const skipped =
                        stage.key === "department" &&
                        departmentSkipped;

                      const stopped =
                        request.status === "rejected" &&
                        !record &&
                        !skipped;

                      const waiting =
                        !record &&
                        !stopped &&
                        !skipped &&
                        (stage.key === "department"
                          ? request.status === "pending_department"
                          : request.status === "pending_finance");

                      return (
                        <div
                          key={stage.key}
                          className="rounded-xl border border-slate-200 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-bold">
                              {index + 1}. {stage.label}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                record?.decision === "approved"
                                  ? "bg-green-100 text-green-800"
                                  : record?.decision === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {record
                                ? record.decision === "approved"
                                  ? ar
                                    ? "موافقة"
                                    : "Approved"
                                  : ar
                                    ? "مرفوض"
                                    : "Rejected"
                                : skipped
                                  ? ar
                                    ? "تم تجاوز المرحلة"
                                    : "Stage skipped"
                                  : stopped
                                    ? ar
                                      ? "لم تُنفّذ"
                                      : "Not reached"
                                    : waiting
                                      ? ar
                                        ? "بانتظار القرار"
                                        : "Pending"
                                      : ar
                                        ? "بانتظار المرحلة السابقة"
                                        : "Awaiting prior stage"}
                            </span>
                          </div>

                          {record ? (
                            <div className="mt-3 space-y-2 text-sm text-slate-600">
                              <p>
                                {ar
                                  ? "صاحب القرار:"
                                  : "Decided by:"}{" "}
                                <span className="font-semibold text-slate-800">
                                  {names[record.actor_id] ||
                                    (ar
                                      ? "اسم غير متاح"
                                      : "Name unavailable")}
                                </span>
                              </p>

                              <p>
                                {ar ? "التاريخ:" : "Date:"}{" "}
                                {formatDate(record.created_at)}
                              </p>

                              {record.note && (
                                <div className="rounded-lg bg-slate-50 p-3">
                                  <p className="font-semibold text-slate-700">
                                    {record.decision === "rejected"
                                      ? ar
                                        ? "سبب الرفض"
                                        : "Rejection reason"
                                      : ar
                                        ? "ملاحظة"
                                        : "Note"}
                                  </p>

                                  <p className="mt-1 whitespace-pre-wrap">
                                    {record.note}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">
                              {skipped
                                ? ar
                                  ? "انتقل الطلب مباشرة إلى مرحلة القرار النهائي."
                                  : "This request went directly to final review."
                                : stopped
                                  ? ar
                                    ? "توقفت الموافقات بعد رفض الطلب."
                                    : "Workflow stopped after rejection."
                                  : waiting
                                    ? ar
                                      ? "بانتظار اتخاذ القرار."
                                      : "Waiting for a decision."
                                    : ar
                                      ? "لا يوجد قرار مسجل لهذه المرحلة بعد."
                                      : "No decision recorded for this stage yet."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/dashboard/requests"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    {ar ? "طلباتي" : "My requests"}
                  </Link>

                  {viewer?.role !== "employee" && (
                    <Link
                      href="/dashboard/approvals"
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      {ar
                        ? "العودة للموافقات"
                        : "Back to approvals"}
                    </Link>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
