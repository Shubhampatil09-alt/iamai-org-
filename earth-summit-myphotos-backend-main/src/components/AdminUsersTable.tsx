'use client';

import { useState } from 'react';
import { createUser, resetUserPassword, deleteUser } from '@/actions/users';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { UserPlus, Trash2, Key, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  _count: {
    photos: number;
  };
};

type AdminUsersTableProps = {
  users: User[];
  currentUserId: string;
};

export default function AdminUsersTable({ users, currentUserId }: AdminUsersTableProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Create user dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'USER' | 'PHOTOGRAPHER' | 'ADMIN'>('USER');
  
  // Reset password dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetUserEmail, setResetUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      setError('Email and password are required');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Password validation
    if (newUserPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('email', newUserEmail);
    formData.append('password', newUserPassword);
    formData.append('name', newUserName);
    formData.append('role', newUserRole);

    const result = await createUser(formData);

    if (result.success) {
      setCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('USER');
      router.refresh();
    } else {
      setError(result.error || 'Failed to create user');
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    const result = await resetUserPassword(resetUserId, newPassword);

    if (result.success) {
      setResetDialogOpen(false);
      setResetUserId('');
      setResetUserEmail('');
      setNewPassword('');
      router.refresh();
      alert('Password reset successfully');
    } else {
      setError(result.error || 'Failed to reset password');
    }

    setLoading(false);
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Delete user ${userEmail}? This action cannot be undone.`)) return;

    setLoading(true);
    const result = await deleteUser(userId);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete user');
    }

    setLoading(false);
  };

  const openResetDialog = (userId: string, userEmail: string) => {
    setResetUserId(userId);
    setResetUserEmail(userEmail);
    setResetDialogOpen(true);
    setError('');
  };

  return (
    <div className="space-y-4">
      {/* Create User Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => setCreateDialogOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Create New User
        </Button>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg">{user.name || user.email}</h3>
                  <Badge variant={user.role === 'ADMIN' ? 'default' : user.role === 'PHOTOGRAPHER' ? 'secondary' : 'outline'}>
                    {user.role}
                  </Badge>
                  {user.id === currentUserId && (
                    <Badge variant="outline">You</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user._count.photos} photos • Joined {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openResetDialog(user.id, user.email)}
                  disabled={loading}
                >
                  <Key className="h-4 w-4 mr-1" />
                  Reset Password
                </Button>
                {user.id !== currentUserId && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteUser(user.id, user.email)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Name (Optional)</label>
              <Input
                type="text"
                placeholder="John Doe"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password *</label>
              <Input
                type="password"
                placeholder="Min 6 characters"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role *</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'USER' | 'PHOTOGRAPHER' | 'ADMIN')}
                disabled={loading}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="USER">User</option>
                <option value="PHOTOGRAPHER">Photographer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setError('');
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={loading}>
                {loading ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Resetting password for: <span className="font-medium">{resetUserEmail}</span>
            </p>
            <div>
              <label className="text-sm font-medium">New Password *</label>
              <Input
                type="password"
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setResetDialogOpen(false);
                  setError('');
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
