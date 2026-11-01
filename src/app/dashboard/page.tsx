
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { NotificationBell } from "@/components/notification-bell";

type TeamMember = {
  id: string;
  role: string;
  label: string;
};

type Workspace = {
  organizationId: string;
  organizationName: string;
  role: string;
  email: string;
  fullName: string;
  memberCount: number | null;
  budgetTotal: number | null;
  budgetCount: number | null;
  requestCount: number | null;
  pendingCount: number | null;
  departmentName: string | null;
  departmentBudget: number | null;
  departmentTeam: TeamMember[];
  departmentTeamError: boolean;
};

type Role =
  | "owner"
  | "finance_manager"
  | "department_manager"
  | "employee";

const roleNames: Record<Role, { ar: string; en: string }> = {
  owner: { ar: "صاحب الشركة", en: "Owner" },
  finance_manager: {
    ar: "المدير المالي",
    en: "Finance Manager",
  },
  department_manager: {
    ar: "مدير القسم",
    en: "Department Manager",
  },
  employee: { ar: "موظف", en: "Employee" },
};

export default function DashboardPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [workspace, setWorkspace] = useState<Workspace | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const supabase = createClient();

        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (!active) return;

        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const user = authData.user;

        const {
          data: memberships,
          error: membershipError,
        } = await supabase
          .from("memberships")
          .select("organization_id, role, department_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1);

        if (!active) return;
        if (membershipError) throw membershipError;

        if (!memberships || memberships.length === 0) {
          router.replace("/onboarding");
          return;
        }

        const membership = memberships[0];

        const {
          data: organization,
          error: organizationError,
        } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", membership.organization_id)
          .single();

        if (!active) return;
        if (organizationError) throw organizationError;

        const { count, error: countError } = await supabase
          .from("memberships")
          .select("organization_id", {
            count: "exact",
            head: true,
          })
          .eq("organization_id", membership.organization_id)
          .eq("status", "active");

        if (!active) return;

        const today = new Date();
        const monthStart =
          `${today.getFullYear()}-` +
          `${String(today.getMonth() + 1).padStart(2, "0")}-01`;

        const canManageBudgets =
          membership.role === "owner" ||
          membership.role === "finance_manager";

        let budgetTotal: number | null = null;
        let budgetCount: number | null = null;

        if (canManageBudgets) {
          const {
            data: budgets,
            error: budgetsError,
          } = await supabase
            .from("budgets")
            .select("amount")
            .eq("organization_id", membership.organization_id)
            .eq("period_start", monthStart);

          if (!active) return;

          if (budgetsError) {
            console.error("Budget summary error:", budgetsError);
          } else {
            budgetCount = budgets?.length ?? 0;
            budgetTotal = (budgets ?? []).reduce(
              (sum, budget) => sum + Number(budget.amount),
              0
            );
          }
        }

        let departmentName: string | null = null;
        let departmentBudget: number | null = null;
        let departmentTeam: TeamMember[] = [];
        let departmentTeamError = false;

        if (
          membership.role === "department_manager" &&
          membership.department_id
        ) {
          const [
            departmentResult,
            budgetResult,
            teamResult,
          ] = await Promise.all([
            supabase
              .from("departments")
              .select("name")
              .eq("organization_id", membership.organization_id)
              .eq("id", membership.department_id)
              .maybeSingle(),

            supabase
              .from("budgets")
              .select("amount")
              .eq("organization_id", membership.organization_id)
              .eq("department_id", membership.department_id)
              .eq("period_start", monthStart)
              .maybeSingle(),

            supabase
              .from("memberships")
              .select("user_id, role")
              .eq("organization_id", membership.organization_id)
              .eq("department_id", membership.department_id)
              .eq("status", "active"),
          ]);

          if (!active) return;

          if (departmentResult.error) {
            console.error(
              "Department lookup:",
              departmentResult.error
            );
          } else {
            departmentName = departmentResult.data?.name ?? null;
          }

          if (budgetResult.error) {
            console.error(
              "Department budget lookup:",
              budgetResult.error
            );
          } else {
            departmentBudget = budgetResult.data
              ? Number(budgetResult.data.amount)
              : null;
          }

          if (teamResult.error) {
            console.error(
              "Department team lookup:",
              teamResult.error
            );
            departmentTeamError = true;
          } else {
            const teamMembers = teamResult.data ?? [];
            const userIds = teamMembers.map(
              (member) => member.user_id
            );

            let namesById = new Map<string, string>();

            if (userIds.length > 0) {
              const profilesResult = await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", userIds);

              if (!active) return;

              if (profilesResult.error) {
                console.error(
                  "Team profile names lookup:",
                  profilesResult.error
                );
              } else {
                namesById = new Map(
                  (profilesResult.data ?? []).map((profile) => [
                    profile.id,
                    profile.full_name?.trim() || "",
                  ])
                );
              }
            }

            departmentTeam = teamMembers.map((member) => ({
              id: member.user_id,
              role: member.role,
              label:
                namesById.get(member.user_id) ||
                (member.user_id === user.id
                  ? ar
                    ? "أنت"
                    : "You"
                  : ar
                    ? "اسم غير متاح"
                    : "Name unavailable"),
            }));
          }
        }

        let requestCount: number | null = null;
        let pendingCount: number | null = null;

        if (membership.role !== "employee") {
          let query = supabase
            .from("expense_requests")
            .select("status, department_id")
            .eq("organization_id", membership.organization_id);

          if (
            membership.role === "department_manager" &&
            membership.department_id
          ) {
            query = query.eq(
              "department_id",
              membership.department_id
            );
          }

          const result = await query;

          if (!active) return;

          if (!result.error) {
            requestCount = result.data?.length ?? 0;
            pendingCount = (result.data ?? []).filter(
              (request) =>
                request.status === "pending_department" ||
                request.status === "pending_finance"
            ).length;
          }
        }

        setWorkspace({
          organizationId: membership.organization_id,
          organizationName: organization.name,
          role: membership.role,
          email: user.email ?? "",
          fullName:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : user.email?.split("@")[0] ?? "User",
          memberCount: countError ? null : count,
          budgetTotal,
          budgetCount,
          requestCount,
          pendingCount,
          departmentName,
          departmentBudget,
          departmentTeam,
          departmentTeamError,
        });
      } catch (err) {
        if (active) {
          console.error("Dashboard load error:", err);
          setError(
            ar
              ? "تعذر تحميل بيانات الشركة. حدّث الصفحة وحاول مجددًا."
              : "Unable to load your company. Refresh and try again."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [router, ar]);

  async function signOut() {
    setSigningOut(true);

    const supabase = createClient();
    const { error: signOutError } =
      await supabase.auth.signOut();

    if (signOutError) {
      setError(
        ar
          ? "تعذر تسجيل الخروج. حاول مرة ثانية."
          : "Could not sign out. Please try again."
      );
      setSigningOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  const role = workspace?.role as Role | undefined;
  const isOwner = role === "owner";
  const isFinance = role === "finance_manager";
  const isDepartmentManager = role === "department_manager";
  const isEmployee = role === "employee";
  const isAdmin = isOwner || isFinance;

  const roleLabel =
    role && roleNames[role]
      ? ar
        ? roleNames[role].ar
        : roleNames[role].en
      : workspace?.role ?? "—";

  const navItems = [
    {
      key: "overview",
      en: "Overview",
      ar: "نظرة عامة",
      symbol: "◫",
      href: "/dashboard",
      ready: true,
      visible: true,
    },
    {
      key: "requests",
      en: "My requests",
      ar: "طلباتي",
      symbol: "▤",
      href: "/dashboard/requests",
      ready: true,
      visible: true,
    },
    {
      key: "approvals",
      en: "Approvals",
      ar: "الموافقات",
      symbol: "✓",
      href: "/dashboard/approvals",
      ready: true,
      visible: !isEmployee,
    },
    {
      key: "budgets",
      en: "Budgets",
      ar: "الميزانيات",
      symbol: "▥",
      href: "/dashboard/budgets",
      ready: true,
      visible: isAdmin,
    },
    {
      key: "departments",
      en: "Departments",
      ar: "الأقسام",
      symbol: "▦",
      href: "/dashboard/departments",
      ready: true,
      visible: isAdmin,
    },
    {
      key: "team",
      en: "My Team",
      ar: "فريقي",
      symbol: "♙",
      href: "/dashboard/team",
      ready: true,
      visible: true,
    },
    {
      key: "settings",
      en: "Settings",
      ar: "الإعدادات",
      symbol: "⚙",
      href: "/dashboard/settings",
      ready: true,
      visible: true,
    },
    {
      key: "payments",
      en: "Payments",
      ar: "المدفوعات",
      symbol: "◈",
      href: "/dashboard/payments",
      ready: true,
      visible: isAdmin,
    },
    {
      key: "reports",
      en: "Reports",
      ar: "التقارير",
      symbol: "▧",
      href: "/dashboard/reports",
      ready: true,
      visible: isAdmin,
    },
  ].filter((item) => item.visible);

  const roleIntro = isOwner
    ? ar
      ? "تابع شركتك وأقسامها وفريقها وميزانياتها من مكان واحد. طلبات المصروفات متاحة الآن."
      : "Manage your company, departments, team and budgets in one place. Expense requests are available now."
    : isFinance
      ? ar
        ? "مساحة العمل المالية للشركة. الميزانيات والموافقات المالية متاحة الآن."
        : "Your company finance workspace. Budgets and financial approvals are available now."
      : isDepartmentManager
        ? ar
          ? "تابع طلبات قسمك والموافقات وميزانية القسم وفريق العمل."
          : "Manage your department requests, approvals, budget and team."
        : ar
          ? "قدّم طلبات المصروفات وتابع حالتها، وتعرّف على زملائك في القسم."
          : "Submit and track expense requests and meet your department colleagues.";

  const money = (value: number) =>
    `${value.toLocaleString(ar ? "ar-JO" : "en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} JOD`;

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F5F7FB] text-[#101D35] lg:flex"
    >
      <aside className="flex w-full shrink-0 flex-col bg-[#0B1930] px-5 py-6 text-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:overflow-y-auto lg:px-6">
        <div className="flex items-center gap-3" dir="ltr">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold">
            S
          </div>
          <span className="text-2xl font-bold tracking-tight">
            spendwise
            <span className="text-blue-400">.</span>
          </span>
        </div>

        <div className="mt-9 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">
            {ar ? "مساحة العمل" : "WORKSPACE"}
          </p>
          <p className="mt-1 truncate font-semibold">
            {workspace?.organizationName ??
              (ar ? "جارٍ التحميل..." : "Loading...")}
          </p>
          <p className="mt-1 text-xs text-blue-300">
            {workspace ? roleLabel : "—"}
          </p>
        </div>

        <nav
          className="mt-8 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:flex-col"
          aria-label={ar ? "القائمة الرئيسية" : "Main navigation"}
        >
          {workspace &&
            navItems.map((item) =>
              item.ready ? (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={
                    item.key === "overview" ? "page" : undefined
                  }
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/10 ${
                    item.key === "overview"
                      ? "bg-blue-600 font-semibold text-white"
                      : "text-slate-200"
                  }`}
                >
                  <span
                    className="w-5 text-center text-lg"
                    aria-hidden="true"
                  >
                    {item.symbol}
                  </span>
                  <span>{ar ? item.ar : item.en}</span>
                </Link>
              ) : (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400"
                  title={ar ? "قريبًا" : "Coming soon"}
                >
                  <span
                    className="w-5 text-center text-lg"
                    aria-hidden="true"
                  >
                    {item.symbol}
                  </span>
                  <span>{ar ? item.ar : item.en}</span>
                  <span className="ms-auto text-[10px] opacity-60">
                    {ar ? "قريبًا" : "Soon"}
                  </span>
                </div>
              )
            )}
        </nav>

        <div className="mt-auto hidden border-t border-white/10 pt-6 text-xs text-slate-400 lg:block">
          © 2026 Spendwise Business
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              {ar ? "لوحة التحكم" : "DASHBOARD"}
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">
              {ar ? "نظرة عامة" : "Overview"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NotificationBell />
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {signingOut
                ? ar
                  ? "جارٍ الخروج..."
                  : "Signing out..."
                : ar
                  ? "تسجيل الخروج"
                  : "Sign out"}
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-10">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500"
              role="status"
            >
              {ar
                ? "جارٍ تحميل مساحة العمل..."
                : "Loading your workspace..."}
            </div>
          ) : workspace ? (
            <>
              <section className="rounded-2xl bg-[#102544] p-7 text-white shadow-sm sm:p-9">
                <p className="text-sm text-blue-300">
                  {ar ? "أهلًا بعودتك" : "Welcome back"} ·{" "}
                  {roleLabel}
                </p>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  {workspace.fullName}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  {roleIntro}
                </p>
              </section>

              {(isOwner || isFinance) && (
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-500">
                      {ar
                        ? "العضويات الظاهرة"
                        : "Visible team memberships"}
                    </p>
                    <p className="mt-3 text-3xl font-bold">
                      {workspace.memberCount ?? "—"}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {ar
                        ? "بحسب صلاحيات القراءة"
                        : "Based on your read permissions"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-500">
                      {ar ? "الميزانيات" : "Budgets"}
                    </p>
                    <p className="mt-3 text-xl font-bold">
                      {workspace.budgetTotal === null
                        ? ar
                          ? "تعذر تحميل الميزانيات"
                          : "Unable to load budgets"
                        : money(workspace.budgetTotal)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {ar
                        ? `ميزانيات الشهر الحالي: ${workspace.budgetCount ?? "—"}`
                        : `Current month · ${workspace.budgetCount ?? "—"} department budget(s)`}
                    </p>
                    <Link
                      href="/dashboard/budgets"
                      className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline"
                    >
                      {ar ? "إدارة الميزانيات" : "Manage budgets"}
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-500">
                      {ar ? "طلبات الموافقة" : "Approval requests"}
                    </p>
                    <p className="mt-3 text-xl font-bold">
                      {workspace.pendingCount ?? "—"}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {ar
                        ? `طلبات معلقة: ${workspace.pendingCount ?? "—"}`
                        : `Pending requests: ${workspace.pendingCount ?? "—"}`}
                    </p>
                  </div>
                </section>
              )}

              {isDepartmentManager && (
                <section className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-500">
                      {ar ? "القسم الذي تديره" : "Your department"}
                    </p>
                    <h3 className="mt-2 text-xl font-bold">
                      {workspace.departmentName ??
                        (ar
                          ? "لم يتم تحديد القسم"
                          : "Department not available")}
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                      <h3 className="font-bold">
                        {ar ? "طلبات قسمك" : "Department requests"}
                      </h3>
                      <p className="mt-3 text-sm text-slate-500">
                        {ar
                          ? `طلبات قسمك المعلقة: ${workspace.pendingCount ?? "—"}`
                          : `Pending department requests: ${workspace.pendingCount ?? "—"}`}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                      <h3 className="font-bold">
                        {ar ? "ميزانية القسم" : "Department budget"}
                      </h3>
                      <p className="mt-3 text-2xl font-bold">
                        {workspace.departmentBudget === null
                          ? ar
                            ? "لا توجد ميزانية مسجلة لهذا الشهر أو تعذر تحميلها"
                            : "No budget recorded for this month, or it could not be loaded"
                          : money(workspace.departmentBudget)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {ar
                          ? "الشهر الحالي · عرض فقط"
                          : "Current month · View only"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-bold">
                        {ar ? "فريق قسمي" : "My department team"}
                      </h3>
                      <Link
                        href="/dashboard/team"
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {ar
                          ? "عرض صفحة الفريق"
                          : "View team page"}
                      </Link>
                    </div>

                    {workspace.departmentTeamError ? (
                      <p className="mt-3 text-sm text-amber-700">
                        {ar
                          ? "تعذر تحميل الفريق. قد تحتاج صلاحيات القراءة إلى مراجعة."
                          : "Could not load team members. Read permissions may need review."}
                      </p>
                    ) : workspace.departmentTeam.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        {ar
                          ? "لا يوجد أعضاء ظاهرون في القسم."
                          : "No visible members in this department."}
                      </p>
                    ) : (
                      <div className="mt-4 divide-y divide-slate-100">
                        {workspace.departmentTeam.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between gap-3 py-3 text-sm"
                          >
                            <span className="font-medium">
                              {member.label}
                            </span>
                            <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-700">
                              {member.role === "employee"
                                ? ar
                                  ? "موظف"
                                  : "Employee"
                                : ar
                                  ? "مدير قسم"
                                  : "Department Manager"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {isEmployee && (
                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                    <h3 className="text-lg font-bold">
                      {ar
                        ? "طلب مصروف جديد"
                        : "New expense request"}
                    </h3>
                    <p className="mt-3 text-sm text-slate-500">
                      {ar
                        ? "قدّم طلب مصروف جديد من صفحة طلباتي."
                        : "Submit an expense request from My requests."}
                    </p>
                    <Link
                      href="/dashboard/requests"
                      className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {ar ? "تقديم طلب" : "New request"}
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                    <h3 className="text-lg font-bold">
                      {ar ? "طلباتي" : "My requests"}
                    </h3>
                    <p className="mt-3 text-sm text-slate-500">
                      {ar
                        ? "تابع طلباتك وحالات الموافقة من صفحة طلباتي."
                        : "Track your requests and approval status on My requests."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                    <h3 className="text-lg font-bold">
                      {ar ? "فريقي" : "My Team"}
                    </h3>
                    <p className="mt-3 text-sm text-slate-500">
                      {ar
                        ? "تعرّف على زملائك ومدير قسمك."
                        : "Meet your department colleagues and manager."}
                    </p>
                    <Link
                      href="/dashboard/team"
                      className="mt-5 inline-flex rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      {ar ? "عرض فريقي" : "View my team"}
                    </Link>
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <h3 className="text-lg font-bold">
                  {ar ? "معلومات حسابك" : "Your account"}
                </h3>
                <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">
                      {ar ? "الشركة" : "Company"}
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {workspace.organizationName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {ar ? "دورك" : "Your role"}
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {roleLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {ar ? "البريد الإلكتروني" : "Email"}
                    </dt>
                    <dd
                      className="mt-1 break-all font-semibold"
                      dir="ltr"
                    >
                      {workspace.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {ar ? "العملة الأساسية" : "Base currency"}
                    </dt>
                    <dd className="mt-1 font-semibold">JOD</dd>
                  </div>
                </dl>
              </section>
            </>
          ) : !error ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p>
                {ar
                  ? "ما في مساحة عمل متاحة."
                  : "No workspace available."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
