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
import { Settings, LogOut, Package, Undo, RotateCcw, Save, Check } from "lucide-react";
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
  
  // Mobile mode detection
  const isMobileMode = preferences.mobileModePreference || (window.innerWidth <= 768);
  const isDesktopAndMobile = preferences.mobileModePreference && window.innerWidth > 768;

  // Fetch worker's job assignments
  const { data: assignmentsData } = useQuery({
    queryKey: ["/api/users/me/assignments"],
    enabled: !!user && user.role === "worker",
  });

  // Fetch job details
  const { data: jobData } = useQuery({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId && !!user,
  });

  // Fetch active session
  const { data: sessionData } = useQuery({
    queryKey: ["/api/scan-sessions/my-active"],
    enabled: !!user,
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
      setActiveSession(data.session);
      toast({
        title: "Session ready",
        description: "You can now scan barcodes",
      });
    },
    onError: (error: Error) => {
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

      // Send WebSocket update
      sendMessage({
        type: "scan_event",
        data: data.scanEvent,
        jobId,
        sessionId: activeSession?.id || '',
      });

      // Update stats
      setScanStats(prev => ({
        ...prev,
        totalScans: prev.totalScans + 1,
        scansPerHour: calculateScansPerHour(prev.totalScans + 1, activeSession?.startTime?.toString() || Date.now().toString()),
        score: calculateScore(prev.totalScans + 1, Date.now() - new Date(activeSession?.startTime || "").getTime()),
      }));

      // Flash success feedback
      showScanFeedback(true);

      // Clear input
      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = "";
        barcodeInputRef.current.focus();
      }

      toast({
        title: "Item scanned successfully",
        description: `${data.scanEvent.productName} added to box`,
      });
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

      // Update stats
      setScanStats(prev => ({
        ...prev,
        totalScans: Math.max(0, prev.totalScans - data.undoneEvents.length),
      }));

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

  const handleBarcodeSubmit = (barcode: string) => {
    if (!barcode.trim()) return;
    
    // Auto-create session if none exists
    if (!activeSession) {
      autoCreateSessionMutation.mutate();
      toast({
        title: "Creating session",
        description: "Please try scanning again",
      });
      return;
    }
    
    scanMutation.mutate(barcode.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const input = e.target as HTMLInputElement;
      handleBarcodeSubmit(input.value);
    }
  };

  // Auto-start session when entering a job
  useEffect(() => {
    if (jobId && user && !activeSession && !session) {
      autoCreateSessionMutation.mutate();
    }
  }, [jobId, user, activeSession, session]);

  // Mobile mode helper functions
  const getUniqueCustomers = () => {
    const products = (jobData as any)?.products || [];
    const customerSet = new Set(products.map((p: any) => p.customerName));
    const customers = Array.from(customerSet);
    return customers.sort();
  };

  const getCurrentCustomer = () => {
    if (!preferences.singleBoxMode) return undefined;
    const customers = getUniqueCustomers();
    return customers[currentBoxIndex] || customers[0];
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
    const assignments = (assignmentsData as any)?.assignments || [];
    
    if (isLoading || !assignmentsData) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading assignments...</p>
          </div>
        </div>
      );
    }

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
  const session = (sessionData as any)?.session || activeSession;
  const workerAssignment = getWorkerAssignment();

  // Mobile interface mode
  if (isMobileMode && preferences.singleBoxMode) {
    return (
      <MobileScannerInterface
        currentCustomer={getCurrentCustomer() || "No Customer Selected"}
        currentBoxNumber={currentBoxIndex + 1}
        assignedColor={workerAssignment?.assignedColor || "#3B82F6"}
        totalBoxes={getTotalBoxes()}
        completedBoxes={getCompletedBoxes()}
        scanStats={scanStats}
        lastScanEvent={lastScanEvent}
        onScan={handleBarcodeSubmit}
        onUndo={() => undoMutation.mutate(1)}
        onSwitchBox={handleBoxSwitch}
        isUndoAvailable={scanStats.totalScans > 0}
        isConnected={isConnected}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              {/* Mobile Mode Toggle for Desktop */}
              {!isMobileMode && window.innerWidth > 768 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Direct mobile mode toggle
                    preferences.mobileModePreference = true;
                    toast({
                      title: "Mobile Mode",
                      description: "Go to Settings to enable mobile mode permanently",
                    });
                    setLocation("/settings");
                  }}
                  data-testid="button-mobile-mode"
                >
                  📱 Enable Mobile
                </Button>
              )}
              
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

        {/* Performance Dashboard */}
        <Card data-testid="performance-dashboard">
          <CardHeader>
            <CardTitle>Session Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600" data-testid="stat-items-scanned">
                  {scanStats.totalScans}
                </div>
                <p className="text-sm text-gray-600">Items Scanned</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600" data-testid="stat-scans-per-hour">
                  {scanStats.scansPerHour}
                </div>
                <p className="text-sm text-gray-600">Scans/Hour</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600" data-testid="stat-accuracy">
                  {scanStats.accuracy}%
                </div>
                <p className="text-sm text-gray-600">Accuracy</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600" data-testid="stat-score">
                  {scanStats.score.toFixed(1)}
                </div>
                <p className="text-sm text-gray-600">Score (1-10)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scanner Input */}
        <Card data-testid="scanner-input">
          <CardHeader>
            <CardTitle>Barcode Scanner</CardTitle>
          </CardHeader>
          <CardContent>
            {!session ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  {jobData?.isActive === false 
                    ? "Scanning is paused by manager"
                    : "Getting session ready..."
                  }
                </p>
                {autoCreateSessionMutation.isPending && (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    ref={barcodeInputRef}
                    placeholder="Scan or type barcode here..."
                    className="text-lg font-mono h-12"
                    onKeyPress={handleKeyPress}
                    data-testid="input-barcode"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Package className="text-gray-400 text-xl" />
                  </div>
                </div>

                <BarcodeScanner onScan={handleBarcodeSubmit} />

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => undoMutation.mutate(1)}
                    disabled={undoMutation.isPending || scanStats.totalScans === 0}
                    data-testid="button-undo"
                  >
                    <Undo className="mr-2 h-4 w-4" />
                    Undo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => undoMutation.mutate(5)}
                    disabled={undoMutation.isPending || scanStats.totalScans < 5}
                    data-testid="button-bulk-undo"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Bulk Undo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => saveSessionMutation.mutate()}
                    disabled={saveSessionMutation.isPending}
                    data-testid="button-save"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => finishSessionMutation.mutate()}
                    disabled={finishSessionMutation.isPending}
                    data-testid="button-finish"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Finish
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
            />
          </CardContent>
        </Card>

        {/* Current Scan Info */}
        {lastScanEvent && (
          <Card data-testid="scan-info">
            <CardHeader>
              <CardTitle>Last Scanned Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 p-4 bg-success-50 border border-success-200 rounded-lg">
                <div className="text-4xl font-bold text-success-600">✓</div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{lastScanEvent.productName}</h3>
                  <p className="text-sm text-gray-600">Barcode: {lastScanEvent.barCode}</p>
                  <p className="text-sm text-success-600 font-medium">
                    Added to {lastScanEvent.customerName} - Box {lastScanEvent.boxNumber}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-success-600">
                    {/* Current/Total count would be calculated here */}
                  </div>
                  <p className="text-xs text-gray-600">items</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}