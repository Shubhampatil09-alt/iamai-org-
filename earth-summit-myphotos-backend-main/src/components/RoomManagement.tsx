"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";

type Room = {
  id: string;
  name: string;
  createdAt: Date;
  _count: {
    photos: number;
  };
};

export default function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      console.error("Fetch rooms error:", err);
      setError("Failed to load rooms");
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newRoomName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create room");
      }

      setNewRoomName("");
      await fetchRooms();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRoom = async (id: string) => {
    if (!editingName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/rooms/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update room");
      }

      setEditingId(null);
      setEditingName("");
      await fetchRooms();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm("Delete this room? All photos in this room will be deleted."))
      return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/rooms/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete room");
      }

      await fetchRooms();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (room: Room) => {
    setEditingId(room.id);
    setEditingName(room.name);
    setError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
    setError("");
  };

  return (
    <Card className="p-6">
      {/* Create Room */}
      <div className="mb-6">
        <div className="flex gap-2">
          <Input
            placeholder="Enter room name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleCreateRoom()}
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleCreateRoom}
            disabled={!newRoomName.trim() || loading}
            size="lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </div>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </div>

      {/* Room List */}
      <div className="space-y-2">
        {rooms.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No rooms yet. Create your first room above.
          </p>
        ) : (
          rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              {editingId === room.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleUpdateRoom(room.id)
                    }
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleUpdateRoom(room.id)}
                    disabled={!editingName.trim() || loading}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEditing}
                    disabled={loading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <h3 className="font-semibold">{room.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {room._count.photos}{" "}
                      {room._count.photos === 1 ? "photo" : "photos"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(room)}
                      disabled={loading}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteRoom(room.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
