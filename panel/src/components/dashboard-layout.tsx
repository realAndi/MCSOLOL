"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { 
  Moon, 
  Sun,
  Settings,
  Terminal,
  MessageSquare,
  FolderOpen,
  Package,
  Menu,
  LayoutDashboard,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "next-themes";
import { useParams, usePathname } from "next/navigation";

const SidebarContents = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const params = useParams();
  const serverId = params.serverId as string;
  const pathname = usePathname();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <SidebarHeader className="border-b px-6 py-4">
        {serverId ? (
          <>
            <h2 className="font-semibold">{serverId}</h2>
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </>
        ) : (
          <h2 className="font-semibold">Dashboard</h2>
        )}
      </SidebarHeader>
      <div className="flex-1">
        {/* Navigation Group */}
        {serverId ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href={`/dashboard/${serverId}`} className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md">
                    <Settings className="h-4 w-4" />
                    <span>Main Settings</span>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/dashboard/${serverId}/console`} className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md">
                    <Terminal className="h-4 w-4" />
                    <span>Console</span>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/dashboard/${serverId}/chat`} className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md">
                    <MessageSquare className="h-4 w-4" />
                    <span>Player Chat</span>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/dashboard/${serverId}/files`} className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md">
                    <FolderOpen className="h-4 w-4" />
                    <span>File Browser</span>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/dashboard/${serverId}/plugins`} className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md">
                    <Package className="h-4 w-4" />
                    <span>Plugin Installer</span>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link 
                    href={`/dashboard/${serverId}/danger`} 
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md text-destructive"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Dangerous Settings</span>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        ) : null}
      </div>
      <SidebarFooter className="border-t px-3 py-4">
        {mounted && (
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md"
            suppressHydrationWarning
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span suppressHydrationWarning>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
        )}
      </SidebarFooter>
    </div>
  );
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldHideSidebar = pathname === "/dashboard" || pathname === "/dashboard/create";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Mobile Trigger */}
        {!shouldHideSidebar && (
          <div className="md:hidden fixed top-4 left-4 z-50">
            <SidebarTrigger>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SidebarTrigger>
          </div>
        )}

        {/* Unified Sidebar - Fixed on desktop, overlay on mobile */}
        {!shouldHideSidebar && (
          <Sidebar 
            className="fixed inset-y-0 left-0 z-40 w-64 border-r bg-background md:z-0 md:translate-x-0" 
            side="left"
          >
            <SidebarContents />
          </Sidebar>
        )}

        {/* Main Content - Padded on desktop to account for sidebar */}
        <main className={`flex-1 ${!shouldHideSidebar ? "" : ""}`}>
          <div className="max-w-[1200px] mx-auto p-4 md:p-6 h-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
} 