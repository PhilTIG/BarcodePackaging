import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./use-auth";
import { queryClient } from "@/lib/queryClient";

interface WSMessage {
  type: string;
  data: Record<string, unknown>;
  jobId?: string;
  sessionId?: string;
}

export function useWebSocket(jobId?: string, onWorkerBoxUpdate?: (boxNumber: number, workerId: string, workerColor?: string, workerStaffId?: string) => void) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Robust WebSocket URL construction with environment detection
      const getWebSocketUrl = (): string => {
        // Ensure we're in a browser environment
        if (typeof window === 'undefined') {
          throw new Error('WebSocket can only be used in browser environment');
        }

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        
        // Validate host exists and is not empty
        if (!host || host.trim() === '' || host.includes('undefined')) {
          console.error('[WebSocket] Invalid host detected:', host);
          throw new Error(`Invalid host for WebSocket connection: ${host}`);
        }

        // Special handling for Replit production URLs
        let wsUrl: string;
        if (host.includes('.replit.dev') || host.includes('worf.replit.dev')) {
          // Production Replit environment - use the full host
          wsUrl = `${protocol}//${host}/ws`;
        } else if (host === 'localhost:5173' || host === 'localhost:3000') {
          // Local development - connect to backend server
          wsUrl = `ws://localhost:5000/ws`;
        } else {
          // Default case - use current host
          wsUrl = `${protocol}//${host}/ws`;
        }
        
        console.log(`[WebSocket] Attempting connection to: ${wsUrl}`);
        console.log(`[WebSocket] Current location: ${window.location.href}`);
        console.log(`[WebSocket] Detected environment: ${host.includes('.replit.dev') ? 'Replit Production' : 'Other'}`);
        
        // Basic URL validation
        try {
          new URL(wsUrl);
          return wsUrl;
        } catch (urlError) {
          console.error('[WebSocket] Invalid URL constructed:', wsUrl, urlError);
          throw new Error(`Invalid WebSocket URL: ${wsUrl}`);
        }
      };

      const wsUrl = getWebSocketUrl();
      console.log(`[WebSocket] Creating connection for user ${user.id}${jobId ? ` on job ${jobId}` : ''}`);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log(`[WebSocket] Connection established successfully`);
        setIsConnected(true);
        
        // Authenticate with the WebSocket server
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const authMessage = {
            type: "authenticate",
            data: {
              userId: user.id,
              jobId,
            },
          };
          console.log(`[WebSocket] Sending authentication:`, authMessage);
          wsRef.current.send(JSON.stringify(authMessage));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          console.log(`[WebSocket] Message received:`, message);
          handleMessage(message);
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error, "Raw data:", event.data);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log(`[WebSocket] Connection closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
        setIsConnected(false);
        
        // Only attempt to reconnect if it wasn't a manual close (code 1000)
        if (event.code !== 1000 && user) {
          const delay = Math.min(3000 * Math.pow(1.5, 0), 30000); // Exponential backoff with max 30s
          console.log(`[WebSocket] Scheduling reconnection in ${delay}ms`);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[WebSocket] Attempting reconnection...`);
            void connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("[WebSocket] Connection error:", error);
        console.error("[WebSocket] Error details - ReadyState:", wsRef.current?.readyState, "URL:", wsRef.current?.url);
        setIsConnected(false);
      };
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
      console.error("[WebSocket] Error context - User:", user?.id, "JobId:", jobId, "Location:", window?.location?.href);
      setIsConnected(false);
      
      // Retry connection after delay with exponential backoff
      const retryDelay = 5000;
      console.log(`[WebSocket] Scheduling retry in ${retryDelay}ms due to connection creation failure`);
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`[WebSocket] Retrying connection after creation failure...`);
        void connect();
      }, retryDelay);
    }
  }, [user, jobId]);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case "connected":
        // Server welcome message - acknowledge connection
        console.log("[WebSocket] Server connection confirmed:", message.data);
        break;
        
      case "authenticated":
        // Authentication confirmation from server
        console.log("[WebSocket] Authentication confirmed:", message.data);
        break;
        
      case "scan_update":
        // PHASE 1 OPTIMIZATION: Direct data update without query invalidation
        console.log("[WebSocket] Optimized scan update received:", message.data);
        
        // Update job products data directly
        if (message.data.products) {
          queryClient.setQueryData(["/api/jobs", jobId], (oldData: any) => ({
            ...oldData,
            products: message.data.products
          }));
        }
        
        // Update worker performance data directly
        if (message.data.performance && message.data.scanEvent?.userId) {
          queryClient.setQueryData(["/api/jobs", jobId, "worker-performance", message.data.scanEvent.userId], {
            performance: message.data.performance
          });
        }
        
        // Trigger box highlighting update for real-time visual feedback
        if (onWorkerBoxUpdate && message.data.scanEvent?.boxNumber && message.data.scanEvent?.userId) {
          onWorkerBoxUpdate(
            Number(message.data.scanEvent.boxNumber),
            String(message.data.scanEvent.userId),
            message.data.scanEvent.workerColor as string,
            message.data.scanEvent.workerStaffId as string
          );
        }
        
        // Update job progress if available
        if (message.data.progress) {
          queryClient.setQueryData([`/api/jobs/${jobId}/progress`], message.data.progress);
        }
        
        // Invalidate Manager Dashboard jobs list to update progress bars
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        break;
      
      case "scan_event":
        // Real-time scan event with direct data updates
        console.log("[WebSocket] Scan event received:", message.data);
        
        // Update product data directly if provided
        if (message.data.products) {
          queryClient.setQueryData(["/api/jobs", jobId], (oldData: any) => ({
            ...oldData,
            products: message.data.products
          }));
        }
        
        // Update performance data directly if provided
        if (message.data.performance && message.data.userId) {
          queryClient.setQueryData(["/api/jobs", jobId, "worker-performance", message.data.userId], {
            performance: message.data.performance
          });
        }
        
        // Trigger box highlighting update for worker box highlighting
        if (onWorkerBoxUpdate && message.data.boxNumber && message.data.userId) {
          onWorkerBoxUpdate(
            Number(message.data.boxNumber),
            String(message.data.userId),
            message.data.workerColor as string,
            message.data.workerStaffId as string
          );
        }
        break;
      
      case "undo_event":
        // Undo event handling - update UI in real-time
        console.log("[WebSocket] Undo event received:", message.data);
        
        // Call the worker's handleUndoSuccess function if it exists (for worker scanner UI)
        if (typeof window !== 'undefined' && (window as any).handleUndoSuccess) {
          (window as any).handleUndoSuccess(message.data);
        }
        
        // Invalidate query cache to update all monitoring interfaces
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] }); // Manager Dashboard progress bars
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "progress"] }); // Supervisor View progress bars
        
        // Invalidate worker performance data if we know which user performed the undo
        if (message.data.userId) {
          queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "worker-performance", message.data.userId] });
        }
        
        // Invalidate extra items query to update Extra Items modal
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "extra-items"] });
        break;
        
      case "undo_update":
        // PHASE 1 OPTIMIZATION: Direct data update for undo operations
        console.log("[WebSocket] Optimized undo update received:", message.data);
        
        // Update job products data directly
        if (message.data.products) {
          queryClient.setQueryData(["/api/jobs", jobId], (oldData: any) => ({
            ...oldData,
            products: message.data.products
          }));
        }
        
        // Update worker performance data directly
        if (message.data.performance && message.data.userId) {
          queryClient.setQueryData(["/api/jobs", jobId, "worker-performance", message.data.userId], {
            performance: message.data.performance
          });
        }
        break;
      
      case "job_status_update":
        // Job status changed
        console.log("[WebSocket] Job status update received:", message.data);
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", message.data.jobId] });
        break;
      
      case "check_count_update":
        // CheckCount corrections applied - update all monitoring interfaces
        console.log("[WebSocket] CheckCount update received:", message.data);
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "progress"] });
        queryClient.invalidateQueries({ queryKey: ["/api/check-sessions"] });
        
        // Show user feedback about the CheckCount correction
        if (message.data && message.data.applyCorrections && Array.isArray(message.data.corrections) && message.data.corrections.length > 0) {
          console.log(`[CheckCount] Box ${message.data.boxNumber} corrections applied by ${message.data.userName}`);
          console.log(`[CheckCount] Extra items: ${message.data.extraItemsCount || 0}`);
        }
        break;

      case "job_locked":
        // Job has been locked by a manager
        console.log("[WebSocket] Job locked notification received:", message.data);
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/me/assignments"] });
        break;

      case "job_unlocked":
        // Job has been unlocked by a manager
        console.log("[WebSocket] Job unlocked notification received:", message.data);
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/me/assignments"] });
        break;

      case "job_locked_session_terminated":
        // Worker session terminated due to job locking
        console.log("[WebSocket] Session terminated - job locked:", message.data);
        queryClient.invalidateQueries({ queryKey: ["/api/users/me/assignments"] });
        
        // Handle session termination (could redirect to worker selection or show notification)
        if (typeof window !== 'undefined' && window.location.pathname.includes('/worker-scanner')) {
          // If worker is currently in scanning interface, redirect them
          console.log("[WebSocket] Redirecting worker due to job lock");
          window.location.href = '/worker-selection';
        }
        break;

      case "job_scanning_update":
        // Job scanning status changed (paused/active for in-progress jobs)
        console.log("[WebSocket] Job scanning status update received:", message.data);
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", message.data.jobId] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/me/assignments"] });
        break;

      case "performance_update":
        // Real-time performance statistics update
        console.log("[WebSocket] Performance update received:", message.data);
        if (message.data.userId && message.data.performance) {
          queryClient.setQueryData(["/api/jobs", jobId, "worker-performance", message.data.userId], {
            performance: message.data.performance
          });
        }
        break;
      
      default:
        console.log("[WebSocket] Unknown message type received:", message.type, message.data);
    }
  }, [jobId, onWorkerBoxUpdate]);

  const sendMessage = (message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log(`[WebSocket] Sending message:`, message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn(`[WebSocket] Cannot send message - connection not open. ReadyState: ${wsRef.current?.readyState}`, message);
    }
  };

  const disconnect = () => {
    console.log(`[WebSocket] Manual disconnection requested`);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (wsRef.current) {
      // Close with code 1000 (normal closure) to prevent reconnection
      wsRef.current.close(1000, "Manual disconnect");
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
  }, [connect]);

  return {
    isConnected,
    sendMessage,
    disconnect,
  };
}
