
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Only allow approved local destinations.
 * Invitation links require a valid invitation token.
 */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) {
    return null;
  }

  // Password recovery destination.
  if (value === "/reset-password") {
    return value;
  }

  try {
    const url = new URL(value, "http://localhost");

    if (url.origin !== "http://localhost") {
      return null;
    }

    if (url.pathname !== "/invite/accept") {
      return null;
    }

    const token = url.searchParams.get("token");

    if (!token || !/^[0-9a-f]{64}$/.test(token)) {
      return null;
    }

    return `${url.pathname}?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  const destination = new URL("/login", origin);
  const response = NextResponse.redirect(destination);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let errorOccurred = true;
  let attempted = false;

  if (code) {
    attempted = true;

    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    errorOccurred = Boolean(error);
  } else if (
    tokenHash &&
    (type === "signup" || type === "email" || type === "recovery")
  ) {
    attempted = true;

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    errorOccurred = Boolean(error);
  }

  if (!attempted || errorOccurred) {
    destination.searchParams.set(
      "confirmed",
      attempted ? "error" : "missing"
    );

    if (next && next !== "/reset-password") {
      destination.searchParams.set("next", next);
    }
  } else if (next === "/reset-password") {
    // A recovery link must lead to the password form,
    // never directly to the dashboard.
    destination.pathname = "/reset-password";
    destination.search = "";
  } else if (next) {
    // Invitation acceptance performs its own checks.
    destination.pathname = "/invite/accept";
    destination.search = new URL(next, origin).search;
  } else {
    destination.searchParams.set("confirmed", "1");
  }

  response.headers.set("Location", destination.toString());
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");

  return response;
}
