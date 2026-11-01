
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";
import { useLanguage } from "@/components/language-provider";

type Member = {
  organization_id: string;
  department_id: string | null;
  role: string;
};

type ExpenseRequest = {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: string;
  requester_id: string;
  department_id: string | null;
  created_at: string;
};

const statusNames: Record<string, [string, string]> = {
  pending_department: [
    "بانتظار مدير القسم",
    "Pending department",
  ],
  pending_finance: [
    "بانتظار القرار النهائي",
    "Pending final approval",
  ],
  approved: ["معتمد", "Approved"],
  rejected: ["مرفوض", "Rejected"],
};

export default function ApprovalsPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [member, setMember] = useState<Member | null>(null);
  const [uid, setUid] = useState("");
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [namesById, setNamesById] = useState<
    Record<string, string>
  >({});
  const [departments, setDepartments] = useState<
    Record<string, string>
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (m: Member) => {
    const supabase = createClient();

    let query = supabase
      .from("expense_requests")
      .select(
        "id,title,description,amount,status,requester_id,department_id,created_at"
      )
      .eq("organization_id", m.organization_id)
      .order("created_at", { ascending: false });

    if (m.role === "department_manager") {
      if (!m.department_id) {
        setRequests([]);
        setNamesById({});
        setDepartments({});
        return;
      }

      query = query.eq("department_id", m.department_id);
    }

    const { data, error: readError } = await query;

    if (readError) {
      throw readError;
    }

    const rows = (data ?? []) as ExpenseRequest[];

    setRequests(rows);

    const requesterIds = [
      ...new Set(rows.map((request) => request.requester_id)),
    ];

    if (requesterIds.length > 0) {
      const profilesResult = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", requesterIds);

      if (!profilesResult.error) {
        setNamesById(
          Object.fromEntries(
            (profilesResult.data ?? []).map((profile) => [
              profile.id,
              profile.full_name || "",
            ])
          )
        );
      }
    } else {
      setNamesById({});
    }

    const departmentsResult = await supabase
      .from("departments")
      .select("id,name")
      .eq("organization_id", m.organization_id);

    if (!departmentsResult.error) {
      setDepartments(
        Object.fromEntries(
          (departmentsResult.data ?? []).map((department) => [
            department.id,
            department.name,
          ])
        )
      );
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const supabase = createClient();

        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("memberships")
            .select("organization_id,department_id,role")
            .eq("user_id", auth.user.id)
            .eq("status", "active")
            .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership) {
          router.replace("/onboarding");
          return;
        }

        if (!active) return;

        const currentMember = membership as Member;

        setMember(currentMember);
        setUid(auth.user.id);

        if (
          [
            "owner",
            "finance_manager",
            "department_manager",
          ].includes(currentMember.role)
        ) {
          await refresh(currentMember);
        }
      } catch (cause) {
        if (active) {
          console.error("Approvals load error:", cause);

          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load approvals"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [router, refresh]);

  const canDecide = (request: ExpenseRequest) => {
    if (!member || request.requester_id === uid) {
      return false;
    }

    if (request.status === "pending_department") {
      return (
        member.role === "department_manager" &&
        member.department_id !== null &&
        request.department_id === member.department_id
      );
    }

    if (request.status === "pending_finance") {
      return (
        member.role === "finance_manager" ||
        member.role === "owner"
      );
    }

    return false;
  };

  async function handleRefresh() {
    if (!member || refreshing || busy) return;

    setRefreshing(true);
    setError("");
    setNotice("");

    try {
      await refresh(member);
    } catch (cause) {
      console.error("Approvals refresh error:", cause);

      setError(
        cause instanceof Error
          ? cause.message
          : ar
            ? "تعذر تحديث الطلبات."
            : "Unable to refresh requests."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function decide(
    id: string,
    decision: "approved" | "rejected"
  ) {
    if (!member || busy || refreshing) return;

    const request = requests.find((item) => item.id === id);

    if (!request || !canDecide(request)) {
      setError(
        ar
          ? "ليس لديك صلاحية اتخاذ قرار لهذا الطلب."
          : "You cannot decide this request."
      );
      return;
    }

    const note = notes[id]?.trim() ?? "";

    if (decision === "rejected" && !note) {
      setError(
        ar
          ? "سبب الرفض مطلوب."
          : "Rejection reason is required."
      );
      return;
    }

    setBusy(id);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();

      const { error: rpcError } = await supabase.rpc(
        "decide_expense_request",
        {
          p_request_id: id,
          p_decision: decision,
          p_note: note || null,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      await refresh(member);

      setNotes((previous) => ({
        ...previous,
        [id]: "",
      }));

      setNotice(
        ar
          ? "تم تسجيل القرار وتحديث حالة الطلب."
          : "Decision recorded and request status updated."
      );

      router.refresh();
    } catch (cause) {
      console.error("Approval decision error:", cause);

      const message =
        cause &&
        typeof cause === "object" &&
        "message" in cause &&
        typeof cause.message === "string"
          ? cause.message
          : ar
            ? "تعذر تسجيل القرار."
            : "Unable to record decision.";

      if (
        message.includes("Request already decided")
      ) {
        setError(
          ar
            ? "تم اتخاذ قرار لهذا الطلب مسبقًا. اضغط تحديث الطلبات."
            : "This request has already been decided. Refresh the requests."
        );
      } else {
        setError(message);
      }

      try {
        await refresh(member);
      } catch (refreshError) {
        console.error(
          "Refresh after decision error:",
          refreshError
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const visibleRequests = requests.filter(
    (request) =>
      member?.role === "owner" ||
      member?.role === "finance_manager" ||
      request.department_id === member?.department_id
  );

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F5F7FB] text-[#101D35]"
    >
      <DashboardHeader
        title={
          ar
            ? "الموافقات وطلبات الشركة"
            : "Approvals & requests"
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm leading-7 text-slate-500">
              {ar
                ? "مدير القسم يراجع الطلب أولًا، ثم يتخذ المدير المالي أو صاحب الشركة القرار النهائي. لا يحتاج الطلب إلى موافقتين نهائيتين."
                : "The department manager reviews first. The finance manager or owner then makes the final decision. Only one final decision is required."}
            </p>
          </div>

          {member &&
            member.role !== "employee" && (
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing || busy !== null}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing
                  ? ar
                    ? "جارٍ التحديث..."
                    : "Refreshing..."
                  : ar
                    ? "تحديث الطلبات"
                    : "Refresh requests"}
              </button>
            )}
        </div>

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

        {loading ? (
          <p className="rounded-2xl bg-white p-8 text-slate-500">
            {ar ? "جارٍ التحميل..." : "Loading..."}
          </p>
        ) : !member || member.role === "employee" ? (
          <p className="rounded-2xl bg-white p-8 text-slate-500">
            {ar
              ? "ليس لديك صلاحية عرض الموافقات."
              : "You do not have approval access."}
          </p>
        ) : visibleRequests.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-slate-500">
            {ar
              ? "لا توجد طلبات ظاهرة."
              : "No visible requests."}
          </p>
        ) : (
          <div className="space-y-4">
            {visibleRequests.map((request) => (
              <article
                key={request.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">
                      {request.title}
                    </h2>

                    <Link
                      href={`/dashboard/requests/${request.id}`}
                      className="mt-1 inline-block text-sm font-semibold text-blue-600 hover:underline"
                    >
                      {ar
                        ? "تفاصيل الطلب وسجل القرارات"
                        : "Request details & decision history"}
                    </Link>
                  </div>

                  <strong className="text-base">
                    {Number(request.amount).toFixed(3)} JOD
                  </strong>
                </div>

                <p className="text-sm text-slate-500">
                  {namesById[request.requester_id] ||
                    (ar ? "موظف" : "Employee")}
                  {" · "}
                  {request.department_id
                    ? departments[request.department_id] ||
                      (ar ? "قسم" : "Department")
                    : ar
                      ? "بدون قسم"
                      : "No department"}
                </p>

                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {request.description}
                </p>

                <p
                  className={`text-sm font-semibold ${
                    request.status === "approved"
                      ? "text-green-700"
                      : request.status === "rejected"
                        ? "text-red-700"
                        : "text-blue-700"
                  }`}
                >
                  {statusNames[request.status]?.[
                    ar ? 0 : 1
                  ] ?? request.status}
                </p>

                {canDecide(request) && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-500">
                      {request.status === "pending_department"
                        ? ar
                          ? "قرار مدير القسم"
                          : "Department manager decision"
                        : ar
                          ? "القرار النهائي: المدير المالي أو صاحب الشركة"
                          : "Final decision: Finance manager or owner"}
                    </p>

                    <label className="block text-sm font-medium">
                      {ar
                        ? "ملاحظة / سبب الرفض"
                        : "Note / rejection reason"}

                      <textarea
                        value={notes[request.id] || ""}
                        onChange={(event) =>
                          setNotes((previous) => ({
                            ...previous,
                            [request.id]: event.target.value,
                          }))
                        }
                        maxLength={2000}
                        rows={2}
                        disabled={busy !== null || refreshing}
                        className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500 disabled:opacity-60"
                      />
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy !== null || refreshing}
                        onClick={() =>
                          void decide(request.id, "approved")
                        }
                        className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === request.id
                          ? ar
                            ? "جارٍ التنفيذ..."
                            : "Processing..."
                          : ar
                            ? "موافقة"
                            : "Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={busy !== null || refreshing}
                        onClick={() =>
                          void decide(request.id, "rejected")
                        }
                        className="rounded-xl border border-red-300 px-5 py-2.5 font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {ar ? "رفض" : "Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
