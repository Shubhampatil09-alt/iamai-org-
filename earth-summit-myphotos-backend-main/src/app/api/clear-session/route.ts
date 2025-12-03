import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  // Clear all auth-related cookies
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("authjs.csrf-token");
  cookieStore.delete("__Host-authjs.csrf-token");

  return NextResponse.json({
    success: true,
    message: "Session cleared. Please refresh the page."
  });
}
