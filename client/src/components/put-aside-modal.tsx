
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Package, Clock } from 'lucide-react';

interface PutAsideModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

interface PutAsideItem {
  id: string;
  barCode: string;
  productName: string;
  customerName: string;
  putAsideAt: string;
  isBoxAvailable: boolean;
  assignedToBox: number | null;
  putAsideBy: {
    name: string;
    staffId: string;
  };
}

export function PutAsideModal({ isOpen, onClose, jobId }: PutAsideModalProps) {
  const { data: putAsideData, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/put-aside`],
    enabled: isOpen,
    refetchInterval: 5000, // Real-time updates
  });

  const putAsideItems: PutAsideItem[] = (putAsideData as any)?.putAsideItems || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const availableItemsCount = putAsideItems.filter(item => item.isBoxAvailable).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Put Aside Items
          </DialogTitle>
          <DialogDescription>
            Items waiting for available boxes. {availableItemsCount} of {putAsideItems.length} items have boxes available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading put aside items...</p>
            </div>
          ) : putAsideItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Put Aside Items</h3>
              <p className="text-sm">No items are currently put aside for this job.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {putAsideItems
                .sort((a, b) => new Date(b.putAsideAt).getTime() - new Date(a.putAsideAt).getTime())
                .map((item, index) => (
                  <Card key={item.id} className={`${item.isBoxAvailable ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${item.isBoxAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <h3 className="font-medium text-sm truncate">{item.productName}</h3>
                            {item.isBoxAvailable ? (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Box Available
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                <XCircle className="w-3 h-3 mr-1" />
                                No Box
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                            <div>
                              <span className="font-medium">Barcode:</span>
                              <br />
                              {item.barCode}
                            </div>
                            <div>
                              <span className="font-medium">Customer:</span>
                              <br />
                              {item.customerName}
                            </div>
                            <div>
                              <span className="font-medium">Put Aside By:</span>
                              <br />
                              {item.putAsideBy?.name} ({item.putAsideBy?.staffId})
                            </div>
                            <div>
                              <span className="font-medium">When:</span>
                              <br />
                              {formatDate(item.putAsideAt)}
                            </div>
                          </div>

                          {item.isBoxAvailable && item.assignedToBox && (
                            <div className="mt-2 p-2 bg-green-100 rounded text-xs">
                              <strong>Ready for Box {item.assignedToBox}</strong> - Worker can scan this item and it will be allocated automatically.
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 ml-4">
                          {item.isBoxAvailable ? (
                            <div className="text-center">
                              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-1" />
                              <div className="text-xs text-green-700 font-medium">
                                Box {item.assignedToBox}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Clock className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                              <div className="text-xs text-gray-500">
                                Waiting
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
