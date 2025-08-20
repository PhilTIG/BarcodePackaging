import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Search, Scan, Package } from "lucide-react";
import type { BoxRequirement } from "@shared/schema";

interface CheckCountProgress {
  [barCode: string]: {
    expectedQty: number;
    originalScannedQty: number;
    checkScannedQty: number;
    discrepancyType: 'match' | 'shortage' | 'excess';
    isComplete: boolean;
  };
}

interface CheckCountSession {
  id: string;
  jobId: string;
  boxNumber: number | null;
  userId: string;
  status: string;
  startTime: string;
  totalItemsExpected: number;
  totalItemsScanned: number;
}

export default function CheckCountPage() {
  const { jobId, boxNumber } = useParams();
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [barCodeInput, setBarCodeInput] = useState("");
  const [checkProgress, setCheckProgress] = useState<CheckCountProgress>({});
  const [currentSession, setCurrentSession] = useState<CheckCountSession | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showDiscrepancyDialog, setShowDiscrepancyDialog] = useState(false);
  const [discrepancyData, setDiscrepancyData] = useState<any>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
      return;
    }
    if (user && !["supervisor", "manager", "worker"].includes(user.role)) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  // Focus on barcode input when component mounts
  useEffect(() => {
    if (inputRef.current && isSessionActive) {
      inputRef.current.focus();
    }
  }, [isSessionActive]);

  // Fetch box requirements for this specific box
  const { data: boxRequirementsData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/box-requirements`],
    enabled: !!jobId && !!user,
  });

  // Get box requirements filtered by box number (with useMemo to prevent re-creation)
  const boxRequirements: BoxRequirement[] = useMemo(() => {
    return (boxRequirementsData as any)?.boxRequirements?.filter(
      (req: BoxRequirement) => req.boxNumber === parseInt(boxNumber!)
    ) || [];
  }, [boxRequirementsData, boxNumber]);

  const customerName = boxRequirements.length > 0 ? boxRequirements[0].customerName : `Box ${boxNumber}`;

  // Initialize check progress when box requirements are loaded
  useEffect(() => {
    if (boxRequirements.length > 0) {
      const initialProgress: CheckCountProgress = {};
      boxRequirements.forEach(req => {
        initialProgress[req.barCode] = {
          expectedQty: req.requiredQty,
          originalScannedQty: req.scannedQty || 0,
          checkScannedQty: 0,
          discrepancyType: 'match',
          isComplete: false
        };
      });
      setCheckProgress(initialProgress);
    }
  }, [boxRequirements]);

  // Create check session mutation
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const totalExpected = boxRequirements.reduce((sum, req) => sum + (req.scannedQty || 0), 0);
      const response = await apiRequest("POST", "/api/check-sessions", {
        jobId: jobId!,
        boxNumber: parseInt(boxNumber!),
        totalItemsExpected: totalExpected
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setCurrentSession(data.session);
      setIsSessionActive(true);
      toast({
        title: "Check session started",
        description: `Started verification for ${customerName}`,
      });
      // Focus input after session starts
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start check session",
        description: error.message || "Unable to start verification",
        variant: "destructive",
      });
    },
  });

  // Complete session mutation
  const completeSessionMutation = useMutation({
    mutationFn: async (data: { applyCorrections?: boolean; corrections?: any[]; extraItems?: any[] } = {}) => {
      if (!currentSession) return;
      
      const discrepancies = Object.values(checkProgress).filter(
        p => p.discrepancyType !== 'match'
      ).length;
      
      const response = await apiRequest("POST", `/api/check-sessions/${currentSession.id}/complete`, {
        discrepanciesFound: discrepancies,
        applyCorrections: data.applyCorrections || false,
        corrections: data.corrections || [],
        extraItems: data.extraItems || []
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Check session completed",
        description: "Box verification finished successfully",
      });
      handleGoBack();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete session",
        description: error.message || "Unable to finish verification",
        variant: "destructive",
      });
    },
  });

  // Record check event mutation
  const recordEventMutation = useMutation({
    mutationFn: async (eventData: { barCode: string; productName: string; scannedQty: number; expectedQty: number }) => {
      if (!currentSession) return;
      
      const response = await apiRequest("POST", "/api/check-events", {
        checkSessionId: currentSession.id,
        barCode: eventData.barCode,
        productName: eventData.productName,
        scannedQty: eventData.scannedQty,
        expectedQty: eventData.expectedQty,
        discrepancyType: eventData.scannedQty === eventData.expectedQty ? 'match' : 
                        eventData.scannedQty > eventData.expectedQty ? 'excess' : 'shortage',
        eventType: 'scan'
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update the check progress state after successful scan
      setCheckProgress(prev => {
        const updated = { ...prev };
        if (updated[variables.barCode]) {
          updated[variables.barCode] = {
            ...updated[variables.barCode],
            checkScannedQty: updated[variables.barCode].checkScannedQty + 1,
            discrepancyType: variables.scannedQty === variables.expectedQty ? 'match' : 
                           variables.scannedQty > variables.expectedQty ? 'excess' : 'shortage',
            isComplete: updated[variables.barCode].checkScannedQty + 1 >= variables.expectedQty
          };
        }
        return updated;
      });
      
      // Update session scan count
      setCurrentSession(prev => prev ? {
        ...prev,
        totalItemsScanned: prev.totalItemsScanned + 1
      } : null);
      
      toast({
        title: "Item scanned",
        description: `${variables.productName} recorded successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Scan failed",
        description: error.message || "Failed to record scan",
        variant: "destructive",
      });
    },
  });

  const handleStartSession = () => {
    if (boxRequirements.length === 0) {
      toast({
        title: "No items to check",
        description: "This box has no items to verify",
        variant: "destructive",
      });
      return;
    }
    createSessionMutation.mutate();
  };

  const handleGoBack = () => {
    // Determine return location based on user role
    if (user?.role === 'worker') {
      setLocation(`/scanner/${jobId}`);
    } else {
      setLocation(`/supervisor/${jobId}`);
    }
  };

  const handleBarCodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barCodeInput.trim() || !isSessionActive) return;

    const barCode = barCodeInput.trim();
    
    // Find matching box requirement
    const requirement = boxRequirements.find(req => req.barCode === barCode);
    if (!requirement) {
      toast({
        title: "Unknown barcode",
        description: `Barcode ${barCode} not found in this box`,
        variant: "destructive",
      });
      setBarCodeInput("");
      return;
    }

    // Get current progress for this barcode
    const currentProgress = checkProgress[barCode] || {
      expectedQty: requirement.requiredQty,
      originalScannedQty: requirement.scannedQty || 0,
      checkScannedQty: 0,
      discrepancyType: 'match' as const,
      isComplete: false
    };

    const newCheckScanned = currentProgress.checkScannedQty + 1;

    // Record the event (state update will happen in onSuccess)
    recordEventMutation.mutate({
      barCode,
      productName: requirement.productName,
      scannedQty: newCheckScanned,
      expectedQty: currentProgress.originalScannedQty
    });

    setBarCodeInput("");
    inputRef.current?.focus();
  };

  const handleScanComplete = () => {
    const scannedDiscrepancies = Object.values(checkProgress).filter(p => p.discrepancyType !== 'match');
    
    // Check for zero-scan scenario: if no scans occurred but products were previously scanned
    const totalCheckScans = Object.values(checkProgress).reduce((sum, p) => sum + p.checkScannedQty, 0);
    const hasZeroScans = totalCheckScans === 0;
    
    // Create discrepancies for products that were previously scanned but not found during CheckCount
    let zeroScanDiscrepancies: any[] = [];
    if (hasZeroScans) {
      boxRequirements.forEach(requirement => {
        if (requirement.scannedQty > 0) {
          // Product was previously scanned but not found during CheckCount = discrepancy
          zeroScanDiscrepancies.push({
            barCode: requirement.barCode,
            productName: requirement.productName,
            expectedQty: requirement.scannedQty, // What was previously scanned
            originalScannedQty: requirement.scannedQty,
            checkScannedQty: 0, // Nothing found during CheckCount
            discrepancyType: 'shortage' as const,
            isComplete: false
          });
        }
      });
    }
    
    const allDiscrepancies = [...scannedDiscrepancies, ...zeroScanDiscrepancies];
    
    if (allDiscrepancies.length > 0) {
      // Update checkProgress to include zero-scan discrepancies for dialog display
      if (zeroScanDiscrepancies.length > 0) {
        const updatedProgress = { ...checkProgress };
        zeroScanDiscrepancies.forEach(disc => {
          updatedProgress[disc.barCode] = disc;
        });
        setCheckProgress(updatedProgress);
      }
      
      setDiscrepancyData(allDiscrepancies);
      setShowDiscrepancyDialog(true);
    } else {
      // No discrepancies - complete normally
      completeSessionMutation.mutate({
        applyCorrections: false,
        corrections: [],
        extraItems: []
      });
    }
  };

  const handleKeepOriginal = () => {
    setShowDiscrepancyDialog(false);
    // Complete without applying corrections - creates check result with rejected status
    completeSessionMutation.mutate({ 
      applyCorrections: false,
      corrections: [],
      extraItems: []
    });
  };

  const handleApplyCorrections = () => {
    setShowDiscrepancyDialog(false);
    
    // Prepare correction data and extra items
    const corrections: any[] = [];
    const extraItems: any[] = [];
    
    boxRequirements.forEach(requirement => {
      const progress = checkProgress[requirement.barCode];
      if (progress && progress.discrepancyType !== 'match') {
        // Create correction record
        corrections.push({
          sessionId: currentSession?.id,
          boxRequirementId: requirement.id,
          barCode: requirement.barCode,
          originalQty: progress.originalScannedQty,
          checkQty: progress.checkScannedQty,
          correctedQty: progress.checkScannedQty, // Use check count as correction (0 for zero-scan discrepancies)
        });
        
        // If excess items found, add them as extra items
        if (progress.discrepancyType === 'excess') {
          const excessCount = progress.checkScannedQty - progress.originalScannedQty;
          for (let i = 0; i < excessCount; i++) {
            extraItems.push({
              barCode: requirement.barCode,
              productName: requirement.productName
            });
          }
        }
      }
    });
    
    completeSessionMutation.mutate({ 
      applyCorrections: true, 
      corrections, 
      extraItems 
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading check details...</p>
        </div>
      </div>
    );
  }

  if (!user || !["supervisor", "manager", "worker"].includes(user.role)) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header with Scanner */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={handleGoBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Check Count - {customerName}</h1>
              <p className="text-sm text-gray-600">Box {boxNumber}</p>
            </div>
          </div>
          
          {isSessionActive && (
            <Button 
              onClick={handleScanComplete}
              variant="outline"
              data-testid="button-scan-complete"
            >
              Scan Complete
            </Button>
          )}
        </div>
        
        {/* Barcode Scanner Input */}
        {isSessionActive && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Scan className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Barcode Scanner</span>
            </div>
            <form onSubmit={handleBarCodeScan}>
              <Input
                ref={inputRef}
                type="text"
                placeholder="Scan or enter barcode..."
                value={barCodeInput}
                onChange={(e) => setBarCodeInput(e.target.value)}
                className="w-full text-center text-lg"
                data-testid="input-barcode"
              />
            </form>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!isSessionActive ? (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Start Box Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Ready to verify {customerName}</h3>
                  <p className="text-gray-600 mb-6">
                    This will start a quality check session for {boxRequirements.length} items
                  </p>
                  <Button 
                    onClick={handleStartSession}
                    disabled={createSessionMutation.isPending || boxRequirements.length === 0}
                    data-testid="button-start-check"
                  >
                    {createSessionMutation.isPending ? "Starting..." : "Start Check Session"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {/* Products Grid - Same as Box Modal */}
            <div className="grid gap-4">
              {boxRequirements.map((requirement) => {
                const progress = checkProgress[requirement.barCode] || {
                  expectedQty: requirement.requiredQty,
                  originalScannedQty: requirement.scannedQty || 0,
                  checkScannedQty: 0,
                  discrepancyType: 'match' as const,
                  isComplete: false
                };

                const originalProgress = progress.originalScannedQty > 0 ? 
                  (progress.originalScannedQty / progress.expectedQty) * 100 : 0;
                
                const checkProgress_pct = progress.originalScannedQty > 0 ? 
                  (progress.checkScannedQty / progress.originalScannedQty) * 100 : 0;

                const statusIcon = progress.isComplete ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : progress.discrepancyType === 'excess' ? (
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                ) : progress.discrepancyType === 'shortage' && progress.checkScannedQty > 0 ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : null;

                return (
                  <Card key={requirement.barCode} className="border-gray-200" data-testid={`item-${requirement.barCode}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {statusIcon}
                            <div>
                              <h4 className="font-medium text-gray-900">{requirement.productName}</h4>
                              <p className="text-sm text-gray-600">{requirement.barCode}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            Required: {progress.expectedQty}
                          </div>
                          <div className="text-sm text-gray-600">
                            Original: {progress.originalScannedQty}
                          </div>
                          <div className="text-sm font-medium">
                            Check: <span className={
                              progress.isComplete ? 'text-green-600' : 
                              progress.discrepancyType === 'excess' ? 'text-orange-600' : 
                              progress.discrepancyType === 'shortage' ? 'text-red-600' : 'text-blue-600'
                            }>
                              {progress.checkScannedQty}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Dual Progress Bars */}
                      <div className="space-y-3">
                        {/* Original Progress Bar */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-700">Original Progress</span>
                            <span className="text-xs text-gray-500">{Math.round(originalProgress)}%</span>
                          </div>
                          <Progress 
                            value={originalProgress} 
                            className="h-2" 
                            style={{
                              '--progress-background': progress.isComplete ? '#10b981' : '#3b82f6'
                            } as any}
                          />
                        </div>
                        
                        {/* Check Progress Bar */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-700">Check Progress</span>
                            <span className="text-xs text-gray-500">{Math.round(checkProgress_pct)}%</span>
                          </div>
                          <Progress 
                            value={checkProgress_pct} 
                            className="h-2"
                            style={{
                              '--progress-background': 
                                progress.isComplete ? '#10b981' : 
                                progress.discrepancyType === 'excess' ? '#f97316' : 
                                progress.discrepancyType === 'shortage' ? '#ef4444' : '#3b82f6'
                            } as any}
                          />
                        </div>
                      </div>
                      
                      {/* Status Badges */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {progress.isComplete && (
                          <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                            Complete ✓
                          </Badge>
                        )}
                        {progress.discrepancyType === 'excess' && progress.checkScannedQty > progress.originalScannedQty && (
                          <Badge variant="secondary" className="text-orange-700 bg-orange-50 border-orange-200">
                            Extra Items
                          </Badge>
                        )}
                        {progress.discrepancyType === 'shortage' && progress.checkScannedQty > 0 && (
                          <Badge variant="secondary" className="text-red-700 bg-red-50 border-red-200">
                            Shortage
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Discrepancy Dialog */}
      <Dialog open={showDiscrepancyDialog} onOpenChange={setShowDiscrepancyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discrepancies Found</DialogTitle>
            <DialogDescription>
              There are quantity differences between the original scan and your check. 
              What would you like to do?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {discrepancyData && discrepancyData.map((item: any, index: number) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium">{item.productName}</div>
                <div className="text-sm text-gray-600">
                  Original: {item.originalScannedQty}, Check: {item.checkScannedQty}
                  <span className={`ml-2 font-medium ${
                    item.discrepancyType === 'excess' ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    ({item.discrepancyType === 'excess' ? '+' : ''}{item.checkScannedQty - item.originalScannedQty})
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={handleKeepOriginal}
              className="flex-1"
            >
              Keep Original
            </Button>
            <Button 
              onClick={handleApplyCorrections}
              className="flex-1"
            >
              Apply Corrections
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}