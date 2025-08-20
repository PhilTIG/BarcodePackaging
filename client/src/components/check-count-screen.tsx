import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ArrowLeft, Package } from "lucide-react";
import type { BoxRequirement } from "@shared/schema";

interface CheckCountScreenProps {
  isOpen: boolean;
  onClose: () => void;
  boxNumber: number | null;
  customerName: string;
  jobId: string;
  boxRequirements: BoxRequirement[];
  returnLocation: 'monitor' | 'worker'; // Where to go back to
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
  discrepanciesFound: number;
  isComplete: boolean;
}

interface CheckCountProgress {
  [barCode: string]: {
    expectedQty: number;
    originalScannedQty: number;
    checkScannedQty: number;
    extraItems: number;
    hasDiscrepancy: boolean;
  };
}

export function CheckCountScreen({
  isOpen,
  onClose,
  boxNumber,
  customerName,
  jobId,
  boxRequirements,
  returnLocation
}: CheckCountScreenProps) {
  const [checkSession, setCheckSession] = useState<CheckCountSession | null>(null);
  const [progress, setProgress] = useState<CheckCountProgress>({});
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [showDiscrepancies, setShowDiscrepancies] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize progress from box requirements
  useEffect(() => {
    if (boxRequirements.length > 0) {
      const initialProgress: CheckCountProgress = {};
      boxRequirements.forEach(req => {
        initialProgress[req.barCode] = {
          expectedQty: req.requiredQty,
          originalScannedQty: req.scannedQty || 0,
          checkScannedQty: 0,
          extraItems: 0,
          hasDiscrepancy: false
        };
      });
      setProgress(initialProgress);
    }
  }, [boxRequirements]);

  // Create check session
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (!boxNumber) throw new Error("No box number provided");
      const response = await apiRequest("POST", "/api/check-sessions", {
        jobId,
        boxNumber,
        totalItemsExpected: boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0)
      });
      const data = await response.json();
      return data.session;
    },
    onSuccess: (session) => {
      setCheckSession(session);
      console.log('[CheckCount] Session created:', session.id);
    },
    onError: (error) => {
      console.error('[CheckCount] Failed to create session:', error);
      toast({
        title: "Error",
        description: "Failed to start CheckCount session",
        variant: "destructive"
      });
    }
  });

  // Record scan event
  const recordScanMutation = useMutation({
    mutationFn: async ({ barCode }: { barCode: string }) => {
      if (!checkSession) throw new Error("No active session");
      
      const response = await apiRequest("POST", `/api/check-sessions/${checkSession.id}/scan`, {
        barCode
      });
      return response.json();
    },
    onSuccess: async (resultPromise) => {
      const result = await resultPromise;
      setProgress(prev => ({
        ...prev,
        [result.barCode]: {
          ...prev[result.barCode],
          checkScannedQty: result.checkScannedQty,
          extraItems: result.extraItems,
          hasDiscrepancy: result.hasDiscrepancy
        }
      }));
      
      setScannedBarcode("");
      inputRef.current?.focus();
      
      console.log('[CheckCount] Scan recorded:', result);
    },
    onError: (error) => {
      console.error('[CheckCount] Scan failed:', error);
      toast({
        title: "Scan Error",
        description: error.message || "Failed to record scan",
        variant: "destructive"
      });
    }
  });

  // Complete check session
  const completeSessionMutation = useMutation({
    mutationFn: async ({ applyCorrections }: { applyCorrections: boolean }) => {
      if (!checkSession) throw new Error("No active session");
      
      const response = await apiRequest("POST", `/api/check-sessions/${checkSession.id}/complete`, {
        applyCorrections
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "CheckCount Complete",
        description: "Box verification completed successfully",
      });
      onClose();
    },
    onError: (error) => {
      console.error('[CheckCount] Complete failed:', error);
      toast({
        title: "Error",
        description: "Failed to complete CheckCount",
        variant: "destructive"
      });
    }
  });

  // Initialize session when component opens
  useEffect(() => {
    if (isOpen && !checkSession) {
      createSessionMutation.mutate();
    }
  }, [isOpen]);

  // Auto-focus input when session is ready
  useEffect(() => {
    if (checkSession && inputRef.current) {
      inputRef.current.focus();
    }
  }, [checkSession]);

  // Handle barcode scan
  const handleScan = (barcode: string) => {
    if (!checkSession || !barcode.trim()) return;
    recordScanMutation.mutate({ barCode: barcode.trim() });
  };

  // Handle manual input
  const handleInputSubmit = () => {
    if (scannedBarcode.trim()) {
      handleScan(scannedBarcode.trim());
    }
  };

  // Calculate progress percentages
  const originalScanProgress = boxRequirements.length > 0 
    ? (boxRequirements.reduce((sum, req) => sum + (req.scannedQty || 0), 0) / 
       boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0)) * 100 
    : 0;

  const checkScanProgress = boxRequirements.length > 0
    ? (Object.values(progress).reduce((sum, p) => sum + p.checkScannedQty, 0) /
       boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0)) * 100
    : 0;

  // Check if all items have been checked
  const allItemsChecked = Object.values(progress).every(p => 
    p.checkScannedQty >= p.expectedQty
  );

  // Find discrepancies
  const discrepancies = Object.entries(progress).filter(([_, p]) => p.hasDiscrepancy);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900" data-testid="check-count-screen">
      {/* Header */}
      <div className="bg-blue-600 dark:bg-blue-800 text-white px-6 py-4 shadow-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-blue-700 dark:hover:bg-blue-900"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to {returnLocation === 'monitor' ? 'Monitor' : 'Scanning'}
          </Button>

          <div className="flex-1 flex justify-center">
            <div className="flex items-center space-x-4">
              <Input
                ref={inputRef}
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleInputSubmit()}
                placeholder="Scan or enter barcode..."
                className="w-80 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="input-barcode"
                disabled={recordScanMutation.isPending}
              />
              <Button
                onClick={handleInputSubmit}
                disabled={!scannedBarcode.trim() || recordScanMutation.isPending}
                className="bg-white text-blue-600 hover:bg-gray-100"
                data-testid="button-scan"
              >
                Scan
              </Button>
            </div>
          </div>

          <div className="w-32"></div> {/* Spacer for balance */}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Box Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Package className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                CheckCount - Box {boxNumber}
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Customer: <span className="font-medium">{customerName}</span>
            </p>
          </div>

          {/* Progress Bars */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Original Scan Progress
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(originalScanProgress)}%
                </span>
              </div>
              <Progress 
                value={originalScanProgress} 
                className="h-3"
                data-testid="progress-original"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Check Progress
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(checkScanProgress)}%
                </span>
              </div>
              <Progress 
                value={checkScanProgress} 
                className="h-3"
                data-testid="progress-check"
              />
            </div>
          </div>

          {/* Items List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Items to Verify
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {boxRequirements.map((req) => {
                const itemProgress = progress[req.barCode] || {
                  expectedQty: req.requiredQty,
                  originalScannedQty: req.scannedQty,
                  checkScannedQty: 0,
                  extraItems: 0,
                  hasDiscrepancy: false
                };

                const getStatusColor = () => {
                  if (itemProgress.hasDiscrepancy) return "text-orange-600 dark:text-orange-400";
                  if (itemProgress.checkScannedQty >= itemProgress.expectedQty) return "text-green-600 dark:text-green-400";
                  return "text-gray-600 dark:text-gray-400";
                };

                return (
                  <div
                    key={req.id}
                    className="p-4"
                    data-testid={`item-${req.barCode}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {req.productName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Barcode: {req.barCode}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className={`text-sm font-medium ${getStatusColor()}`}>
                          Check: {itemProgress.checkScannedQty} / {itemProgress.expectedQty}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Original: {itemProgress.originalScannedQty}
                        </div>
                        {itemProgress.extraItems > 0 && (
                          <div className="text-xs text-orange-600 dark:text-orange-400">
                            +{itemProgress.extraItems} extra
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complete Button */}
          {allItemsChecked && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              {discrepancies.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-2">
                      Discrepancies Found
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      The CheckCount found differences from the original scan. Do you want to update the quantities?
                    </p>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => completeSessionMutation.mutate({ applyCorrections: false })}
                      variant="outline"
                      className="px-8"
                      disabled={completeSessionMutation.isPending}
                      data-testid="button-keep-original"
                    >
                      Keep Original
                    </Button>
                    <Button
                      onClick={() => completeSessionMutation.mutate({ applyCorrections: true })}
                      className="px-8"
                      disabled={completeSessionMutation.isPending}
                      data-testid="button-apply-corrections"
                    >
                      Apply Corrections
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
                    ✓ Verification Complete
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    All items verified successfully with no discrepancies found.
                  </p>
                  <Button
                    onClick={() => completeSessionMutation.mutate({ applyCorrections: false })}
                    className="px-8"
                    disabled={completeSessionMutation.isPending}
                    data-testid="button-complete"
                  >
                    Complete CheckCount
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}