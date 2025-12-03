'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Folder, ChevronRight, Loader2 } from 'lucide-react';

type Folder = {
  id: string;
  name: string;
};

type Props = {
  onSelectFolder: (folderId: string, folderName: string) => void;
};

export default function GoogleDriveFolderPicker({ onSelectFolder }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'My Drive' },
  ]);

  useEffect(() => {
    loadFolders('root');
  }, []);

  const loadFolders = async (parentId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (parentId !== 'root') {
        params.set('parentId', parentId);
      }

      const response = await fetch(`/api/gdrive/folders?${params}`);
      const data = await response.json();

      if (data.folders) {
        setFolders(data.folders);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder: Folder) => {
    setBreadcrumb([...breadcrumb, folder]);
    loadFolders(folder.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumb = breadcrumb.slice(0, index + 1);
    setBreadcrumb(newBreadcrumb);
    const folderId = newBreadcrumb[newBreadcrumb.length - 1].id;
    loadFolders(folderId);
  };

  const handleSelect = () => {
    const current = breadcrumb[breadcrumb.length - 1];
    setSelectedFolder(current);
    onSelectFolder(current.id, current.name);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm overflow-x-auto">
        {breadcrumb.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className="text-blue-600 hover:underline whitespace-nowrap"
            >
              {item.name}
            </button>
            {index < breadcrumb.length - 1 && (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        ))}
      </div>

      {/* Folder List */}
      <div className="border rounded-lg max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : folders.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No folders found
          </div>
        ) : (
          <div className="divide-y">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleFolderClick(folder)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
              >
                <Folder className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">{folder.name}</span>
                <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Select Button */}
      <Button onClick={handleSelect} className="w-full">
        Select Current Folder: {breadcrumb[breadcrumb.length - 1].name}
      </Button>
    </div>
  );
}
