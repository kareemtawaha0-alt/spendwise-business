
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";
import { DashboardHeader } from "@/components/dashboard-header";

type Request = {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
  requester_id: string;
  department_id: string;
};

type Membership = {
  organization_id: string;
  department_id: string | null;
  role: string;
};

const statusNames: Record<string, [string, string]> = {
  pending_department: [
    "بانتظار مدير القسم",
    "Pending department approval",
  ],
  pending_finance: [
    "بانتظار المدير المالي",
    "Pending finance approval",
  ],
  approved: ["معتمد", "Approved"],
  rejected: ["مرفوض", "Rejected"],
};

export default function RequestsPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [membership, setMembership] =
    useState<Membership | null>(null);
  const [userId, setUserId] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [paidRequestIds, setPaidRequestIds] =
    useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const refresh = useCallback(
    async (orgId: string, uid: string) => {
      const supabase = createClient();

      const { data, error: readError } = await supabase
        .from("expense_requests")
        .select(
          "id,title,description,amount,status,created_at,requester_id,department_id"
        )
        .eq("organization_id", orgId)
        .eq("requester_id", uid)
        .order("created_at", { ascending: false });

      if (readError) throw readError;

      const loadedRequests = (data ?? []) as Request[];
      setRequests(loadedRequests);

      const approvedIds = loadedRequests
        .filter((request) => request.status === "approved")
        .map((request) => request.id);

      if (approvedIds.length === 0) {
        setPaidRequestIds(new Set());
        return;
      }

      const { data: payments, error: paymentError } =
        await supabase
          .from("expense_payments")
          .select("request_id")
          .eq("organization_id", orgId)
          .in("request_id", approvedIds);

      if (paymentError) throw paymentError;

      setPaidRequestIds(
        new Set(
          (payments ?? []).map((payment) => payment.request_id)
        )
      );
    },
    []
  );

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

        const { data: member, error: memberError } =
          await supabase
            .from("memberships")
            .select("organization_id,department_id,role")
            .eq("user_id", auth.user.id)
            .eq("status", "active")
            .maybeSingle();

        if (memberError) throw memberError;

        if (!member) {
          router.replace("/onboarding");
          return;
        }

        if (!active) return;

        setMembership(member as Membership);
        setUserId(auth.user.id);

        await refresh(
          member.organization_id,
          auth.user.id
        );
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load requests"
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
  }, [router, refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!membership || saving) return;

    setError("");
    setNotice("");

    const validAmount =
      /^\d+(\.\d{1,3})?$/.test(amount.trim()) &&
      Number(amount) > 0 &&
      Number.isFinite(Number(amount));

    if (!validAmount) {
      setError(
        ar
          ? "أدخل مبلغًا موجبًا حتى 3 منازل عشرية."
          : "Enter a positive amount with up to 3 decimal places."
      );
      return;
    }

    if (
      title.trim().length < 3 ||
      description.trim().length < 3
    ) {
      setError(
        ar
          ? "العنوان والوصف يجب أن يكونا 3 أحرف على الأقل."
          : "Title and description must be at least 3 characters."
      );
      return;
    }

    setSaving(true);

    try {
      const { error: submitError } =
        await createClient().rpc(
          "submit_expense_request",
          {
            p_title: title.trim(),
            p_description: description.trim(),
            p_amount: Number(amount),
          }
        );

      if (submitError) throw submitError;

      setTitle("");
      setDescription("");
      setAmount("");

      await refresh(
        membership.organization_id,
        userId
      );

      setNotice(
        ar
          ? "تم إرسال الطلب بنجاح."
          : "Request submitted successfully."
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to submit request"
      );
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    membership?.role === "employee" ||
    membership?.role === "department_manager";

  function getStatus(item: Request) {
    if (item.status === "approved") {
      if (paidRequestIds.has(item.id)) {
        return {
          label: ar ? "تم صرف المبلغ" : "Paid",
          color: "bg-green-50 text-green-700",
        };
      }

      return {
        label: ar
          ? "معتمد — بانتظار الصرف"
          : "Approved — Awaiting payment",
        color: "bg-amber-50 text-amber-700",
      };
    }

    return {
      label:
        statusNames[item.status]?.[ar ? 0 : 1] ??
        item.status,
      color:
        item.status === "rejected"
          ? "bg-red-50 text-red-700"
          : "bg-blue-50 text-blue-700",
    };
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F5F7FB] text-[#101D35]"
    >
      <DashboardHeader
        title={
          ar ? "طلبات المصروفات" : "Expense requests"
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-9">
        <p className="text-sm text-slate-500">
          {ar
            ? "قدّم طلبات المصروفات وتابع مراحل الموافقة والصرف."
            : "Submit expense requests and track approvals and payments."}
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="rounded-xl bg-green-50 p-4 text-green-800"
          >
            {notice}
          </p>
        )}

        {loading ? (
          <p>
            {ar ? "جارٍ التحميل..." : "Loading..."}
          </p>
        ) : (
          <>
            {canSubmit && (
              <form
                onSubmit={submit}
                className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
              >
                <h2 className="text-xl font-bold">
                  {ar
                    ? "طلب مصروف جديد"
                    : "New expense request"}
                </h2>

                <label className="block text-sm font-medium">
                  {ar ? "عنوان الطلب" : "Title"}

                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                    className="mt-2 w-full rounded-xl border p-3"
                  />
                </label>

                <label className="block text-sm font-medium">
                  {ar
                    ? "السبب والتفاصيل"
                    : "Description"}

                  <textarea
                    required
                    minLength={3}
                    maxLength={3000}
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    rows={3}
                    className="mt-2 w-full rounded-xl border p-3"
                  />
                </label>

                <label className="block text-sm font-medium">
                  {ar
                    ? "المبلغ (JOD)"
                    : "Amount (JOD)"}

                  <input
                    required
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value)
                    }
                    className="mt-2 w-full rounded-xl border p-3"
                    dir="ltr"
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    !membership?.department_id
                  }
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? ar
                      ? "جارٍ الإرسال..."
                      : "Submitting..."
                    : ar
                      ? "إرسال الطلب"
                      : "Submit request"}
                </button>

                {!membership?.department_id && (
                  <p className="text-sm text-amber-700">
                    {ar
                      ? "لا يوجد قسم مرتبط بحسابك."
                      : "No department assigned to your account."}
                  </p>
                )}
              </form>
            )}

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">
                  {ar
                    ? "طلباتي السابقة"
                    : "My requests"}
                </h2>

                <button
                  type="button"
                  disabled={!membership || loading}
                  onClick={() => {
                    if (!membership) return;

                    setError("");

                    void refresh(
                      membership.organization_id,
                      userId
                    ).catch((cause) => {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Unable to refresh requests"
                      );
                    });
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50"
                >
                  {ar ? "تحديث الحالات" : "Refresh statuses"}
                </button>
              </div>

              {requests.length === 0 ? (
                <p className="text-slate-500">
                  {ar
                    ? "لا توجد طلبات بعد."
                    : "No requests yet."}
                </p>
              ) : (
                <div className="space-y-3">
                  {requests.map((item) => {
                    const status = getStatus(item);

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border p-4"
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <div className="space-y-1">
                            <strong>
                              {item.title}
                            </strong>

                            <div>
                              <Link
                                href={`/dashboard/requests/${item.id}`}
                                className="text-sm font-semibold text-blue-600 hover:underline"
                              >
                                {ar
                                  ? "عرض التفاصيل وسجل الموافقات"
                                  : "View details & approval history"}
                              </Link>
                            </div>
                          </div>

                          <span className="text-sm font-semibold">
                            {Number(item.amount).toFixed(3)} JOD
                          </span>
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                          {item.description}
                        </p>

                        <span
                          className={`mt-3 inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
