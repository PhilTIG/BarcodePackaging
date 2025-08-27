import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useErrorContext } from "@/lib/error-context";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Package, Settings, LogOut, CloudUpload, Eye, Users, Download, Plus, ChevronDown, UserPlus, Palette, Trash2, Archive, Box } from "lucide-react";
import { ExtraItemsModal } from "@/components/extra-items-modal";
import { QASummaryPanel } from "@/components/qa-summary-panel";
import { z } from "zod";
import { assignWorkerPattern, getDefaultWorkerColors, type WorkerAllocationPattern } from "../../../lib/worker-allocation";

const uploadFormSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  jobTypeId: z.string().min(1, "Job type is required"),
  description: z.string().optional(),
  boxLimit: z.string().optional().refine((val) => {
    if (!val || val === "") return true; // Optional field
    const num = parseInt(val);
    return !isNaN(num) && num > 0;
  }, "Box limit must be a positive number"),
  file: z.instanceof(File).optional(),
});

type UploadForm = z.infer<typeof uploadFormSchema>;

// Component for Extra Items, Put Aside, and Boxes Complete buttons
function ExtraItemsAndBoxesButtons({
  jobId,
  onExtraItemsClick,
  onBoxesCompleteClick,
  onPutAsideClick
}: {
  jobId: string;
  onExtraItemsClick: () => void;
  onBoxesCompleteClick: () => void;
  onPutAsideClick: () => void;
}) {
  // Connect to WebSocket for real-time updates (same as Job Monitoring)
  const { isConnected } = useWebSocket(jobId);

  // Use single /progress endpoint for consistent real-time data (same as Job Monitoring)
  const { data: progressData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/progress`],
    enabled: !!jobId,
    refetchInterval: 5000, // 5-second polling as requested
  });

  // Fetch Put Aside count separately
  const { data: putAsideData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/put-aside/count`],
    enabled: !!jobId,
    refetchInterval: 5000, // 5-second polling for real-time updates
  });

  // Extract consistent data from progress endpoint (matches SupervisorView)
  const extraItemsCount = (progressData as any)?.progress?.extraItemsCount || 0;
  const completedCustomers = (progressData as any)?.progress?.completedCustomers || 0;
  const totalCustomers = (progressData as any)?.progress?.totalCustomers || 0;
  const jobHasBoxLimit = (progressData as any)?.job?.boxLimit != null; // Check if job has box limit
  const putAsideCount = (putAsideData as any)?.count || 0;

  return (
    <>
      {/* Extra Items Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onExtraItemsClick}
        data-testid={`button-extra-items-${jobId}`}
      >
        <Package className="mr-1 h-4 w-4" />
        {extraItemsCount} Extra Items
      </Button>

      {/* Put Aside Button - Only show when job has box limit */}
      {jobHasBoxLimit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onPutAsideClick}
          className="border-orange-500 text-orange-600 hover:bg-orange-50"
          data-testid={`button-put-aside-${jobId}`}
        >
          <Package className="mr-1 h-4 w-4" />
          {putAsideCount} Put Aside
        </Button>
      )}

      {/* Boxes Complete Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onBoxesCompleteClick}
        data-testid={`button-boxes-complete-${jobId}`}
      >
        <Box className="mr-1 h-4 w-4" />
        {completedCustomers}/{totalCustomers} Customers
      </Button>
    </>
  );
}

// Component for Completed Boxes Modal
function CompletedBoxesModal({
  isOpen,
  onClose,
  jobId
}: {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
}) {
  // Use same real-time progress endpoint as Job Monitoring
  const { data: progressData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/progress`],
    enabled: !!jobId && isOpen,
    refetchInterval: 5000, // 5-second polling for consistency
  });

  // Get completed boxes from progress data - now includes products array
  const products = (progressData as any)?.products || [];

  // Group by customer and check if all items in customer's box are complete
  const boxMap = new Map<string, {
    customerName: string;
    boxNumber: number;
    totalQty: number;
    scannedQty: number;
    isComplete: boolean;
  }>();

  products.forEach((product: any) => {
    const key = `${product.customerName}-${product.boxNumber}`;
    if (!boxMap.has(key)) {
      boxMap.set(key, {
        customerName: product.customerName,
        boxNumber: product.boxNumber,
        totalQty: 0,
        scannedQty: 0,
        isComplete: true
      });
    }
    const box = boxMap.get(key)!;
    box.totalQty += product.qty;
    box.scannedQty += product.scannedQty;
    box.isComplete = box.isComplete && product.isComplete;
  });

  const completedBoxes = Array.from(boxMap.values()).filter(box => box.isComplete);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Completed Boxes</DialogTitle>
          <DialogDescription>
            List of all completed boxes showing item counts
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {completedBoxes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No completed boxes found.
            </div>
          ) : (
            <div className="space-y-2">
              {completedBoxes
                .sort((a: any, b: any) => a.boxNumber - b.boxNumber)
                .map((box: any, index: number) => (
                  <div key={`${box.customerName}-${box.boxNumber}`} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-green-50">
                    <div>
                      <div className="font-medium">Box {box.boxNumber}</div>
                      <div className="text-sm text-gray-600">{box.customerName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{box.scannedQty}/{box.totalQty} items</div>
                      <div className="text-xs text-gray-500">100% Complete</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Component for Put Aside Modal
function PutAsideModal({
  isOpen,
  onClose,
  jobId
}: {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
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

export default function ManagerDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logout, isLoading } = useAuth();
  const { formatError, getErrorDetails } = useErrorContext();
  const [uploadSuccess, setUploadSuccess] = useState<{
    productsCount: number;
    customersCount: number;
    job: any;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [currentError, setCurrentError] = useState<any>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isExtraItemsModalOpen, setIsExtraItemsModalOpen] = useState(false);
  const [extraItemsJobId, setExtraItemsJobId] = useState<string | null>(null);
  const [isPutAsideModalOpen, setIsPutAsideModalOpen] = useState(false);
  const [putAsideJobId, setPutAsideJobId] = useState<string | null>(null);
  const [isCompletedBoxesModalOpen, setIsCompletedBoxesModalOpen] = useState(false);
  const [completedBoxesJobId, setCompletedBoxesJobId] = useState<string | null>(null);

  // Assignment form state
  const [assignForm, setAssignForm] = useState({
    userId: "",
    assignedColor: "#3B82F6", // Default blue
  });

  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      name: "",
      jobTypeId: "",
      description: "",
      boxLimit: "",
    },
  });

  // Fetch jobs with WebSocket real-time updates
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: !!user,
    refetchInterval: 5000, // 5-second polling as fallback
  });

  // Connect to WebSocket for real-time updates on all active jobs
  useWebSocket();

  // Fetch users for assignment
  const { data: workersData } = useQuery({
    queryKey: ["/api/users?role=worker"],
    enabled: !!user,
  });

  // Fetch job types for upload form
  const { data: jobTypesData } = useQuery({
    queryKey: ["/api/job-types"],
    enabled: !!user,
  });

  // Upload CSV mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: UploadForm & { file: File }) => {
      const formData = new FormData();
      formData.append("csv", data.file);
      formData.append("name", data.name);
      formData.append("jobTypeId", data.jobTypeId);
      formData.append("description", data.description || "");
      if (data.boxLimit && data.boxLimit.trim()) {
        formData.append("boxLimit", data.boxLimit.trim());
      }

      const response = await apiRequest("POST", "/api/jobs", formData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploadSuccess({
        productsCount: data.productsCount,
        customersCount: data.customersCount,
        job: data.job
      });
      form.reset();
      setSelectedFile(null); // Clear selected file on success
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      
      // Show warning if box limit is less than 80% of customers
      if (data.warning) {
        toast({
          title: "CSV uploaded with warning",
          description: data.warning,
          variant: "destructive",
        });
      } else {
        toast({
          title: "CSV uploaded successfully",
          description: `${data.productsCount} products loaded for ${data.customersCount} customers`,
        });
      }
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      setCurrentError(error);

      const errorDetails = getErrorDetails(error);
      const formattedMessage = formatError(error, "Please check your CSV format and try again");

      // If there are more than 3 errors and detailed mode is enabled, show "More..." option
      if (errorDetails.length > 3) {
        toast({
          title: "CSV Upload Failed",
          description: formattedMessage,
          variant: "destructive",
          action: (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setErrorDialogOpen(true)}
              data-testid="button-more-errors"
            >
              More...
            </Button>
          ),
        });
      } else {
        toast({
          title: "CSV Upload Failed",
          description: formattedMessage,
          variant: "destructive",
        });
      }
    },
  });

  // Job status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });

  // Multi-Worker Assignment mutation with automatic pattern assignment
  const assignWorkerMutation = useMutation({
    mutationFn: async (data: { jobId: string; userId: string; assignedColor: string }) => {
      // Get current job assignments to determine worker count and pattern
      const jobsResponse = await apiRequest("GET", "/api/jobs");
      const jobsData = await jobsResponse.json();
      const currentJob = jobsData.jobs?.find((job: any) => job.id === data.jobId);
      const currentAssignments = currentJob?.assignments || [];

      // Automatically assign allocation pattern based on assignment order (chronological)
      const workerIndex = currentAssignments.length;
      const allocationPattern = assignWorkerPattern(workerIndex);

      const response = await apiRequest("POST", `/api/jobs/${data.jobId}/assign`, {
        userId: data.userId,
        assignedColor: data.assignedColor,
        allocationPattern,
        workerIndex,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setAssignDialogOpen(false);
      setAssignForm({ userId: "", assignedColor: "#3B82F6" });
      toast({
        title: "Worker assigned successfully",
        description: `Worker assigned with ${data.assignment?.allocationPattern || 'ascending'} box allocation pattern`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment failed",
        description: error.message || "Failed to assign worker to job",
        variant: "destructive",
      });
    },
  });

  // Worker unassignment mutation
  const unassignWorkerMutation = useMutation({
    mutationFn: async (data: { jobId: string; userId: string }) => {
      const response = await apiRequest("DELETE", `/api/jobs/${data.jobId}/assign/${data.userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Worker unassigned successfully",
        description: "The worker has been removed from the job",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unassignment failed",
        description: error.message || "Failed to unassign worker from job",
        variant: "destructive",
      });
    },
  });

  // Handle unassign worker action
  const handleUnassignWorker = (jobId: string, userId: string) => {
    unassignWorkerMutation.mutate({ jobId, userId });
  };

  // Toggle job active status mutation for scanning control
  const toggleJobActiveMutation = useMutation({
    mutationFn: async ({ jobId, isActive }: { jobId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}/active`, {
        isActive,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Scanning control updated",
        description: "Job scanning status has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle job active toggle
  const handleJobActiveToggle = (jobId: string, isActive: boolean) => {
    toggleJobActiveMutation.mutate({ jobId, isActive });
  };

  // Remove job mutation
  const removeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("DELETE", `/api/jobs/${jobId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job removed successfully",
        description: "The job and all its data have been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove job",
        description: error.message || "Unable to remove the job",
        variant: "destructive",
      });
    },
  });

  // Handle job removal
  const handleRemoveJob = (jobId: string) => {
    if (confirm("Are you sure you want to remove this job? This action cannot be undone.")) {
      removeJobMutation.mutate(jobId);
    }
  };

  // Handle job archiving
  const archiveJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest('POST', `/api/jobs/${jobId}/archive`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/archives'] });
      toast({
        title: "Success",
        description: "Job archived successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive job",
        variant: "destructive",
      });
    }
  });

  const handleArchiveJob = (jobId: string) => {
    if (confirm("Are you sure you want to archive this job? It will be moved to the archives with a comprehensive summary.")) {
      archiveJobMutation.mutate(jobId);
    }
  };

  // Handle assignment form submission
  const handleAssignWorker = () => {
    if (!selectedJobId || !assignForm.userId) {
      toast({
        title: "Assignment incomplete",
        description: "Please select a worker to assign",
        variant: "destructive",
      });
      return;
    }

    assignWorkerMutation.mutate({
      jobId: selectedJobId,
      userId: assignForm.userId,
      assignedColor: assignForm.assignedColor,
    });
  };

  const onSubmit = (data: UploadForm) => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }

    // Basic file validation
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file format",
        description: "Please select a .csv file",
        variant: "destructive",
      });
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File too large",
        description: "CSV file must be smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Uploading CSV...",
      description: "Validating and processing your file",
    });

    uploadMutation.mutate({
      ...data,
      file: selectedFile,
    });
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  // Redirect if not authenticated or not a manager
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
      return;
    }
    if (user && user.role !== "manager") {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (!user || user.role !== "manager") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Package className="text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Manager Dashboard</h1>
                <p className="text-sm text-gray-600">Welcome back, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/archives")}
                data-testid="button-archives"
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/settings")}
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <div className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm font-medium">
                {user.staffId}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* CSV Upload Section or Success Display */}
        <Card data-testid="upload-section">
          {uploadSuccess ? (
            // Success Banner
            <CardContent className="p-6">
              <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-green-50 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-green-800">CSV Loaded Successfully</h3>
                </div>
                <p className="text-green-700 mb-4">
                  {uploadSuccess.productsCount} products, {uploadSuccess.customersCount} customers
                </p>
                <div className="flex justify-center space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setUploadSuccess(null)}
                    data-testid="button-upload-new"
                  >
                    Upload New CSV
                  </Button>
                  <Button
                    onClick={() => setLocation(`/supervisor/${uploadSuccess.job.id}`)}
                    data-testid="button-monitor-job"
                  >
                    Monitor Job
                  </Button>
                </div>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Upload New Job</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Form Fields Row - Responsive */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter job name" data-testid="input-job-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="jobTypeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-job-type">
                                  <SelectValue placeholder="Select a job type..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(jobTypesData as any)?.jobTypes?.map((jobType: any) => (
                                  <SelectItem key={jobType.id} value={jobType.id}>
                                    {jobType.name} ({jobType.benchmarkItemsPerHour} items/hr)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="boxLimit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Box Limit</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                min="1" 
                                placeholder="No Limit" 
                                data-testid="input-box-limit" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter job description" data-testid="input-job-description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* File Selection and CSV Format Requirements Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          id="csv-upload"
                          data-testid="input-csv-file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            setSelectedFile(file || null);
                          }}
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById("csv-upload")?.click()}
                            data-testid="button-select-file"
                            className="w-full md:w-auto"
                          >
                            <CloudUpload className="mr-2 h-4 w-4" />
                            {selectedFile ? selectedFile.name : "Select File"}
                          </Button>
                          {selectedFile && (
                            <p className="text-xs text-green-600 flex-1 ml-1">
                              ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* CSV Format Guide - Collapsible */}
                      <div>
                        <Collapsible defaultOpen={false}>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-blue-900">CSV Format Requirements</h4>
                                <ChevronDown className="h-4 w-4 text-blue-600 transition-transform duration-200 data-[state=open]:rotate-180" />
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent className="mt-2">
                              <p className="text-blue-800 text-sm mb-3">Your CSV file must contain these exact column headers:</p>
                              <div className="bg-white border border-blue-200 rounded text-xs p-2 font-mono mb-3">
                                BarCode,Product Name,Qty,CustomName,Group
                              </div>
                              <div className="text-blue-700 text-sm space-y-1">
                                <p><strong>BarCode:</strong> Product barcode (required)</p>
                                <p><strong>Product Name:</strong> Name of the product (required)</p>
                                <p><strong>Qty:</strong> Quantity as a positive number (required)</p>
                                <p><strong>CustomName:</strong> Customer destination name (required)</p>
                                <p><strong>Group:</strong> Product grouping (optional)</p>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      </div>
                    </div>



                    <Button
                      type="submit"
                      disabled={uploadMutation.isPending}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      data-testid="button-upload"
                    >
                      {uploadMutation.isPending ? "Uploading..." : "Create Job"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </>
          )}
        </Card>

        {/* Active Jobs */}
        <Card data-testid="active-jobs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Jobs</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/archives")}
                className="flex items-center gap-2"
                data-testid="button-archives-inline"
              >
                <Archive className="h-4 w-4" />
                Archives
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-2 bg-gray-200 rounded mb-2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(jobsData as any)?.jobs?.map((job: any) => {
                  const progressPercentage = Math.round((job.completedItems / job.totalProducts) * 100);
                  const isCompleted = progressPercentage === 100;

                  return (
                    <div
                      key={job.id}
                      className={`border border-gray-200 rounded-lg p-4 relative ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}
                      data-testid={`job-card-${job.id}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{job.name}</h3>
                          <p className="text-sm text-gray-600">
                            {job.totalProducts} products, {job.totalCustomers} customers
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "default"
                                : job.status === "active"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {job.status === "completed" ? "Completed" : job.status === "active" ? "In Progress" : "Pending"}
                          </Badge>
                          <Button
                            variant={
                              job.status === "completed" 
                                ? (job.isActive ? "default" : "outline") 
                                : (job.isActive ? "default" : "outline")
                            }
                            size="sm"
                            onClick={() => handleJobActiveToggle(job.id, !job.isActive)}
                            className="h-6 px-2 text-xs font-medium"
                            data-testid={`button-toggle-scanning-${job.id}`}
                          >
                            {job.status === "completed" 
                              ? (job.isActive ? "Lock Job" : "Locked") 
                              : (job.isActive ? "Scanning Active" : "Scanning Paused")
                            }
                          </Button>
                          <span className="text-sm text-gray-600">Created: {new Date(job.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Progress Bar with Percentage */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                          <span>Progress - {progressPercentage}% complete</span>
                          <div className="flex flex-col items-end">
                            {progressPercentage === 0 ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="mt-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveJob(job.id);
                                }}
                                data-testid={`button-remove-${job.id}`}
                              >
                                Remove Job
                              </Button>
                            ) : (
                              // Archive button only shows for locked jobs (completed + isActive = false)
                              job.status === "completed" && !job.isActive && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchiveJob(job.id);
                                  }}
                                  data-testid={`button-archive-${job.id}`}
                                >
                                  <Archive className="h-3 w-3 mr-1" />
                                  Archive
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                        <div className="rounded-md p-1 bg-gray-50">
                          <Progress value={progressPercentage} className="mb-2" />
                        </div>
                      </div>



                      {/* Assigned Workers Display with Allocation Patterns */}
                      {job.assignments && job.assignments.length > 0 && (
                        <div className="mb-4 mr-24">
                          <p className="text-sm text-gray-600 mb-2">Assigned Workers ({job.assignments.length}/4):</p>
                          <div className="flex flex-wrap gap-2">
                            {job.assignments.map((assignment: any, index: number) => {
                              const pattern = assignWorkerPattern(index);
                              const patternLabels = {
                                'ascending': '↗ Asc',
                                'descending': '↙ Desc',
                                'middle_up': '↑ Mid+',
                                'middle_down': '↓ Mid-'
                              };

                              return (
                                <div key={assignment.id} className="flex items-center space-x-2 bg-gray-50 rounded-full px-3 py-1 group">
                                  <div
                                    className="w-3 h-3 rounded-full border border-gray-300"
                                    style={{ backgroundColor: assignment.assignedColor || '#3B82F6' }}
                                    data-testid={`worker-color-${assignment.assignee.id}`}
                                  />
                                  <span className="text-sm text-gray-700 font-medium">
                                    {assignment.assignee.name}
                                  </span>
                                  <span className="text-xs text-gray-500 bg-white px-1 rounded">
                                    {patternLabels[pattern as keyof typeof patternLabels]}
                                  </span>
                                  <button
                                    onClick={() => handleUnassignWorker(job.id, assignment.assignee.id)}
                                    className="ml-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    data-testid={`unassign-${assignment.assignee.id}`}
                                    title="Unassign worker"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          {job.assignments.length < 4 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Can assign {4 - job.assignments.length} more worker(s) for optimal multi-worker coordination
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setLocation(`/supervisor/${job.id}`)}
                          data-testid={`button-monitor-${job.id}`}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          Monitor
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setAssignDialogOpen(true);
                          }}
                          data-testid={`button-assign-${job.id}`}
                        >
                          <Users className="mr-1 h-4 w-4" />
                          Assign Workers
                        </Button>

                        <Button variant="outline" size="sm" data-testid={`button-export-${job.id}`}>
                          <Download className="mr-1 h-4 w-4" />
                          Export
                        </Button>

                        {/* Extra Items, Put Aside, and Boxes buttons now inline with other action buttons */}
                        <ExtraItemsAndBoxesButtons jobId={job.id}
                          onExtraItemsClick={() => {
                            setExtraItemsJobId(job.id);
                            setIsExtraItemsModalOpen(true);
                          }}
                          onPutAsideClick={() => {
                            setPutAsideJobId(job.id);
                            setIsPutAsideModalOpen(true);
                          }}
                          onBoxesCompleteClick={() => {
                            setCompletedBoxesJobId(job.id);
                            setIsCompletedBoxesModalOpen(true);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {!(jobsData as any)?.jobs?.length && (
                  <div className="text-center py-8 text-gray-500">
                    No jobs found. Upload a CSV file to create your first job.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* QA Summary Panel and Worker Status - Side by Side on Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QA Summary Panel */}
          <div className="h-full">
            <QASummaryPanel />
          </div>

          {/* Workers Status */}
          <div className="h-full">
            <Card data-testid="workers-status" className="h-full">
              <CardHeader>
                <CardTitle>Worker Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {(workersData as any)?.workers?.map((worker: any) => (
                    <div key={worker.id} className="border border-gray-200 rounded-lg p-4" data-testid={`worker-card-${worker.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{worker.name}</h3>
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${worker.isActive ? 'bg-success-500' : 'bg-gray-400'}`}></div>
                          <span className={`text-sm font-medium ${worker.isActive ? 'text-success-600' : 'text-gray-600'}`}>
                            {worker.isActive ? 'Active' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">Staff ID: {worker.staffId}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Role: {worker.role}</span>
                        <span className="text-gray-600">Last active: 2h ago</span>
                      </div>
                    </div>
                  ))}

                  {!(workersData as any)?.workers?.length && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No workers found.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Error Details Dialog */}
      <ErrorDialog
        isOpen={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        title="CSV Upload Errors"
        errors={currentError ? getErrorDetails(currentError) : []}
      />

      {/* Assign Workers Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="assign-worker-dialog">
          <DialogHeader>
            <DialogTitle>Assign Worker to Job</DialogTitle>
            <DialogDescription>
              Select a worker and choose their color. Each worker will be automatically assigned a box allocation pattern based on assignment order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Worker Selection */}
            <div>
              <Label htmlFor="worker-select">Select Worker</Label>
              <Select
                value={assignForm.userId}
                onValueChange={(value) => setAssignForm(prev => ({ ...prev, userId: value }))}
              >
                <SelectTrigger id="worker-select" data-testid="select-worker">
                  <SelectValue placeholder="Choose a worker..." />
                </SelectTrigger>
                <SelectContent>
                  {(workersData as any)?.workers?.filter((worker: any) => {
                    // Filter out workers already assigned to this job
                    const currentJob = (jobsData as any)?.jobs?.find((job: any) => job.id === selectedJobId);
                    const assignedWorkerIds = currentJob?.assignments?.map((assignment: any) => assignment.assignee.id) || [];
                    return !assignedWorkerIds.includes(worker.id);
                  }).map((worker: any) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.name} ({worker.staffId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color Selection */}
            <div>
              <Label htmlFor="color-picker">Worker Color</Label>
              <div className="flex items-center space-x-3 mt-2">
                <input
                  type="color"
                  id="color-picker"
                  value={assignForm.assignedColor}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, assignedColor: e.target.value }))}
                  className="w-12 h-12 rounded border border-gray-300 cursor-pointer"
                  data-testid="input-worker-color"
                />
                <div className="flex-1">
                  <Input
                    value={assignForm.assignedColor}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, assignedColor: e.target.value }))}
                    placeholder="#3B82F6"
                    data-testid="input-color-code"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This color will identify the worker in dashboards and reports
                  </p>
                </div>
              </div>
            </div>

            {/* Allocation Pattern Preview */}
            {selectedJobId && (
              <div className="border border-gray-200 rounded-lg p-3">
                <Label className="text-sm font-medium">Worker Allocation Pattern</Label>
                <div className="mt-2">
                  {(() => {
                    const currentJob = (jobsData as any)?.jobs?.find((job: any) => job.id === selectedJobId);
                    const currentAssignments = currentJob?.assignments || [];
                    const workerIndex = currentAssignments.length;
                    const pattern = assignWorkerPattern(workerIndex);

                    const patternDescriptions = {
                      'ascending': 'Ascending: Boxes 1, 2, 3, 4... (Worker 1)',
                      'descending': 'Descending: Boxes 100, 99, 98, 97... (Worker 2)',
                      'middle_up': 'Middle Up: Boxes 50, 51, 52, 53... (Worker 3)',
                      'middle_down': 'Middle Down: Boxes 49, 48, 47, 46... (Worker 4)'
                    };

                    return (
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: assignForm.assignedColor }}
                        />
                        <span className="font-medium">
                          {patternDescriptions[pattern as keyof typeof patternDescriptions]}
                        </span>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-gray-500 mt-1">
                    Allocation patterns ensure workers don't conflict when scanning boxes
                  </p>
                </div>
              </div>
            )}

            {/* Color Preview */}
            <div className="border border-gray-200 rounded-lg p-3">
              <Label className="text-sm font-medium">Preview</Label>
              <div className="flex items-center space-x-2 mt-2">
                <div
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: assignForm.assignedColor }}
                ></div>
                <span className="text-sm text-gray-600">
                  {assignForm.userId ? (workersData as any)?.workers?.find((w: any) => w.id === assignForm.userId)?.name || "Selected Worker" : "Worker Name"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignWorker}
              disabled={!assignForm.userId || assignWorkerMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignWorkerMutation.isPending ? "Assigning..." : "Assign Worker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extra Items Modal */}
      {extraItemsJobId && (
        <ExtraItemsModal
          isOpen={isExtraItemsModalOpen}
          onClose={() => {
            setIsExtraItemsModalOpen(false);
            setExtraItemsJobId(null);
          }}
          jobId={extraItemsJobId}
        />
      )}

      {/* Completed Boxes Modal */}
      {completedBoxesJobId && (
        <CompletedBoxesModal
          isOpen={isCompletedBoxesModalOpen}
          onClose={() => {
            setIsCompletedBoxesModalOpen(false);
            setCompletedBoxesJobId(null);
          }}
          jobId={completedBoxesJobId}
        />
      )}

      {/* Put Aside Modal */}
      {putAsideJobId && (
        <PutAsideModal
          isOpen={isPutAsideModalOpen}
          onClose={() => {
            setIsPutAsideModalOpen(false);
            setPutAsideJobId(null);
          }}
          jobId={putAsideJobId}
        />
      )}
    </div>
  );
}