import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Pin cookies to the apex domain so the PKCE code_verifier set here is
  // readable by the callback regardless of www vs non-www entry.
  const isLocalhost =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost";

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        ...(isLocalhost ? {} : { domain: ".tripkawan.my" }),
      },
    }
  );
}
