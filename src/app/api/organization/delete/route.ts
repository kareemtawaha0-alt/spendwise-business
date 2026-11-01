
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const organizationId = body?.organizationId;
    const confirmation = body?.confirmation;

    if (
      typeof organizationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        organizationId
      ) ||
      confirmation !== "DELETE"
    ) {
      return NextResponse.json(
        { error: "Invalid deletion request." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(values) {
            try {
              values.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Session refresh is handled by the auth flow.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    // Ownership is verified again inside the database function.
    const { error } = await supabase.rpc(
      "spendwise_delete_organization",
      {
        p_organization_id: organizationId,
      }
    );

    if (error) {
      console.error("Organization deletion failed:", error.message);

      return NextResponse.json(
        { error: "Unable to delete organization." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Organization deleted successfully.",
    });
  } catch (error) {
    console.error("Delete organization error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
