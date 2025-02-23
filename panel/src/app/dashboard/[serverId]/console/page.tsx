"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Eraser, Play, Square, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useParams } from "next/navigation";

interface LogEntry {
  timestamp: string;
  type: "info" | "warning" | "error" | "command";
  content: string;
}

export default function ConsolePage() {
  const params = useParams();
  const serverId = params.serverId as string;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [command, setCommand] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [serverStatus, setServerStatus] = useState<"running" | "stopped" | "starting" | "stopping">("stopped");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Initialize WebSocket connection and fetch initial logs
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isComponentMounted = true;
    let lastTimestamp: string | null = null;

    const fetchInitialLogs = async () => {
      try {
        const response = await fetch(`/api/server/${serverId}/console?limit=100`);
        if (!response.ok) throw new Error('Failed to fetch logs');
        const data = await response.json();
        if (data.logs && isComponentMounted) {
          setLogs(data.logs);
          lastTimestamp = data.lastTimestamp;
        }
      } catch (error) {
        console.error('Failed to fetch initial logs:', error);
      }
    };

    const connectEventSource = () => {
      if (!isComponentMounted) return;

      try {
        // Close existing connection if any
        if (eventSource) {
          eventSource.close();
        }

        // Connect to the console stream endpoint with last timestamp
        const streamUrl = new URL(`${window.location.protocol}//${window.location.host}/api/server/${serverId}/console/stream`);
        if (lastTimestamp) {
          streamUrl.searchParams.set('since', lastTimestamp);
        }
        console.log('Connecting to console stream:', streamUrl.toString());
        
        eventSource = new EventSource(streamUrl.toString());

        eventSource.onopen = () => {
          console.log('Console stream connected');
        };

        eventSource.onmessage = (event) => {
          if (!isComponentMounted) return;

          try {
            const data = JSON.parse(event.data);
            console.log('Console stream message received:', data);
            
            if (data.logs && data.logs.length > 0) {
              // Update logs in a batch to avoid multiple re-renders
              setLogs(prev => {
                const newLogs = [...prev];
                let updated = false;

                data.logs.forEach((entry: any) => {
                  const newLog: LogEntry = {
                    timestamp: entry.timestamp,
                    type: entry.type as "info" | "warning" | "error" | "command",
                    content: entry.content
                  };

                  // Check for duplicates
                  const isDuplicate = newLogs.some(log => 
                    log.timestamp === newLog.timestamp && 
                    log.content === newLog.content
                  );

                  if (!isDuplicate) {
                    newLogs.push(newLog);
                    updated = true;
                  }
                });

                // Only update state if we added new logs
                if (updated) {
                  // Keep only the last 1000 logs to prevent memory issues
                  const trimmedLogs = newLogs.slice(-1000);
                  lastTimestamp = trimmedLogs[trimmedLogs.length - 1].timestamp;
                  return trimmedLogs;
                }
                return prev;
              });
            }
          } catch (error) {
            console.error('Failed to process console message:', error, event.data);
          }
        };

        eventSource.onerror = (error) => {
          if (!isComponentMounted) return;
          console.error('Console stream error:', error);
          
          // Reconnect on error after a delay
          if (eventSource) {
            eventSource.close();
            setTimeout(connectEventSource, 5000);
          }
        };
      } catch (error) {
        if (!isComponentMounted) return;
        console.error('Failed to create console stream connection:', error);
        // Try to reconnect after a delay
        setTimeout(connectEventSource, 5000);
      }
    };

    // Initial setup
    fetchInitialLogs().then(() => {
      if (isComponentMounted) {
        connectEventSource();
      }
    });

    // Cleanup
    return () => {
      isComponentMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [serverId]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Poll server status (keep this for reliability)
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/server/${serverId}/status`);
        if (!response.ok) throw new Error('Failed to fetch status');
        const data = await response.json();
        setServerStatus(data.status);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [serverId]);

  // Handle server control actions
  const handleServerAction = async (action: "start" | "stop" | "restart" | "force-stop") => {
    try {
      // Add command message to logs
      const commandMessages = {
        'start': 'Starting server...',
        'stop': 'Stopping server...',
        'restart': 'Restarting server...',
        'force-stop': 'Force stopping server...'
      };
      
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        type: 'command',
        content: commandMessages[action]
      }]);

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
        // Add success message to logs
        setLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          type: 'info',
          content: `Server ${action} command sent successfully`
        }]);

        toast({
          title: "Success",
          description: `Server ${action} command sent successfully`,
        });
      } else {
        throw new Error(data.message || 'Failed to control server');
      }
    } catch (error) {
      // Add error message to logs
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        type: 'error',
        content: `Failed to ${action} server: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);

      console.error(`Failed to ${action} server:`, error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} server`,
        variant: "destructive",
      });
    }
  };

  // Handle command submission
  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    try {
      const response = await fetch(`/api/server/${serverId}/console`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: command.trim() }),
      });

      if (!response.ok) throw new Error('Failed to send command');
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send command');
      }

      setCommand("");
    } catch (error) {
      console.error('Failed to send command:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send command',
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)]">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
            <div className="flex items-center gap-4">
              <CardTitle>Server Console</CardTitle>
              <div className="px-2 py-1 rounded-md bg-muted text-xs">
                Status: {serverStatus}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-scroll"
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                />
                <Label htmlFor="auto-scroll">Auto-scroll</Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogs([])}
              >
                <Eraser className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardHeader>

          {/* Server Controls */}
          <div className="px-6 pb-4 border-b flex-shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                onClick={() => handleServerAction("start")}
                className="w-full transition-all hover:scale-105 active:scale-95"
                disabled={serverStatus === "starting" || serverStatus === "running"}
              >
                <Play className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Start Server</span>
                <span className="sm:hidden">Start</span>
              </Button>

              <Button
                variant="secondary"
                onClick={() => handleServerAction("stop")}
                className="w-full transition-all hover:scale-105 active:scale-95"
                disabled={serverStatus === "stopping" || serverStatus === "stopped"}
              >
                <Square className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Stop Server</span>
                <span className="sm:hidden">Stop</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => handleServerAction("restart")}
                className="w-full transition-all hover:scale-105 active:scale-95"
                disabled={serverStatus !== "running"}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Restart Server</span>
                <span className="sm:hidden">Restart</span>
              </Button>

              <Button
                variant="destructive"
                onClick={() => handleServerAction("force-stop")}
                className="w-full transition-all hover:scale-105 active:scale-95"
                disabled={serverStatus === "stopped"}
              >
                <XCircle className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Force Stop</span>
                <span className="sm:hidden">Force</span>
              </Button>
            </div>
          </div>

          <CardContent className="flex-1 flex flex-col p-4 min-h-0">
            {/* Console Output */}
            <div 
              ref={scrollAreaRef}
              className="flex-1 overflow-auto rounded-md border bg-muted p-4 leading-5 font-['Consolas',_'Monaco',_'Courier_New',_monospace]"
            >
              {logs.map((log, index) => {
                // Format timestamp
                const date = new Date(log.timestamp);
                const formattedTime = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
                
                // Remove any existing timestamp from content
                const cleanContent = log.content.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
                
                return (
                  <div
                    key={index}
                    className={`whitespace-pre-wrap ${
                      log.type === "error" ? "text-red-500" :
                      log.type === "warning" ? "text-yellow-500" :
                      log.type === "command" ? "text-blue-500" :
                      "text-foreground"
                    }`}
                  >
                    <span className="text-muted-foreground">[{formattedTime}] </span>
                    {cleanContent}
                  </div>
                );
              })}
            </div>

            {/* Command Input */}
            <form onSubmit={handleCommand} className="flex gap-2 mt-4 flex-shrink-0">
              <Input
                ref={commandInputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Type a command..."
                className="font-['Consolas',_'Monaco',_'Courier_New',_monospace]"
                disabled={serverStatus !== "running"}
              />
              <Button 
                type="submit"
                disabled={serverStatus !== "running"}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
} 