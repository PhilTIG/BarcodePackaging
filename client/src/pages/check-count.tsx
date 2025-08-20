import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Package, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { BoxRequirement } from "@shared/schema";

interface CheckCountProgress {
  [barCode: string]: {
    expectedQty: number;
    originalScannedQty: number;
    checkScannedQty: number;
    discrepancyType: 'match' | 'shortage' | 'excess';
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
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Fetch box requirements for this specific box
  const { data: boxRequirementsData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/box-requirements`],
    enabled: !!jobId && !!user,
  });

  // Get box requirements filtered by box number
  const boxRequirements: BoxRequirement[] = (boxRequirementsData as any)?.boxRequirements?.filter(
    (req: BoxRequirement) => req.boxNumber === parseInt(boxNumber!)
  ) || [];

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
          discrepancyType: 'match'
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
    mutationFn: async () => {
      if (!currentSession) return;
      
      const discrepancies = Object.values(checkProgress).filter(
        p => p.discrepancyType !== 'match'
      ).length;
      
      const response = await apiRequest("POST", `/api/check-sessions/${currentSession.id}/complete`, {
        discrepanciesFound: discrepancies
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

    // Update check progress
    const currentProgress = checkProgress[barCode] || {
      expectedQty: requirement.requiredQty,
      originalScannedQty: requirement.scannedQty || 0,
      checkScannedQty: 0,
      discrepancyType: 'match' as const
    };

    const newCheckScanned = currentProgress.checkScannedQty + 1;
    const newDiscrepancyType: 'match' | 'shortage' | 'excess' = newCheckScanned === currentProgress.originalScannedQty ? 'match' :
                              newCheckScanned > currentProgress.originalScannedQty ? 'excess' : 'shortage';

    const updatedProgress = {
      ...currentProgress,
      checkScannedQty: newCheckScanned,
      discrepancyType: newDiscrepancyType
    };

    setCheckProgress(prev => ({
      ...prev,
      [barCode]: updatedProgress
    }));

    // Record the event
    recordEventMutation.mutate({
      barCode,
      productName: requirement.productName,
      scannedQty: newCheckScanned,
      expectedQty: currentProgress.originalScannedQty
    });

    setBarCodeInput("");
    inputRef.current?.focus();
  };

  const calculateProgressPercentages = () => {
    const totalOriginalScanned = Object.values(checkProgress).reduce((sum, p) => sum + p.originalScannedQty, 0);
    const totalCheckScanned = Object.values(checkProgress).reduce((sum, p) => sum + p.checkScannedQty, 0);
    
    const originalProgress = totalOriginalScanned > 0 ? 100 : 0; // Original scanning is complete
    const checkProgress_pct = totalOriginalScanned > 0 ? (totalCheckScanned / totalOriginalScanned) * 100 : 0;
    
    return { originalProgress, checkProgress: checkProgress_pct };
  };

  const { originalProgress, checkProgress: checkProgressPct } = calculateProgressPercentages();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
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
              <h1 className="text-lg font-semibold text-gray-900">Check Count</h1>
              <p className="text-sm text-gray-600">
                {customerName} • Box {boxNumber}
              </p>
            </div>
          </div>
          
          {/* Barcode Scanner Input */}
          {isSessionActive && (
            <form onSubmit={handleBarCodeScan} className="flex-1 max-w-md mx-8">
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
          )}
          
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              {Object.keys(checkProgress).length} items
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {!isSessionActive ? (
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
        ) : (
          <div className="space-y-6">
            {/* Progress Bars */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Original Scan Progress</span>
                      <span className="text-sm text-gray-500">{originalProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={originalProgress} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Check Progress</span>
                      <span className="text-sm text-gray-500">{checkProgressPct.toFixed(0)}%</span>
                    </div>
                    <Progress value={checkProgressPct} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items Grid */}
            <div className="grid gap-4">
              {boxRequirements.map((requirement) => {
                const progress = checkProgress[requirement.barCode] || {
                  expectedQty: requirement.requiredQty,
                  originalScannedQty: requirement.scannedQty || 0,
                  checkScannedQty: 0,
                  discrepancyType: 'match' as const
                };

                const statusIcon = progress.discrepancyType === 'match' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : progress.discrepancyType === 'excess' ? (
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                );

                const statusColor = progress.discrepancyType === 'match' ? 'bg-green-50 border-green-200' :
                                  progress.discrepancyType === 'excess' ? 'bg-orange-50 border-orange-200' :
                                  'bg-red-50 border-red-200';

                return (
                  <Card key={requirement.barCode} className={`${statusColor}`} data-testid={`item-${requirement.barCode}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            {statusIcon}
                            <div>
                              <h4 className="font-medium text-gray-900">{requirement.productName}</h4>
                              <p className="text-sm text-gray-600">{requirement.barCode}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right space-y-1">
                          <div className="text-sm text-gray-600">
                            Original: {progress.originalScannedQty} / {progress.expectedQty}
                          </div>
                          <div className="text-sm font-medium">
                            Check: <span className={progress.discrepancyType === 'match' ? 'text-green-600' : 
                                                  progress.discrepancyType === 'excess' ? 'text-orange-600' : 'text-red-600'}>
                              {progress.checkScannedQty}
                            </span> / {progress.originalScannedQty}
                          </div>
                          {progress.discrepancyType !== 'match' && (
                            <Badge variant="outline" className={progress.discrepancyType === 'excess' ? 'text-orange-700' : 'text-red-700'}>
                              {progress.discrepancyType === 'excess' ? 'Excess' : 'Shortage'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Complete Button */}
            <Card>
              <CardContent className="p-6 text-center">
                <Button 
                  onClick={() => completeSessionMutation.mutate()}
                  disabled={completeSessionMutation.isPending}
                  size="lg"
                  data-testid="button-complete-check"
                >
                  {completeSessionMutation.isPending ? "Completing..." : "Complete Check Session"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}