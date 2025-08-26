import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users, Package } from 'lucide-react';

interface CustomerQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobName?: string;
}

interface UnallocatedCustomer {
  customerName: string;
  totalItems: number;
  productCount: number;
}

export function CustomerQueueModal({ isOpen, onClose, jobId, jobName }: CustomerQueueModalProps) {
  const { data: customersData, isLoading, error } = useQuery({
    queryKey: ['/api/jobs', jobId, 'unallocated-customers'],
    enabled: isOpen && !!jobId,
    refetchInterval: 30000, // Refresh every 30 seconds when open
  });

  const customers = (customersData as any)?.customers || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="customer-queue-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Queue - {jobName || 'Unassigned Job'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100">
                  Unallocated Customers
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Customers waiting for box assignment
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {customers.length} customers
            </Badge>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading unallocated customers...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-8 text-red-600 dark:text-red-400">
              Failed to load unallocated customers. Please try again.
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && customers.length === 0 && (
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                All customers assigned!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                All customers in this job have been allocated to boxes.
              </p>
            </div>
          )}

          {/* Customers List */}
          {!isLoading && !error && customers.length > 0 && (
            <div className="space-y-3">
              {customers.map((customer: UnallocatedCustomer, index: number) => (
                <Card key={`${customer.customerName}-${index}`} className="border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {customer.customerName}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            <span>{customer.totalItems} total items</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>•</span>
                            <span>{customer.productCount} unique products</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" data-testid={`badge-items-${customer.customerName}`}>
                          {customer.totalItems} items
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid={`button-assign-${customer.customerName}`}
                          onClick={() => {
                            // TODO: Future functionality - manual box assignment
                            console.log(`Assign ${customer.customerName} to box`);
                          }}
                        >
                          Assign to Box
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={onClose} data-testid="button-close-customer-queue">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}