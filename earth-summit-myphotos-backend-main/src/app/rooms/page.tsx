import { auth } from "@/auth";
import { redirect } from "next/navigation";
import RoomManagement from "@/components/RoomManagement";

export default async function RoomsPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  // Only admins can access the rooms page
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Rooms Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage rooms for organizing photos
          </p>
        </div>

        {/* Room Management Component */}
        <RoomManagement />
      </div>
    </main>
  );
}
