import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const origin = new URL(request.url).origin;

  if (!code) {
    return NextResponse.redirect(
      `${origin}/app/login?error=${encodeURIComponent("No auth code received")}`
    );
  }

  const cookieStore = await cookies();

  const redirectTo = next ? `/app${next}` : "/app/";
  const response = NextResponse.redirect(`${origin}${redirectTo}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          const isLocalhost = new URL(request.url).hostname === "localhost";
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              path: "/",
              // Only pin to production domain when not on localhost
              ...(!isLocalhost && { domain: ".tripkawan.my" }),
            });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Include cookie diagnostic in the error redirect so we can see exactly
    // what arrived at the callback (temporary while diagnosing PKCE issue).
    const cookieNames = cookieStore.getAll().map((c) => c.name).join(",");
    return NextResponse.redirect(
      `${origin}/app/login?error=${encodeURIComponent(error.message)}&cookies=${encodeURIComponent(cookieNames)}&host=${encodeURIComponent(new URL(request.url).host)}`
    );
  }

  return response;
}
