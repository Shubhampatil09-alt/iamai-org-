import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyPhotos - AI-Powered Photo Management",
  description: "Manage and search your photo collection with AI face recognition",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session = null;

  try {
    session = await auth();
  } catch (error) {
    // If session decryption fails (e.g., old cookie with different secret)
    // just treat user as not authenticated
    console.log('Auth error (likely old session cookie):', error);
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar user={session?.user || null} />
        {children}
      </body>
    </html>
  );
}
