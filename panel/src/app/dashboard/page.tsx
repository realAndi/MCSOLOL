"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Play, Square, Settings, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ServerListItem {
  id: string;
  name: string;
  motd: string;
  status: "running" | "stopped" | "starting" | "stopping";
  players: {
    online: number;
    max: number;
  };
  version: string;
  port: string;
}

interface PortConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflictingServer?: ServerListItem;
  currentServer?: ServerListItem;
  onChangePort: (newPort: string) => Promise<void>;
  onStopServer: () => Promise<void>;
}

function PortConflictDialog({
  isOpen,
  onClose,
  conflictingServer,
  currentServer,
  onChangePort,
  onStopServer,
}: PortConflictDialogProps) {
  const [newPort, setNewPort] = useState(currentServer?.port || "25565");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset the port when the dialog opens with a new server
  useEffect(() => {
    if (currentServer) {
      setNewPort(currentServer.port);
    }
  }, [currentServer]);

  // Don't render the dialog if servers are not defined
  if (!conflictingServer || !currentServer) {
    return null;
  }

  const handleChangePort = async () => {
    try {
      setIsSubmitting(true);
      await onChangePort(newPort);
      onClose();
    } catch (error) {
      console.error('Failed to change port:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopServer = async () => {
    try {
      setIsSubmitting(true);
      await onStopServer();
      onClose();
    } catch (error) {
      console.error('Failed to stop server:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Port Conflict Detected</DialogTitle>
          <DialogDescription>
            Server "{conflictingServer.name}" is already running on port {conflictingServer.port}.
            You can either stop that server or change the port for "{currentServer.name}".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>New Port</Label>
            <Input
              type="number"
              min="1024"
              max="65535"
              value={newPort}
              onChange={(e) => setNewPort(e.target.value)}
              placeholder="Enter new port number"
            />
            <p className="text-sm text-muted-foreground">
              Choose a port number between 1024 and 65535
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleStopServer}
            disabled={isSubmitting}
          >
            Stop {conflictingServer.name}
          </Button>
          <Button
            onClick={handleChangePort}
            disabled={isSubmitting || !newPort || newPort === currentServer.port}
          >
            Change Port
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portConflict, setPortConflict] = useState<{
    isOpen: boolean;
    conflictingServer?: ServerListItem;
    currentServer?: ServerListItem;
  }>({
    isOpen: false
  });

  useEffect(() => {
    const fetchServers = async () => {
      try {
        setError(null);
        const response = await fetch('/api/server');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch servers');
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch servers');
        }
        
        setServers(data.servers || []);
      } catch (error) {
        console.error('Failed to fetch servers:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch servers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchServers();
  }, []);

  const handleServerAction = async (server: ServerListItem, action: "start" | "stop") => {
    if (action === "start") {
      // Check for port conflicts
      const runningServer = servers.find(s => 
        s.status === "running" && 
        s.port === server.port && 
        s.id !== server.id
      );

      if (runningServer) {
        setPortConflict({
          isOpen: true,
          conflictingServer: runningServer,
          currentServer: server
        });
        return;
      }
    }

    try {
      const response = await fetch(`/api/server/${server.id}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} server`);
      }

      // Refresh the server list
      const updatedResponse = await fetch('/api/server');
      const data = await updatedResponse.json();
      setServers(data.servers || []);
    } catch (error) {
      console.error(`Failed to ${action} server:`, error);
    }
  };

  const handleChangePort = async (newPort: string) => {
    if (!portConflict.currentServer) return;

    try {
      // Update server.properties with new port
      const response = await fetch(`/api/server/${portConflict.currentServer.id}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'server-port': newPort
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update server port');
      }

      // Refresh the server list
      const updatedResponse = await fetch('/api/server');
      const data = await updatedResponse.json();
      setServers(data.servers || []);

      // Start the server with the new port
      await handleServerAction(portConflict.currentServer, "start");
    } catch (error) {
      console.error('Failed to change port:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Servers</h1>
        <Button asChild>
          <Link href="/dashboard/create">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Server
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading servers...</p>
        </div>
      ) : error ? (
        <Card className="col-span-full p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2 text-destructive">Error Loading Servers</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Card key={server.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="truncate">{server.name}</CardTitle>
                    <CardDescription className="truncate">{server.motd}</CardDescription>
                  </div>
                  <div className="px-2 py-1 rounded-md bg-muted text-xs">
                    Status: {server.status}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Players:</span>
                      <span className="font-medium">{server.players.online}/{server.players.max}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Version:</span>
                      <span className="font-medium">{server.version}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Port:</span>
                      <span className="font-medium">{server.port}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                      onClick={() => handleServerAction(server, server.status === "running" ? "stop" : "start")}
                    >
                      {server.status === "running" ? (
                        <Square className="mr-2 h-4 w-4" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      {server.status === "running" ? "Stop" : "Start"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                      asChild
                    >
                      <Link href={`/dashboard/${server.id}`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Empty State */}
          {servers.length === 0 && (
            <Card className="col-span-full p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">No Servers Found</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by creating your first Minecraft server.
                </p>
                <Button asChild>
                  <Link href="/dashboard/create">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Server
                  </Link>
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      <PortConflictDialog
        isOpen={portConflict.isOpen}
        onClose={() => setPortConflict({ isOpen: false })}
        conflictingServer={portConflict.conflictingServer}
        currentServer={portConflict.currentServer}
        onChangePort={handleChangePort}
        onStopServer={() => handleServerAction(portConflict.conflictingServer!, "stop")}
      />
    </DashboardLayout>
  );
} 