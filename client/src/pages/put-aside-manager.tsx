import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  Search, 
  Filter, 
  ArrowRight,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PutAsideItem {
  id: string;
  jobId: string;
  barCode: string;
  productName: string;
  customerName: string;
  originalBoxNumber: number;
  quantity: number;
  status: 'pending' | 'reallocated';
  putAsideBy: string;
  putAsideAt: string;
  reallocatedBy?: string;
  reallocatedAt?: string;
  reallocatedToBoxNumber?: number;
  sourceEventId?: string;
  // Additional fields from join
  jobName?: string;
  putAsideWorkerName?: string;
}

interface Job {
  id: string;
  name: string;
  status: string;
}

export function PutAsideManagerPage() {
  const [, navigate] = useLocation();
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<PutAsideItem | null>(null);
  const [reallocationBoxNumber, setReallocationBoxNumber] = useState<string>('');
  const [showReallocationDialog, setShowReallocationDialog] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all jobs for filter dropdown
  const { data: jobsData } = useQuery({
    queryKey: ['/api/jobs'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch put aside items based on filters
  const { data: putAsideData, isLoading, refetch } = useQuery({
    queryKey: [`/api/jobs/${selectedJob}/put-aside`, statusFilter],
    queryFn: () => {
      const url = selectedJob === 'all' 
        ? `/api/put-aside/all${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`
        : `/api/jobs/${selectedJob}/put-aside${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`;
      return fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      }).then(res => res.json());
    },
    enabled: !!user && (user.role === 'manager' || user.role === 'supervisor'),
    refetchInterval: 10000 // Refresh every 10 seconds for real-time updates
  });

  // Reallocate mutation
  const reallocationMutation = useMutation({
    mutationFn: async ({ itemId, targetBoxNumber }: { itemId: string; targetBoxNumber: number }) => {
      return apiRequest('POST', `/api/put-aside/${itemId}/reallocate`, {
        targetBoxNumber
      });
    },
    onSuccess: () => {
      toast({
        title: "Item Reallocated",
        description: "The put aside item has been successfully reallocated."
      });
      
      // Refresh data
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      
      // Close dialog
      setShowReallocationDialog(false);
      setSelectedItem(null);
      setReallocationBoxNumber('');
    },
    onError: (error: any) => {
      toast({
        title: "Reallocation Failed",
        description: error.message || "Failed to reallocate the item. Please try again.",
        variant: "destructive"
      });
    }
  });

  if (!user || (user.role !== 'manager' && user.role !== 'supervisor')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Only managers and supervisors can access the Put Aside Manager.
          </p>
        </div>
      </div>
    );
  }

  const jobs: Job[] = (jobsData as any)?.jobs || [];
  const putAsideItems: PutAsideItem[] = (putAsideData as any)?.items || [];

  // Filter items based on search term
  const filteredItems = putAsideItems.filter(item =>
    item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barCode.includes(searchTerm) ||
    item.putAsideWorkerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.jobName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group items by status
  const itemsByStatus = filteredItems.reduce((acc: Record<string, PutAsideItem[]>, item) => {
    if (!acc[item.status]) {
      acc[item.status] = [];
    }
    acc[item.status].push(item);
    return acc;
  }, {});

  // Statistics
  const stats = {
    total: putAsideItems.length,
    pending: (itemsByStatus.pending || []).length,
    reallocated: (itemsByStatus.reallocated || []).length,
    pendingValue: putAsideItems.filter(item => item.status === 'pending').reduce((sum, item) => sum + item.quantity, 0)
  };

  const handleReallocation = (item: PutAsideItem) => {
    setSelectedItem(item);
    setReallocationBoxNumber('');
    setShowReallocationDialog(true);
  };

  const confirmReallocation = () => {
    if (!selectedItem || !reallocationBoxNumber) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid box number.",
        variant: "destructive"
      });
      return;
    }

    const boxNumber = parseInt(reallocationBoxNumber);
    if (isNaN(boxNumber) || boxNumber <= 0) {
      toast({
        title: "Invalid Box Number",
        description: "Box number must be a positive integer.",
        variant: "destructive"
      });
      return;
    }

    reallocationMutation.mutate({
      itemId: selectedItem.id,
      targetBoxNumber: boxNumber
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'reallocated':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800">Pending</Badge>;
      case 'reallocated':
        return <Badge className="bg-green-100 text-green-800">Reallocated</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-pulse" />
              <p className="text-gray-600 dark:text-gray-400">Loading put aside items...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Put Aside Manager
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage items that have been put aside during scanning operations
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => refetch()}
            className="flex items-center gap-2"
            data-testid="refresh-button"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Items</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.pending}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.reallocated}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Reallocated</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.pendingValue}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Pending Qty</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              
              {/* Job Filter */}
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Job Filter</label>
                <Select value={selectedJob} onValueChange={setSelectedJob}>
                  <SelectTrigger data-testid="job-filter">
                    <SelectValue placeholder="Select a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name || job.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Status Filter</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="status-filter">
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reallocated">Reallocated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="flex-2">
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search items, customers, workers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedJob('all');
                    setStatusFilter('all');
                    setSearchTerm('');
                  }}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        <Tabs value="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list">
              Items List ({filteredItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No put aside items found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {searchTerm || selectedJob !== 'all' || statusFilter !== 'all'
                        ? 'No items match your current filters.'
                        : 'No items have been put aside yet.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredItems.map(item => (
                  <Card 
                    key={item.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        
                        {/* Item Details */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(item.status)}
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {item.productName}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {item.barCode}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Customer:</span>
                              <p className="text-gray-600 dark:text-gray-400">{item.customerName}</p>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Original Box:</span>
                              <p className="text-gray-600 dark:text-gray-400">{item.originalBoxNumber}</p>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Quantity:</span>
                              <p className="text-gray-600 dark:text-gray-400">{item.quantity}</p>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Job:</span>
                              <p className="text-gray-600 dark:text-gray-400">{item.jobName || item.jobId}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {item.putAsideWorkerName || 'Unknown'}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(item.putAsideAt).toLocaleString()}
                            </div>
                          </div>

                          {item.status === 'reallocated' && item.reallocatedToBoxNumber && (
                            <div className="bg-green-50 border border-green-200 p-2 rounded text-sm">
                              <strong>Reallocated to Box {item.reallocatedToBoxNumber}</strong>
                              {item.reallocatedAt && (
                                <span className="text-green-600 ml-2">
                                  on {new Date(item.reallocatedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {getStatusBadge(item.status)}
                          
                          {item.status === 'pending' && (
                            <Button
                              onClick={() => handleReallocation(item)}
                              className="flex items-center gap-1"
                              size="sm"
                              data-testid={`reallocate-${item.id}`}
                            >
                              <ArrowRight className="h-3 w-3" />
                              Reallocate
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Reallocation Dialog */}
      <Dialog open={showReallocationDialog} onOpenChange={setShowReallocationDialog}>
        <DialogContent data-testid="reallocation-dialog">
          <DialogHeader>
            <DialogTitle>Reallocate Put Aside Item</DialogTitle>
            <DialogDescription>
              Assign this item to a specific box number for continued processing.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                <h4 className="font-medium">{selectedItem.productName}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customer: {selectedItem.customerName} | Qty: {selectedItem.quantity}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Target Box Number
                </label>
                <Input
                  type="number"
                  placeholder="Enter box number (e.g., 15)"
                  value={reallocationBoxNumber}
                  onChange={(e) => setReallocationBoxNumber(e.target.value)}
                  min="1"
                  data-testid="target-box-input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The item will be allocated to this box and become available for scanning
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowReallocationDialog(false)}
                  disabled={reallocationMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmReallocation}
                  disabled={reallocationMutation.isPending || !reallocationBoxNumber}
                  data-testid="confirm-reallocation"
                >
                  {reallocationMutation.isPending ? 'Reallocating...' : 'Reallocate Item'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}