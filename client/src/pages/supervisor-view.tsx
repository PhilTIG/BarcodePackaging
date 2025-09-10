import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Settings, LogOut, Users, Package, ChevronLeft, FileBarChart } from "lucide-react";
import { CustomerBoxGrid } from "@/components/customer-box-grid";
import { PerformanceDashboard } from "@/components/performance-dashboard";
import { ExtraItemsModal } from "@/components/extra-items-modal";
import { CustomerQueueModal } from "@/components/customer-queue-modal";
import { CustomerProgressModal } from "@/components/customer-progress-modal";
import { NonScannedReportModal } from "@/components/non-scanned-report-modal";
import { ItemFilter } from "@/components/item-filter";
import { GroupFilter } from "@/components/group-filter";
import { useFilteredBoxData } from "@/hooks/use-filtered-box-data";
import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

// Put Aside Modal Component (without Allocate to Box button)
function PutAsideModal({
  isOpen,
  onClose,
  jobId
}: {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}) {
  const { data: putAsideData, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/put-aside`],
    enabled: !!jobId && isOpen,
    refetchInterval: 5000, // 5-second polling for real-time updates
  });

  const putAsideItems = (putAsideData as any)?.items || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Package className="h-5 w-5" />
            Put Aside Items ({putAsideItems.length})
          </DialogTitle>
          <DialogDescription>
            Items waiting for automatic allocation when workers scan matching barcodes
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500">Loading put aside items...</div>
            </div>
          ) : putAsideItems.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500">No put aside items found</div>
            </div>
          ) : (
            putAsideItems.map((item: any, index: number) => (
              <Card key={index} className="border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-sm bg-orange-100 px-2 py-1 rounded">
                      {item.barCode}
                    </div>
                    <div className="font-medium">{item.productName}</div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      Qty: {item.qty}
                    </Badge>
                  </div>
                  <div className="text-xs text-orange-600 mt-2">
                    Will be allocated automatically when workers scan matching barcode
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SupervisorView() {
  const { jobId } = useParams();
  const [, setLocation] = useLocation();
  const { user, isLoading, logout } = useAuth();
  const [isExtraItemsModalOpen, setIsExtraItemsModalOpen] = useState(false);
  const [isCustomerQueueModalOpen, setIsCustomerQueueModalOpen] = useState(false);
  const [isPutAsideModalOpen, setIsPutAsideModalOpen] = useState(false);
  const [isCustomerProgressModalOpen, setIsCustomerProgressModalOpen] = useState(false);
  const [isNonScannedReportOpen, setIsNonScannedReportOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  // Fetch all jobs for supervisor (job selection) with real-time updates
  const { data: allJobsData } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: !!user && !jobId,
    refetchInterval: 10000, // 10-second polling for consistent real-time updates
  });

  // Fetch job details
  const { data: jobData } = useQuery({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId && !!user,
  });

  // Fetch job progress
  const { data: progressData } = useQuery({
    queryKey: ["/api/jobs", jobId, "progress"],
    enabled: !!jobId && !!user,
    refetchInterval: 10000, // Reduced from 5s to 10s for better performance
  });

  // Fetch Put Aside count - WebSocket updates only
  const { data: putAsideData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/put-aside/count`],
    enabled: !!jobId && !!user,
    // REMOVED: refetchInterval polling - WebSocket provides real-time updates
  });

  // Fetch non-scanned items count for button
  const { data: nonScannedData } = useQuery({
    queryKey: ['/api/jobs', jobId, 'non-scanned-report'],
    enabled: !!jobId && !!user,
    refetchInterval: 5000, // Real-time updates for button count
  });

  // Connect to WebSocket for real-time updates 
  const { isConnected } = useWebSocket(jobId);

  // Get available products and groups for filtering (always fetch when job is available)
  const { availableProducts, availableGroups } = useFilteredBoxData(jobId || "", [], []);

  // Check for session conflicts - WebSocket updates only
  const { data: sessionData } = useQuery({
    queryKey: ["/api/check-sessions"],
    queryFn: async () => {
      const response = await fetch("/api/check-sessions");
      return response.json();
    },
    enabled: !!user && (user.role === 'supervisor' || user.role === 'manager'),
    // REMOVED: refetchInterval polling - WebSocket provides real-time updates
  });

  // Redirect if not authenticated or not a supervisor/manager
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
      return;
    }
    if (user && !["supervisor", "manager"].includes(user.role)) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  // This check is now redundant due to the useEffect hook above, but kept for clarity.
  // The useEffect ensures we navigate away before this point if not authenticated.
  if (!user || (user.role !== "supervisor" && user.role !== "manager")) {
     return null;
  }

  // Show job selection interface when no jobId
  if (!jobId) {
    if (isLoading || !allJobsData) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading jobs...</p>
          </div>
        </div>
      );
    }

    const jobs = (allJobsData as any)?.jobs || [];
    // Supervisors can see all jobs regardless of status
    const visibleJobs = jobs;

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-primary-100 w-10 h-10 rounded-lg flex items-center justify-center">
                  <Settings className="text-primary-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Supervisor Dashboard</h1>
                  <p className="text-sm text-gray-600">Select a job to monitor</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/settings")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <div className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm font-medium">
                  {user.staffId}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout();
                    setLocation("/login");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Available Jobs</h2>
              <p className="text-sm text-gray-600">
                Monitor progress, assign workers, and track performance
              </p>
            </div>

            {visibleJobs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="bg-gray-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Package className="text-gray-400 w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Jobs Available</h3>
                  <p className="text-gray-600">No jobs are currently available for monitoring.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {visibleJobs.map((job: any) => {
                  // Progress calculation: job.completedItems includes ALL customer items (allocated + unallocated)
                  const completionPercentage = Math.round((job.completedItems / job.totalProducts) * 100);
                  const assignedWorkers = job.assignments || [];

                  return (
                    <Card key={job.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div
                          className="flex items-center justify-between"
                          onClick={() => setLocation(`/supervisor/${job.id}`)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {job.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={job.status === 'active' ? "default" : job.status === 'pending' ? "secondary" : "outline"}
                                    className="text-xs"
                                  >
                                    {job.status}
                                  </Badge>
                                  {job.status !== 'completed' && !job.isActive && (
                                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                      Paused
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Badge
                                variant={completionPercentage === 100 ? "default" : "secondary"}
                                className="ml-2"
                              >
                                {completionPercentage}% Complete
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-gray-600">Total Items</p>
                                <p className="text-lg font-semibold text-gray-900">{job.totalProducts}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Assigned Workers</p>
                                <div className="flex items-center gap-1 mt-1">
                                  {assignedWorkers.slice(0, 3).map((assignment: any, index: number) => (
                                    <div
                                      key={assignment.id}
                                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                                      style={{ backgroundColor: assignment.assignedColor }}
                                      title={assignment.assignee?.name}
                                    />
                                  ))}
                                  {assignedWorkers.length > 3 && (
                                    <span className="text-xs text-gray-500 ml-1">
                                      +{assignedWorkers.length - 3} more
                                    </span>
                                  )}
                                  {assignedWorkers.length === 0 && (
                                    <span className="text-sm text-gray-500">None assigned</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Progress</p>
                                <Progress 
                                  value={completionPercentage} 
                                  className="h-2 mt-1" 
                                  data-testid={`job-progress-${job.id}`}
                                />
                              </div>
                            </div>
                          </div>
                          <Button size="sm" className="ml-4">
                            Monitor
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!(jobData as any)?.job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  const { job, products } = jobData as any;
  const progress = (progressData as any)?.progress;
  // Progress calculation: job.completedItems includes ALL customer items (allocated + unallocated)
  const completionPercentage = Math.round((job.completedItems / job.totalProducts) * 100);
  
  // Conditional logic for Put Aside and Customer Queue interfaces
  const boxLimit = job?.boxLimit;
  const totalCustomers = progress?.totalCustomers || job.totalCustomers || 0;
  const shouldShowLimitedBoxInterfaces = boxLimit && (boxLimit < totalCustomers);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Navigate back to correct dashboard based on user role
                  if (user?.role === "manager") {
                    setLocation("/manager");
                  } else {
                    setLocation("/supervisor");
                  }
                }}
                data-testid="button-back"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="bg-primary-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Users className="text-primary-600" />
              </div>
              <div className="flex-1 mx-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Job Monitor</h1>
                    <p className="text-sm text-gray-600">{job.name}</p>
                  </div>

                  {/* Filters - Same row as title */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <ItemFilter
                      availableProducts={availableProducts}
                      selectedProducts={selectedProducts}
                      onSelectionChange={setSelectedProducts}
                      placeholder="Filter by product name..."
                    />
                    <GroupFilter
                      availableGroups={availableGroups || []}
                      selectedGroups={selectedGroups}
                      onSelectionChange={setSelectedGroups}
                      placeholder="Filter by group..."
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNonScannedReportOpen(true)}
                      className="flex items-center gap-2"
                      data-testid="non-scanned-report-button"
                      disabled={(nonScannedData as any)?.summary?.totalRequired === 0}
                    >
                      <FileBarChart className="w-4 h-4" />
                      {(nonScannedData as any)?.summary?.totalRequired !== undefined 
                        ? `${(nonScannedData as any).summary.totalRequired} Required`
                        : 'Loading...'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-medium text-gray-900">{completionPercentage}% Complete</p>
              <p className="text-xs text-gray-600">
                {job.completedItems} of {job.totalProducts} items
              </p>
              <div className="flex items-center mt-1">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-gray-600'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Overall Progress */}
        <Card data-testid="overall-progress">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Progress</CardTitle>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-gray-600">Active ({progress?.activeSessions || 0})</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                  <span className="text-gray-600">Waiting ({progress?.waitingSessions || 0})</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercentage} className="h-4 mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Items: {job.completedItems}/{job.totalProducts}</span>
                <div className="text-xs text-gray-500">({completionPercentage}% complete)</div>
              </div>
              <div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-auto p-2 flex flex-col items-start"
                  onClick={() => setIsCustomerProgressModalOpen(true)}
                  data-testid="button-customer-progress"
                >
                  <span className="text-gray-600">Customer Progress ({progress?.completedCustomers || 0}/{progress?.totalCustomers || job.totalCustomers})</span>
                  <div className="text-xs text-gray-500">({progress?.customerCompletionPercentage || 0}% complete)</div>
                </Button>
              </div>
              <div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-auto p-2 flex flex-col items-start"
                  onClick={() => setIsExtraItemsModalOpen(true)}
                  data-testid="button-extra-items"
                >
                  <span className="text-gray-600">Extra Items: {progress?.extraItemsCount || 0}</span>
                  <div className="text-xs text-gray-500">Click to view details</div>
                </Button>
              </div>

              {/* Put Aside Button - Only show when box limit < total customers */}
              {shouldShowLimitedBoxInterfaces && (
                <div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-auto p-2 flex flex-col items-start border-orange-500 text-orange-600 hover:bg-orange-50"
                    onClick={() => setIsPutAsideModalOpen(true)}
                    data-testid="button-put-aside"
                  >
                    <span className="text-orange-600">Put Aside: {(putAsideData as any)?.count || 0}</span>
                    <div className="text-xs text-orange-500">Items to allocate</div>
                  </Button>
                </div>
              )}

              {/* Customer Queue Button - Only show when box limit < total customers */}
              {shouldShowLimitedBoxInterfaces && (
                <div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-auto p-2 flex flex-col items-start"
                    onClick={() => setIsCustomerQueueModalOpen(true)}
                    data-testid="button-customer-queue"
                  >
                    <span className="text-gray-600">Customer Queue: {progress?.unallocatedCustomers || 0}</span>
                    <div className="text-xs text-gray-500">Unallocated customers</div>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Boxes Grid */}
        <Card data-testid="customer-boxes">
          <CardHeader>
            <CardTitle>Customer Boxes</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerBoxGrid
              products={products}
              jobId={job.id}
              supervisorView={true}
              filterByProducts={selectedProducts}
              filterByGroups={selectedGroups}
              onCheckCount={(boxNumber, jobId) => {
                // Navigate to dedicated CheckCount page
                setLocation(`/check-count/${jobId}/${boxNumber}`);
              }}
            />
          </CardContent>
        </Card>

        {/* Worker Performance */}
        <Card data-testid="worker-performance">
          <CardHeader>
            <CardTitle>Worker Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceDashboard
              jobId={job.id}
              supervisorView={true}
            />
          </CardContent>
        </Card>

        {/* Job Statistics */}
        <Card data-testid="job-statistics">
          <CardHeader>
            <CardTitle>Job Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{job.totalProducts}</div>
                <p className="text-sm text-gray-600">Total Products</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{job.totalCustomers}</div>
                <p className="text-sm text-gray-600">Customers</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600">{job.completedItems}</div>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning-600">{job.totalProducts - job.completedItems}</div>
                <p className="text-sm text-gray-600">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extra Items Modal */}
      <ExtraItemsModal 
        isOpen={isExtraItemsModalOpen}
        onClose={() => setIsExtraItemsModalOpen(false)}
        jobId={jobId!}
      />

      {/* BOX LIMIT: Customer Queue Modal */}
      <CustomerQueueModal 
        isOpen={isCustomerQueueModalOpen}
        onClose={() => setIsCustomerQueueModalOpen(false)}
        jobId={jobId!}
        jobName={job?.name}
      />

      {/* Put Aside Modal */}
      <PutAsideModal
        isOpen={isPutAsideModalOpen}
        onClose={() => setIsPutAsideModalOpen(false)}
        jobId={jobId!}
      />

      {/* Customer Progress Modal */}
      <CustomerProgressModal
        isOpen={isCustomerProgressModalOpen}
        onClose={() => setIsCustomerProgressModalOpen(false)}
        jobId={jobId!}
        jobName={job?.name}
      />

      {/* Non Scanned Report Modal */}
      <NonScannedReportModal
        isOpen={isNonScannedReportOpen}
        onClose={() => setIsNonScannedReportOpen(false)}
        jobId={jobId!}
        jobName={job?.name}
      />

    </div>
  );
}