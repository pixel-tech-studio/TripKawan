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
    return NextResponse.redirect(
      `${origin}/app/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return response;
}
