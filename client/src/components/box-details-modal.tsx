import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

export function BoxDetailsModal({
  isOpen,
  onClose,
  boxNumber,
  jobId,
  customerName,
  totalQty,
  scannedQty,
  isComplete,
  lastWorkerColor
}: BoxDetailsModalProps) {
  // Fetch box requirements for this specific box using the default query function
  const { data: boxRequirementsResponse, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/box-requirements`],
    enabled: isOpen && boxNumber !== null
  });

  if (!isOpen || boxNumber === null) return null;

  // Filter box requirements for this specific box number
  const boxRequirementsData = boxRequirementsResponse as { boxRequirements: BoxRequirement[] } | undefined;
  const allBoxRequirements: BoxRequirement[] = boxRequirementsData?.boxRequirements || [];
  const boxRequirements = allBoxRequirements.filter((req: BoxRequirement) => req.boxNumber === boxNumber);
  
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
    if (req.lastWorkerUserId && req.lastWorkerColor) {
      const existing = acc[key].workers.get(req.lastWorkerUserId);
      if (existing) {
        existing.count += req.scannedQty;
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
  const allWorkers = new Map<string, { color: string; totalContribution: number }>();
  Object.values(productGroups).forEach(group => {
    group.workers.forEach((worker, userId) => {
      const existing = allWorkers.get(userId);
      if (existing) {
        existing.totalContribution += worker.count;
      } else {
        allWorkers.set(userId, {
          color: worker.color,
          totalContribution: worker.count
        });
      }
    });
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="box-details-modal">
        <DialogHeader>
          <DialogTitle>Box {boxNumber} Details - {customerName}</DialogTitle>
          <DialogDescription>
            Detailed view of box contents, product progress, and worker contributions
          </DialogDescription>
        </DialogHeader>
        
        {/* Box Summary with Box Number in top-right */}
        <Card data-testid="box-summary-card">
          <CardHeader>
            <CardTitle className="flex justify-between items-start">
              <span>Box Summary</span>
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
            <div>
              <h3 className="font-semibold text-lg" data-testid="customer-name-display">
                {customerName}
              </h3>
              <p className="text-sm text-muted-foreground">Customer Destination</p>
            </div>
            
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
                {Array.from(allWorkers.entries()).map(([userId, worker]) => (
                  <Badge 
                    key={userId}
                    variant="secondary"
                    className="text-white border-2 border-white"
                    style={{ backgroundColor: worker.color }}
                    data-testid={`worker-badge-${userId}`}
                  >
                    Worker {userId.slice(-4)} ({worker.totalContribution} items)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}