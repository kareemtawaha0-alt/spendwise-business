import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";



export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const organizationId = body.organizationId;
    const email = body.email;
    const role = body.role;
    const departmentId = body.departmentId ?? null;
    if (typeof organizationId !== "string" || !/^[0-9a-f-]{36}$/i.test(organizationId) ||
        typeof email !== "string" || email.length > 320 ||
        !["finance_manager", "department_manager", "employee"].includes(role) ||
        (departmentId !== null && typeof departmentId !== "string")) {
      return NextResponse.json({ error: "Invalid invitation details." }, { status: 400 });
    }
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(values) {
            try {
              values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch { /* Session refresh is handled by the auth flow. */ }
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error } = await supabase.rpc("spendwise_create_invitation", {
      p_organization_id: organizationId,
      p_email: email.trim().toLowerCase(),
      p_role: role,
      p_department_id: departmentId,
      p_token_hash: tokenHash,
    });
    if (error) {
      console.error("Invitation RPC failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const origin = new URL(request.url).origin;
    return NextResponse.json({ url: `${origin}/invite/accept?token=${token}` });
  } catch (error) {
    console.error("Create invitation error:", error);
    return NextResponse.json({ error: "Could not create invitation." }, { status: 500 });
  }
}