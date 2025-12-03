import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPhotosByRoom } from "@/actions/photos";
import ModernPhotoGallery from "@/components/ModernPhotoGallery";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  const photosData = await getPhotosByRoom();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Photo Gallery
            </h1>
            <p className="text-muted-foreground mt-1">
              Browse and discover amazing photography
            </p>
          </div>
          <Link href="/search">
            <Button size="lg" variant="outline" className="gap-2">
              <Search className="h-5 w-5" />
              Search Similar
            </Button>
          </Link>
        </div>

        {/* Gallery */}
        <ModernPhotoGallery
          photosByRoom={photosData.photosByRoom}
          userRole={session.user.role}
          totalPhotos={photosData.total}
        />
      </div>
    </main>
  );
}
