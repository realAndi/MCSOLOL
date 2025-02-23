"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  Play, 
  Square, 
  RefreshCw, 
  XCircle,
  Users,
  Cpu,
  HardDrive,
  Globe,
  Terminal,
  Settings,
  MessageSquare,
  FolderOpen,
  Package,
  Gauge,
  Server,
  Shield,
  Copy
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface ServerStatus {
  status: "running" | "stopped" | "starting" | "stopping";
  players: {
    online: number;
    max: number;
  };
  performance: {
    cpu: string;
    ram: {
      used: string;
      total: string;
    };
  };
  network: {
    ip: string;
    port: string;
  };
  settings: {
    name: string;
    motd: string;
    version: string;
  };
}

export default function ServerPage() {
  const params = useParams();
  const serverId = params.serverId as string;
  const { toast } = useToast();
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/server/${serverId}/status`);
        if (!response.ok) throw new Error('Failed to fetch status');
        
        const data = await response.json();
        setServerStatus(data);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [serverId]);

  const handleServerAction = async (action: "start" | "stop" | "restart" | "force-stop") => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/server/${serverId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error('Failed to control server');
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: `Server ${action} command sent successfully`,
        });
      } else {
        throw new Error(data.message || 'Failed to control server');
      }
    } catch (error) {
      console.error(`Failed to ${action} server:`, error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} server`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAddress = () => {
    if (serverStatus) {
      const address = `${serverStatus.network.ip}:${serverStatus.network.port}`;
      navigator.clipboard.writeText(address);
      toast({
        title: "Copied!",
        description: "Server address copied to clipboard",
      });
    }
  };

  if (!serverStatus) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Loading...</h2>
            <p className="text-muted-foreground">Fetching server information</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate RAM usage percentage
  const ramUsed = parseInt(serverStatus.performance.ram.used.replace(/[^0-9]/g, ''));
  const ramTotal = parseInt(serverStatus.performance.ram.total.replace(/[^0-9]/g, ''));
  const ramPercentage = (ramUsed / ramTotal) * 100;

  // Calculate CPU usage percentage
  const cpuPercentage = parseFloat(serverStatus.performance.cpu.replace('%', ''));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Server Header with Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{serverStatus.settings.name}</CardTitle>
                  <CardDescription>{serverStatus.settings.motd}</CardDescription>
                </div>
                <div className="px-3 py-1 rounded-md bg-muted text-sm">
                  {serverStatus.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Version</div>
                  <div className="font-medium">{serverStatus.settings.version}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Players</div>
                  <div className="font-medium">{serverStatus.players.online}/{serverStatus.players.max}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Server Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 mb-4">
                <code className="px-2 py-1 rounded bg-muted">
                  {serverStatus.network.ip}:{serverStatus.network.port}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyAddress}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Share this address with players to connect to your server
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Server Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Server Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                onClick={() => handleServerAction("start")}
                className="w-full transition-all hover:scale-105 active:scale-95"
                disabled={serverStatus.status === "starting" || serverStatus.status === "running" || isLoading}
              >
                <Play className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Start Server</span>
                <span className="sm:hidden">Start</span>
              </Button>

              <Button
                variant="secondary"
                onClick={() => handleServerAction("stop")}
                className="w-full transition-all hover:scale-105 active:scale-95"
                disabled={serverStatus.status === "stopping" || serverStatus.status === "stopped" || isLoading}
              >
                <Square className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Stop Server</span>
                <span className="sm:hidden">Stop</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => handleServerAction("restart")}
                className="w-full transition-all hover:scale-105 active:scale-95"
                disabled={serverStatus.status !== "running" || isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Restart Server</span>
                <span className="sm:hidden">Restart</span>
              </Button>

              <Button
                variant="destructive"
                onClick={() => handleServerAction("force-stop")}
                className="w-full transition-all hover:scale-105 active:scale-95"
                disabled={serverStatus.status === "stopped" || isLoading}
              >
                <XCircle className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Force Stop</span>
                <span className="sm:hidden">Force</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Performance Monitoring */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                CPU Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{serverStatus.performance.cpu}</span>
                  <span className="text-sm text-muted-foreground">100%</span>
                </div>
                <Progress value={cpuPercentage} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{serverStatus.performance.ram.used}</span>
                  <span className="text-sm text-muted-foreground">{serverStatus.performance.ram.total}</span>
                </div>
                <Progress value={ramPercentage} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
} 