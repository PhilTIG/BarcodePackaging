import { useEffect, useRef, useState } from "react";
import { useAuth } from "./use-auth";
import { queryClient } from "@/lib/queryClient";

interface WSMessage {
  type: string;
  data: any;
  jobId?: string;
  sessionId?: string;
}

export function useWebSocket(jobId?: string) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      
      // Authenticate with the WebSocket server
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: "authenticate",
          data: {
            userId: user.id,
            jobId,
          },
        }));
      }
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };
  };

  const handleMessage = (message: WSMessage) => {
    switch (message.type) {
      case "scan_update":
        // Invalidate relevant queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "progress"] });
        break;
      
      case "scan_event":
        // Real-time scan event received
        console.log("Scan event received:", message.data);
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
        break;
      
      case "undo_event":
        // Undo operation received
        console.log("Undo event received:", message.data);
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
        break;
      
      case "job_status_update":
        // Job status changed
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", message.data.jobId] });
        break;
      
      default:
        console.log("Unknown message type:", message.type);
    }
  };

  const sendMessage = (message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  };

  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, jobId]);

  return {
    isConnected,
    sendMessage,
    disconnect,
  };
}
