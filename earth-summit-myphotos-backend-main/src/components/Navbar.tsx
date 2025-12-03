'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logout } from '@/actions/auth';
import {
  LogOut,
  Search,
  Home,
  Shield,
  User,
  DoorOpen,
  Download,
} from 'lucide-react';
import { Role } from '@prisma/client';

type NavbarProps = {
  user: {
    email?: string | null;
    name?: string | null;
    role: Role;
  } | null;
};

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-card border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              MyPhotos
            </h1>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button
                variant={isActive('/') ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Gallery
              </Button>
            </Link>

            {user && (
              <>
                <Link href="/search">
                  <Button
                    variant={isActive('/search') ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Search
                  </Button>
                </Link>

                <Link href="/dashboard/imports">
                  <Button
                    variant={isActive('/dashboard/imports') ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Imports
                  </Button>
                </Link>

                {user.role === 'ADMIN' && (
                  <>
                    <Link href="/rooms">
                      <Button
                        variant={isActive('/rooms') ? 'default' : 'ghost'}
                        size="sm"
                        className="gap-2"
                      >
                        <DoorOpen className="h-4 w-4" />
                        Rooms
                      </Button>
                    </Link>
                    <Link href="/admin">
                      <Button
                        variant={isActive('/admin') ? 'default' : 'ghost'}
                        size="sm"
                        className="gap-2"
                      >
                        <Shield className="h-4 w-4" />
                        Admin
                      </Button>
                    </Link>
                  </>
                )}
              </>
            )}

            {/* User Menu */}
            {user ? (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="hidden sm:block">
                    <div className="font-medium">{user.name || 'User'}</div>
                    <div className="text-xs text-muted-foreground">{user.role}</div>
                  </div>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l">
                <Link href="/auth/login">
                  <Button size="sm">Login</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
