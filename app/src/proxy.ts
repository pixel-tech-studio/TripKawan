import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const proxyConfig = {
  matcher: [
    /*
     * Match all /app/* paths EXCEPT:
     * - /app/login  (login page — must not block unauthenticated users)
     * - /app/auth/* (Supabase PKCE callback — must reach the route handler untouched)
     */
    "/app/((?!login|auth).*)",
  ],
};
