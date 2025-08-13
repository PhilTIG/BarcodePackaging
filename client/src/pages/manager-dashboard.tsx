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
  const { user, logout } = useAuth();
  const [uploadSuccess, setUploadSuccess] = useState<any>(null);

  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    } else if (user.role !== "manager") {
      setLocation("/login");
    }
  }, [user, setLocation]);

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

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploadSuccess(data);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "CSV uploaded successfully",
        description: `${data.productsCount} products loaded for ${data.job.totalCustomers} customers`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message,
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
    const fileInput = document.getElementById("csv-upload") as HTMLInputElement;
    if (!fileInput?.files?.[0]) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      ...data,
      file: fileInput.files[0],
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
        {/* CSV Upload Section */}
        <Card data-testid="upload-section">
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
                  />
                  <Button
                    type="button"
                    onClick={() => document.getElementById("csv-upload")?.click()}
                    data-testid="button-select-file"
                  >
                    Select File
                  </Button>
                </div>

                {uploadSuccess && (
                  <div className="p-4 bg-success-50 border border-success-200 rounded-lg" data-testid="upload-success">
                    <div className="flex items-center">
                      <div className="text-success-600 mr-3">✓</div>
                      <div>
                        <p className="text-success-800 font-medium">CSV Uploaded Successfully</p>
                        <p className="text-success-700 text-sm">
                          {uploadSuccess.productsCount} products, {uploadSuccess.job.totalCustomers} customers loaded
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                {jobsData?.jobs?.map((job: any) => (
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

                {!jobsData?.jobs?.length && (
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
              {workersData?.workers?.map((worker: any) => (
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

              {!workersData?.workers?.length && (
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
