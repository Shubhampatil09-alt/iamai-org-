import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getUsers } from '@/actions/users';
import AdminUsersTable from '@/components/AdminUsersTable';
import { Shield } from 'lucide-react';

export default async function AdminPage() {
  const session = await auth();

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const users = await getUsers();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
          </div>
          <p className="text-muted-foreground">
            Manage users and their roles
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Users</div>
            <div className="text-3xl font-bold mt-2">{users.length}</div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground">Admins</div>
            <div className="text-3xl font-bold mt-2">
              {users.filter((u) => u.role === 'ADMIN').length}
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground">Photographers</div>
            <div className="text-3xl font-bold mt-2">
              {users.filter((u) => u.role === 'PHOTOGRAPHER').length}
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground">Regular Users</div>
            <div className="text-3xl font-bold mt-2">
              {users.filter((u) => u.role === 'USER').length}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">User Management</h2>
          <AdminUsersTable users={users} currentUserId={session.user.id} />
        </div>
      </div>
    </main>
  );
}
