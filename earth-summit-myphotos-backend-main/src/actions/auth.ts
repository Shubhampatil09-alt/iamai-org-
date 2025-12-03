'use server';

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export type SignupResult = {
  success: boolean;
  error?: string;
};

export type LoginResult = {
  success: boolean;
  error?: string;
};

export async function signup(formData: FormData): Promise<SignupResult> {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    if (password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: "User already exists with this email" };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role: "USER", // Default role
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Signup error:", error);
    return { success: false, error: "Failed to create account" };
  }
}

export async function login(formData: FormData): Promise<LoginResult> {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid email or password" };
        default:
          return { success: false, error: "Authentication failed" };
      }
    }
    return { success: false, error: "An error occurred" };
  }
}

export async function logout() {
  await signOut({ redirect: false });
  redirect("/");
}
