import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Package, Settings, LogOut, CloudUpload, Eye, Users, Download, Plus } from "lucide-react";
import { z } from "zod";

const uploadFormSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  description: z.string().optional(),
  file: z.instanceof(File).optional(),
});

type UploadForm = z.infer<typeof uploadFormSchema>;

export default function ManagerDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logout, isLoading } = useAuth();
  const [uploadSuccess, setUploadSuccess] = useState<{
    productsCount: number;
    customersCount: number;
    job: any;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Fetch jobs
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: !!user,
  });

  // Fetch users for assignment
  const { data: workersData } = useQuery({
    queryKey: ["/api/users/workers"],
    enabled: !!user,
  });

  // Upload CSV mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: UploadForm & { file: File }) => {
      const formData = new FormData();
      formData.append("csv", data.file);
      formData.append("name", data.name);
      formData.append("description", data.description || "");

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
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "CSV uploaded successfully",
        description: `${data.productsCount} products loaded for ${data.customersCount} customers`,
      });
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      
      // Show detailed error for header issues
      const isHeaderError = error.message?.includes('header error');
      const showDetailed = isHeaderError || error.message?.includes('CustomerName');
      
      toast({
        title: "CSV Upload Failed",
        description: showDetailed ? error.message : "Please check your CSV format and try again",
        variant: "destructive",
      });
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

  if (!user || user.role !== "manager") {
    setLocation("/login");
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
                onClick={() => setLocation("/settings")}
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CloudUpload className="text-primary-600 text-2xl" />
                    </div>
                    <p className="text-gray-600 mb-4">Drop CSV file here or click to browse</p>
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
                    <Button
                      type="button"
                      onClick={() => document.getElementById("csv-upload")?.click()}
                      data-testid="button-select-file"
                    >
                      {selectedFile ? selectedFile.name : "Select File"}
                    </Button>
                    {selectedFile && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>

                  {/* CSV Format Guide */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements</h4>
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
                  </div>
                </div>



                <Button
                  type="submit"
                  disabled={uploadMutation.isPending}
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
              <Button variant="outline" size="sm" data-testid="button-create-job">
                <Plus className="mr-1 h-4 w-4" />
                Create Job
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
              <div className="space-y-4">
                {(jobsData as any)?.jobs?.map((job: any) => (
                  <div key={job.id} className="border border-gray-200 rounded-lg p-4" data-testid={`job-card-${job.id}`}>
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
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <span>Progress: {Math.round((job.completedItems / job.totalProducts) * 100)}% complete</span>
                      <span>Created: {new Date(job.createdAt).toLocaleDateString()}</span>
                    </div>

                    <Progress value={(job.completedItems / job.totalProducts) * 100} className="mb-4" />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/supervisor/${job.id}`)}
                        data-testid={`button-monitor-${job.id}`}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Monitor
                      </Button>
                      <Button variant="outline" size="sm" data-testid={`button-assign-${job.id}`}>
                        <Users className="mr-1 h-4 w-4" />
                        Assign Workers
                      </Button>
                      <Button variant="outline" size="sm" data-testid={`button-export-${job.id}`}>
                        <Download className="mr-1 h-4 w-4" />
                        Export
                      </Button>
                    </div>
                  </div>
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

        {/* Workers Status */}
        <Card data-testid="workers-status">
          <CardHeader>
            <CardTitle>Worker Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  );
}