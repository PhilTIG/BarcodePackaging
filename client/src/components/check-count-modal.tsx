import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ArrowLeft, X, Package } from "lucide-react";
import type { BoxRequirement } from "@shared/schema";

interface CheckCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxNumber: number;
  customerName: string;
  jobId: string;
  boxRequirements: BoxRequirement[];
  onBoxModalClose?: () => void; // Optional callback to close the parent box modal
}

interface CheckCountSession {
  id: string;
  jobId: string;
  boxNumber: number;
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
  };
}

export function CheckCountModal({
  isOpen,
  onClose,
  boxNumber,
  customerName,
  jobId,
  boxRequirements,
  onBoxModalClose
}: CheckCountModalProps) {
  const [manualBarcode, setManualBarcode] = useState("");
  const [checkSession, setCheckSession] = useState<CheckCountSession | null>(null);
  const [checkProgress, setCheckProgress] = useState<CheckCountProgress>({});
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize check progress from box requirements
  useEffect(() => {
    if (isOpen && boxRequirements.length > 0) {
      const initialProgress: CheckCountProgress = {};
      boxRequirements.forEach((req) => {
        initialProgress[req.barCode] = {
          expectedQty: req.requiredQty,
          originalScannedQty: req.scannedQty || 0,
          checkScannedQty: 0,
          extraItems: 0,
        };
      });
      setCheckProgress(initialProgress);
    }
  }, [isOpen, boxRequirements]);

  // Start check session when modal opens
  const startCheckSessionMutation = useMutation({
    mutationFn: async () => {
      const totalExpected = boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0);
      const response = await apiRequest("POST", "/api/check-sessions", {
        jobId,
        boxNumber: boxNumber!,
        totalItemsExpected: totalExpected,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCheckSession(data.checkSession);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start check session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Record check event for each scan
  const recordCheckEventMutation = useMutation({
    mutationFn: async ({ barCode, scannedQty }: { barCode: string; scannedQty: number }) => {
      if (!checkSession) return;
      
      const product = boxRequirements.find(req => req.barCode === barCode);
      const expectedQty = product?.requiredQty || 0;
      
      const response = await apiRequest("POST", "/api/check-events", {
        checkSessionId: checkSession.id,
        barCode,
        productName: product?.productName || "Unknown",
        scannedQty,
        expectedQty,
        discrepancyType: scannedQty === expectedQty ? "match" : scannedQty > expectedQty ? "excess" : "shortage",
        eventType: "scan",
      });
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to record scan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Complete check session with corrections
  const completeCheckSessionMutation = useMutation({
    mutationFn: async (corrections: any[]) => {
      if (!checkSession) return;
      
      const response = await apiRequest("PATCH", `/api/check-sessions/${checkSession.id}`, {
        status: "completed",
        corrections,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "box-requirements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "progress"] });
      toast({
        title: "CheckCount completed",
        description: "Box verification completed successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete check session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start session when modal opens and close box modal
  useEffect(() => {
    if (isOpen && !checkSession) {
      startCheckSessionMutation.mutate();
      // Close the parent box modal when CheckCount modal opens
      if (onBoxModalClose) {
        onBoxModalClose();
      }
    }
  }, [isOpen]);

  const handleScan = (barCode: string) => {
    processBarcodeScan(barCode);
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      processBarcodeScan(manualBarcode.trim());
      setManualBarcode("");
    }
  };

  const processBarcodeScan = (barCode: string) => {
    // Find the product in box requirements
    const product = boxRequirements.find(req => req.barCode === barCode);
    
    if (!product) {
      toast({
        title: "Product not found",
        description: `Barcode ${barCode} is not expected in this box`,
        variant: "destructive",
      });
      return;
    }

    // Update check progress
    setCheckProgress(prev => {
      const current = prev[barCode] || {
        expectedQty: product.requiredQty,
        originalScannedQty: product.scannedQty,
        checkScannedQty: 0,
        extraItems: 0,
      };

      const newCheckScannedQty = current.checkScannedQty + 1;
      let extraItems = 0;

      // Calculate extras if check scan exceeds expected quantity
      if (newCheckScannedQty > current.expectedQty) {
        extraItems = newCheckScannedQty - current.expectedQty;
      }

      const updated = {
        ...current,
        checkScannedQty: newCheckScannedQty,
        extraItems,
      };

      // Record the check event
      recordCheckEventMutation.mutate({
        barCode,
        scannedQty: newCheckScannedQty,
      });

      return {
        ...prev,
        [barCode]: updated,
      };
    });

    // Focus back to manual input for continuous scanning
    setTimeout(() => {
      manualInputRef.current?.focus();
    }, 100);
  };

  const handleScanComplete = () => {
    // Check for discrepancies
    const foundDiscrepancies: any[] = [];
    
    Object.entries(checkProgress).forEach(([barCode, progress]) => {
      const product = boxRequirements.find(req => req.barCode === barCode);
      if (!product) return;

      if (progress.checkScannedQty !== progress.originalScannedQty) {
        foundDiscrepancies.push({
          barCode,
          productName: product.productName,
          originalScannedQty: progress.originalScannedQty,
          checkScannedQty: progress.checkScannedQty,
          expectedQty: progress.expectedQty,
          extraItems: progress.extraItems,
        });
      }
    });

    if (foundDiscrepancies.length > 0) {
      setDiscrepancies(foundDiscrepancies);
      setShowCorrectionDialog(true);
    } else {
      // No discrepancies, complete the session
      completeCheckSessionMutation.mutate([]);
    }
  };

  const handleCorrection = (applyCorrections: boolean) => {
    const corrections = applyCorrections ? discrepancies : [];
    completeCheckSessionMutation.mutate(corrections);
    setShowCorrectionDialog(false);
  };

  const handleClose = () => {
    // Cancel the check session if in progress
    if (checkSession && checkSession.status === "active") {
      // Cancel session without saving
      apiRequest("DELETE", `/api/check-sessions/${checkSession.id}`);
    }
    onClose();
  };

  const getProgressBarColor = (progress: CheckCountProgress[string]) => {
    if (progress.checkScannedQty === progress.originalScannedQty && progress.checkScannedQty === progress.expectedQty) {
      return "bg-green-500"; // Perfect match
    }
    if (progress.extraItems > 0) {
      return "bg-orange-500"; // Has extras
    }
    return "bg-blue-500"; // Default progress color
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="flex items-center gap-2"
            data-testid="button-close-checkcount"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex-1 max-w-md mx-4">
            {/* Scanner and Manual Input in Center */}
            <div className="space-y-2">
              <BarcodeScanner
                onScan={handleScan}
              />
              <div className="flex gap-2">
                <Input
                  ref={manualInputRef}
                  type="text"
                  placeholder="Enter barcode manually"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleManualSubmit();
                    }
                  }}
                  className="flex-1"
                  data-testid="input-manual-barcode"
                />
                <Button
                  onClick={handleManualSubmit}
                  disabled={!manualBarcode.trim()}
                  data-testid="button-manual-submit"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            data-testid="button-close-checkcount-x"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Box Info */}
        <div className="mt-4 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            CheckCount - Box {boxNumber}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {customerName}
          </p>
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {boxRequirements.map((requirement) => {
            const progress = checkProgress[requirement.barCode] || {
              expectedQty: requirement.requiredQty,
              originalScannedQty: requirement.scannedQty,
              checkScannedQty: 0,
              extraItems: 0,
            };

            const originalProgress = (progress.originalScannedQty / progress.expectedQty) * 100;
            const checkProgress_percent = (progress.checkScannedQty / progress.expectedQty) * 100;

            return (
              <div
                key={requirement.barCode}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-gray-500" />
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {requirement.productName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {requirement.barCode}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Required: {progress.expectedQty}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Original: {progress.originalScannedQty}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Check: {progress.checkScannedQty}
                    </div>
                    {progress.extraItems > 0 && (
                      <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        Extra: +{progress.extraItems}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dual Progress Bars */}
                <div className="space-y-2">
                  {/* Original Progress Bar */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Original Scan
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {Math.min(originalProgress, 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(originalProgress, 100)} 
                      className="h-2"
                    />
                  </div>

                  {/* CheckCount Progress Bar */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Check Count
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {Math.min(checkProgress_percent, 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(checkProgress_percent, 100)}
                      className={`h-2 ${getProgressBarColor(progress)}`}
                    />
                  </div>
                </div>

                {/* Extra Items Box */}
                {progress.extraItems > 0 && (
                  <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700 rounded">
                    <div className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Extra Items Found: +{progress.extraItems}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
        <Button
          onClick={handleScanComplete}
          className="w-full"
          disabled={completeCheckSessionMutation.isPending}
          data-testid="button-scan-complete"
        >
          {completeCheckSessionMutation.isPending ? "Completing..." : "Scan Complete"}
        </Button>
      </div>

      {/* Correction Dialog */}
      {showCorrectionDialog && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Stock Discrepancies Found
            </h3>
            
            <div className="space-y-2 mb-6">
              {discrepancies.map((disc, index) => (
                <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{disc.productName}</strong>: 
                  Original {disc.originalScannedQty}, Check {disc.checkScannedQty}
                  {disc.extraItems > 0 && ` (+${disc.extraItems} extra)`}
                </div>
              ))}
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Do you want to correct the quantities based on the CheckCount results?
            </p>
            
            <div className="flex gap-3">
              <Button
                onClick={() => handleCorrection(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-correction-no"
              >
                No
              </Button>
              <Button
                onClick={() => handleCorrection(true)}
                className="flex-1"
                data-testid="button-correction-yes"
              >
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}