"use client";
import { useState, useEffect } from "react";
import type { NetworkStatus } from "@/types";

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>("online");

  useEffect(() => {
    const handleOnline = () => setStatus("online");
    const handleOffline = () => setStatus("offline");

    setStatus(navigator.onLine ? "online" : "offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { status, setStatus, isOnline: status !== "offline" };
}
