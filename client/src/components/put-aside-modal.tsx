import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, UserIcon, CircleDotIcon, ArrowRightIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PutAsideItem {
  id: string;
  barCode: string;
  productName: string;
  customerName: string;
  quantity: number;
  status: 'pending' | 'allocated';
  putAsideAt: string;
  putAsideBy: string;
  workerName?: string;
  workerStaffId?: string;
  allocatedAt?: string;
  allocatedBoxNumber?: number;
}

interface PutAsideModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

export function PutAsideModal({ isOpen, onClose, jobId }: PutAsideModalProps) {
  const { toast } = useToast();

  // Fetch Put Aside items for this job
  const { data: putAsideData, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/put-aside`],
    enabled: isOpen,
    refetchInterval: 5000, // 5-second polling for real-time updates
  });

  const putAsideItems: PutAsideItem[] = (putAsideData as any)?.items || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Pending</Badge>;
      case 'allocated':
        return <Badge variant="default" className="bg-green-100 text-green-800">Allocated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDotIcon className="h-5 w-5 text-blue-600" />
            Put Aside Items ({putAsideItems.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[60vh] space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500">Loading put aside items...</div>
            </div>
          ) : putAsideItems.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500">No put aside items found</div>
            </div>
          ) : (
            putAsideItems.map((item) => (
              <Card key={item.id} className="border-l-4 border-l-blue-500">
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
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="text-sm text-gray-600">
                      For: <span className="font-medium">{item.customerName}</span>
                    </div>
                  </div>
                  
                  <Separator className="my-3" />
                  
                  <div className="space-y-3">
                    {/* Put Aside Details */}
                    <div className="flex items-center gap-4 text-sm p-2 bg-blue-50 rounded">
                      <div className="flex items-center gap-2">
                        <CircleDotIcon className="h-4 w-4 text-blue-600" />
                        <UserIcon className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">
                          Put aside by {item.workerStaffId || 'Worker'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-600">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{formatDate(item.putAsideAt)}</span>
                      </div>
                    </div>

                    {/* Allocation Details (if allocated) */}
                    {item.status === 'allocated' && item.allocatedAt && (
                      <div className="flex items-center gap-4 text-sm p-2 bg-green-50 rounded">
                        <div className="flex items-center gap-2">
                          <ArrowRightIcon className="h-4 w-4 text-green-600" />
                          <span className="font-medium">
                            Allocated to Box {item.allocatedBoxNumber}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-600">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{formatDate(item.allocatedAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline" data-testid="button-close-put-aside">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}