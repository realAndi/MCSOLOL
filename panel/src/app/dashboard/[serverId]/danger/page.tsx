"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function DangerPage() {
  const params = useParams();
  const serverId = params.serverId as string;
  const router = useRouter();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteServer = async () => {
    if (confirmText !== serverId) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/server/${serverId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete server');
      }

      toast({
        title: "Server Deleted",
        description: "The server has been permanently deleted.",
      });

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to delete server:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete server",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dangerous Settings</h1>
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Delete Server</CardTitle>
            <CardDescription>
              This action is permanent and cannot be undone. All server files, worlds, and configurations will be deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Server Permanently
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Server Permanently</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the server
              <strong> {serverId} </strong>
              and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <p className="text-sm text-muted-foreground mb-4">
              To confirm, type <strong>{serverId}</strong> in the box below:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={serverId}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteServer}
              disabled={confirmText !== serverId || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
} 