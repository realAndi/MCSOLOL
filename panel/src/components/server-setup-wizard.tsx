"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Loader2, Check, ChevronsUpDown, Plus, Trash } from "lucide-react";
import { getMinecraftVersions, getFabricGameVersions, getFabricLoaderVersions, getFabricServerUrl, FABRIC_INSTALLER_VERSIONS, type MinecraftVersion, type FabricLoaderVersion, type FabricInstallerVersion } from "@/lib/minecraft-versions";
import type { MinecraftVersion as MinecraftVersionType } from "@/lib/minecraft-versions";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { Palette } from "lucide-react";
import { CommandList } from "cmdk";

type ServerType = "vanilla" | "paper" | "modded" | "custom" | "zip";
type ModLoader = "forge" | "fabric" | "neoforge";

interface WhitelistPlayer {
  name: string;
  uuid: string;
}

interface ServerProperties {
  // Important settings (shown by default)
  difficulty: "peaceful" | "easy" | "normal" | "hard";
  gamemode: "survival" | "creative" | "adventure";
  max_players: string;
  motd: string;
  pvp: boolean;
  spawn_protection: string;
  view_distance: string;
  level_seed: string;
  
  // Advanced settings (in accordion)
  allow_flight: boolean;
  allow_nether: boolean;
  enable_command_block: boolean;
  enable_rcon: boolean;
  enforce_whitelist: boolean;
  force_gamemode: boolean;
  generate_structures: boolean;
  hardcore: boolean;
  online_mode: boolean;
  rcon_password: string;
  rcon_port: string;
  server_port: string;
  simulation_distance: string;
  whitelist_players?: WhitelistPlayer[];

  // Additional server.properties
  accepts_transfers: boolean;
  broadcast_console_to_ops: boolean;
  broadcast_rcon_to_ops: boolean;
  enable_jmx_monitoring: boolean;
  enable_query: boolean;
  enable_status: boolean;
  enforce_secure_profile: boolean;
  entity_broadcast_range_percentage: string;
  function_permission_level: string;
  generator_settings: string;
  hide_online_players: boolean;
  initial_disabled_packs: string;
  initial_enabled_packs: string;
  level_name: string;
  level_type: string;
  log_ips: boolean;
  max_chained_neighbor_updates: string;
  max_tick_time: string;
  max_world_size: string;
  network_compression_threshold: string;
  op_permission_level: string;
  pause_when_empty_seconds: string;
  player_idle_timeout: string;
  prevent_proxy_connections: boolean;
  query_port: string;
  rate_limit: string;
  require_resource_pack: boolean;
  resource_pack: string;
  resource_pack_id: string;
  resource_pack_prompt: string;
  resource_pack_sha1: string;
  server_ip: string;
  spawn_monsters: boolean;
  sync_chunk_writes: boolean;
  text_filtering_config: string;
  use_native_transport: boolean;
  operators?: WhitelistPlayer[];
}

interface ServerSetupData {
  serverType: ServerType | "";
  serverName: string;
  gameVersion: string;
  customJar: File | null;
  customZip: File | null;
  modLoader?: ModLoader;
  loaderVersion?: string;
  installerVersion?: FabricInstallerVersion;
  properties: ServerProperties;
}

// Add these color code constants at the top of the file
const MINECRAFT_COLORS = {
  '0': { code: '\u00A70', name: 'Black', color: '#000000' },
  '1': { code: '\u00A71', name: 'Dark Blue', color: '#0000AA' },
  '2': { code: '\u00A72', name: 'Dark Green', color: '#00AA00' },
  '3': { code: '\u00A73', name: 'Dark Aqua', color: '#00AAAA' },
  '4': { code: '\u00A74', name: 'Dark Red', color: '#AA0000' },
  '5': { code: '\u00A75', name: 'Dark Purple', color: '#AA00AA' },
  '6': { code: '\u00A76', name: 'Gold', color: '#FFAA00' },
  '7': { code: '\u00A77', name: 'Gray', color: '#AAAAAA' },
  '8': { code: '\u00A78', name: 'Dark Gray', color: '#555555' },
  '9': { code: '\u00A79', name: 'Indigo', color: '#5555FF' },
  'a': { code: '\u00A7a', name: 'Green', color: '#55FF55' },
  'b': { code: '\u00A7b', name: 'Aqua', color: '#55FFFF' },
  'c': { code: '\u00A7c', name: 'Red', color: '#FF5555' },
  'd': { code: '\u00A7d', name: 'Pink', color: '#FF55FF' },
  'e': { code: '\u00A7e', name: 'Yellow', color: '#FFFF55' },
  'f': { code: '\u00A7f', name: 'White', color: '#FFFFFF' },
} as const;

const MINECRAFT_FORMATTING = {
  'k': { code: '\u00A7k', name: 'Obfuscated', preview: '?' },
  'l': { code: '\u00A7l', name: 'Bold', preview: 'B' },
  'm': { code: '\u00A7m', name: 'Strikethrough', preview: 'S' },
  'n': { code: '\u00A7n', name: 'Underline', preview: 'U' },
  'o': { code: '\u00A7o', name: 'Italic', preview: 'I' },
  'r': { code: '\u00A7r', name: 'Reset', preview: 'R' },
} as const;

interface ColoredTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

