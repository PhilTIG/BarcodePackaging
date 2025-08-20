import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Users, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { CheckCountModal } from '@/components/check-count-modal';
import type { BoxRequirement as SchemaBoxRequirement } from '@shared/schema';

interface BoxDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxNumber: number | null;
  jobId: string;
  customerName: string;
  totalQty: number;
  scannedQty: number;
  isComplete: boolean;
  lastWorkerColor?: string;
  onCheckCount?: (boxNumber: number, jobId: string) => void;
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
  lastWorkerUserId?: string;
  lastWorkerColor?: string;
}

interface Worker {
  id: string;
  staffId: string;
  name: string;
  role: string;
  isActive: boolean;
}

export function BoxDetailsModal({
  isOpen,
  onClose,
  boxNumber,
  jobId,
  customerName,
  totalQty,
  scannedQty,
  isComplete,
  lastWorkerColor,
  onCheckCount
}: BoxDetailsModalProps) {
  // CheckCount modal state
  const [isCheckCountModalOpen, setIsCheckCountModalOpen] = useState(false);
  
  // User authentication and preferences
  const { user } = useAuth();
  const { preferences } = useUserPreferences();
  // Fetch box requirements for this specific box using the default query function
  const { data: boxRequirementsResponse, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/box-requirements`],
    enabled: isOpen && boxNumber !== null
  });

  // Fetch workers to get their names
  const { data: workersResponse } = useQuery({
    queryKey: ["/api/users?role=worker"],
    enabled: isOpen && boxNumber !== null
  });

  if (!isOpen || boxNumber === null) return null;

  // Filter box requirements for this specific box number
  const boxRequirementsData = boxRequirementsResponse as { boxRequirements: BoxRequirement[] } | undefined;
  const allBoxRequirements: BoxRequirement[] = boxRequirementsData?.boxRequirements || [];
  const boxRequirements = allBoxRequirements.filter((req: BoxRequirement) => req.boxNumber === boxNumber);
  
  // Get workers data for name mapping
  const workersData = workersResponse as { workers: Worker[] } | undefined;
  const workers: Worker[] = workersData?.workers || [];
  const workerMap = new Map(workers.map(worker => [worker.id, worker]));
  
  // Calculate overall completion percentage
  const completionPercentage = totalQty > 0 ? Math.round((scannedQty / totalQty) * 100) : 0;

  // Group requirements by product and aggregate quantities
  const productGroups = boxRequirements.reduce((acc, req) => {
    const key = `${req.barCode}-${req.productName}`;
    if (!acc[key]) {
      acc[key] = {
        barCode: req.barCode,
        productName: req.productName,
        totalRequired: 0,
        totalScanned: 0,
        isComplete: true,
        workers: new Map<string, { color: string; count: number }>()
      };
    }
    
    acc[key].totalRequired += req.requiredQty;
    acc[key].totalScanned += req.scannedQty;
    acc[key].isComplete = acc[key].isComplete && req.isComplete;
    
    // Track workers who scanned this product
    // Note: lastWorkerUserId only shows the most recent worker for this specific product
    // But we still want to show their contribution
    if (req.lastWorkerUserId && req.lastWorkerColor && req.scannedQty > 0) {
      const existing = acc[key].workers.get(req.lastWorkerUserId);
      if (existing) {
        existing.count = Math.max(existing.count, req.scannedQty);
      } else {
        acc[key].workers.set(req.lastWorkerUserId, {
          color: req.lastWorkerColor,
          count: req.scannedQty
        });
      }
    }
    
    return acc;
  }, {} as Record<string, {
    barCode: string;
    productName: string;
    totalRequired: number;
    totalScanned: number;
    isComplete: boolean;
    workers: Map<string, { color: string; count: number }>;
  }>);

  // Get all unique workers who contributed to this box
  // Aggregate worker contributions across ALL products in this box
  const allWorkers = new Map<string, { color: string; totalContribution: number }>();
  
  // Iterate through each box requirement to find all workers who scanned any product in this box
  boxRequirements.forEach(req => {
    if (req.lastWorkerUserId && req.lastWorkerColor && req.scannedQty > 0) {
      const existing = allWorkers.get(req.lastWorkerUserId);
      if (existing) {
        // Add this worker's contribution to their total
        existing.totalContribution += req.scannedQty;
      } else {
        // First time seeing this worker in this box
        allWorkers.set(req.lastWorkerUserId, {
          color: req.lastWorkerColor,
          totalContribution: req.scannedQty
        });
      }
    }
  });

  console.log(`[BoxModal] Box ${boxNumber} workers:`, Array.from(allWorkers.entries()).map(([id, worker]) => ({
    workerId: id.slice(-8),
    color: worker.color, 
    contribution: worker.totalContribution
  })));

  // Check if user can perform CheckCount
  const canCheckCount = () => {
    if (!user) return false;
    
    // Managers and supervisors can always perform checks
    if (user.role === 'manager' || user.role === 'supervisor') {
      return true;
    }
    
    // Workers need the checkBoxEnabled preference
    if (user.role === 'worker') {
      return preferences.checkBoxEnabled;
    }
    
    return false;
  };

  // Handle CheckCount button click
  const handleCheckCount = () => {
    console.log('[DEBUG] CheckCount button clicked!');
    console.log('[DEBUG] boxNumber:', boxNumber);
    console.log('[DEBUG] canCheckCount():', canCheckCount());
    console.log('[DEBUG] user:', user);
    console.log('[DEBUG] preferences:', preferences);
    
    if (!boxNumber || !canCheckCount()) {
      console.log('[DEBUG] Early return - missing boxNumber or no permission');
      return;
    }
    
    console.log('[DEBUG] Closing box modal first');
    onClose(); // Close box modal immediately
    
    console.log('[DEBUG] Setting isCheckCountModalOpen to true');
    setIsCheckCountModalOpen(true);
    
    console.log('[DEBUG] isCheckCountModalOpen after set:', true);
  };

  // Get theme color for button styling
  const getThemeColor = () => {
    const themeColorMap: Record<string, string> = {
      blue: '#3b82f6',
      green: '#10b981',
      orange: '#f97316',
      teal: '#14b8a6',
      red: '#ef4444',
      dark: '#374151'
    };
    return themeColorMap[preferences.theme] || themeColorMap.blue;
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="box-details-modal">
        
        {/* Box Summary with Box Number in top-right */}
        <Card data-testid="box-summary-card">
          <CardHeader>
            <CardTitle className="flex justify-between items-end">
              <h3 className="text-2xl font-semibold leading-none tracking-tight" data-testid="customer-name-display">
                {customerName}
              </h3>
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white border-4 border-white shadow-lg"
                style={{ backgroundColor: lastWorkerColor || '#6366f1' }}
                data-testid="large-box-number"
              >
                {boxNumber}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm font-bold" data-testid="overall-progress-text">
                  {scannedQty}/{totalQty} ({completionPercentage}%)
                </span>
              </div>
              <Progress value={completionPercentage} className="h-3" data-testid="overall-progress-bar" />
            </div>

            {isComplete && (
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Box Complete
                </span>
              </div>
            )}

            {/* CheckCount Button */}
            {canCheckCount() && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleCheckCount}
                  className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: getThemeColor() }}
                  data-testid="check-count-button"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Check Count
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Details - Full Width */}
        <Card data-testid="product-details-card">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Loading product details...</div>
            ) : boxRequirements.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No product data available for this box</div>
            ) : (
              <div className="space-y-4">
                {Object.values(productGroups).map((product, index) => {
                  const productCompletion = product.totalRequired > 0 
                    ? Math.round((product.totalScanned / product.totalRequired) * 100) 
                    : 0;
                  
                  return (
                    <div key={`${product.barCode}-${index}`} className="border rounded-lg p-3 space-y-2" data-testid={`product-item-${index}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm truncate flex-1" data-testid={`product-name-${index}`}>
                          {product.productName}
                        </h4>
                        <div className="flex items-center gap-2">
                          {product.totalScanned >= product.totalRequired ? (
                            <CheckCircle className="w-4 h-4 text-green-600" data-testid={`product-status-complete-${index}`} />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" data-testid={`product-status-incomplete-${index}`} />
                          )}
                          <span className="text-sm font-bold" data-testid={`product-quantity-${index}`}>
                            {product.totalScanned}/{product.totalRequired}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{productCompletion}%</span>
                        </div>
                        <Progress value={productCompletion} className="h-2" data-testid={`product-progress-${index}`} />
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Barcode: {product.barCode}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Section - Workers */}
        {allWorkers.size > 0 && (
          <Card data-testid="workers-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Workers Who Packed This Box
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Array.from(allWorkers.entries()).map(([userId, worker]) => {
                  const workerInfo = workerMap.get(userId);
                  const displayName = workerInfo ? `${workerInfo.name} (${workerInfo.staffId})` : `Worker ${userId.slice(-4)}`;
                  
                  return (
                    <Badge 
                      key={userId}
                      variant="secondary"
                      className="text-white border-2 border-white"
                      style={{ backgroundColor: worker.color }}
                      data-testid={`worker-badge-${userId}`}
                    >
                      {displayName} ({worker.totalContribution} items)
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
    
    {/* CheckCount Modal */}
    {boxNumber && (
      <CheckCountModal
        isOpen={isCheckCountModalOpen}
        onClose={() => setIsCheckCountModalOpen(false)}
        boxNumber={boxNumber}
        customerName={customerName}
        jobId={jobId}
        boxRequirements={boxRequirements as SchemaBoxRequirement[]}
        onBoxModalClose={onClose}
      />
    )}
    </>
  );
}