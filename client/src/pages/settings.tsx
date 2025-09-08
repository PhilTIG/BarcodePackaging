import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useErrorContext } from "@/lib/error-context";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Trash2, Plus, Edit3, Users, Settings as SettingsIcon, Palette, Package, ChevronDown, RotateCcw } from "lucide-react";
import { z } from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const AVAILABLE_THEMES = [
  { name: "blue", label: "Blue", colors: ["#3B82F6", "#2563EB", "#1D4ED8"] },
  { name: "green", label: "Green", colors: ["#10B981", "#059669", "#047857"] },
  { name: "orange", label: "Orange", colors: ["#F59E0B", "#D97706", "#B45309"] },
  { name: "teal", label: "Teal", colors: ["#14B8A6", "#0D9488", "#0F766E"] },
  { name: "red", label: "Red", colors: ["#EF4444", "#DC2626", "#B91C1C"] },
  { name: "dark", label: "Dark", colors: ["#6B7280", "#4B5563", "#374151"] },
];

const userFormSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["manager", "supervisor", "worker"], {
    required_error: "Role is required",
  }),
  pin: z.string().min(4, "PIN must be at least 4 characters"),
  checkBoxEnabled: z.boolean().default(false),
});

const jobTypeFormSchema = z.object({
  name: z.string().min(1, "Job type name is required"),
  benchmarkItemsPerHour: z.number().min(1, "Benchmark must be at least 1 item per hour").default(71),
  requireGroupField: z.boolean().default(false),
});

