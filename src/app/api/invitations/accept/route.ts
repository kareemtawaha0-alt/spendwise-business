import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";



export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
      return NextResponse.json({ error: "Invalid invitation link." }, { status: 400 });
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
    if (authError || !user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    const hash = createHash("sha256").update(token).digest("hex");
    const { error } = await supabase.rpc("spendwise_accept_invitation", { p_token_hash: hash });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json({ error: "Could not accept invitation." }, { status: 500 });
  }
}