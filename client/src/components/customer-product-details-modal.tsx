import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Package, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CustomerProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  jobId: string;
  totalItems: number;
  productCount: number;
  groupName?: string | null;
}

interface CustomerProduct {
  id: string;
  customerName: string;
  barCode: string;
  productName: string;
  requiredQty: number;
  scannedQty: number;
  isComplete: boolean;
  groupName?: string | null;
}

export function CustomerProductDetailsModal({
  isOpen,
  onClose,
  customerName,
  jobId,
  totalItems,
  productCount,
  groupName
}: CustomerProductDetailsModalProps) {

  // Fetch customer product details using the dedicated customer products endpoint
  const { data: customerProductsResponse, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/customers/${customerName}/products`],
    enabled: isOpen && !!customerName && !!jobId
  });

  if (!isOpen) return null;

  // Use the dedicated customer products API response
  const customerProductsData = customerProductsResponse as { products: CustomerProduct[] } | undefined;
  const customerProducts = customerProductsData?.products || [];

  // Calculate overall completion percentage
  const totalRequiredQty = customerProducts.reduce((sum, product) => sum + product.requiredQty, 0);
  const totalScannedQty = customerProducts.reduce((sum, product) => sum + product.scannedQty, 0);
  const completionPercentage = totalRequiredQty > 0 ? Math.round((totalScannedQty / totalRequiredQty) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="customer-product-details-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <User className="h-6 w-6 text-blue-600" />
            {customerName} - Products
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Customer Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Customer Name</p>
                  <p className="text-lg font-semibold text-gray-900">{customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Group</p>
                  <div className="mt-1">
                    {groupName ? (
                      <Badge variant="outline" className="text-sm">
                        {groupName}
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-400">No group assigned</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="text-lg font-semibold text-gray-900">{totalItems}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Unique Products</p>
                  <p className="text-lg font-semibold text-gray-900">{productCount}</p>
                </div>
              </div>
              
              {/* Overall Progress */}
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-gray-600">{totalScannedQty}/{totalRequiredQty} ({completionPercentage}%)</span>
                </div>
                <Progress value={completionPercentage} className="h-3" />
              </div>
            </CardContent>
          </Card>

          

          {/* Product Details */}
          <Card data-testid="customer-product-details-card">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading product details...</p>
                </div>
              ) : customerProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No product data available for this customer
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group products by barCode and productName to aggregate quantities (same as Box Details Modal) */}
                  {(() => {
                    const productGroups = customerProducts.reduce((acc, req) => {
                      const key = `${req.barCode}-${req.productName}`;
                      if (!acc[key]) {
                        acc[key] = {
                          barCode: req.barCode,
                          productName: req.productName,
                          totalRequired: 0,
                          totalScanned: 0,
                          isComplete: true
                        };
                      }
                      
                      acc[key].totalRequired += req.requiredQty;
                      acc[key].totalScanned += req.scannedQty;
                      acc[key].isComplete = acc[key].isComplete && req.isComplete;
                      
                      return acc;
                    }, {} as Record<string, {
                      barCode: string;
                      productName: string;
                      totalRequired: number;
                      totalScanned: number;
                      isComplete: boolean;
                    }>);

                    return Object.values(productGroups).map((product, index) => {
                      const productCompletion = product.totalRequired > 0 
                        ? Math.round((product.totalScanned / product.totalRequired) * 100) 
                        : 0;
                      
                      return (
                        <div key={`${product.barCode}-${index}`} className="border rounded-lg p-3 space-y-2" data-testid={`customer-product-item-${index}`}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm truncate flex-1" data-testid={`customer-product-name-${index}`}>
                              {product.productName}
                            </h4>
                            <div className="flex items-center gap-2">
                              {product.totalScanned >= product.totalRequired ? (
                                <CheckCircle className="w-4 h-4 text-green-600" data-testid={`customer-product-status-complete-${index}`} />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" data-testid={`customer-product-status-incomplete-${index}`} />
                              )}
                              <span className="text-sm font-bold" data-testid={`customer-product-quantity-${index}`}>
                                {product.totalScanned}/{product.totalRequired}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Progress</span>
                              <span>{productCompletion}%</span>
                            </div>
                            <Progress value={productCompletion} className="h-2" data-testid={`customer-product-progress-${index}`} />
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Barcode: {product.barCode}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={onClose} data-testid="button-close-customer-products">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}