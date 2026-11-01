
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard-header";
import { useLanguage } from "@/components/language-provider";

type Member = {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  status: string;
  department_id: string | null;
  created_at: string;
};

type Department = {
  id: string;
  name: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type Workspace = {
  organization_id: string;
  role: string;
};

const roleLabels: Record<
  string,
  { en: string; ar: string }
> = {
  owner: { en: "Owner", ar: "صاحب الشركة" },
  finance_manager: {
    en: "Finance Manager",
    ar: "المدير المالي",
  },
  department_manager: {
    en: "Department Manager",
    ar: "مدير قسم",
  },
  employee: { en: "Employee", ar: "موظف" },
};

export default function TeamPage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [myUserId, setMyUserId] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myRole, setMyRole] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [memberToRemove, setMemberToRemove] =
    useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        window.location.replace("/login");
        return;
      }

      setMyUserId(auth.user.id);
      setMyEmail(auth.user.email ?? "");

      const {
        data: workspaces,
        error: workspaceError,
      } = await supabase
        .from("memberships")
        .select("organization_id, role")
        .eq("user_id", auth.user.id)
        .eq("status", "active")
        .limit(1);

      if (workspaceError) throw workspaceError;

      const workspace =
        (workspaces as Workspace[] | null)?.[0];

      if (!workspace) {
        window.location.replace("/onboarding");
        return;
      }

      setMyRole(workspace.role);

      const [
        orgResult,
        memberResult,
        departmentResult,
      ] = await Promise.all([
        supabase
          .from("organizations")
          .select("name")
          .eq("id", workspace.organization_id)
          .single(),

        supabase
          .from("memberships")
          .select(
            "id, user_id, organization_id, role, status, department_id, created_at"
          )
          .eq("organization_id", workspace.organization_id)
          .order("created_at", { ascending: true }),

        supabase
          .from("departments")
          .select("id, name")
          .eq("organization_id", workspace.organization_id),
      ]);

      if (orgResult.error) throw orgResult.error;
      if (memberResult.error) throw memberResult.error;
      if (departmentResult.error) {
        throw departmentResult.error;
      }

      const loadedMembers =
        (memberResult.data ?? []) as Member[];

      setCompanyName(
        orgResult.data?.name ?? "Spendwise Business"
      );

      setMembers(loadedMembers);
      setDepartments(
        (departmentResult.data ?? []) as Department[]
      );

      // Fetch real names for all visible team members.
      const memberIds = [
        ...new Set(
          loadedMembers.map((member) => member.user_id)
        ),
      ];

      if (memberIds.length > 0) {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", memberIds);

        if (profileError) throw profileError;

        setProfiles((profileData ?? []) as Profile[]);
      } else {
        setProfiles([]);
      }
    } catch (cause) {
      console.error("Team loading failed:", cause);

      setError(
        ar
          ? "تعذر تحميل بيانات الفريق. تحقق من صلاحيات قراءة العضويات والملفات الشخصية."
          : "Could not load team data. Check membership and profile read permissions."
      );
    } finally {
      setLoading(false);
    }
  }, [ar]);

  useEffect(() => {
    void load();
  }, [load]);

  const departmentName = (id: string | null) =>
    id
      ? departments.find((d) => d.id === id)?.name ??
        (ar ? "قسم غير معروف" : "Unknown department")
      : ar
        ? "بدون قسم"
        : "No department";

  const roleName = (role: string) =>
    roleLabels[role]?.[ar ? "ar" : "en"] ?? role;

  const profileName = (userId: string) =>
    profiles
      .find((profile) => profile.id === userId)
      ?.full_name?.trim() || "";

  const memberName = (member: Member) => {
    const name = profileName(member.user_id);

    if (name) return name;

    if (member.user_id === myUserId) {
      return myEmail || (ar ? "حسابك" : "Your account");
    }

    return ar ? "عضو بالفريق" : "Team member";
  };

  function openRemoveDialog(member: Member) {
    if (
      myRole !== "owner" ||
      member.role === "owner" ||
      member.user_id === myUserId
    ) {
      return;
    }

    setRemoveError("");
    setMemberToRemove(member);
  }

  async function removeMember() {
    if (
      !memberToRemove ||
      removing ||
      myRole !== "owner" ||
      memberToRemove.role === "owner" ||
      memberToRemove.user_id === myUserId
    ) {
      return;
    }

    setRemoving(true);
    setRemoveError("");
    setSuccess("");

    try {
      const supabase = createClient();

      const { error: rpcError } = await supabase.rpc(
        "spendwise_remove_member",
        {
          p_member_id: memberToRemove.id,
        }
      );

      if (rpcError) throw rpcError;

      setMemberToRemove(null);

      setSuccess(
        ar
          ? "تمت إزالة العضو من الشركة بنجاح."
          : "Member removed from the company successfully."
      );

      await load();
    } catch (cause) {
      console.error("Remove member failed:", cause);

      setRemoveError(
        ar
          ? "تعذرت إزالة العضو. تأكد من صلاحياتك وحاول مرة ثانية."
          : "Could not remove the member. Check your permissions and try again."
      );
    } finally {
      setRemoving(false);
    }
  }

  const activeMembers = members.filter(
    (member) => member.status === "active"
  );

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F8FAFC] text-[#0B1930]"
    >
      <DashboardHeader
        title={ar ? "أعضاء الفريق" : "Team Members"}
      />

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700">
              {ar
                ? "إدارة الشركة"
                : "COMPANY MANAGEMENT"}
            </span>

            <p className="mt-5 text-slate-500">
              {ar
                ? "عرض أعضاء شركتك وأدوارهم وأقسامهم."
                : "View your company's members, roles and departments."}
            </p>

            {companyName && (
              <p className="mt-2 text-sm font-semibold text-blue-700">
                {companyName}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {(myRole === "owner" ||
              myRole === "finance_manager") && (
              <Link
                href="/dashboard/team/invite"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {ar ? "+ دعوة عضو" : "+ Invite member"}
              </Link>
            )}

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || removing}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {ar ? "تحديث البيانات" : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {success}
          </div>
        )}

        {loading ? (
          <div
            role="status"
            className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500"
          >
            {ar
              ? "جارٍ تحميل أعضاء الفريق..."
              : "Loading team members..."}
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">
                  {ar
                    ? "إجمالي العضويات الظاهرة"
                    : "Visible memberships"}
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {members.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">
                  {ar
                    ? "الأعضاء النشطون"
                    : "Active members"}
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {activeMembers.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">
                  {ar ? "صلاحيتك" : "Your role"}
                </p>

                <p className="mt-2 text-lg font-bold">
                  {roleName(myRole)}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
                <h2 className="text-xl font-bold">
                  {ar ? "فريق الشركة" : "Company team"}
                </h2>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {ar
                    ? "قائمة الأعضاء"
                    : "Member directory"}
                </span>
              </div>

              {members.length === 0 ? (
                <p className="p-8 text-slate-500">
                  {ar
                    ? "ما في عضويات ظاهرة حاليًا."
                    : "No memberships visible yet."}
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {members.map((member) => {
                    const isMe =
                      member.user_id === myUserId;

                    const canRemove =
                      myRole === "owner" &&
                      !isMe &&
                      member.role !== "owner";

                    return (
                      <div
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {memberName(member)}

                            {isMe && (
                              <span className="ms-2 text-xs text-blue-600">
                                {ar ? "أنت" : "You"}
                              </span>
                            )}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {departmentName(
                              member.department_id
                            )}
                          </p>

                          {!isMe && !profileName(member.user_id) && (
                            <p className="mt-1 font-mono text-xs text-slate-400">
                              {member.user_id.slice(0, 8)}…
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                            {roleName(member.role)}
                          </span>

                          <span
                            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                              member.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {member.status}
                          </span>

                          {canRemove && (
                            <button
                              type="button"
                              onClick={() =>
                                openRemoveDialog(member)
                              }
                              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              {ar
                                ? "إزالة العضو"
                                : "Remove member"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-500">
              {ar
                ? "يمكن لصاحب الشركة والمدير المالي دعوة أعضاء جدد. إزالة الأعضاء متاحة لصاحب الشركة فقط. سجلات المصروفات والموافقات السابقة تبقى محفوظة بعد إزالة العضو."
                : "Owners and finance managers can invite members. Only the owner can remove members. Previous expense requests and approval records are preserved after removal."}
            </p>
          </>
        )}
      </section>

      {memberToRemove && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !removing
            ) {
              setMemberToRemove(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-member-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
              </svg>
            </div>

            <h2
              id="remove-member-title"
              className="text-xl font-bold text-slate-900"
            >
              {ar
                ? "تأكيد إزالة العضو"
                : "Remove team member?"}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              {ar
                ? "سيتم إخراج هذا العضو من الشركة وإلغاء وصوله إلى بياناتها. ستبقى طلبات المصروفات والموافقات السابقة محفوظة."
                : "This member will lose access to the company. Their previous expense requests and approval history will remain preserved."}
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                {memberName(memberToRemove)}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {roleName(memberToRemove.role)}
              </p>

              <p className="mt-1 font-mono text-xs text-slate-400">
                {memberToRemove.user_id.slice(0, 8)}…
              </p>
            </div>

            {removeError && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {removeError}
              </p>
            )}

            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={removing}
                onClick={() => setMemberToRemove(null)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {ar ? "إلغاء" : "Cancel"}
              </button>

              <button
                type="button"
                disabled={removing}
                onClick={() => void removeMember()}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removing
                  ? ar
                    ? "جارٍ الإزالة..."
                    : "Removing..."
                  : ar
                    ? "نعم، إزالة العضو"
                    : "Yes, remove member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
