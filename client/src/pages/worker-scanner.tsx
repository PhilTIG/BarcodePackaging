import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateScore } from "@/lib/scoring";
import { Settings, LogOut, Package, Undo, RotateCcw, Save, Check, Camera } from "lucide-react";
import { CustomerBoxGrid } from "@/components/customer-box-grid";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { MobileScannerInterface } from "@/components/mobile-scanner-interface";
import { useUserPreferences } from "@/hooks/use-user-preferences";

export default function WorkerScanner() {
  const { jobId } = useParams();
  const [, setLocation] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { preferences } = useUserPreferences();
  const { toast } = useToast();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [activeSession, setActiveSession] = useState<{ id: string; startTime: string } | null>(null);
  const [lastScanEvent, setLastScanEvent] = useState<{
    productName: string;
    barCode: string;
    customerName: string;
    boxNumber: number;
  } | null>(null);

  // State for displaying undo events
  const [undoDisplay, setUndoDisplay] = useState<Array<{
    productName: string;
    barCode: string;
    customerName: string;
    boxNumber: number | null;
    timestamp: string;
  }> | null>(null);
  const [scanStats, setScanStats] = useState({
    totalScans: 0,
    scansPerHour: 0,
    accuracy: 100,
    score: 0,
  });
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [currentBoxIndex, setCurrentBoxIndex] = useState(0);
  // Track last scanned box number for highlighting (POC-style single box highlighting)
  const [lastScannedBoxNumber, setLastScannedBoxNumber] = useState<number | null>(null);

  // Load job data with proper loading state
  const { data: jobData, isLoading: jobLoading, error: jobError } = useQuery({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId,
    refetchOnWindowFocus: false, // Reduce excessive calls
  });

  const job = jobData?.job;
  const products = jobData?.products || [];

  // Auto-redirect logic in useEffect to prevent render-time state updates
  useEffect(() => {
    // Accessing userSession here assuming it's available in the scope or passed as a prop
    // For demonstration, let's assume userSession is globally available or from context
    const userSession = (window as any).userSession; // Replace with actual context if needed

    if (!jobId) {
      // Auto-assign to most recently active job if no jobId in URL
      if (userSession?.currentJobId) {
        setLocation(`/scanner/${userSession.currentJobId}`);
        return;
      }
    } else if (userSession?.currentJobId && jobId !== userSession.currentJobId) {
      // Show redirect prompt if user is on a different job
      if (confirm(`You are currently assigned to a different job. Would you like to switch to your assigned job?`)) {
        setLocation(`/scanner/${userSession.currentJobId}`);
        return;
      }
    }
  }, [jobId, setLocation]); // Added setLocation to dependencies


  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    boxNumber: number | null;
    customerName: string;
    productName: string;
    progress: string | null;
    isExtraItem?: boolean;
    timestamp?: string;
  } | null>(null);

  // Runtime single box mode state (separate from settings preference)
  const [runtimeSingleBoxMode, setRuntimeSingleBoxMode] = useState(false);

  // Initialize runtime mode from user's default preference on component mount
  useEffect(() => {
    setRuntimeSingleBoxMode(preferences.singleBoxMode);
  }, [preferences.singleBoxMode]);

  // Mobile mode detection - now based on runtime toggle or screen size
  const isMobileMode = runtimeSingleBoxMode || (window.innerWidth < 800);
  const isDesktopAndMobile = runtimeSingleBoxMode && window.innerWidth >= 800;

  // Fetch worker's job assignments - WebSocket handles real-time updates
  const { data: assignmentsData, isLoading: isAssignmentsLoading, error: assignmentsError } = useQuery({
    queryKey: ["/api/users/me/assignments"],
    enabled: !!user,
    retry: 3,
    retryDelay: 1000,
    // PHASE 1 OPTIMIZATION: No polling - WebSocket provides real-time updates
  });

  // Fetch job details
  // The jobData is already fetched above, so this query might be redundant or need adjustment
  // based on how jobData is intended to be used. For now, keeping it as is.
  const { data: currentJobDetails } = useQuery({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId && !!user,
  });

  // Fetch active session
  const { data: sessionData, refetch: refetchSession } = useQuery({
    queryKey: ["/api/scan-sessions/my-active"],
    enabled: !!user,
  });

  // Fetch job-specific worker performance - WebSocket handles real-time updates
  const { data: jobPerformanceData } = useQuery({
    queryKey: ["/api/jobs", jobId, "worker-performance", user?.id],
    enabled: !!jobId && !!user?.id,
    // PHASE 1 OPTIMIZATION: No polling - WebSocket provides real-time performance updates
  });

  // Connect to WebSocket
  const { sendMessage, isConnected } = useWebSocket(jobId);

  // Auto-focus barcode input
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Listen for undo events from successful undo mutations
  useEffect(() => {
    const handleUndoSuccess = (data: any) => {
      if (data.undoneEvents && Array.isArray(data.undoneEvents)) {
        // Transform undone events into display format
        const undoItems = data.undoneEvents.map((event: any) => ({
          productName: event.productName,
          barCode: event.barCode,
          customerName: event.customerName,
          boxNumber: event.boxNumber,
          timestamp: event.scanTime || new Date().toISOString()
        }));

        // Set undo display (replaces last scan temporarily)
        setUndoDisplay(undoItems);
        setLastScanEvent(null); // Clear last scan event
        setScanResult(null); // Clear any scan results
      }
    };

    // Store the handler for potential cleanup
    (window as any).handleUndoSuccess = handleUndoSuccess;

    return () => {
      delete (window as any).handleUndoSuccess;
    };
  }, []);

  // Redirect if not authenticated or not a worker
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
      return;
    }
  }, [user, isLoading, setLocation]);

  // Handle job selection logic for workers
  useEffect(() => {
    if (!user || user.role !== "worker" || !assignmentsData || jobId) return;

    const assignments = (assignmentsData as any)?.assignments || [];

    if (assignments.length === 0) {
      // No assignments - stay on scanner page and show no assignments message
      setShowJobSelector(false);
      return;
    } else if (assignments.length === 1) {
      // Only one assignment - auto-redirect to that job
      setLocation(`/scanner/${assignments[0].jobId}`);
    } else {
      // Multiple assignments - show job selector
      setShowJobSelector(true);
    }
  }, [user, assignmentsData, jobId, setLocation]);

  // Create scan session mutation
  const autoCreateSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scan-sessions/auto", {
        jobId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[WorkerScanner] Session created successfully:', data.session);
      setActiveSession(data.session);
      // Refetch the session query to update sessionData for consistency
      refetchSession();
      toast({
        title: "Session ready",
        description: "You can now scan barcodes",
      });
    },
    onError: (error: Error) => {
      console.error('[WorkerScanner] Session creation failed:', error);
      toast({
        title: "Cannot start scanning",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Scan event mutation
  const scanMutation = useMutation({
    mutationFn: async (barcode: string) => {
      if (!activeSession) throw new Error("No active session");

      const response = await apiRequest("POST", "/api/scan-events", {
        sessionId: activeSession.id,
        barCode: barcode,
        eventType: "scan",
        jobId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setLastScanEvent(data.scanEvent);

      // Clear any previous scan result (extra items only) and undo display since we have a new scan
      setScanResult(null);
      setUndoDisplay(null);

      // Check if backend marked this as an error scan
      if (data.scanEvent.eventType === 'error') {
        // Handle error scans from backend
        if (data.scanEvent.productName) {
          setScanError(`Unexpected stock scanned: ${data.scanEvent.productName}\nAll quantities for this product have been fulfilled`);
        } else {
          setScanError('Unexpected stock scanned: unknown stock');
        }
        setTimeout(() => setScanError(null), 3000);
        showScanFeedback(false);

        // Clear input and focus
        if (barcodeInputRef.current) {
          barcodeInputRef.current.value = "";
          barcodeInputRef.current.focus();
        }
        return;
      }

      if (data.scanEvent.eventType === 'extra_item') {
        // Handle extra items - both fulfilled products and unknown barcodes
        if (data.scanEvent.productName && data.scanEvent.productName !== 'Unknown') {
          setScanError(`⚠️\nExtra Item\nUnexpected stock scanned: ${data.scanEvent.productName}\nAll quantities for this product have been fulfilled\nItem added to Extra Items`);
        } else {
          setScanError(`⚠️\nExtra Item\nUnknown Product scanned: ${data.scanEvent.barCode}\nItem added to Extra Items`);
        }

        // After 3 seconds, clear error but keep extra item info until next scan
        setTimeout(() => {
          setScanError(null);

          // Set orange extra item display that persists until next scan
          setScanResult({
            boxNumber: null,
            customerName: '', // No customer since it's not for any customer in CSV
            productName: `${data.scanEvent.barCode} ${data.scanEvent.productName || 'Unknown'} Added to Extra Items`,
            progress: null,
            isExtraItem: true,
            timestamp: data.scanEvent.scanTime || new Date().toISOString()
          });
        }, 3000);
        showScanFeedback(false);

        // Clear input and focus
        if (barcodeInputRef.current) {
          barcodeInputRef.current.value = "";
          barcodeInputRef.current.focus();
        }
        return;
      }

      if (data.scanEvent.eventType === 'put_aside') {
        // Handle put aside items
        setScanError(`🔶\nPut Aside Required\nItem: ${data.scanEvent.productName || data.scanEvent.barCode}\nNeeds to be allocated to an available box\nItem added to Put Aside list`);

        // After 3 seconds, clear error but keep put aside info until next scan
        setTimeout(() => {
          setScanError(null);

          // Set orange put aside display that persists until next scan
          setScanResult({
            boxNumber: null,
            customerName: 'Put Aside Required',
            productName: `${data.scanEvent.barCode} ${data.scanEvent.productName || 'Unknown'} - Put Aside`,
            progress: null,
            isPutAside: true, // New field to distinguish from extra items
            timestamp: data.scanEvent.scanTime || new Date().toISOString()
          });
        }, 3000);
        showScanFeedback(false);

        // Clear input and focus
        if (barcodeInputRef.current) {
          barcodeInputRef.current.value = "";
          barcodeInputRef.current.focus();
        }
        return;
      }

      // Set visual feedback for successful scan
      if (data.scanEvent?.boxNumber && data.scanEvent?.customerName && data.scanEvent?.productName) {
        // Update last scanned box for highlighting
        setLastScannedBoxNumber(data.scanEvent.boxNumber);
      }

      // Flash success feedback
      showScanFeedback(true);

      // Clear input and focus
      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = "";
        barcodeInputRef.current.focus();
      }

      // PHASE 1 OPTIMIZATION: Remove all query invalidations - WebSocket handles updates
      // No longer invalidating queries to prevent 3+ API calls per scan

      // Delay box switching for mobile mode - reduced from 100ms to 50ms
      if (runtimeSingleBoxMode && data.scanEvent?.customerName) {
        setTimeout(() => {
          const customers = getUniqueCustomers();
          const newBoxIndex = customers.indexOf(data.scanEvent.customerName);
          if (newBoxIndex !== -1 && newBoxIndex !== currentBoxIndex) {
            setCurrentBoxIndex(newBoxIndex);
          }
        }, 50);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Scan error",
        description: error.message,
        variant: "destructive",
      });
      showScanFeedback(false);
    },
  });

  // Undo mutation
  const undoMutation = useMutation({
    mutationFn: async (count?: number) => {
      if (!activeSession) throw new Error("No active session");

      const response = await apiRequest("POST", "/api/scan-events/undo", {
        sessionId: activeSession.id,
        count,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Enhanced toast message to differentiate between scan types
      let title = "";
      let description = "";

      if (data.summary) {
        const { scanUndone, extraItemsUndone, totalUndone } = data.summary;
        if (extraItemsUndone > 0 && scanUndone > 0) {
          title = `Undid ${totalUndone} items`;
          description = `${scanUndone} successful scans and ${extraItemsUndone} extra items removed`;
        } else if (extraItemsUndone > 0) {
          title = `Removed ${extraItemsUndone} extra item${extraItemsUndone > 1 ? 's' : ''}`;
          description = "Extra items removed from history";
        } else if (scanUndone > 0) {
          title = `Undid ${scanUndone} successful scan${scanUndone > 1 ? 's' : ''}`;
          description = "Scan progress and box quantities updated";
        } else {
          title = `Undid ${totalUndone} item${totalUndone > 1 ? 's' : ''}`;
          description = "Scan history updated";
        }
      } else {
        // Fallback for old response format
        title = `Undid ${data.undoneEvents?.length || 0} scan(s)`;
        description = "Scan history updated";
      }

      toast({
        title,
        description,
      });

      // PHASE 1 OPTIMIZATION: Remove query invalidations - WebSocket handles all updates
      // This eliminates the additional API calls after undo operations

      // Handle undo display for this worker
      if ((window as any).handleUndoSuccess) {
        (window as any).handleUndoSuccess(data);
      }
    },
  });

  // Save session mutation
  const saveSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) throw new Error("No active session");

      const response = await apiRequest("PATCH", `/api/scan-sessions/${activeSession.id}/status`, {
        status: "paused",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Session saved",
        description: "You can resume later",
      });
    },
  });

  // Complete session mutation
  const finishSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) throw new Error("No active session");

      const response = await apiRequest("PATCH", `/api/scan-sessions/${activeSession.id}/status`, {
        status: "completed",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Session completed",
        description: "Great work! Session has been finished.",
      });
      setLocation("/manager");
    },
  });

  const calculateScansPerHour = (totalScans: number, startTime: string): number => {
    const elapsed = Date.now() - new Date(startTime).getTime();
    const hours = elapsed / (1000 * 60 * 60);
    return hours > 0 ? Math.round(totalScans / hours) : 0;
  };

  const showScanFeedback = (success: boolean): void => {
    // Visual feedback for successful/failed scans
    const flashElement = document.getElementById("scan-flash-target");
    if (flashElement) {
      flashElement.style.backgroundColor = success ? "#10B981" : "#EF4444";
      flashElement.style.transform = "scale(1.05)";
      setTimeout(() => {
        flashElement.style.backgroundColor = "";
        flashElement.style.transform = "";
      }, 200);
    }
  };

  // REMOVED: POC-style frontend processing - now backend handles all allocation logic

  const handleBarcodeSubmit = (barcode: string) => {
    if (!barcode.trim()) return;

    // Block scanning if job is paused (in-progress + not active)
    if (job?.status !== 'completed' && !job?.isActive) {
      setScanError('Scanning is paused by manager. Please wait for scanning to be resumed.');
      setTimeout(() => setScanError(null), 3000);
      return;
    }

    // Clear previous scan results and errors
    setScanError(null);
    setScanResult(null);

    // Auto-create session if none exists
    if (!activeSession) {
      autoCreateSessionMutation.mutate();
      setScanError("Creating session - please try scanning again");
      setTimeout(() => setScanError(null), 2000);
      return;
    }

    // Let backend handle all allocation logic - no frontend processing
    scanMutation.mutate(barcode.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      const barcode = input.value;
      handleBarcodeSubmit(barcode);
      // Clear input after successful submission
      if (barcode.trim()) {
        input.value = "";
      }
    }
  };

  // Auto-start session when entering a job
  useEffect(() => {
    if (jobId && user && !activeSession && !sessionData?.session) {
      console.log('[WorkerScanner] Auto-creating session for W002:', { jobId, user: user?.staffId, activeSession, sessionData });
      autoCreateSessionMutation.mutate();
    }
  }, [jobId, user, activeSession, sessionData]);

  // Invalidate job data when switching jobs to ensure fresh product data
  useEffect(() => {
    if (jobId) {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-sessions/my-active"] });
    }
  }, [jobId]);

  // Mobile mode helper functions
  const getUniqueCustomers = () => {
    const products = (jobData as any)?.products || [];
    // Maintain order of first appearance in CSV, don't sort alphabetically
    const seenCustomers = new Set();
    const customers: string[] = [];

    products.forEach((p: any) => {
      if (!seenCustomers.has(p.customerName)) {
        seenCustomers.add(p.customerName);
        customers.push(p.customerName);
      }
    });

    return customers;
  };

  const getCurrentCustomer = (): string => {
    // Don't show customer until scanning starts
    if (!runtimeSingleBoxMode || (jobPerformanceData?.performance?.totalScans || 0) === 0) return "Ready to Scan";
    const customers = getUniqueCustomers();
    return (customers[currentBoxIndex] as string) || (customers[0] as string) || "Ready to Scan";
  };

  const getCurrentBoxProgress = () => {
    // Don't show progress until scanning starts
    if ((jobPerformanceData?.performance?.totalScans || 0) === 0) {
      return { completed: 0, total: 0 };
    }

    const currentCustomer = getCurrentCustomer();
    if (currentCustomer === "Ready to Scan") {
      return { completed: 0, total: 0 };
    }

    const products = (jobData as any)?.products || [];
    const customerProducts = products.filter((p: any) => p.customerName === currentCustomer);

    const total = customerProducts.reduce((sum: number, p: any) => sum + p.qty, 0);
    const completed = customerProducts.reduce((sum: number, p: any) => sum + (p.scannedQty || 0), 0);

    return { completed, total };
  };

  const getTotalBoxes = () => {
    return getUniqueCustomers().length;
  };

  const getCompletedBoxes = () => {
    const products = (jobData as any)?.products || [];
    const customers = getUniqueCustomers();

    return customers.filter(customer => {
      const customerProducts = products.filter((p: any) => p.customerName === customer);
      return customerProducts.every((p: any) => p.scannedQty >= p.totalQty);
    }).length;
  };

  const handleBoxSwitch = (direction: 'next' | 'prev') => {
    const totalBoxes = getTotalBoxes();
    if (direction === 'next' && currentBoxIndex < totalBoxes - 1) {
      setCurrentBoxIndex(prev => prev + 1);
    } else if (direction === 'prev' && currentBoxIndex > 0) {
      setCurrentBoxIndex(prev => prev - 1);
    }
  };

  const getWorkerAssignment = () => {
    const assignments = (assignmentsData as any)?.assignments || [];
    return assignments.find((a: any) => a.jobId === jobId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (user.role !== "worker") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">Worker access required</p>
          <Button onClick={() => setLocation("/login")} variant="outline">
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  // Handle job loading states
  if (jobLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading job...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-500">
              {jobError ? 'Error loading job' : 'Job not found'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show job selection interface when no jobId and multiple assignments
  if (!jobId) {
    if (isAssignmentsLoading || !assignmentsData) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading assignments...</p>
          </div>
        </div>
      );
    }

    // Handle assignment loading error
    if (assignmentsError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-red-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Package className="text-red-600 w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-red-900 mb-2">Error Loading Assignments</h2>
            <p className="text-red-600 mb-4">Failed to fetch your job assignments. Please try again later.</p>
            <Button onClick={() => {
              logout();
              setLocation("/login");
            }} variant="outline">
              Back to Login
            </Button>
          </div>
        </div>
      );
    }


    const assignments = (assignmentsData as any)?.assignments || [];

    if (assignments.length === 0) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="bg-primary-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Package className="text-primary-600 w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Jobs Assigned</h2>
            <p className="text-gray-600 mb-4">You don't have any active job assignments yet.</p>
            <p className="text-sm text-gray-500 mb-6">Please contact your supervisor to be assigned to a job.</p>
            <Button onClick={() => {
              logout();
              setLocation("/login");
            }} variant="outline">
              Back to Login
            </Button>
          </div>
        </div>
      );
    }

    if (assignments.length > 1 || showJobSelector) {
      return (
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-100 w-10 h-10 rounded-lg flex items-center justify-center">
                    <Package className="text-primary-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Select Job</h1>
                    <p className="text-sm text-gray-600">Choose a job to work on</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout();
                    setLocation("/login");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <div className="p-4">
            <div className="max-w-2xl mx-auto">
              <div className="grid gap-4">
                {assignments.map((assignment: any) => {
                  const job = assignment.job;
                  const completionPercentage = job ? Math.round((job.completedItems / job.totalProducts) * 100) : 0;

                  return (
                    <Card key={assignment.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div
                          className="flex items-center justify-between"
                          onClick={() => setLocation(`/scanner/${assignment.jobId}`)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div
                                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: assignment.assignedColor }}
                              />
                              <h3 className="text-lg font-semibold text-gray-900">
                                {job?.name || 'Loading...'}
                              </h3>
                              {job?.status !== 'completed' && !job?.isActive && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                  Paused
                                </Badge>
                              )}
                            </div>
                            {job && (
                              <>
                                <p className="text-sm text-gray-600 mb-2">
                                  {job.totalProducts} total items • {completionPercentage}% complete
                                </p>
                                <Progress
                                  value={completionPercentage}
                                  className="h-2"
                                  data-testid={`job-progress-${assignment.jobId}`}
                                />
                              </>
                            )}
                          </div>
                          <Button size="sm">
                            Start Working
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }


  const session = activeSession || (sessionData as any)?.session;
  const workerAssignment = getWorkerAssignment();

  // Mobile interface mode
  if (isMobileMode) {
    return (
      <MobileScannerInterface
        currentCustomer={getCurrentCustomer()}
        currentBoxNumber={currentBoxIndex + 1}
        assignedColor={workerAssignment?.assignedColor || "#3B82F6"}
        totalBoxes={getTotalBoxes()}
        completedBoxes={getCompletedBoxes()}
        currentBoxProgress={getCurrentBoxProgress()}
        scanStats={{
          totalScans: jobPerformanceData?.performance?.totalScans || 0,
          scansPerHour: jobPerformanceData?.performance?.scansPerHour || 0,
          accuracy: jobPerformanceData?.performance?.accuracy || 100,
          score: jobPerformanceData?.performance?.score || 0,
        }}
        lastScanEvent={lastScanEvent}
        onScan={handleBarcodeSubmit}
        isPaused={job?.status !== 'completed' && !job?.isActive}
        onUndo={() => undoMutation.mutate(1)}
        onSwitchSession={() => setLocation('/scanner')}
        isUndoAvailable={(jobPerformanceData?.performance?.totalScans || 0) > 0}
        isConnected={isConnected}
        scanError={scanError}
        scanResult={scanResult}
        undoDisplay={undoDisplay}
        runtimeSingleBoxMode={runtimeSingleBoxMode}
        onRuntimeToggle={setRuntimeSingleBoxMode}
        onLogout={() => {
          logout();
          setLocation("/login");
        }}
        userStaffId={user.staffId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Error Overlay for Desktop View - Same as Mobile */}
      {scanError && (
        <div className="fixed inset-0 bg-red-500 bg-opacity-95 z-50 flex items-center justify-center">
          <div className="text-center text-white p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <div className="text-3xl font-bold mb-4">Scan Error</div>
            <div className="text-xl mb-6 whitespace-pre-line">{scanError}</div>
            <Button
              onClick={() => {
                // Error will be cleared automatically by the parent component
                if (barcodeInputRef.current) {
                  barcodeInputRef.current.focus();
                }
              }}
              className="bg-white text-red-500 hover:bg-gray-100"
              data-testid="button-error-dismiss"
            >
              Continue Scanning
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Package className="text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Scanner</h1>
                <p className="text-sm text-gray-600">{job.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Show job switching button if worker has multiple assignments */}
              {(assignmentsData as any)?.assignments && (assignmentsData as any).assignments.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/scanner")}
                  data-testid="button-switch-job"
                >
                  Switch Job
                </Button>
              )}

              {/* Single Box Mode Toggle - Always Visible */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Single Box</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runtimeSingleBoxMode}
                    onChange={(e) => setRuntimeSingleBoxMode(e.target.checked)}
                    className="sr-only peer"
                    data-testid="toggle-single-box-mode"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/settings")}
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <div className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm font-medium">
                {user.staffId}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  setLocation("/login");
                }}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Connection Status */}
        {!isConnected && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-600">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Connecting to real-time updates...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Three Panels - Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Job Performance Panel */}
          <Card data-testid="performance-dashboard" className="order-1 lg:order-1">
            <CardHeader>
              <CardTitle>Job Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-primary-600" data-testid="stat-items-scanned">
                    {jobPerformanceData?.performance?.totalScans || 0}
                  </div>
                  <p className="text-xs text-gray-600">Items Scanned</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-primary-600" data-testid="stat-scans-per-hour">
                    {jobPerformanceData?.performance?.scansPerHour || 0}
                  </div>
                  <p className="text-xs text-gray-600">Scans/Hour</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-success-600" data-testid="stat-accuracy">
                    {jobPerformanceData?.performance?.accuracy || 100}%
                  </div>
                  <p className="text-xs text-gray-600">Accuracy</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-primary-600" data-testid="stat-score">
                    {jobPerformanceData?.performance?.score?.toFixed(1) || '0.0'}
                  </div>
                  <p className="text-xs text-gray-600">Score (1-10)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Barcode Scanner Panel */}
          <Card data-testid="scanner-input" className="order-2 lg:order-2">
            <CardHeader>
              <CardTitle>Barcode Scanner</CardTitle>
            </CardHeader>
            <CardContent>
              {!session ? (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4 text-sm">
                    {(job?.isActive === false)
                      ? "Scanning is paused by manager"
                      : "Getting session ready..."
                    }
                  </p>
                  {autoCreateSessionMutation.isPending && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        ref={barcodeInputRef}
                        placeholder={
                          job?.status !== 'completed' && !job?.isActive
                            ? "Scanning is paused..."
                            : "Scan or type barcode here..."
                        }
                        className="text-lg font-mono h-12"
                        onKeyDown={handleKeyDown}
                        disabled={job?.status !== 'completed' && !job?.isActive}
                        data-testid="input-barcode"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // This will be handled by the BarcodeScanner component
                        const scannerElement = document.querySelector('[data-testid="button-toggle-camera"]') as HTMLButtonElement;
                        if (scannerElement) {
                          scannerElement.click();
                        }
                      }}
                      disabled={job?.status !== 'completed' && !job?.isActive}
                      className="h-12 px-3"
                      data-testid="button-start-camera-inline"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Camera scanner only on larger screens */}
                  <div className="hidden lg:block">
                    <BarcodeScanner
                      onScan={job?.status !== 'completed' && !job?.isActive ? undefined : handleBarcodeSubmit}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => undoMutation.mutate(1)}
                      disabled={undoMutation.isPending || (jobPerformanceData?.performance?.totalScans || 0) === 0}
                      data-testid="button-undo"
                    >
                      <Undo className="mr-1 h-3 w-3" />
                      Undo
                    </Button>
                    {/* Best not to bulk undo as it is too dangerous
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => undoMutation.mutate(5)}
                      disabled={undoMutation.isPending || (jobPerformanceData?.performance?.totalScans || 0) < 5}
                      data-testid="button-bulk-undo"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Bulk Undo
                    </Button>
                    */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveSessionMutation.mutate()}
                      disabled={saveSessionMutation.isPending}
                      data-testid="button-save"
                    >
                      <Save className="mr-1 h-3 w-3" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => finishSessionMutation.mutate()}
                      disabled={finishSessionMutation.isPending}
                      data-testid="button-finish"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Finish
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last Scanned Item Panel */}
          <Card data-testid="scan-info" className="order-3 lg:order-3 md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle>
                {job && job.status !== 'completed' && !job.isActive ? 'Scanning Status' : 'Last Scanned Item'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Show "Scanning is Paused" message for in-progress jobs that are not active */}
              {job && job.status !== 'completed' && !job.isActive ? (
                <div className="flex items-center justify-center h-48 text-center">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                      <Package className="w-8 h-8 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-yellow-800 mb-2">Scanning is Paused</h3>
                      <p className="text-sm text-yellow-700">
                        A manager has paused scanning for this job.<br />
                        Please wait for scanning to be resumed.
                      </p>
                    </div>
                  </div>
                </div>
              ) : scanResult ? (
                <div className="flex items-center space-x-4">
                  {/* Text area on the left */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 text-sm mb-1">{scanResult.productName}</h3>
                    <p className="text-xs text-gray-600 mb-1">
                      {scanResult.isExtraItem ? 'Extra Item' : `Box: ${scanResult.boxNumber}`}
                    </p>
                    <p className={`text-xs font-medium ${
                      scanResult.isExtraItem ? 'text-orange-600' : 'text-success-600'
                    }`}>
                      {scanResult.isExtraItem ? 'Added to Extra Items' : `Just scanned into Box ${scanResult.boxNumber}`}
                    </p>
                  </div>

                  {/* Box tile on the right - Orange for Extra Items */}
                  <div className="flex-shrink-0">
                    <div
                      className={`border rounded-lg p-3 relative transition-all duration-200 ${
                        scanResult.isExtraItem
                          ? 'bg-orange-100 border-orange-300'
                          : 'bg-green-100 border-green-300'
                      }`}
                      style={{ minHeight: '150px', width: '192px' }}
                    >
                      {/* Indicator for just-scanned */}
                      <div className="absolute top-1 left-1">
                        <div className={`w-3 h-3 rounded-full ${
                          scanResult.isExtraItem ? 'bg-orange-500' : 'bg-green-500'
                        }`}></div>
                      </div>

                      {/* Customer name or "Extra Item" */}
                      <div className="mb-4 pr-2">
                        <h3 className={`font-medium text-sm truncate ${
                          scanResult.isExtraItem ? 'text-orange-900' : 'text-gray-900'
                        }`} title={scanResult.isExtraItem ? 'Extra Item' : scanResult.customerName}>
                          {scanResult.isExtraItem ? 'Extra Item' : scanResult.customerName}
                        </h3>
                      </div>

                      {/* Center content */}
                      <div className="flex items-center justify-center h-20">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${
                            scanResult.isExtraItem ? 'text-orange-600' : 'text-primary-600'
                          }`}>
                            {scanResult.isExtraItem ? 'EXTRA' : scanResult.boxNumber}
                          </div>
                          {scanResult.isExtraItem && (
                            <div className="text-sm font-medium text-orange-600 mt-1">
                              ITEM
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : undoDisplay && undoDisplay.length > 0 ? (
                // Display undo events with red styling
                <div className="space-y-2">
                  {undoDisplay.map((undoItem, index) => (
                    <div key={index} className="flex items-center space-x-4 bg-red-50 p-3 rounded-lg border border-red-200">
                      {/* Undo icon and text area on the left */}
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="undo-icon">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-red-800 text-sm mb-1">
                            Undid: {undoItem.productName}
                            {undoItem.boxNumber ? ` from Box ${undoItem.boxNumber}` : ''}
                          </h3>
                          <p className="text-xs text-red-600 mb-1">Barcode: {undoItem.barCode}</p>
                          <p className="text-xs text-red-500 font-medium">
                            {new Date(undoItem.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {/* Red-styled box tile on the right */}
                      <div className="flex-shrink-0">
                        <div
                          className="border border-red-300 bg-red-100 rounded-lg p-3 relative transition-all duration-200"
                          style={{ minHeight: '150px', width: '192px' }}
                        >
                          {/* Red indicator dot for undo */}
                          <div className="absolute top-1 left-1">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          </div>

                          {/* Customer name */}
                          <div className="mb-4 pr-2">
                            <h3 className="font-medium text-sm truncate text-red-900" title={undoItem.customerName}>
                              {undoItem.customerName}
                            </h3>
                          </div>

                          {/* Center content with UNDO text */}
                          <div className="flex items-center justify-center h-20">
                            <div className="text-center">
                              <svg className="h-8 w-8 text-red-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              <div className="text-sm font-bold text-red-600">
                                UNDONE
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : lastScanEvent ? (
                <div className="flex items-center space-x-4">
                  {/* Text area on the left */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 text-sm mb-1">{lastScanEvent.productName}</h3>
                    <p className="text-xs text-gray-600 mb-1">Barcode: {lastScanEvent.barCode}</p>
                    <p className="text-xs text-success-600 font-medium">
                      Just scanned into Box {lastScanEvent.boxNumber}
                    </p>
                  </div>

                  {/* Box tile on the right - exact CustomerBoxGrid styling */}
                  <div className="flex-shrink-0">
                    {(() => {
                      // Calculate actual box progress from products data
                      const boxProducts = products.filter((p: any) => p.boxNumber === lastScanEvent.boxNumber);
                      const totalQty = boxProducts.reduce((sum: number, p: any) => sum + p.qty, 0);
                      const scannedQty = boxProducts.reduce((sum: number, p: any) => sum + (p.scannedQty || 0), 0);
                      const completionPercentage = totalQty > 0 ? Math.round((scannedQty / totalQty) * 100) : 0;
                      const isComplete = totalQty > 0 && scannedQty === totalQty;

                      return (
                        <div
                          className="border rounded-lg p-3 relative bg-green-100 border-green-300 transition-all duration-200 cursor-pointer hover:shadow-lg"
                          style={{ minHeight: '150px', width: '192px' }}
                        >
                          {/* Green indicator for just-scanned */}
                          <div className="absolute top-1 left-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>

                          {/* Customer name spanning full width with proper spacing */}
                          <div className="mb-4 pr-2">
                            <h3 className="font-medium text-sm truncate text-gray-900" title={lastScanEvent.customerName}>
                              {lastScanEvent.customerName}
                            </h3>
                          </div>

                          {/* Box Number Badge - Top Right with spacing from customer name */}
                          <div className="absolute top-10 right-2">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 border-white shadow-lg bg-primary text-white">
                              {lastScanEvent.boxNumber}
                            </div>
                          </div>

                          {/* Quantity fraction - Left side at same height as box number */}
                          <div className="absolute top-12 left-2">
                            <div className="text-lg font-bold text-gray-900">
                              {scannedQty}/{totalQty}
                            </div>
                          </div>

                          {/* Centered percentage text and progress bar at bottom */}
                          <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center">
                            {isComplete ? (
                              <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium mb-1">
                                100%
                              </div>
                            ) : (
                              <p className="text-xs text-center mb-1 text-gray-600">
                                {completionPercentage}%
                              </p>
                            )}

                            {/* Centered progress bar */}
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 transition-all duration-300"
                                style={{ width: `${completionPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No scans yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Customer Boxes Grid */}
        <Card data-testid="customer-boxes">
          <CardHeader>
            <CardTitle>Customer Boxes</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerBoxGrid
              products={products}
              jobId={job.id}
              supervisorView={false}
              lastScannedBoxNumber={lastScannedBoxNumber}
              onBoxScanUpdate={(boxNumber, workerId, workerColor) => {
                // POC-style single box highlighting - only one box highlighted at a time
                setLastScannedBoxNumber(boxNumber);
              }}
              onCheckCount={(boxNumber, jobId) => {
                // Navigate to dedicated CheckCount page
                setLocation(`/check-count/${jobId}/${boxNumber}`);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}