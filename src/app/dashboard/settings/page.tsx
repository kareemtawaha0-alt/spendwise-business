
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";
import { DashboardHeader } from "@/components/dashboard-header";

type Workspace = {
  organizationId: string;
  organizationName: string;
  role: string;
  userId: string;
  email: string;
  fullName: string;
};

const roleLabels: Record<string, { ar: string; en: string }> = {
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

export default function SettingsPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [workspace, setWorkspace] = useState<Workspace | null>(
    null
  );

  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [companySuccess, setCompanySuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const user = authData.user;

      const { data: memberships, error: membershipError } =
        await supabase
          .from("memberships")
          .select("organization_id, role")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1);

      if (membershipError) {
        throw membershipError;
      }

      if (!memberships || memberships.length === 0) {
        router.replace("/onboarding");
        return;
      }

      const membership = memberships[0];

      const [organizationResult, profileResult] =
        await Promise.all([
          supabase
            .from("organizations")
            .select("name")
            .eq("id", membership.organization_id)
            .single(),

          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

      if (organizationResult.error) {
        throw organizationResult.error;
      }

      if (profileResult.error) {
        throw profileResult.error;
      }

      const savedFullName =
        profileResult.data?.full_name?.trim() ||
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "") ||
        user.email?.split("@")[0] ||
        "";

      setWorkspace({
        organizationId: membership.organization_id,
        organizationName: organizationResult.data.name,
        role: membership.role,
        userId: user.id,
        email: user.email ?? "",
        fullName: savedFullName,
      });

      setCompanyName(organizationResult.data.name);
      setFullName(savedFullName);
    } catch (err) {
      console.error("Settings load error:", err);

      setLoadError(
        ar
          ? "تعذر تحميل الإعدادات. حاول مرة ثانية."
          : "Unable to load settings. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router, ar]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveCompanyName() {
    if (!workspace || workspace.role !== "owner") {
      return;
    }

    setCompanyError("");
    setCompanySuccess("");

    const trimmedName = companyName.trim();

    if (!trimmedName) {
      setCompanyError(
        ar
          ? "اسم الشركة لا يمكن أن يكون فارغًا."
          : "Company name cannot be empty."
      );
      return;
    }

    if (trimmedName.length > 100) {
      setCompanyError(
        ar
          ? "اسم الشركة يجب ألا يتجاوز 100 حرف."
          : "Company name must not exceed 100 characters."
      );
      return;
    }

    if (trimmedName === workspace.organizationName) {
      return;
    }

    setSavingCompany(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("organizations")
        .update({ name: trimmedName })
        .eq("id", workspace.organizationId)
        .select("name")
        .single();

      if (error) {
        throw error;
      }

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              organizationName: data.name,
            }
          : previous
      );

      setCompanyName(data.name);

      setCompanySuccess(
        ar
          ? "تم تحديث اسم الشركة بنجاح."
          : "Company name updated successfully."
      );

      router.refresh();
    } catch (err) {
      console.error("Company update error:", err);

      setCompanyError(
        ar
          ? "تعذر تحديث اسم الشركة. حاول مرة ثانية."
          : "Unable to update company name. Please try again."
      );
    } finally {
      setSavingCompany(false);
    }
  }

  async function saveProfile() {
    if (!workspace) {
      return;
    }

    setProfileError("");
    setProfileSuccess("");

    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setProfileError(
        ar
          ? "الاسم الشخصي لا يمكن أن يكون فارغًا."
          : "Full name cannot be empty."
      );
      return;
    }

    if (trimmedName.length > 100) {
      setProfileError(
        ar
          ? "الاسم الشخصي يجب ألا يتجاوز 100 حرف."
          : "Full name must not exceed 100 characters."
      );
      return;
    }

    if (trimmedName === workspace.fullName) {
      return;
    }

    setSavingProfile(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName })
        .eq("id", workspace.userId)
        .select("full_name")
        .single();

      if (error) {
        throw error;
      }

      const updatedName =
        data.full_name?.trim() || trimmedName;

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              fullName: updatedName,
            }
          : previous
      );

      setFullName(updatedName);

      setProfileSuccess(
        ar
          ? "تم تحديث اسمك الشخصي بنجاح."
          : "Your profile name was updated successfully."
      );

      router.refresh();
    } catch (err) {
      console.error("Profile update error:", err);

      setProfileError(
        ar
          ? "تعذر تحديث الاسم الشخصي. حاول مرة ثانية."
          : "Unable to update your name. Please try again."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  const isOwner = workspace?.role === "owner";

  const companyChanged =
    companyName.trim() !==
    (workspace?.organizationName ?? "");

  const profileChanged =
    fullName.trim() !==
    (workspace?.fullName ?? "");

  const roleLabel = workspace
    ? roleLabels[workspace.role]
      ? ar
        ? roleLabels[workspace.role].ar
        : roleLabels[workspace.role].en
      : workspace.role
    : "—";

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F5F7FB] text-[#101D35]"
    >
      <DashboardHeader
        title={ar ? "الإعدادات" : "Settings"}
      />

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
        >
          {ar
            ? "العودة إلى لوحة التحكم"
            : "Back to dashboard"}
        </Link>

        {loadError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            {ar
              ? "جارٍ تحميل الإعدادات..."
              : "Loading settings..."}
          </div>
        ) : workspace ? (
          <>
            {/* MY PROFILE */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="text-xl font-bold">
                  {ar ? "الملف الشخصي" : "My Profile"}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {ar
                    ? "عدّل معلوماتك الشخصية الظاهرة داخل الشركة."
                    : "Manage your personal information displayed to your team."}
                </p>
              </div>

              {profileError && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {profileError}
                </div>
              )}

              {profileSuccess && (
                <div
                  role="status"
                  className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
                >
                  {profileSuccess}
                </div>
              )}

              <form
                className="mt-7 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveProfile();
                }}
              >
                <div>
                  <label
                    htmlFor="full-name"
                    className="mb-2 block text-sm font-semibold"
                  >
                    {ar ? "الاسم الكامل" : "Full name"}
                  </label>

                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    maxLength={100}
                    required
                    disabled={savingProfile}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      setProfileError("");
                      setProfileSuccess("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-email"
                    className="mb-2 block text-sm font-semibold"
                  >
                    {ar
                      ? "البريد الإلكتروني"
                      : "Email address"}
                </label>

                  <input
                    id="profile-email"
                    type="email"
                    value={workspace.email}
                    disabled
                    readOnly
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    {ar
                      ? "تغيير البريد الإلكتروني غير متاح حاليًا."
                      : "Changing your email address is not available yet."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={
                      savingProfile || !profileChanged
                    }
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingProfile
                      ? ar
                        ? "جارٍ الحفظ..."
                        : "Saving..."
                      : ar
                        ? "حفظ الاسم"
                        : "Save name"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      savingProfile || !profileChanged
                    }
                    onClick={() => {
                      setFullName(workspace.fullName);
                      setProfileError("");
                      setProfileSuccess("");
                    }}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {ar ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              </form>
            </section>

            {/* COMPANY SETTINGS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    {ar
                      ? "إعدادات الشركة"
                      : "Company Settings"}
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    {ar
                      ? "المعلومات الأساسية لمساحة عمل الشركة."
                      : "Basic information about your company workspace."}
                  </p>
                </div>

                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {isOwner
                    ? ar
                      ? "صلاحية التعديل"
                      : "Edit access"
                    : ar
                      ? "عرض فقط"
                      : "Read only"}
                </span>
              </div>

              {companyError && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {companyError}
                </div>
              )}

              {companySuccess && (
                <div
                  role="status"
                  className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
                >
                  {companySuccess}
                </div>
              )}

              <form
                className="mt-7 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveCompanyName();
                }}
              >
                <div>
                  <label
                    htmlFor="company-name"
                    className="mb-2 block text-sm font-semibold"
                  >
                    {ar ? "اسم الشركة" : "Company name"}
                  </label>

                  <input
                    id="company-name"
                    type="text"
                    value={companyName}
                    maxLength={100}
                    required
                    disabled={!isOwner || savingCompany}
                    onChange={(event) => {
                      setCompanyName(event.target.value);
                      setCompanyError("");
                      setCompanySuccess("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    {isOwner
                      ? ar
                        ? "يمكن لصاحب الشركة تعديل اسمها."
                        : "The company owner can update this name."
                      : ar
                        ? "يمكن لصاحب الشركة فقط تعديل الاسم."
                        : "Only the company owner can edit this name."}
                  </p>
                </div>

                {isOwner && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={
                        savingCompany || !companyChanged
                      }
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingCompany
                        ? ar
                          ? "جارٍ الحفظ..."
                          : "Saving..."
                        : ar
                          ? "حفظ التغييرات"
                          : "Save changes"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        savingCompany || !companyChanged
                      }
                      onClick={() => {
                        setCompanyName(
                          workspace.organizationName
                        );
                        setCompanyError("");
                        setCompanySuccess("");
                      }}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {ar ? "إلغاء" : "Cancel"}
                    </button>
                  </div>
                )}
              </form>
            </section>

            {/* WORKSPACE INFORMATION */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold">
                {ar
                  ? "معلومات مساحة العمل"
                  : "Workspace Information"}
              </h2>

              <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-slate-500">
                    {ar ? "الشركة" : "Company"}
                  </p>

                  <p className="mt-1 font-semibold">
                    {workspace.organizationName}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">
                    {ar ? "دورك" : "Your role"}
                  </p>

                  <p className="mt-1 font-semibold">
                    {roleLabel}
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
