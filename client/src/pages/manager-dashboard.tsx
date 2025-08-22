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
import { JobCardWithLiveProgress } from "@/components/job-card-with-live-progress";
import { z } from "zod";
import { assignWorkerPattern, getDefaultWorkerColors, type WorkerAllocationPattern } from "../../../lib/worker-allocation";

const uploadFormSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  jobTypeId: z.string().min(1, "Job type is required"),
  description: z.string().optional(),
  file: z.instanceof(File).optional(),
});

type UploadForm = z.infer<typeof uploadFormSchema>;

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { error, clearError } = useErrorContext();

  // State Management
  const [selectedTab, setSelectedTab] = useState("upload");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [workerColors, setWorkerColors] = useState<{ [workerId: string]: string }>({});

  // Form Setup
  const uploadForm = useForm<UploadForm>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      name: "",
      jobTypeId: "",
      description: "",
    },
  });

  // Modal State
  const [assignWorkersModal, setAssignWorkersModal] = useState<{
    isOpen: boolean;
    jobId: string;
  }>({ isOpen: false, jobId: "" });

  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    jobId: string;
    jobName: string;
  }>({ isOpen: false, jobId: "", jobName: "" });

  const [extraItemsModal, setExtraItemsModal] = useState<{
    isOpen: boolean;
    jobId: string;
    jobName: string;
  }>({ isOpen: false, jobId: "", jobName: "" });

  // Data Queries
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: workersData } = useQuery({
    queryKey: ["/api/users/workers"],
  });

  const { data: jobTypesData } = useQuery({
    queryKey: ["/api/job-types"],
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: async (data: UploadForm) => {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("jobTypeId", data.jobTypeId);
      if (data.description) {
        formData.append("description", data.description);
      }
      if (data.file) {
        formData.append("file", data.file);
      }

      return await apiRequest("/api/jobs", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      toast({ title: "Job created successfully!" });
      uploadForm.reset();
      setUploadDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Job Management Functions
  const handleArchiveJob = async (jobId: string) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/archive`, { method: "POST" });
      toast({ title: "Job archived successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch (error: any) {
      toast({
        title: "Error archiving job",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveJob = async (jobId: string) => {
    try {
      await apiRequest(`/api/jobs/${jobId}`, { method: "DELETE" });
      toast({ title: "Job removed successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch (error: any) {
      toast({
        title: "Error removing job",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleJobActiveToggle = async (jobId: string, isActive: boolean) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/toggle-active`, {
        method: "POST",
        body: JSON.stringify({ isActive }),
        headers: { "Content-Type": "application/json" },
      });
      
      toast({ 
        title: isActive ? "Job scanning activated!" : "Job scanning paused!" 
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch (error: any) {
      toast({
        title: "Error updating job status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnassignWorker = async (jobId: string, workerId: string) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/assignments/${workerId}`, {
        method: "DELETE",
      });
      toast({ title: "Worker unassigned successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch (error: any) {
      toast({
        title: "Error unassigning worker",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onUploadSubmit = (data: UploadForm) => {
    uploadMutation.mutate(data);
  };

  if (!user || user.role !== "manager") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Access denied. Manager role required.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="manager-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manager Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setLocation("/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Job Upload Section */}
      <Card data-testid="upload-section">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Create New Job
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Upload CSV files to create new sorting jobs. Each job represents a batch of products to be sorted.
          </p>
        </CardContent>
      </Card>

      {/* Active Jobs with Live Progress */}
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
              {(jobsData as any)?.jobs?.map((job: any) => (
                <JobCardWithLiveProgress 
                  key={job.id} 
                  job={job} 
                  onArchive={handleArchiveJob} 
                  onRemove={handleRemoveJob} 
                  onToggleActive={handleJobActiveToggle} 
                  onUnassignWorker={handleUnassignWorker} 
                  assignWorkerPattern={assignWorkerPattern}
                  setAssignWorkersModal={setAssignWorkersModal}
                  setExportModal={setExportModal}
                  setExtraItemsModal={setExtraItemsModal}
                />
              ))}

              {!(jobsData as any)?.jobs?.length && (
                <div className="text-center py-8 text-gray-500">
                  No jobs found. Upload a CSV file to create your first job.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QA Summary Panel */}
      <QASummaryPanel />

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
            <DialogDescription>
              Upload a CSV file to create a new sorting job.
            </DialogDescription>
          </DialogHeader>
          <Form {...uploadForm}>
            <form onSubmit={uploadForm.handleSubmit(onUploadSubmit)} className="space-y-4">
              <FormField
                control={uploadForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter job name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={uploadForm.control}
                name="jobTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(jobTypesData as any)?.jobTypes?.map((type: any) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={uploadForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter job description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={uploadForm.control}
                name="file"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>CSV File</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={(e) => onChange(e.target.files?.[0])}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? "Creating..." : "Create Job"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Extra Items Modal */}
      <ExtraItemsModal
        isOpen={extraItemsModal.isOpen}
        onClose={() => setExtraItemsModal(prev => ({ ...prev, isOpen: false }))}
        jobId={extraItemsModal.jobId}
        jobName={extraItemsModal.jobName}
      />

      {/* Error Dialog - Remove this as it's causing crashes without proper props */}
      {/* <ErrorDialog /> */}
    </div>
  );
}