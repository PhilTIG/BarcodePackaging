import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Archive, 
  Trash2, 
  Database, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertTriangle,
  ArrowUpFromLine,
  Calendar
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface WorkerStats {
  workerId: string;
  workerName: string;
  workerStaffId: string;
  totalItemsChecked: number;
  correctChecks: number;
  discrepanciesFound: number;
  accuracy: string;
}

interface JobArchive {
  id: string;
  originalJobId: string;
  jobName: string;
  totalItems: number;
  totalBoxes: number;
  managerName: string;
  managerId: string;
  totalExtrasFound: number;
  totalItemsChecked: number;
  totalCorrectChecks: number;
  overallCheckAccuracy: string;
  archivedBy: string;
  archivedAt: string;
  isPurged: boolean;
  workerStats: WorkerStats[];
}

export default function Archives() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedArchive, setSelectedArchive] = useState<JobArchive | null>(null);

  // Fetch all archives
  const { data: archivesData, isLoading } = useQuery({
    queryKey: ['/api/archives'],
    enabled: true
  });

  const archives: JobArchive[] = (archivesData as any)?.archives || [];

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (archiveId: string) => {
      const response = await apiRequest(`/api/archives/${archiveId}/unarchive`, 'POST');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archives'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: "Job has been restored to active jobs",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive job",
        variant: "destructive",
      });
    }
  });

  // Purge mutation
  const purgeMutation = useMutation({
    mutationFn: async (archiveId: string) => {
      const response = await apiRequest(`/api/archives/${archiveId}/purge`, 'DELETE');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archives'] });
      toast({
        title: "Success",
        description: "Job data has been purged. Summary retained.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to purge job data",
        variant: "destructive",
      });
    }
  });

  // Delete archive mutation
  const deleteArchiveMutation = useMutation({
    mutationFn: async (archiveId: string) => {
      const response = await apiRequest(`/api/archives/${archiveId}`, 'DELETE');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/archives'] });
      toast({
        title: "Success",
        description: "Archive has been permanently deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete archive",
        variant: "destructive",
      });
    }
  });

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const getAccuracyColor = (accuracy: string) => {
    const acc = parseFloat(accuracy);
    if (acc >= 95) return 'text-green-600';
    if (acc >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Archive className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Job Archives</h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Archive className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Job Archives</h1>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {archives.length} Total Archives
        </Badge>
      </div>

      {archives.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Archive className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Archives Yet</h3>
            <p className="text-gray-500 text-center">
              When jobs are archived, they will appear here with detailed summaries and worker performance data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {archives.map((archive) => (
            <Card key={archive.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {archive.jobName}
                      {archive.isPurged && (
                        <Badge variant="secondary" className="text-xs">
                          <Database className="h-3 w-3 mr-1" />
                          Purged
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Archived {formatDate(archive.archivedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Manager: {archive.managerName}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!archive.isPurged && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <ArrowUpFromLine className="h-4 w-4 mr-1" />
                            Unarchive
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Unarchive Job</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will restore "{archive.jobName}" to the active jobs list. All job data will be restored from the snapshot.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => unarchiveMutation.mutate(archive.id)}>
                              Unarchive Job
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    
                    {!archive.isPurged && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700">
                            <Database className="h-4 w-4 mr-1" />
                            Purge Data
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Purge Job Data</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the detailed job data while keeping the summary. The job cannot be unarchived after purging.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => purgeMutation.mutate(archive.id)}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              Purge Data
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Archive</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the entire archive including all summary data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteArchiveMutation.mutate(archive.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Archive
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{archive.totalItems}</div>
                    <div className="text-sm text-gray-500">Total Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{archive.totalBoxes}</div>
                    <div className="text-sm text-gray-500">Total Boxes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{archive.totalExtrasFound}</div>
                    <div className="text-sm text-gray-500">Extras Found</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getAccuracyColor(archive.overallCheckAccuracy)}`}>
                      {parseFloat(archive.overallCheckAccuracy).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Check Accuracy</div>
                  </div>
                </div>

                {archive.workerStats && archive.workerStats.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Worker Performance
                    </h4>
                    <div className="grid gap-2">
                      {archive.workerStats.map((worker) => (
                        <div key={worker.workerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-medium">{worker.workerName}</div>
                              <div className="text-sm text-gray-500">ID: {worker.workerStaffId}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <div className="font-medium">{worker.totalItemsChecked}</div>
                              <div className="text-gray-500">Checked</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium">{worker.correctChecks}</div>
                              <div className="text-gray-500">Correct</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium text-red-600">{worker.discrepanciesFound}</div>
                              <div className="text-gray-500">Issues</div>
                            </div>
                            <div className="text-center">
                              <div className={`font-medium ${getAccuracyColor(worker.accuracy)}`}>
                                {parseFloat(worker.accuracy).toFixed(1)}%
                              </div>
                              <div className="text-gray-500">Accuracy</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}