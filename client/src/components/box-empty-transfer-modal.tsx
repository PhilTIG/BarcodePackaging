import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Package, Users, Trash2, ArrowRight, Clock, User } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { BoxRequirement } from '@shared/schema';

interface BoxEmptyTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxNumber: number | null;
  jobId: string;
  customerName: string;
  isComplete: boolean;
  onAction?: () => void;
}

interface BoxHistory {
  id: string;
  boxNumber: number;
  action: 'emptied' | 'transferred';
  performedBy: string;
  targetGroup?: string;
  reason?: string;
  timestamp: string;
  itemsProcessed: number;
}

export function BoxEmptyTransferModal({
  isOpen,
  onClose,
  boxNumber,
  jobId,
  customerName,
  isComplete,
  onAction
}: BoxEmptyTransferModalProps) {
  const [activeTab, setActiveTab] = useState('empty');
  const [reason, setReason] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  const [customGroupName, setCustomGroupName] = useState('');
  const [useCustomGroup, setUseCustomGroup] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch box history for this box
  const { data: boxHistoryData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/boxes/${boxNumber}/history`],
    enabled: isOpen && boxNumber !== null
  });

  // Fetch existing groups for this job
  const { data: groupsData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/groups`],
    enabled: isOpen && activeTab === 'transfer'
  });

  // Empty box mutation
  const emptyBoxMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/jobs/${jobId}/boxes/${boxNumber}/empty`, 'POST', { 
        reason: reason.trim() || undefined 
      });
    },
    onSuccess: () => {
      toast({
        title: "Box Emptied Successfully",
        description: `Box ${boxNumber} has been emptied and is ready for reallocation.`
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/progress`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/box-history`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/boxes/${boxNumber}/history`] });
      
      onAction?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Empty Box",
        description: error.message || "An error occurred while emptying the box.",
        variant: "destructive"
      });
    }
  });

  // Transfer box mutation  
  const transferBoxMutation = useMutation({
    mutationFn: async () => {
      const finalTargetGroup = useCustomGroup ? customGroupName.trim() : targetGroup;
      if (!finalTargetGroup) {
        throw new Error('Please select or enter a group name');
      }
      
      return apiRequest(`/api/jobs/${jobId}/boxes/${boxNumber}/transfer`, 'POST', { 
        targetGroup: finalTargetGroup,
        reason: reason.trim() || undefined 
      });
    },
    onSuccess: (data) => {
      const finalTargetGroup = useCustomGroup ? customGroupName.trim() : targetGroup;
      toast({
        title: "Box Transferred Successfully",
        description: `Box ${boxNumber} has been transferred to group "${finalTargetGroup}".`
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/progress`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/box-history`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/groups`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/boxes/${boxNumber}/history`] });
      
      onAction?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Transfer Box",
        description: error.message || "An error occurred while transferring the box.",
        variant: "destructive"
      });
    }
  });

  const handleEmptyBox = () => {
    emptyBoxMutation.mutate();
  };

  const handleTransferBox = () => {
    transferBoxMutation.mutate();
  };

  const resetForm = () => {
    setReason('');
    setTargetGroup('');
    setCustomGroupName('');
    setUseCustomGroup(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen || boxNumber === null) return null;

  const boxHistory: BoxHistory[] = (boxHistoryData as any)?.history || [];
  const existingGroups: string[] = (groupsData as any)?.groups || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="box-empty-transfer-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Box {boxNumber} - {customerName}
          </DialogTitle>
          <DialogDescription>
            Empty completed boxes for reallocation or transfer boxes to specific groups.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="empty" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Empty Box
            </TabsTrigger>
            <TabsTrigger value="transfer" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Transfer Box
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empty" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                  Empty Box {boxNumber}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-md">
                  <p className="text-sm text-orange-800">
                    <strong>Warning:</strong> This action will reset all scanned quantities for this box to zero, 
                    making it available for reallocation to workers based on their allocation patterns.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason (Optional)</label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for emptying this box..."
                    className="min-h-20"
                    data-testid="empty-reason-input"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={handleClose}
                    disabled={emptyBoxMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEmptyBox}
                    disabled={emptyBoxMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700"
                    data-testid="confirm-empty-box"
                  >
                    {emptyBoxMutation.isPending ? 'Emptying...' : 'Empty Box'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <ArrowRight className="h-5 w-5" />
                  Transfer Box {boxNumber}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    Transfer this box and all its items to a specific group. The box contents will be 
                    associated with the selected group for future organization and export.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="existing-group"
                      name="group-type"
                      checked={!useCustomGroup}
                      onChange={() => setUseCustomGroup(false)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="existing-group" className="text-sm font-medium">
                      Select Existing Group
                    </label>
                  </div>
                  
                  {!useCustomGroup && (
                    <Select value={targetGroup} onValueChange={setTargetGroup} disabled={existingGroups.length === 0}>
                      <SelectTrigger data-testid="select-existing-group">
                        <SelectValue placeholder={existingGroups.length === 0 ? "No existing groups found" : "Choose a group..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {existingGroups.map(group => (
                          <SelectItem key={group} value={group}>
                            {group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="custom-group"
                      name="group-type"
                      checked={useCustomGroup}
                      onChange={() => setUseCustomGroup(true)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="custom-group" className="text-sm font-medium">
                      Create New Group
                    </label>
                  </div>
                  
                  {useCustomGroup && (
                    <input
                      type="text"
                      value={customGroupName}
                      onChange={(e) => setCustomGroupName(e.target.value)}
                      placeholder="Enter new group name..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="custom-group-input"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason (Optional)</label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for transferring this box..."
                    className="min-h-20"
                    data-testid="transfer-reason-input"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={handleClose}
                    disabled={transferBoxMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleTransferBox}
                    disabled={transferBoxMutation.isPending || (!targetGroup && !customGroupName.trim())}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="confirm-transfer-box"
                  >
                    {transferBoxMutation.isPending ? 'Transferring...' : 'Transfer Box'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Box {boxNumber} History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {boxHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No actions have been performed on this box yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {boxHistory.map((entry) => (
                      <div 
                        key={entry.id} 
                        className="border rounded-lg p-3 bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={entry.action === 'emptied' ? 'destructive' : 'default'}
                                className={entry.action === 'emptied' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}
                              >
                                {entry.action === 'emptied' ? 'Emptied' : 'Transferred'}
                              </Badge>
                              {entry.targetGroup && (
                                <Badge variant="outline">
                                  → {entry.targetGroup}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                <span>Performed by {entry.performedBy}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Package className="h-3 w-3" />
                                <span>{entry.itemsProcessed} items processed</span>
                              </div>
                              
                              {entry.reason && (
                                <div className="mt-2 p-2 bg-white rounded border text-sm">
                                  <strong>Reason:</strong> {entry.reason}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}