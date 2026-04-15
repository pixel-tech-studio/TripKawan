"use client";

import { createBrowserClient } from "@supabase/ssr";

// Pin cookies to the apex domain so the PKCE code_verifier set here is
// readable by the callback regardless of www vs non-www entry.
function getCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return undefined;
  if (host.endsWith(".tripkawan.my") || host === "tripkawan.my") {
    return ".tripkawan.my";
  }
  return undefined;
}

export function createClient() {
  const domain = getCookieDomain();
  const cookieOptions: Record<string, string> = {
    path: "/",
    sameSite: "lax",
  };
  if (domain) cookieOptions.domain = domain;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions }
  );
}
