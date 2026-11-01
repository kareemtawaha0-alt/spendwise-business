
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const [message, setMessage] = useState("Preparing your workspace...");

  useEffect(() => {
    let cancelled = false;

    async function checkWorkspace() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (authError || !user) {
          window.location.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("memberships")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1);

        if (cancelled) return;

        if (error) {
          console.error("Membership check failed:", error);
          setMessage("Unable to load your workspace. Please refresh.");
          return;
        }

        if (data && data.length > 0) {
          window.location.replace("/dashboard");
        } else {
          window.location.replace("/onboarding");
        }
      } catch (error) {
        console.error("Workspace routing failed:", error);

        if (!cancelled) {
          setMessage("Something went wrong. Please refresh.");
        }
      }
    }

    checkWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
          S
        </div>

        <h1 className="text-2xl font-bold text-[#0B1930]">
          Spendwise Business
        </h1>

        <p className="mt-3 text-sm text-slate-500" role="status">
          {message}
        </p>
      </div>
    </main>
  );
}
