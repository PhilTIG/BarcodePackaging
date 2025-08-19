import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, UserIcon, PackageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ExtraItem {
  barCode: string;
  productName: string;
  quantity: number;
  scans: Array<{
    scanTime: string;
    workerName: string;
    workerStaffId: string;
    workerColor: string;
  }>;
}

interface ExtraItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

export function ExtraItemsModal({ isOpen, onClose, jobId }: ExtraItemsModalProps) {
  // Use same progress endpoint as Dashboard and Job Monitoring for consistency
  const { data: progressData, isLoading } = useQuery({
    queryKey: ["/api/jobs", jobId, "progress"],
    enabled: isOpen,
    refetchInterval: 5000, // 5-second polling for real-time updates
  });

  const extraItems: ExtraItem[] = (progressData as any)?.progress?.extraItemsDetails || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getWorkerColorStyle = (color: string) => ({
    backgroundColor: `${color}`,
    opacity: 0.8,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            Extra Items ({extraItems.reduce((sum, item) => sum + item.quantity, 0)})
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[60vh] space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500">Loading extra items...</div>
            </div>
          ) : extraItems.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500">No extra items found</div>
            </div>
          ) : (
            extraItems.map((item, index) => (
              <Card key={index} className="border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {item.barCode}
                      </div>
                      <div className="font-medium">{item.productName}</div>
                      <Badge variant="secondary">
                        Qty: {item.quantity}
                      </Badge>
                    </div>
                  </div>
                  
                  <Separator className="my-3" />
                  
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 font-medium">Scan Details:</div>
                    {item.scans.map((scan, scanIndex) => (
                      <div key={scanIndex} className="flex items-center gap-4 text-sm p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border"
                            style={getWorkerColorStyle(scan.workerColor)}
                          />
                          <UserIcon className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {scan.workerName} ({scan.workerStaffId})
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-600">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{formatDate(scan.scanTime)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline" data-testid="button-close-extra-items">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}