type UserFormData = z.infer<typeof userFormSchema>;
type JobTypeFormData = z.infer<typeof jobTypeFormSchema>;

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const { detailedErrorMessages, setDetailedErrorMessages } = useErrorContext();
  // Re-enabled user preferences provider
  const { preferences, updatePreference, isLoading: preferencesLoading } = useUserPreferences();
  const [activeTab, setActiveTab] = useState<"general" | "users" | "job-types">("general");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isJobTypeDialogOpen, setIsJobTypeDialogOpen] = useState(false);
  const [editingJobType, setEditingJobType] = useState<any>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      staffId: "",
      name: "",
      role: "worker",
      pin: "",
      checkBoxEnabled: false,
    },
  });

  const jobTypeForm = useForm<JobTypeFormData>({
    resolver: zodResolver(jobTypeFormSchema),
    defaultValues: {
      name: "",
      benchmarkItemsPerHour: 71,
      requireGroupField: false,
    },
  });

  // Fetch users for management
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!user && user.role === "manager",
  });

  // Fetch job types
  const { data: jobTypesData, isLoading: jobTypesLoading } = useQuery({
    queryKey: ["/api/job-types"],
    enabled: !!user,
  });

  // User management mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      form.reset();
      setIsCreateDialogOpen(false);
      toast({
        title: "User created successfully",
        description: "New user has been added to the system",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UserFormData }) => {
      const response = await apiRequest("PUT", `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      form.reset();
      setEditingUser(null);
      setIsCreateDialogOpen(false);
      toast({
        title: "User updated successfully",
        description: "User information has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User deleted successfully",
        description: "User has been removed from the system",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleThemeChange = (newTheme: string) => {
    updatePreference("theme", newTheme);
    toast({
      title: "Theme updated",
      description: `Switched to ${newTheme} theme`,
    });
  };

  const handleSettingChange = (key: string, value: any) => {
    if (key === "detailedErrorMessages") {
      setDetailedErrorMessages(value);
    } else {
      updatePreference(key as keyof typeof preferences, value);
    }
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      localStorage.clear();
      toast({
        title: "Data cleared",
        description: "All local data has been removed",
        variant: "destructive",
      });
    }
  };

  // New handler for deleting all job data with enhanced safety
  const handleDeleteAllJobs = async () => {
    // First confirmation
    const firstConfirm = window.confirm(
      "⚠️ DANGER: This will permanently delete ALL job data including:\n" +
      "• All jobs and scan data\n" +
      "• CheckCount QA records\n" +
      "• Worker assignments\n" +
      "• Box requirements\n\n" +
      "User accounts and settings will be preserved.\n\n" +
      "Do you want to continue?"
    );

    if (!firstConfirm) return;

    // Second confirmation requiring text input
    const confirmText = window.prompt(
      "⚠️ FINAL CONFIRMATION\n\n" +
      "Type 'DELETE' (in capital letters) to confirm this destructive action:"
    );

    if (confirmText !== "DELETE") {
      if (confirmText !== null) { // User didn't cancel
        toast({
          title: "Deletion cancelled",
          description: "You must type 'DELETE' exactly to confirm.",
          variant: "default",
        });
      }
      return;
    }

    try {
      const response = await apiRequest('DELETE', '/api/jobs/all-data');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete job data: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Job data deleted successfully",
        description: result.message,
        variant: "destructive",
      });

      // Invalidate queries and refresh the page after a delay
      queryClient.invalidateQueries();
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Error deleting job data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete job data",
        variant: "destructive",
      });
    }
  };

  const onSubmitUser = (data: UserFormData) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const handleEditUser = (userToEdit: any) => {
    setEditingUser(userToEdit);
    form.reset({
      staffId: userToEdit.staffId,
      name: userToEdit.name,
      role: userToEdit.role,
      pin: "", // Don't pre-fill PIN for security
      checkBoxEnabled: userToEdit.preferences?.checkBoxEnabled || false,
    });
    setIsCreateDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const resetForm = () => {
    form.reset();
    setEditingUser(null);
    setIsCreateDialogOpen(false);
  };

  // Job Type management mutations
  const createJobTypeMutation = useMutation({
    mutationFn: async (data: JobTypeFormData) => {
      const response = await apiRequest("POST", "/api/job-types", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      jobTypeForm.reset();
      setIsJobTypeDialogOpen(false);
      toast({
        title: "Job type created successfully",
        description: "New job type has been added to the system",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create job type",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateJobTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: JobTypeFormData }) => {
      const response = await apiRequest("PUT", `/api/job-types/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      jobTypeForm.reset();
      setEditingJobType(null);
      setIsJobTypeDialogOpen(false);
      toast({
        title: "Job type updated successfully",
        description: "Job type information has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update job type",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteJobTypeMutation = useMutation({
    mutationFn: async (jobTypeId: string) => {
      const response = await apiRequest("DELETE", `/api/job-types/${jobTypeId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({
        title: "Job type deleted successfully",
        description: "Job type has been removed from the system",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete job type",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmitJobType = (data: JobTypeFormData) => {
    if (editingJobType) {
      updateJobTypeMutation.mutate({ id: editingJobType.id, data });
    } else {
      createJobTypeMutation.mutate(data);
    }
  };

  const handleEditJobType = (jobTypeToEdit: any) => {
    setEditingJobType(jobTypeToEdit);
    jobTypeForm.reset({
      name: jobTypeToEdit.name,
      benchmarkItemsPerHour: jobTypeToEdit.benchmarkItemsPerHour,
      requireGroupField: jobTypeToEdit.requireGroupField,
    });
    setIsJobTypeDialogOpen(true);
  };

  const handleDeleteJobType = (jobTypeId: string) => {
    if (window.confirm("Are you sure you want to delete this job type? This action cannot be undone.")) {
      deleteJobTypeMutation.mutate(jobTypeId);
    }
  };

  const resetJobTypeForm = () => {
    jobTypeForm.reset();
    setEditingJobType(null);
    setIsJobTypeDialogOpen(false);
  };

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!user) {
    return null;
  }

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
                  if (user.role === "manager") {
                    setLocation("/manager");
                  } else if (user.role === "supervisor") {
                    setLocation("/supervisor");
                  } else {
                    setLocation("/scanner");
                  }
                }}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-600">System configuration and user management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {user.role === "worker" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/scanner")}
                  data-testid="button-switch-job"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Switch Job
                </Button>
              )}
              <div className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm font-medium">
                {user.staffId}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("general")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "general"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              data-testid="tab-general"
            >
              <SettingsIcon className="h-4 w-4 mr-2 inline" />
              General
            </button>
            {user.role === "manager" && (
              <>
                <button
                  onClick={() => setActiveTab("users")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "users"
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                  data-testid="tab-users"
                >
                  <Users className="h-4 w-4 mr-2 inline" />
                  User Management
                </button>
                <button
                  onClick={() => setActiveTab("job-types")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "job-types"
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                  data-testid="tab-job-types"
                >
                  <Package className="h-4 w-4 mr-2 inline" />
                  Job Types
                </button>
              </>
            )}
          </nav>
        </div>
      </div>

      <div className="p-4 space-y-6">{activeTab === "general" ? (
        <>
          {/* Color Theme Section */}
          <Card data-testid="theme-settings">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Color Theme</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {AVAILABLE_THEMES.map((themeOption) => (
                  <div
                    key={themeOption.name}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      preferences.theme === themeOption.name
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                    onClick={() => handleThemeChange(themeOption.name)}
                    data-testid={`theme-${themeOption.name}`}
                  >
                    <div className="flex items-center space-x-2 mb-3">
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: themeOption.colors[0] }}
                      ></div>
                      <span className="font-medium text-gray-900">{themeOption.label}</span>
                      {preferences.theme === themeOption.name && (
                        <div className="text-primary ml-auto font-bold">✓</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {themeOption.colors.map((color, index) => (
                        <div
                          key={index}
                          className="h-2 rounded"
                          style={{ backgroundColor: color }}
                        ></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        {/* Scanner Settings */}
        <Card data-testid="scanner-settings">
          <CardHeader>
            <CardTitle>Scanner Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Auto-clear Input</h3>
                <p className="text-sm text-gray-600">Automatically clear input field after successful scan</p>
              </div>
              <Switch
                checked={preferences.autoClearInput}
                onCheckedChange={(checked) => handleSettingChange("autoClearInput", checked)}
                data-testid="switch-auto-clear"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Sound Feedback</h3>
                <p className="text-sm text-gray-600">Play sound on successful scan</p>
              </div>
              <Switch
                checked={preferences.soundFeedback}
                onCheckedChange={(checked) => handleSettingChange("soundFeedback", checked)}
                data-testid="switch-sound"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Vibration Feedback</h3>
                <p className="text-sm text-gray-600">Vibrate device on scan (mobile only)</p>
              </div>
              <Switch
                checked={preferences.vibrationFeedback}
                onCheckedChange={(checked) => handleSettingChange("vibrationFeedback", checked)}
                data-testid="switch-vibration"
              />
            </div>

            <div>
              <Label className="text-base font-medium text-gray-900">Scanner Type</Label>
              <Select
                value={preferences.scannerType}
                onValueChange={(value) => handleSettingChange("scannerType", value)}
              >
                <SelectTrigger className="mt-2" data-testid="select-scanner-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera">Camera Scanner</SelectItem>
                  <SelectItem value="usb">USB HID Scanner</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth Scanner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Mobile Mode</h3>
                <p className="text-sm text-gray-600">Enable mobile-first interface with touch-optimized controls</p>
              </div>
              <Switch
                checked={preferences.mobileModePreference}
                onCheckedChange={(checked) => handleSettingChange("mobileModePreference", checked)}
                data-testid="switch-mobile-mode"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Default Single Box Mode</h3>
                <p className="text-sm text-gray-600">Start in Single Box mode by default when scanning (can be changed during scanning)</p>
              </div>
              <Switch
                checked={preferences.singleBoxMode}
                onCheckedChange={(checked) => handleSettingChange("singleBoxMode", checked)}
                data-testid="switch-default-single-box"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Single Box Mode</h3>
                <p className="text-sm text-gray-600">Focus on one box at a time with full-screen display (mobile only)</p>
              </div>
              <Switch
                checked={preferences.singleBoxMode}
                onCheckedChange={(checked) => handleSettingChange("singleBoxMode", checked)}
                disabled={!preferences.mobileModePreference}
                data-testid="switch-single-box"
              />
            </div>

            <div>
              <Label className="text-base font-medium text-gray-900">Maximum Boxes Per Row</Label>
              <Input
                type="number"
                value={preferences.maxBoxesPerRow}
                onChange={(e) => updatePreference("maxBoxesPerRow", parseInt(e.target.value) || 12)}
                min="4"
                max="48"
                className="mt-2"
                data-testid="input-max-boxes-per-row"
              />
              <p className="text-sm text-gray-600 mt-1">
                Sets maximum boxes displayed per row on wide screens (4-48). Values above 16 use simplified box design. Layout automatically adjusts for smaller screens.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Performance Settings - Only for managers */}
        {user.role === "manager" && (
          <Card data-testid="performance-settings">
            <CardHeader>
              <CardTitle>Performance Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-medium text-gray-900">Target Scans Per Hour</Label>
                <Input
                  type="number"
                  value={preferences.targetScansPerHour}
                  onChange={(e) => handleSettingChange("targetScansPerHour", parseInt(e.target.value))}
                  min="1"
                  max="500"
                  className="mt-2"
                  data-testid="input-target-scans"
                />
                <p className="text-sm text-gray-600 mt-1">Industry average is 71 items/hour</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Auto-save Sessions</h3>
                  <p className="text-sm text-gray-600">Automatically save progress every 5 minutes</p>
                </div>
                <Switch
                  checked={preferences.autoSaveSessions}
                  onCheckedChange={(checked) => handleSettingChange("autoSaveSessions", checked)}
                  data-testid="switch-auto-save"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Show Real-time Stats</h3>
                  <p className="text-sm text-gray-600">Display performance metrics during scanning</p>
                </div>
                <Switch
                  checked={preferences.showRealtimeStats}
                  onCheckedChange={(checked) => handleSettingChange("showRealtimeStats", checked)}
                  data-testid="switch-realtime-stats"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Detailed Error Messaging</h3>
                  <p className="text-sm text-gray-600">Show detailed CSV validation errors instead of summary</p>
                </div>
                <Switch
                  checked={detailedErrorMessages}
                  onCheckedChange={(checked) => handleSettingChange("detailedErrorMessages", checked)}
                  data-testid="switch-detailed-errors"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Information - Only for managers */}
        {user.role === "manager" && (
          <Card data-testid="system-info">
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">App Version</span>
                  <span className="font-medium text-gray-900">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated</span>
                  <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Device Type</span>
                  <span className="font-medium text-gray-900">
                    {/Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Storage Used</span>
                  <span className="font-medium text-gray-900">
                    {Math.round(JSON.stringify(localStorage).length / 1024)} KB
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleClearData}
                  data-testid="button-clear-data"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone - Only for Managers - Collapsible */}
        {user.role === "manager" && (
          <Collapsible defaultOpen={false}>
            <Card data-testid="danger-zone" className="border-red-200 bg-red-50">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-red-100/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Trash2 className="h-5 w-5 text-red-600" />
                      <CardTitle className="text-red-800">Danger Zone</CardTitle>
                    </div>
                    <ChevronDown className="h-4 w-4 text-red-600 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-red-900 mb-2">Delete All Job Data</h3>
                      <p className="text-sm text-red-700 mb-4">
                        This will permanently delete all jobs, products, scan sessions, and progress data. 
                        User accounts and settings will be preserved. This action cannot be undone.
                      </p>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAllJobs}
                        data-testid="button-delete-all-data"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete All Job Data
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
        </>
      ) : activeTab === "users" && user.role === "manager" ? (
        <>
          {/* User Management Section */}
          <Card data-testid="user-management">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>User Management</span>
                </CardTitle>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetForm} data-testid="button-add-user">
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-white text-black border border-gray-200">
                    <DialogHeader>
                      <DialogTitle>
                        {editingUser ? "Edit User" : "Add New User"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingUser 
                          ? "Update user information and role permissions."
                          : "Create a new user account for the warehouse system."
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmitUser)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="staffId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Staff ID</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="M001, S001, W001..." data-testid="input-staff-id" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter full name" data-testid="input-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-role">
                                    <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="supervisor">Supervisor</SelectItem>
                                  <SelectItem value="worker">Worker</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="pin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                PIN {editingUser && "(leave empty to keep current PIN)"}
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="password" 
                                  placeholder={editingUser ? "Enter new PIN (optional)" : "Enter 4-digit PIN"} 
                                  data-testid="input-pin" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* CheckCount Permission - Only show for workers */}
                        {form.watch("role") === "worker" && (
                          <FormField
                            control={form.control}
                            name="checkBoxEnabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Enable Check Count</FormLabel>
                                  <div className="text-sm text-muted-foreground">
                                    Allow this worker to perform check count verification on completed boxes
                                  </div>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-check-count-enabled"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={resetForm}
                            data-testid="button-cancel"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createUserMutation.isPending || updateUserMutation.isPending}
                            data-testid="button-save-user"
                          >
                            {editingUser 
                              ? (updateUserMutation.isPending ? "Updating..." : "Update User")
                              : (createUserMutation.isPending ? "Creating..." : "Create User")
                            }
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-16 float-right"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {(usersData as any)?.users?.map((userData: any) => (
                    <div 
                      key={userData.id} 
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      data-testid={`user-card-${userData.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-3">
                            <h3 className="font-medium text-gray-900">{userData.name}</h3>
                            <Badge 
                              variant={
                                userData.role === "manager" ? "default" :
                                userData.role === "supervisor" ? "secondary" : "outline"
                              }
                              data-testid={`badge-role-${userData.role}`}
                            >
                              {userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Staff ID: {userData.staffId}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Last active: Never logged in
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(userData)}
                            data-testid={`button-edit-${userData.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUser(userData.id)}
                            disabled={userData.id === user?.id}
                            data-testid={`button-delete-${userData.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!(usersData as any)?.users || (usersData as any)?.users?.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      No users found. Add your first user to get started.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : activeTab === "users" && user.role !== "manager" ? (
        <>
          {/* Fallback for non-managers who somehow get to users tab */}
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
              <p className="text-gray-600">User management is only available to managers.</p>
            </CardContent>
          </Card>
        </>
      ) : null}
      {activeTab === "job-types" && (
        <>
          {/* Job Types Management */}
          <Card data-testid="job-types-settings">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Job Types Management</span>
                </CardTitle>
                <Dialog open={isJobTypeDialogOpen} onOpenChange={setIsJobTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetJobTypeForm} data-testid="button-add-job-type">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Job Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-white text-black border border-gray-200">
                    <DialogHeader>
                      <DialogTitle>
                        {editingJobType ? "Edit Job Type" : "Add New Job Type"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingJobType 
                          ? "Update job type settings and requirements."
                          : "Create a new job type with benchmark targets and field requirements."
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...jobTypeForm}>
                      <form onSubmit={jobTypeForm.handleSubmit(onSubmitJobType)} className="space-y-4">
                        <FormField
                          control={jobTypeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job Type Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Standard Sorting, Express Processing..." data-testid="input-job-type-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={jobTypeForm.control}
                          name="benchmarkItemsPerHour"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Benchmark Items Per Hour</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number"
                                  min="1"
                                  placeholder="71"
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 71)}
                                  data-testid="input-benchmark" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={jobTypeForm.control}
                          name="requireGroupField"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Require Group Field</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  When uploading CSV files, require a "Group" column for organizing items
                                </div>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-require-group"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={resetJobTypeForm}
                            data-testid="button-cancel-job-type"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createJobTypeMutation.isPending || updateJobTypeMutation.isPending}
                            data-testid="button-save-job-type"
                          >
                            {editingJobType 
                              ? (updateJobTypeMutation.isPending ? "Updating..." : "Update Job Type")
                              : (createJobTypeMutation.isPending ? "Creating..." : "Create Job Type")
                            }
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {jobTypesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-16 float-right"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {(jobTypesData as any)?.jobTypes?.map((jobType: any) => (
                    <div 
                      key={jobType.id} 
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      data-testid={`job-type-card-${jobType.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-3">
                            <h3 className="font-medium text-gray-900">{jobType.name}</h3>
                            <Badge 
                              variant="secondary"
                              data-testid={`badge-benchmark-${jobType.id}`}
                            >
                              {jobType.benchmarkItemsPerHour} items/hour
                            </Badge>
                            {jobType.requireGroupField && (
                              <Badge 
                                variant="outline"
                                data-testid={`badge-group-required-${jobType.id}`}
                              >
                                Group Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Benchmark: {jobType.benchmarkItemsPerHour} items per hour
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created: {new Date(jobType.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditJobType(jobType)}
                            data-testid={`button-edit-job-type-${jobType.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteJobType(jobType.id)}
                            data-testid={`button-delete-job-type-${jobType.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!(jobTypesData as any)?.jobTypes || (jobTypesData as any)?.jobTypes?.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      No job types found. Add your first job type to get started.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </div>
  );
}