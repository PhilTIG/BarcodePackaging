import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, CheckSquare, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ManagerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Worker {
  id: string;
  staffId: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface UserPreferences {
  checkBoxEnabled: boolean;
}

export function ManagerSettingsModal({
  isOpen,
  onClose
}: ManagerSettingsModalProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all workers
  const { data: workersResponse, isLoading: workersLoading } = useQuery({
    queryKey: ["/api/users?role=worker"],
    enabled: isOpen
  });

  // Fetch user preferences for all workers
  const { data: allPreferencesResponse, isLoading: preferencesLoading } = useQuery({
    queryKey: ["/api/users/preferences/all"],
    enabled: isOpen
  });

  const workers = (workersResponse as { workers: Worker[] } | undefined)?.workers || [];
  const allPreferences = (allPreferencesResponse as { preferences: Record<string, UserPreferences> } | undefined)?.preferences || {};

  const updateWorkerPreferenceMutation = useMutation({
    mutationFn: async ({ workerId, checkBoxEnabled }: { workerId: string; checkBoxEnabled: boolean }) => {
      const response = await apiRequest('PATCH', `/api/users/${workerId}/preferences`, { checkBoxEnabled });
      return await response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Worker Preference Updated",
        description: `CheckBox permission ${variables.checkBoxEnabled ? 'enabled' : 'disabled'} successfully.`
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/users/preferences/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/preferences"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to update worker preference';
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive"
      });
    },
    onSettled: (data, error, variables) => {
      setLoadingStates(prev => ({ ...prev, [variables.workerId]: false }));
    }
  });

  const handleToggleWorkerPermission = async (workerId: string, currentEnabled: boolean) => {
    setLoadingStates(prev => ({ ...prev, [workerId]: true }));
    
    updateWorkerPreferenceMutation.mutate({
      workerId,
      checkBoxEnabled: !currentEnabled
    });
  };

  const enableAllWorkers = async () => {
    const workersToUpdate = workers.filter(worker => 
      !allPreferences[worker.id]?.checkBoxEnabled
    );

    for (const worker of workersToUpdate) {
      setLoadingStates(prev => ({ ...prev, [worker.id]: true }));
      
      updateWorkerPreferenceMutation.mutate({
        workerId: worker.id,
        checkBoxEnabled: true
      });
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    toast({
      title: "Bulk Update Initiated",
      description: `Enabling CheckBox permission for ${workersToUpdate.length} workers.`
    });
  };

  const disableAllWorkers = async () => {
    const workersToUpdate = workers.filter(worker => 
      allPreferences[worker.id]?.checkBoxEnabled
    );

    for (const worker of workersToUpdate) {
      setLoadingStates(prev => ({ ...prev, [worker.id]: true }));
      
      updateWorkerPreferenceMutation.mutate({
        workerId: worker.id,
        checkBoxEnabled: false
      });
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    toast({
      title: "Bulk Update Initiated",
      description: `Disabling CheckBox permission for ${workersToUpdate.length} workers.`
    });
  };

  const getWorkerStats = () => {
    const total = workers.length;
    const enabled = workers.filter(worker => allPreferences[worker.id]?.checkBoxEnabled).length;
    const disabled = total - enabled;
    
    return { total, enabled, disabled };
  };

  if (!isOpen) return null;

  if (workersLoading || preferencesLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">Loading manager settings...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const stats = getWorkerStats();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="manager-settings-title">
            <Settings className="h-5 w-5" />
            Manager Settings - CheckBox Permissions
          </DialogTitle>
          <DialogDescription>
            Manage worker permissions for the CheckBox verification system. Workers can only perform box checks when this permission is enabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statistics Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Worker Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Workers</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
                  <div className="text-sm text-muted-foreground">Enabled</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{stats.disabled}</div>
                  <div className="text-sm text-muted-foreground">Disabled</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Bulk Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button
                onClick={enableAllWorkers}
                variant="outline"
                className="flex-1"
                disabled={stats.enabled === stats.total}
                data-testid="enable-all-workers"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Enable All Workers
              </Button>
              <Button
                onClick={disableAllWorkers}
                variant="outline"
                className="flex-1"
                disabled={stats.enabled === 0}
                data-testid="disable-all-workers"
              >
                Disable All Workers
              </Button>
            </CardContent>
          </Card>

          {/* Individual Worker Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Individual Worker Permissions</CardTitle>
              <Separator />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workers.map((worker) => {
                  const isEnabled = allPreferences[worker.id]?.checkBoxEnabled || false;
                  const isLoading = loadingStates[worker.id] || false;
                  
                  return (
                    <div key={worker.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <h4 className="font-medium">{worker.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Staff ID: {worker.staffId}
                            </p>
                          </div>
                          <Badge variant={worker.isActive ? "default" : "secondary"}>
                            {worker.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge variant={isEnabled ? "default" : "outline"}>
                          {isEnabled ? "CheckBox Enabled" : "CheckBox Disabled"}
                        </Badge>
                        
                        <div className="flex items-center space-x-2">
                          <Label htmlFor={`worker-${worker.id}`} className="text-sm">
                            CheckBox Permission
                          </Label>
                          <Switch
                            id={`worker-${worker.id}`}
                            checked={isEnabled}
                            disabled={isLoading}
                            onCheckedChange={() => handleToggleWorkerPermission(worker.id, isEnabled)}
                            data-testid={`worker-permission-${worker.id}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {workers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No workers found in the system.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>About CheckBox Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Workers with CheckBox permission can verify completed boxes by scanning items</p>
              <p>• Only completed boxes (100% scanned) show the CheckBox button</p>
              <p>• Managers and supervisors always have CheckBox access</p>
              <p>• CheckBox sessions track discrepancies and provide quality assurance reports</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}