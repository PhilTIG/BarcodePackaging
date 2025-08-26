
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Clock, Package, X } from 'lucide-react';

interface PutAsideNotificationProps {
  jobId: string;
  className?: string;
}

interface PutAsideItem {
  id: string;
  barCode: string;
  productName: string;
  customerName: string;
  isBoxAvailable: boolean;
  assignedToBox: number | null;
}

export function PutAsideNotification({ jobId, className = "" }: PutAsideNotificationProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { data: putAsideData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/put-aside`],
    refetchInterval: 5000, // Real-time updates
  });

  const putAsideItems: PutAsideItem[] = (putAsideData as any)?.putAsideItems || [];
  const availableItems = putAsideItems.filter(item => item.isBoxAvailable);

  if (availableItems.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDetails(true)}
        className={`relative ${className} border-green-300 bg-green-50 text-green-700 hover:bg-green-100`}
        data-testid="put-aside-notification"
      >
        <Package className="mr-1 h-4 w-4" />
        Put Aside
        <Badge className="ml-1 bg-green-600 text-white text-xs px-1">
          <CheckCircle className="w-3 h-3 mr-1" />
          {availableItems.length}
        </Badge>
      </Button>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Items Ready to Scan
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              These items have boxes available. Simply scan the barcode and the system will direct you to the correct box.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableItems.map((item) => (
                <div key={item.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-green-900 truncate">
                        {item.productName}
                      </div>
                      <div className="text-xs text-green-700 mt-1">
                        Barcode: {item.barCode}
                      </div>
                      <div className="text-xs text-green-600">
                        Customer: {item.customerName}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <div className="bg-green-600 text-white text-xs px-2 py-1 rounded">
                        Box {item.assignedToBox}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              <strong>Instructions:</strong> Scan any of these barcodes and you'll be directed to the correct box automatically.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
