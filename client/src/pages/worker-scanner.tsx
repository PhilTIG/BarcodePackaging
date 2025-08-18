import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [scanStats, setScanStats] = useState({
    totalScans: 0,
    scansPerHour: 0,
    accuracy: 100,
    score: 0,
  });
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [currentBoxIndex, setCurrentBoxIndex] = useState(0);
  const [lastScannedBoxNumber, setLastScannedBoxNumber] = useState<number | null>(null); // Track last scanned box for POC-style highlighting
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    boxNumber: number;
    customerName: string;
    productName: string;
    progress: string;
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

  // Fetch worker's job assignments
  const { data: assignmentsData, isLoading: isAssignmentsLoading, error: assignmentsError } = useQuery({
    queryKey: ["/api/users/me/assignments"],
    enabled: !!user,
    retry: 3,
    retryDelay: 1000,
  });

  // Fetch job details
  const { data: jobData } = useQuery({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId && !!user,
  });

  // Fetch active session
  const { data: sessionData, refetch: refetchSession } = useQuery({
    queryKey: ["/api/scan-sessions/my-active"],
    enabled: !!user,
  });

  // Fetch job-specific worker performance
  const { data: jobPerformanceData } = useQuery({
    queryKey: ["/api/jobs", jobId, "worker-performance", user?.id],
    enabled: !!jobId && !!user?.id,
    refetchInterval: 5000, // Update every 5 seconds for real-time updates
  });

  // Connect to WebSocket
  const { sendMessage, isConnected } = useWebSocket(jobId);

  // Auto-focus barcode input
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
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

      // Send WebSocket update for successful scans
      sendMessage({
        type: "scan_event",
        data: data.scanEvent,
        jobId,
        sessionId: activeSession?.id || '',
      });

      // Job performance will be updated via the query refetch
      // Local stats are no longer needed as we use real job performance data

      // Box switching will be handled after data invalidation with delay

      // Set visual feedback for successful scan
      if (data.scanEvent?.boxNumber && data.scanEvent?.customerName && data.scanEvent?.productName) {
        setScanResult({
          boxNumber: data.scanEvent.boxNumber,
          customerName: data.scanEvent.customerName,
          productName: data.scanEvent.productName,
          progress: `Scan successful` // Simple message, progress will be calculated from fresh data
        });

        // Update last scanned box for highlighting
        setLastScannedBoxNumber(data.scanEvent.boxNumber);

        // Clear scan result after 2 seconds
        setTimeout(() => setScanResult(null), 2000);
      }

      // Flash success feedback
      showScanFeedback(true);

      // Clear input and focus
      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = "";
        barcodeInputRef.current.focus();
      }

      // Invalidate job data and performance to get updated progress and then switch boxes after a small delay
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "worker-performance", user?.id] });
      
      // Delay box switching to ensure fresh data is loaded for mobile mode
      if (runtimeSingleBoxMode && data.scanEvent?.customerName) {
        setTimeout(() => {
          const customers = getUniqueCustomers();
          const newBoxIndex = customers.indexOf(data.scanEvent.customerName);
          if (newBoxIndex !== -1 && newBoxIndex !== currentBoxIndex) {
            setCurrentBoxIndex(newBoxIndex);
          }
        }, 100); // Small delay to ensure data is fresh
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
      toast({
        title: `Undid ${data.undoneEvents.length} scan(s)`,
        description: "Scan history updated",
      });

      // Invalidate job performance query to get updated stats
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "worker-performance", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
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
                            </div>
                            {job && (
                              <>
                                <p className="text-sm text-gray-600 mb-2">
                                  {job.totalProducts} total items • {completionPercentage}% complete
                                </p>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${completionPercentage}%` }}
                                  />
                                </div>
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

  if (!(jobData as any)?.job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  const { job, products } = jobData as any;
  // Use activeSession first (from mutations), fallback to sessionData (from queries)
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
        onUndo={() => undoMutation.mutate(1)}
        onSwitchSession={() => setLocation('/scanner')}
        isUndoAvailable={(jobPerformanceData?.performance?.totalScans || 0) > 0}
        isConnected={isConnected}
        scanError={scanError}
        scanResult={scanResult}
        runtimeSingleBoxMode={runtimeSingleBoxMode}
        onRuntimeToggle={setRuntimeSingleBoxMode}
        onLogout={() => {
          logout();
          setLocation("/login");
        }}
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
                    {(jobData as any)?.job?.isActive === false
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
                        placeholder="Scan or type barcode here..."
                        className="text-lg font-mono h-12"
                        onKeyDown={handleKeyDown}
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
                      className="h-12 px-3"
                      data-testid="button-start-camera-inline"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Camera scanner only on larger screens */}
                  <div className="hidden lg:block">
                    <BarcodeScanner onScan={handleBarcodeSubmit} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => undoMutation.mutate(1)}
                      disabled={undoMutation.isPending || scanStats.totalScans === 0}
                      data-testid="button-undo"
                    >
                      <Undo className="mr-1 h-3 w-3" />
                      Undo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => undoMutation.mutate(5)}
                      disabled={undoMutation.isPending || scanStats.totalScans < 5}
                      data-testid="button-bulk-undo"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Bulk Undo
                    </Button>
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
              <CardTitle>Last Scanned Item</CardTitle>
            </CardHeader>
            <CardContent>
              {lastScanEvent ? (
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
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}