function ColoredTextInput({ value, onChange, placeholder, label }: ColoredTextInputProps) {
  const [showPicker, setShowPicker] = React.useState(false);

  const insertCode = (code: string) => {
    onChange(value + code);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const previewText = React.useMemo(() => {
    let text = value;
    // Replace all color codes with spans for preview
    Object.entries(MINECRAFT_COLORS).forEach(([key, { color }]) => {
      const regex = new RegExp(`\u00A7${key}`, 'g');
      text = text.replace(regex, `</span><span style="color: ${color}">`);
    });
    
    // Handle formatting codes
    Object.entries(MINECRAFT_FORMATTING).forEach(([key, format]) => {
      const regex = new RegExp(`\u00A7${key}`, 'g');
      const style = key === 'k' ? 'blur(4px)' :
                    key === 'l' ? 'font-weight: bold' :
                    key === 'm' ? 'text-decoration: line-through' :
                    key === 'n' ? 'text-decoration: underline' :
                    key === 'o' ? 'font-style: italic' :
                    'none';
      text = text.replace(regex, `</span><span style="${style}">`);
    });

    return `<span>${text}</span>`;
  }, [value]);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={handleTextChange}
            placeholder={placeholder}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPicker(!showPicker)}
          >
            <Palette className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Preview */}
        <div 
          className="mt-2 p-2 border rounded bg-muted min-h-[2rem]"
          dangerouslySetInnerHTML={{ __html: previewText }}
        />

        {showPicker && (
          <Card className="absolute right-0 top-full mt-2 z-50 w-[300px]">
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Colors */}
                <div>
                  <Label>Colors</Label>
                  <div className="grid grid-cols-8 gap-1 mt-2">
                    {Object.entries(MINECRAFT_COLORS).map(([key, { color, name }]) => (
                      <TooltipProvider key={key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-8 h-8 p-0"
                              style={{ backgroundColor: color }}
                              onClick={() => insertCode(`\u00A7${key}`)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>{name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>

                {/* Formatting */}
                <div>
                  <Label>Formatting</Label>
                  <div className="grid grid-cols-6 gap-1 mt-2">
                    {Object.entries(MINECRAFT_FORMATTING).map(([key, { name, preview }]) => (
                      <TooltipProvider key={key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-8 h-8 p-0"
                              onClick={() => insertCode(`\u00A7${key}`)}
                            >
                              {preview}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Add this helper function after the color constants
const formatServerName = (name: string) => {
  // Replace spaces with dashes and remove any invalid characters
  return name.toLowerCase()
    .replace(/\s+/g, '-')        // Replace spaces with dashes
    .replace(/[^a-z0-9-]/g, '')  // Remove any characters that aren't letters, numbers, or dashes
    .replace(/-+/g, '-')         // Replace multiple dashes with a single dash
    .replace(/^-+|-+$/g, '');    // Remove dashes from start and end
};

export function ServerSetupWizard() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);
  const [versions, setVersions] = React.useState<MinecraftVersionType[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = React.useState(false);
  const [isLoadingUUID, setIsLoadingUUID] = React.useState(false);
  const [whitelistPlayerName, setWhitelistPlayerName] = React.useState("");
  const [opPlayerName, setOpPlayerName] = React.useState("");
  const [loaderVersions, setLoaderVersions] = React.useState<FabricLoaderVersion[]>([]);
  const [setupData, setSetupData] = React.useState<ServerSetupData>({
    serverType: "",
    serverName: "",
    gameVersion: "",
    customJar: null,
    customZip: null,
    properties: {
      difficulty: "normal",
      gamemode: "survival",
      max_players: "20",
      motd: "",
      pvp: true,
      spawn_protection: "16",
      view_distance: "10",
      level_seed: "",
      
      allow_flight: false,
      allow_nether: true,
      enable_command_block: false,
      enable_rcon: true,
      enforce_whitelist: false,
      force_gamemode: false,
      generate_structures: true,
      hardcore: false,
      online_mode: true,
      rcon_password: crypto.randomUUID(),
      rcon_port: "25575",
      server_port: "25565",
      simulation_distance: "10",
      whitelist_players: [],

      // Initialize additional properties with default values
      accepts_transfers: false,
      broadcast_console_to_ops: true,
      broadcast_rcon_to_ops: true,
      enable_jmx_monitoring: false,
      enable_query: false,
      enable_status: true,
      enforce_secure_profile: true,
      entity_broadcast_range_percentage: "100",
      function_permission_level: "2",
      generator_settings: "{}",
      hide_online_players: false,
      initial_disabled_packs: "",
      initial_enabled_packs: "vanilla",
      level_name: "world",
      level_type: "minecraft:normal",
      log_ips: true,
      max_chained_neighbor_updates: "1000000",
      max_tick_time: "60000",
      max_world_size: "29999984",
      network_compression_threshold: "256",
      op_permission_level: "4",
      pause_when_empty_seconds: "60",
      player_idle_timeout: "0",
      prevent_proxy_connections: false,
      query_port: "25565",
      rate_limit: "0",
      require_resource_pack: false,
      resource_pack: "",
      resource_pack_id: "",
      resource_pack_prompt: "",
      resource_pack_sha1: "",
      server_ip: "",
      spawn_monsters: true,
      sync_chunk_writes: true,
      text_filtering_config: "",
      use_native_transport: true,
      operators: [],
    },
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const zipInputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  // Add visual server name state
  const [visualServerName, setVisualServerName] = React.useState("");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (setupData.serverType === "vanilla") {
      setIsLoadingVersions(true);
      getMinecraftVersions()
        .then((fetchedVersions) => {
          setVersions(fetchedVersions);
          // If no version is selected, select the latest version
          if (!setupData.gameVersion && fetchedVersions.length > 0) {
            const latestVersion = fetchedVersions.find(v => v.isLatest);
            if (latestVersion) {
              setSetupData(prev => ({ ...prev, gameVersion: latestVersion.id }));
            }
          }
        })
        .finally(() => {
          setIsLoadingVersions(false);
        });
    } else if (setupData.serverType === "modded" && setupData.modLoader === "fabric") {
      setIsLoadingVersions(true);
      getFabricGameVersions()
        .then((gameVersions) => {
          // Filter to only stable versions
          const stableGameVersions = gameVersions.filter(v => v.type === 'release');
          
          // Set the latest version as default
          if (stableGameVersions.length > 0) {
            const latestGameVersion = stableGameVersions[0];
            setSetupData(prev => ({
              ...prev,
              gameVersion: latestGameVersion.id,
              installerVersion: "1.0.1" // Set latest installer version as default
            }));
          }
          
          setVersions(stableGameVersions);
        })
        .finally(() => {
          setIsLoadingVersions(false);
        });
    }
  }, [setupData.serverType, setupData.modLoader]);

  // Add new useEffect for fetching loader versions when game version changes
  React.useEffect(() => {
    if (setupData.serverType === "modded" && 
        setupData.modLoader === "fabric" && 
        setupData.gameVersion) {
      setIsLoadingVersions(true);
      getFabricLoaderVersions(setupData.gameVersion)
        .then((versions) => {
          setLoaderVersions(versions);
          
          // Set the latest version as default
          if (versions.length > 0) {
            setSetupData(prev => ({
              ...prev,
              loaderVersion: versions[0]  // Just use the version string directly
            }));
          }
        })
        .finally(() => {
          setIsLoadingVersions(false);
        });
    }
  }, [setupData.gameVersion, setupData.serverType, setupData.modLoader]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (setupData.serverType === "custom" && file.name.endsWith('.jar')) {
        setSetupData((prev) => ({ ...prev, customJar: file }));
      } else if (setupData.serverType === "zip" && file.name.endsWith('.zip')) {
        setSetupData((prev) => ({ ...prev, customZip: file }));
      }
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      if (setupData.serverType === "custom" && file.name.endsWith('.jar')) {
        setSetupData((prev) => ({ ...prev, customJar: file }));
      } else if (setupData.serverType === "zip" && file.name.endsWith('.zip')) {
        setSetupData((prev) => ({ ...prev, customZip: file }));
      }
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  // Function to fetch UUID for a Minecraft username
  const fetchPlayerUUID = async (username: string) => {
    try {
      setIsLoadingUUID(true);
      const response = await fetch(`/api/mojang/profile?username=${encodeURIComponent(username)}`);
      if (!response.ok) throw new Error('Player not found');
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Failed to fetch player UUID:', error);
      throw error;
    } finally {
      setIsLoadingUUID(false);
    }
  };

  // Function to add a player to the whitelist
  const handleAddWhitelistPlayer = async () => {
    if (!whitelistPlayerName) return;
    
    try {
      setIsLoadingUUID(true);
      const response = await fetch(`/api/mojang/profile?username=${encodeURIComponent(whitelistPlayerName)}`);
      
      if (!response.ok) {
        const playerName = whitelistPlayerName;
        toast({
          title: "Player Not Found",
          description: `No player was found with the name "${playerName}".`,
          action: (
            <ToastAction altText="Add anyway" onClick={() => addPlayerToWhitelist(playerName)}>
              Add anyway
            </ToastAction>
          ),
        });
        return;
      }
      
      const data = await response.json();
      addPlayerToWhitelist(whitelistPlayerName, data.id);
      
    } catch (error) {
      const playerName = whitelistPlayerName;
      toast({
        title: "Error",
        description: "Failed to fetch player UUID. Would you like to add this player without a UUID?",
        action: (
          <ToastAction altText="Add anyway" onClick={() => addPlayerToWhitelist(playerName)}>
            Add anyway
          </ToastAction>
        ),
      });
    } finally {
      setIsLoadingUUID(false);
      setWhitelistPlayerName("");
    }
  };

  const addPlayerToWhitelist = (name: string, uuid: string = "") => {
    // Check if player is already in whitelist
    if (setupData.properties.whitelist_players?.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      toast({
        title: "Player Already Added",
        description: `${name} is already in the whitelist.`,
        variant: "destructive",
      });
      return;
    }

    setSetupData(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        whitelist_players: [
          ...(prev.properties.whitelist_players || []),
          { name, uuid }
        ]
      }
    }));

    toast({
      title: "Player Added",
      description: uuid 
        ? `Added ${name} to whitelist with UUID: ${uuid}` 
        : `Added ${name} to whitelist without UUID`,
    });
  };

  // Function to remove a player from the whitelist
  const handleRemoveWhitelistPlayer = (name: string) => {
    setSetupData(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        whitelist_players: prev.properties.whitelist_players?.filter(p => p.name !== name)
      }
    }));
  };

  // Function to add a player to operators
  const handleAddOperator = async () => {
    if (!opPlayerName) return;
    
    try {
      setIsLoadingUUID(true);
      const response = await fetch(`/api/mojang/profile?username=${encodeURIComponent(opPlayerName)}`);
      
      if (!response.ok) {
        const playerName = opPlayerName;
        toast({
          title: "Player Not Found",
          description: `No player was found with the name "${playerName}".`,
          action: (
            <ToastAction altText="Add anyway" onClick={() => addPlayerToOperators(playerName)}>
              Add anyway
            </ToastAction>
          ),
        });
        return;
      }
      
      const data = await response.json();
      addPlayerToOperators(opPlayerName, data.id);
      
    } catch (error) {
      const playerName = opPlayerName;
      toast({
        title: "Error",
        description: "Failed to fetch player UUID. Would you like to add this player without a UUID?",
        action: (
          <ToastAction altText="Add anyway" onClick={() => addPlayerToOperators(playerName)}>
            Add anyway
          </ToastAction>
        ),
      });
    } finally {
      setIsLoadingUUID(false);
      setOpPlayerName("");
    }
  };

  const addPlayerToOperators = (name: string, uuid: string = "") => {
    // Check if player is already an operator
    if (setupData.properties.operators?.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      toast({
        title: "Player Already Added",
        description: `${name} is already an operator.`,
        variant: "destructive",
      });
      return;
    }

    setSetupData(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        operators: [
          ...(prev.properties.operators || []),
          { name, uuid }
        ]
      }
    }));

    toast({
      title: "Operator Added",
      description: uuid 
        ? `Added ${name} as operator with UUID: ${uuid}` 
        : `Added ${name} as operator without UUID`,
    });
  };

  // Function to remove a player from operators
  const handleRemoveOperator = (name: string) => {
    setSetupData(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        operators: prev.properties.operators?.filter(p => p.name !== name)
      }
    }));
  };

  const steps = [
    {
      title: "Server Type",
      component: (
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Label>Select Server Type</Label>
            <Select
              value={setupData.serverType}
              onValueChange={(value: ServerType) => {
                setSetupData((prev) => ({
                  ...prev,
                  serverType: value,
                  gameVersion: "", // Reset version when server type changes
                  customJar: null,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select server type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vanilla">Vanilla</SelectItem>
                <SelectItem value="paper" disabled>
                  <div className="flex items-center gap-2">
                    <span>Paper</span>
                    <span className="text-xs text-muted-foreground">(Coming Soon)</span>
                  </div>
                </SelectItem>
                <SelectItem value="modded" disabled>
                  <div className="flex items-center gap-2">
                    <span>Modded</span>
                    <span className="text-xs text-muted-foreground">(Coming Soon)</span>
                  </div>
                </SelectItem>
                <SelectItem value="custom">Custom JAR</SelectItem>
                <SelectItem value="zip">ZIP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {setupData.serverType === "vanilla" && (
            <div className="flex flex-col space-y-2">
              <Label>Select Minecraft Version</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[280px] justify-between"
                    disabled={isLoadingVersions}
                  >
                    {isLoadingVersions ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading versions...
                      </div>
                    ) : setupData.gameVersion ? (
                      <span>
                        {setupData.gameVersion}
                        {versions.find(v => v.id === setupData.gameVersion)?.isLatest && 
                          <span className="ml-2 text-muted-foreground">(latest)</span>
                        }
                      </span>
                    ) : (
                      "Select version..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0">
                  <Command>
                    <CommandInput placeholder="Search version..." />
                    <CommandEmpty>No version found.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {versions.map((version) => (
                        <CommandItem
                          key={version.id}
                          value={version.id}
                          onSelect={(currentValue) => {
                            if (version.hasDownload) {
                              setSetupData(prev => ({ ...prev, gameVersion: currentValue }));
                              setOpen(false);
                            }
                          }}
                          className={cn(
                            "cursor-pointer",
                            !version.hasDownload && "cursor-not-allowed opacity-50"
                          )}
                          disabled={!version.hasDownload}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              setupData.gameVersion === version.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex items-center">
                            {version.id}
                            {version.isLatest && (
                              <span className="ml-2 text-xs text-muted-foreground">(latest)</span>
                            )}
                            {!version.hasDownload && (
                              <span className="ml-2 text-xs text-muted-foreground">(unavailable)</span>
                            )}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {setupData.serverType === "modded" && (
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Label>Select Mod Loader</Label>
                <Select
                  value={setupData.modLoader}
                  onValueChange={(value: ModLoader) => {
                    setSetupData((prev) => ({
                      ...prev,
                      modLoader: value,
                      gameVersion: "", // Reset version when mod loader changes
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mod loader" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forge">
                      <div className="flex items-center gap-2">
                        <span>Forge</span>
                        <span className="text-xs text-muted-foreground">(Most popular, best mod support)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="fabric">
                      <div className="flex items-center gap-2">
                        <span>Fabric</span>
                        <span className="text-xs text-muted-foreground">(Lightweight, modern)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="neoforge">
                      <div className="flex items-center gap-2">
                        <span>NeoForge</span>
                        <span className="text-xs text-muted-foreground">(New fork of Forge)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {setupData.modLoader === "fabric" && (
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label>Select Minecraft Version</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-[280px] justify-between"
                          disabled={isLoadingVersions}
                        >
                          {isLoadingVersions ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading versions...
                            </div>
                          ) : setupData.gameVersion ? (
                            setupData.gameVersion
                          ) : (
                            "Select version..."
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0">
                        <Command>
                          <CommandInput placeholder="Search version..." />
                          <CommandEmpty>No version found.</CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-auto">
                            {versions.map((version) => (
                              <CommandItem
                                key={version.id}
                                value={version.id}
                                onSelect={(currentValue) => {
                                  setSetupData(prev => ({ ...prev, gameVersion: currentValue }));
                                  setOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    setupData.gameVersion === version.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {version.id}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {setupData.gameVersion && (
                    <div className="flex flex-col space-y-2">
                      <Label>Select Fabric Loader Version</Label>
                      <Select
                        value={setupData.loaderVersion}
                        onValueChange={(value) => {
                          setSetupData(prev => ({ ...prev, loaderVersion: value }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select loader version" />
                        </SelectTrigger>
                        <SelectContent>
                          {loaderVersions.map((version) => (
                            <SelectItem key={version} value={version}>
                              {version}
                              {version === "0.16.10" && (
                                <span className="ml-2 text-xs text-muted-foreground">(latest)</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {setupData.loaderVersion && (
                    <div className="flex flex-col space-y-2">
                      <Label>Select Installer Version</Label>
                      <Select
                        value={setupData.installerVersion}
                        onValueChange={(value: FabricInstallerVersion) => {
                          setSetupData(prev => ({ ...prev, installerVersion: value }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select installer version" />
                        </SelectTrigger>
                        <SelectContent>
                          {FABRIC_INSTALLER_VERSIONS.map((version) => (
                            <SelectItem key={version} value={version}>
                              {version}
                              {version === "1.0.1" && (
                                <span className="ml-2 text-xs text-muted-foreground">(latest)</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {setupData.serverType === "custom" && (
            <div className="space-y-2">
              <Label>Upload Custom JAR</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".jar"
                className="hidden"
              />
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <Upload className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm text-gray-500">
                  {setupData.customJar
                    ? `Selected: ${setupData.customJar.name}`
                    : "Click to upload or drag and drop a JAR file"}
                </p>
              </div>
            </div>
          )}

          {setupData.serverType === "zip" && (
            <div className="space-y-2">
              <Label>Upload ZIP</Label>
              <input
                type="file"
                ref={zipInputRef}
                onChange={handleFileChange}
                accept=".zip"
                className="hidden"
              />
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => zipInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <Upload className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm text-gray-500">
                  {setupData.customZip
                    ? `Selected: ${setupData.customZip.name}`
                    : "Click to upload or drag and drop a ZIP file"}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Upload a ZIP file containing your server files. The ZIP will be extracted to your server directory.
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Server Details",
      component: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Server Name</Label>
            <Input
              value={visualServerName}
              onChange={(e) => {
                const newName = e.target.value;
                setVisualServerName(newName);
                // Update the actual server name with the formatted version
                setSetupData(prev => ({
                  ...prev,
                  serverName: formatServerName(newName)
                }));
              }}
              placeholder="My Minecraft Server"
            />
            <p className="text-sm text-muted-foreground">
              Server ID: {setupData.serverName || "my-minecraft-server"}
            </p>
            <p className="text-sm text-muted-foreground">
              This will be used for the folder name and URL. Spaces will be converted to dashes.
            </p>
          </div>
          <div className="space-y-2">
            <ColoredTextInput
              label="Message of the Day (MOTD)"
              value={setupData.properties.motd}
              onChange={(value) =>
                setSetupData(prev => ({
                  ...prev,
                  properties: { ...prev.properties, motd: value }
                }))
              }
              placeholder="Welcome to my server!"
            />
            <p className="text-sm text-muted-foreground">
              Click the palette icon to add colors and formatting to your MOTD.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Game Settings",
      component: (
        <div className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={setupData.properties.difficulty}
                onValueChange={(value) =>
                  setSetupData(prev => ({
                    ...prev,
                    properties: { ...prev.properties, difficulty: value as any }
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peaceful">Peaceful</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Hardcore Mode</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-muted-foreground">
                        <p className="text-sm">Players are permanently banned upon death</p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Players are permanently banned upon death</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch
                checked={setupData.properties.hardcore}
                onCheckedChange={(checked) =>
                  setSetupData(prev => ({
                    ...prev,
                    properties: { ...prev.properties, hardcore: checked }
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>World Seed</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={setupData.properties.level_seed}
                  onChange={(e) =>
                    setSetupData(prev => ({
                      ...prev,
                      properties: { ...prev.properties, level_seed: e.target.value }
                    }))
                  }
                  placeholder="Leave empty for random"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-muted-foreground">
                        <p className="text-sm">?</p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enter a seed to generate a specific world</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Game Mode</Label>
              <Select
                value={setupData.properties.gamemode}
                onValueChange={(value) =>
                  setSetupData(prev => ({
                    ...prev,
                    properties: { ...prev.properties, gamemode: value as any }
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="survival">Survival</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="adventure">Adventure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Players</Label>
              <Input
                type="number"
                value={setupData.properties.max_players}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    properties: { ...prev.properties, max_players: e.target.value }
                  }))
                }
                min="1"
                max="100"
              />
            </div>

            <div className="space-y-2">
              <Label>Message of the Day (MOTD)</Label>
              <Input
                value={setupData.properties.motd}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    properties: { ...prev.properties, motd: e.target.value }
                  }))
                }
                placeholder="A Minecraft Server"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>PvP</Label>
              <Switch
                checked={setupData.properties.pvp}
                onCheckedChange={(checked) =>
                  setSetupData(prev => ({
                    ...prev,
                    properties: { ...prev.properties, pvp: checked }
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Spawn Protection (blocks)</Label>
              <Input
                type="number"
                value={setupData.properties.spawn_protection}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    properties: { ...prev.properties, spawn_protection: e.target.value }
                  }))
                }
                min="0"
                max="100"
              />
            </div>

            <div className="space-y-2">
              <Label>View Distance (chunks)</Label>
              <Input
                type="number"
                value={setupData.properties.view_distance}
                onChange={(e) =>
                  setSetupData(prev => ({
                    ...prev,
                    properties: { ...prev.properties, view_distance: e.target.value }
                  }))
                }
                min="3"
                max="32"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <Label>Enable Whitelist</Label>
                <Switch
                  checked={setupData.properties.enforce_whitelist}
                  onCheckedChange={(checked) =>
                    setSetupData(prev => ({
                      ...prev,
                      properties: { ...prev.properties, enforce_whitelist: checked }
                    }))
                  }
                />
              </div>

              {setupData.properties.enforce_whitelist && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                  <div className="flex flex-col sm:flex-row gap-2 items-start">
                    <Input
                      value={whitelistPlayerName}
                      onChange={(e) => setWhitelistPlayerName(e.target.value)}
                      placeholder="Enter player name"
                      disabled={isLoadingUUID}
                    />
                    <Input
                      value=""
                      placeholder="UUID will appear here"
                      disabled
                      className="text-muted-foreground font-mono text-sm"
                    />
                    <Button 
                      onClick={handleAddWhitelistPlayer}
                      disabled={isLoadingUUID || !whitelistPlayerName}
                      variant="outline"
                      className="px-3 w-full md:w-auto"
                    >
                      {isLoadingUUID ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {setupData.properties.whitelist_players?.map((player) => (
                  <div key={player.uuid} className="flex flex-col sm:flex-row gap-2 items-start">
                    <Input
                      value={player.name}
                      placeholder="Player Name"
                      disabled
                    />
                    <Input
                      value={player.uuid}
                      placeholder="UUID will appear here"
                      disabled
                      className="text-muted-foreground font-mono text-sm"
                    />
                    <Button 
                      onClick={() => handleRemoveWhitelistPlayer(player.name)}
                      disabled={isLoadingUUID}
                      variant="outline"
                      className="px-3 w-full md:w-auto"
                    >
                      {isLoadingUUID ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="advanced">
              <AccordionTrigger>Advanced Settings</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Allow Flight</Label>
                    <Switch
                      checked={setupData.properties.allow_flight}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, allow_flight: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Allow Nether</Label>
                    <Switch
                      checked={setupData.properties.allow_nether}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, allow_nether: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Enable Command Blocks</Label>
                    <Switch
                      checked={setupData.properties.enable_command_block}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, enable_command_block: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Force Gamemode</Label>
                    <Switch
                      checked={setupData.properties.force_gamemode}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, force_gamemode: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Generate Structures</Label>
                    <Switch
                      checked={setupData.properties.generate_structures}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, generate_structures: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Online Mode</Label>
                    <Switch
                      checked={setupData.properties.online_mode}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, online_mode: checked }
                        }))
                      }
                    />
                  </div>

                  {/* Network Settings */}
                  <div className="pt-4 pb-2">
                    <h3 className="font-medium">Network Settings</h3>
                  </div>

                  <div className="space-y-2">
                    <Label>Server IP</Label>
                    <Input
                      value={setupData.properties.server_ip}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, server_ip: e.target.value }
                        }))
                      }
                      placeholder="Leave empty for all interfaces"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Server Port</Label>
                    <Input
                      type="number"
                      value={setupData.properties.server_port}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, server_port: e.target.value }
                        }))
                      }
                      min="1"
                      max="65535"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Query Port</Label>
                    <Input
                      type="number"
                      value={setupData.properties.query_port}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, query_port: e.target.value }
                        }))
                      }
                      min="1"
                      max="65535"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Network Compression Threshold</Label>
                    <Input
                      type="number"
                      value={setupData.properties.network_compression_threshold}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, network_compression_threshold: e.target.value }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Prevent Proxy Connections</Label>
                    <Switch
                      checked={setupData.properties.prevent_proxy_connections}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, prevent_proxy_connections: checked }
                        }))
                      }
                    />
                  </div>

                  {/* RCON Settings */}
                  <div className="pt-4 pb-2">
                    <h3 className="font-medium">RCON Settings</h3>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Enable RCON</Label>
                    <Switch
                      checked={setupData.properties.enable_rcon}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, enable_rcon: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>RCON Port</Label>
                    <Input
                      type="number"
                      value={setupData.properties.rcon_port}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, rcon_port: e.target.value }
                        }))
                      }
                      min="1"
                      max="65535"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>RCON Password</Label>
                    <Input
                      type="password"
                      value={setupData.properties.rcon_password}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, rcon_password: e.target.value }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Broadcast RCON to Ops</Label>
                    <Switch
                      checked={setupData.properties.broadcast_rcon_to_ops}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, broadcast_rcon_to_ops: checked }
                        }))
                      }
                    />
                  </div>

                  {/* World Settings */}
                  <div className="pt-4 pb-2">
                    <h3 className="font-medium">World Settings</h3>
                  </div>

                  <div className="space-y-2">
                    <Label>Level Name</Label>
                    <Input
                      value={setupData.properties.level_name}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, level_name: e.target.value }
                        }))
                      }
                      placeholder="world"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Level Type</Label>
                    <Input
                      value={setupData.properties.level_type}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, level_type: e.target.value }
                        }))
                      }
                      placeholder="minecraft:normal"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Generator Settings</Label>
                    <Input
                      value={setupData.properties.generator_settings}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, generator_settings: e.target.value }
                        }))
                      }
                      placeholder="{}"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max World Size</Label>
                    <Input
                      type="number"
                      value={setupData.properties.max_world_size}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, max_world_size: e.target.value }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Spawn Monsters</Label>
                    <Switch
                      checked={setupData.properties.spawn_monsters}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, spawn_monsters: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Sync Chunk Writes</Label>
                    <Switch
                      checked={setupData.properties.sync_chunk_writes}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, sync_chunk_writes: checked }
                        }))
                      }
                    />
                  </div>

                  {/* Performance Settings */}
                  <div className="pt-4 pb-2">
                    <h3 className="font-medium">Performance Settings</h3>
                  </div>

                  <div className="space-y-2">
                    <Label>Simulation Distance (chunks)</Label>
                    <Input
                      type="number"
                      value={setupData.properties.simulation_distance}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, simulation_distance: e.target.value }
                        }))
                      }
                      min="3"
                      max="32"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Tick Time (ms)</Label>
                    <Input
                      type="number"
                      value={setupData.properties.max_tick_time}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, max_tick_time: e.target.value }
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Entity Broadcast Range (%)</Label>
                    <Input
                      type="number"
                      value={setupData.properties.entity_broadcast_range_percentage}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, entity_broadcast_range_percentage: e.target.value }
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Chained Neighbor Updates</Label>
                    <Input
                      type="number"
                      value={setupData.properties.max_chained_neighbor_updates}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, max_chained_neighbor_updates: e.target.value }
                        }))
                      }
                    />
                  </div>

                  {/* Player Settings */}
                  <div className="pt-4 pb-2">
                    <h3 className="font-medium">Player Settings</h3>
                  </div>

                  <div className="space-y-2">
                    <Label>Player Idle Timeout (minutes)</Label>
                    <Input
                      type="number"
                      value={setupData.properties.player_idle_timeout}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, player_idle_timeout: e.target.value }
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rate Limit</Label>
                    <Input
                      type="number"
                      value={setupData.properties.rate_limit}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, rate_limit: e.target.value }
                        }))
                      }
                    />
                  </div>

                  {/* Resource Pack Settings */}
                  <div className="pt-4 pb-2">
                    <h3 className="font-medium">Resource Pack Settings</h3>
                  </div>

                  <div className="space-y-2">
                    <Label>Resource Pack URL</Label>
                    <Input
                      value={setupData.properties.resource_pack}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, resource_pack: e.target.value }
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Resource Pack SHA-1</Label>
                    <Input
                      value={setupData.properties.resource_pack_sha1}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, resource_pack_sha1: e.target.value }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Require Resource Pack</Label>
                    <Switch
                      checked={setupData.properties.require_resource_pack}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, require_resource_pack: checked }
                        }))
                      }
                    />
                  </div>

                  {/* Miscellaneous Settings */}
                  <div className="pt-4 pb-2">
                    <h3 className="font-medium">Miscellaneous Settings</h3>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Enable JMX Monitoring</Label>
                    <Switch
                      checked={setupData.properties.enable_jmx_monitoring}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, enable_jmx_monitoring: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Enable Query</Label>
                    <Switch
                      checked={setupData.properties.enable_query}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, enable_query: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Enable Status</Label>
                    <Switch
                      checked={setupData.properties.enable_status}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, enable_status: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Hide Online Players</Label>
                    <Switch
                      checked={setupData.properties.hide_online_players}
                      onCheckedChange={(checked) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, hide_online_players: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Function Permission Level</Label>
                    <Input
                      type="number"
                      value={setupData.properties.function_permission_level}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, function_permission_level: e.target.value }
                        }))
                      }
                      min="1"
                      max="4"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Op Permission Level</Label>
                    <Input
                      type="number"
                      value={setupData.properties.op_permission_level}
                      onChange={(e) =>
                        setSetupData(prev => ({
                          ...prev,
                          properties: { ...prev.properties, op_permission_level: e.target.value }
                        }))
                      }
                      min="1"
                      max="4"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Label>Server Operators</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Players with administrative privileges
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                      <div className="flex flex-col sm:flex-row gap-2 items-start">
                        <Input
                          value={opPlayerName}
                          onChange={(e) => setOpPlayerName(e.target.value)}
                          placeholder="Enter player name"
                          disabled={isLoadingUUID}
                        />
                        <Input
                          value=""
                          placeholder="UUID will appear here"
                          disabled
                          className="text-muted-foreground font-mono text-sm"
                        />
                        <Button 
                          onClick={handleAddOperator}
                          disabled={isLoadingUUID || !opPlayerName}
                          variant="outline"
                          className="px-3 w-full md:w-auto"
                        >
                          {isLoadingUUID ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      
                      {setupData.properties.operators?.map((player) => (
                        <div key={player.uuid} className="flex flex-col sm:flex-row gap-2 items-start">
                          <Input
                            value={player.name}
                            placeholder="Player Name"
                            disabled
                          />
                          <Input
                            value={player.uuid}
                            placeholder="UUID will appear here"
                            disabled
                            className="text-muted-foreground font-mono text-sm"
                          />
                          <Button 
                            onClick={() => handleRemoveOperator(player.name)}
                            disabled={isLoadingUUID}
                            variant="outline"
                            className="px-3 w-full md:w-auto"
                          >
                            {isLoadingUUID ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ),
    },
  ];

  const handleSubmit = async () => {
    try {
      setIsDownloading(true);
      
      // Ensure server name is properly formatted
      const formattedName = formatServerName(setupData.serverName);
      if (!formattedName) {
        throw new Error("Invalid server name");
      }

      // Format operators data for ops.json
      const formattedOps = setupData.properties.operators?.map(op => ({
        uuid: op.uuid || undefined,
        name: op.name,
        level: parseInt(setupData.properties.op_permission_level),
        bypassesPlayerLimit: false
      }));

      // Format whitelist data for whitelist.json
      const formattedWhitelist = setupData.properties.whitelist_players?.map(player => ({
        uuid: player.uuid || undefined,
        name: player.name
      }));

      let downloadResponse;

      if (setupData.serverType === "vanilla") {
        // Find the selected version
        const selectedVersion = versions.find(v => v.id === setupData.gameVersion);
        const serverDownloadUrl = selectedVersion?.serverDownloadUrl;
        
        if (!serverDownloadUrl) {
          throw new Error("No server download URL available");
        }

        // Download vanilla server jar
        downloadResponse = await fetch('/api/server/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: serverDownloadUrl,
            version: setupData.gameVersion,
            name: formattedName,
          }),
        });
      } else if (setupData.serverType === "modded" && setupData.modLoader === "fabric") {
        // Construct Fabric server download URL
        const serverDownloadUrl = getFabricServerUrl(
          setupData.gameVersion,
          setupData.loaderVersion || "",
          setupData.installerVersion || "1.0.1"
        );

        // Download Fabric server jar
        downloadResponse = await fetch('/api/server/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: serverDownloadUrl,
            version: setupData.gameVersion,
            name: formattedName,
            modLoader: setupData.modLoader,
            loaderVersion: setupData.loaderVersion
          }),
        });
      } else if (setupData.serverType === "custom" || setupData.serverType === "zip") {
        // Upload custom JAR or ZIP file
        const formData = new FormData();
        formData.append('name', formattedName);
        
        if (setupData.serverType === "custom" && setupData.customJar) {
          formData.append('file', setupData.customJar);
          formData.append('type', 'jar');
        } else if (setupData.serverType === "zip" && setupData.customZip) {
          formData.append('file', setupData.customZip);
          formData.append('type', 'zip');
        } else {
          throw new Error("No file selected");
        }

        downloadResponse = await fetch('/api/server/upload', {
          method: 'POST',
          body: formData,
        });
      }

      if (!downloadResponse?.ok) {
        const error = await downloadResponse?.json();
        throw new Error(error.error || 'Failed to process server files');
      }

      const downloadResult = await downloadResponse.json();

      // Create the server instance
      const createResponse = await fetch('/api/server/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formattedName,
          version: setupData.gameVersion || 'custom',
          settings: {
            ...setupData.properties,
            // Remove the original operators and whitelist_players arrays
            operators: undefined,
            whitelist_players: undefined,
            // Add version to properties
            version: setupData.gameVersion || 'custom',
            // Add formatted whitelist and ops data
            whitelist: formattedWhitelist,
            ops: formattedOps
          }
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create server instance');
      }

      const createResult = await createResponse.json();
      
      toast({
        title: "Success",
        description: "Server created successfully",
      });

      // Redirect to the new server's dashboard
      router.push(`/dashboard/${createResult.serverId}`);
      
    } catch (error) {
      console.error("Failed to create server:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create server",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 0) {
      if (setupData.serverType === "vanilla") {
        return !!setupData.gameVersion;
      }
      if (setupData.serverType === "modded") {
        if (setupData.modLoader === "fabric") {
          return !!setupData.gameVersion && 
                 !!setupData.loaderVersion && 
                 !!setupData.installerVersion;
        }
        return !!setupData.modLoader && !!setupData.gameVersion;
      }
      if (setupData.serverType === "custom") {
        return !!setupData.customJar;
      }
      if (setupData.serverType === "zip") {
        return !!setupData.customZip;
      }
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div className="max-w-2xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Card>
            <CardContent className="pt-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-xl font-semibold mb-4">
                    {steps[currentStep].title}
                  </h2>
                  {steps[currentStep].component}
                </motion.div>
              </AnimatePresence>

              <div className="flex justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                >
                  Back
                </Button>
                <Button
                  onClick={currentStep === steps.length - 1 ? handleSubmit : handleNext}
                  disabled={!canProceed() || isDownloading}
                >
                  {currentStep === steps.length - 1 ? (
                    isDownloading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Downloading...
                      </div>
                    ) : (
                      "Create Server"
                    )
                  ) : (
                    "Next"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
} 