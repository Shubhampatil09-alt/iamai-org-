import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Add your allowed domains here
const ALLOWED_ORIGINS = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
  // Add more allowed domains as needed
];

// In development, allow localhost
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:3001');
}

export default auth((req: any) => {
  const { nextUrl } = req;

  // Handle auth errors gracefully (e.g., invalid/old session tokens)
  let isLoggedIn = false;
  let userRole = null;

  try {
    isLoggedIn = !!req.auth;
    userRole = req.auth?.user?.role;
  } catch (error) {
    console.log("Middleware auth error:", error);
    // Treat as not logged in
  }

  // Define route patterns
  const isAuthRoute = nextUrl.pathname.startsWith("/auth");
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isSearchRoute = nextUrl.pathname.startsWith("/search");
  const isApiRoute = nextUrl.pathname.startsWith("/api");

  // Allow API routes to be handled by their own auth
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Auth routes - redirect to home if already logged in
  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // Admin routes - only admins
  if (isAdminRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/auth/login", nextUrl));
    }
    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // Search route - only authenticated users
  if (isSearchRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/auth/login", nextUrl));
    }
    return NextResponse.next();
  }

  // All other routes are public
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
