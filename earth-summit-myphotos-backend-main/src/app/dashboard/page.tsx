import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Upload, FolderOpen, Images, CheckCircle, AlertCircle } from 'lucide-react';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  const params = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-12">
        {/* Success/Error Messages */}
        {params.success === 'google_drive_connected' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-green-900 font-medium">
              Google Drive connected successfully! You can now import photos.
            </p>
          </div>
        )}

        {params.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-900 font-medium">
              {params.error === 'google_auth_failed'
                ? 'Failed to connect Google Drive. Please try again.'
                : params.error === 'missing_code'
                ? 'Authorization code missing. Please try again.'
                : params.error === 'invalid_tokens'
                ? 'Failed to obtain valid tokens. Please try again.'
                : 'An error occurred. Please try again.'}
            </p>
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome back, {session.user?.name || 'User'}
          </h1>
          <p className="text-gray-600 text-lg">
            Manage your photos and imports from your dashboard
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* View Gallery */}
          <Link href="/">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Images className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                View Gallery
              </h3>
              <p className="text-gray-600 text-sm">
                Browse and search through all your photos
              </p>
            </div>
          </Link>

          {/* Upload Photos */}
          {(session.user.role === 'PHOTOGRAPHER' || session.user.role === 'ADMIN') && (
            <Link href="/">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                  <Upload className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Upload Photos
                </h3>
                <p className="text-gray-600 text-sm">
                  Upload photos locally or import from Google Drive
                </p>
              </div>
            </Link>
          )}

          {/* Import Jobs */}
          {(session.user.role === 'PHOTOGRAPHER' || session.user.role === 'ADMIN') && (
            <Link href="/dashboard/imports">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                  <FolderOpen className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Import Jobs
                </h3>
                <p className="text-gray-600 text-sm">
                  Track your active Google Drive import jobs
                </p>
              </div>
            </Link>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Quick Actions
          </h2>
          <div className="space-y-4">
            <Link href="/">
              <Button className="w-full md:w-auto" size="lg">
                <Images className="mr-2 h-5 w-5" />
                Browse Gallery
              </Button>
            </Link>
            {(session.user.role === 'PHOTOGRAPHER' || session.user.role === 'ADMIN') && (
              <Link href="/dashboard/imports">
                <Button variant="outline" className="w-full md:w-auto ml-0 md:ml-4 mt-4 md:mt-0" size="lg">
                  <FolderOpen className="mr-2 h-5 w-5" />
                  View Imports
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
