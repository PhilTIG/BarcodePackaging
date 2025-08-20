import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, AlertTriangle, ScanLine, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CheckCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  boxNumber: number;
  jobId: string;
}

interface CheckSession {
  id: string;
  boxNumber: number;
  jobId: string;
  userId: string;
  status: string;
  totalItemsExpected: number;
  totalItemsScanned: number;
  discrepanciesFound: number;
  isComplete: boolean;
  startTime: Date;
  endTime?: Date;
}

interface BoxRequirement {
  id: string;
  boxNumber: number;
  customerName: string;
  barCode: string;
  productName: string;
  requiredQty: number;
  scannedQty: number;
  isComplete: boolean;
}

interface CheckResult {
  id: string;
  checkSessionId: string;
  boxRequirementId: string;
  originalQty: number;
  checkedQty: number;
  adjustedQty?: number;
  discrepancyType: 'match' | 'overcount' | 'undercount' | 'missing';
  correctionApplied: boolean;
  notes?: string;
}

export function CheckCountModal({
  isOpen,
  onClose,
  sessionId,
  boxNumber,
  jobId
}: CheckCountModalProps) {
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [currentBarcode, setCurrentBarcode] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch check session details
  const { data: sessionResponse, isLoading: sessionLoading } = useQuery({
    queryKey: [`/api/check-sessions/${sessionId}`],
    enabled: isOpen && !!sessionId
  });

  // Fetch box requirements for this box
  const { data: boxRequirementsResponse, isLoading: requirementsLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/box-requirements`],
    enabled: isOpen && !!jobId
  });

  // Fetch existing check results
  const { data: resultsResponse } = useQuery({
    queryKey: [`/api/check-sessions/${sessionId}/results`],
    enabled: isOpen && !!sessionId
  });

  const session = (sessionResponse as { session: CheckSession } | undefined)?.session;
  const allBoxRequirements = (boxRequirementsResponse as { boxRequirements: BoxRequirement[] } | undefined)?.boxRequirements || [];
  const boxRequirements = allBoxRequirements.filter(req => req.boxNumber === boxNumber);
  const existingResults = (resultsResponse as { results: CheckResult[] } | undefined)?.results || [];

  // Initialize scanned items from existing results
  useEffect(() => {
    if (existingResults.length > 0) {
      const initialScanned: Record<string, number> = {};
      const initialNotes: Record<string, string> = {};
      
      existingResults.forEach(result => {
        initialScanned[result.boxRequirementId] = result.checkedQty;
        if (result.notes) {
          initialNotes[result.boxRequirementId] = result.notes;
        }
      });
      
      setScannedItems(initialScanned);
      setNotes(initialNotes);
    }
  }, [existingResults]);

  const createCheckEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const response = await apiRequest('POST', '/api/check-events', eventData);
      return await response.json();
    }
  });

  const createCheckResultMutation = useMutation({
    mutationFn: async (resultData: any) => {
      const response = await apiRequest('POST', '/api/check-results', resultData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/check-sessions/${sessionId}/results`] });
    }
  });

  const completeSessionMutation = useMutation({
    mutationFn: async (data: { discrepanciesFound: number }) => {
      const response = await apiRequest('POST', `/api/check-sessions/${sessionId}/complete`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Check Session Completed",
        description: "Box verification has been completed successfully."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/check-sessions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/progress`] });
      onClose();
    }
  });

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBarcode.trim()) return;

    // Find matching requirement
    const requirement = boxRequirements.find(req => req.barCode === currentBarcode.trim());
    
    if (requirement) {
      const currentCount = scannedItems[requirement.id] || 0;
      const newCount = currentCount + 1;
      
      setScannedItems(prev => ({
        ...prev,
        [requirement.id]: newCount
      }));

      // Create check event
      createCheckEventMutation.mutate({
        checkSessionId: sessionId,
        barCode: currentBarcode.trim(),
        scanTime: new Date().toISOString(),
        eventType: 'scan'
      });

      toast({
        title: "Item Scanned",
        description: `${requirement.productName} - Count: ${newCount}`
      });
    } else {
      toast({
        title: "Item Not Found",
        description: "This barcode is not expected in this box.",
        variant: "destructive"
      });
    }

    setCurrentBarcode('');
  };

  const handleQuantityChange = (requirementId: string, quantity: number) => {
    setScannedItems(prev => ({
      ...prev,
      [requirementId]: Math.max(0, quantity)
    }));
  };

  const handleSaveResult = async (requirement: BoxRequirement) => {
    const checkedQty = scannedItems[requirement.id] || 0;
    const originalQty = requirement.requiredQty;
    
    let discrepancyType: 'match' | 'overcount' | 'undercount' | 'missing';
    
    if (checkedQty === originalQty) {
      discrepancyType = 'match';
    } else if (checkedQty > originalQty) {
      discrepancyType = 'overcount';
    } else if (checkedQty === 0) {
      discrepancyType = 'missing';
    } else {
      discrepancyType = 'undercount';
    }

    await createCheckResultMutation.mutateAsync({
      checkSessionId: sessionId,
      boxRequirementId: requirement.id,
      originalQty,
      checkedQty,
      discrepancyType,
      correctionApplied: false,
      notes: notes[requirement.id] || null
    });

    toast({
      title: "Result Saved",
      description: `${requirement.productName} check result recorded.`
    });
  };

  const handleCompleteSession = () => {
    const discrepanciesFound = boxRequirements.filter(req => {
      const checkedQty = scannedItems[req.id] || 0;
      return checkedQty !== req.requiredQty;
    }).length;

    completeSessionMutation.mutate({ discrepanciesFound });
  };

  const calculateProgress = () => {
    const totalItems = boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0);
    const scannedCount = Object.values(scannedItems).reduce((sum, count) => sum + count, 0);
    return totalItems > 0 ? (scannedCount / totalItems) * 100 : 0;
  };

  if (!isOpen || !sessionId) return null;

  if (sessionLoading || requirementsLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">Loading check session...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle data-testid="check-count-modal-title">
            Check Count - Box {boxNumber}
          </DialogTitle>
          <DialogDescription>
            Verify the physical contents of this box by scanning items or manually entering quantities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Session Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Session Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Badge variant={session?.status === 'active' ? 'default' : 'secondary'}>
                    {session?.status || 'Unknown'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Expected Items</Label>
                  <p className="font-medium">{session?.totalItemsExpected || 0}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Progress</Label>
                  <div className="mt-1">
                    <Progress value={calculateProgress()} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {calculateProgress().toFixed(1)}% complete
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Started</Label>
                  <p className="text-sm">{session?.startTime ? new Date(session.startTime).toLocaleTimeString() : '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Barcode Scanner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5" />
                Barcode Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <Input
                  value={currentBarcode}
                  onChange={(e) => setCurrentBarcode(e.target.value)}
                  placeholder="Scan or enter barcode..."
                  className="flex-1"
                  data-testid="barcode-input"
                />
                <Button type="submit" disabled={!currentBarcode.trim()}>
                  Add Item
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader>
              <CardTitle>Expected Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {boxRequirements.map((requirement) => {
                  const checkedQty = scannedItems[requirement.id] || 0;
                  const isMatch = checkedQty === requirement.requiredQty;
                  const hasDiscrepancy = checkedQty !== requirement.requiredQty;
                  
                  return (
                    <div key={requirement.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium">{requirement.productName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {requirement.barCode} • Customer: {requirement.customerName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isMatch ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : hasDiscrepancy ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <Label className="text-sm">Expected</Label>
                          <p className="font-medium">{requirement.requiredQty}</p>
                        </div>
                        <div>
                          <Label className="text-sm">Checked</Label>
                          <Input
                            type="number"
                            min="0"
                            value={checkedQty}
                            onChange={(e) => handleQuantityChange(requirement.id, parseInt(e.target.value) || 0)}
                            className="w-20"
                            data-testid={`quantity-input-${requirement.id}`}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Difference</Label>
                          <p className={`font-medium ${hasDiscrepancy ? 'text-red-500' : 'text-green-500'}`}>
                            {checkedQty - requirement.requiredQty > 0 ? '+' : ''}{checkedQty - requirement.requiredQty}
                          </p>
                        </div>
                      </div>

                      {hasDiscrepancy && (
                        <div className="mb-3">
                          <Label className="text-sm">Notes (optional)</Label>
                          <Textarea
                            value={notes[requirement.id] || ''}
                            onChange={(e) => setNotes(prev => ({ ...prev, [requirement.id]: e.target.value }))}
                            placeholder="Add notes about this discrepancy..."
                            className="mt-1"
                            data-testid={`notes-input-${requirement.id}`}
                          />
                        </div>
                      )}

                      <Button
                        onClick={() => handleSaveResult(requirement)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        data-testid={`save-result-${requirement.id}`}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Result
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteSession}
              disabled={completeSessionMutation.isPending}
              data-testid="complete-session-button"
            >
              Complete Check Session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}