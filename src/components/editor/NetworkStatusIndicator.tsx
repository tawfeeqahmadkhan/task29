"use client";

import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import type { NetworkStatus } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  status: NetworkStatus;
  isSyncing: boolean;
  pendingCount: number;
}

export default function NetworkStatusIndicator({ status, isSyncing, pendingCount }: Props) {
  const configs = {
    online: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: pendingCount > 0 ? `${pendingCount} pending` : "Saved",
      className: "text-green-600 bg-green-50 border-green-200",
    },
    offline: {
      icon: <WifiOff className="w-3.5 h-3.5" />,
      label: pendingCount > 0 ? `Offline · ${pendingCount} pending` : "Offline",
      className: "text-amber-600 bg-amber-50 border-amber-200",
    },
    syncing: {
      icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
      label: "Syncing…",
      className: "text-indigo-600 bg-indigo-50 border-indigo-200",
    },
    error: {
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      label: "Sync error",
      className: "text-red-600 bg-red-50 border-red-200",
    },
  };

  const cfg = isSyncing ? configs.syncing : configs[status];

  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all", cfg.className)}>
      {cfg.icon}
      <span className="hidden sm:inline">{cfg.label}</span>
    </div>
  );
}
