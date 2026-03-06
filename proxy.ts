import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const LOGIN_PATH = "/login";
const DASHBOARD_PATH = "/dashboard";

const protectedRoutePrefixes = [
  "/dashboard",
  "/canvas",
  "/import",
  "/actuals",
  "/settings",
  "/assets",
  "/airlock",
  "/vault",
  "/governance",
];
const guestRoutePrefix = "/guest";

const authPaths = ["/login", "/signup", "/forgot-password"];

function isProtectedPath(pathname: string): boolean {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function isGuestPath(pathname: string): boolean {
  return pathname === guestRoutePrefix || pathname.startsWith(guestRoutePrefix + "/");
}

function isAuthPath(pathname: string): boolean {
  return authPaths.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as { path?: string; maxAge?: number });
          });
        },
      },
    }
  );

  let user: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch {
    user = null;
  }

  const pathname = request.nextUrl.pathname;

  if (isProtectedPath(pathname) || isGuestPath(pathname)) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = LOGIN_PATH;
      return NextResponse.redirect(loginUrl);
    }
  }

  if (user && (pathname === "/" || isAuthPath(pathname))) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = DASHBOARD_PATH;
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

