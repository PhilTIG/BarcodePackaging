import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Archive, CheckCircle, Download, Eye, UserPlus, Package } from "lucide-react";
import { Link } from "wouter";
// Note: ExtraItemsAndBoxesButtons will be included inline since it's not available as separate component

interface JobCardWithLiveProgressProps {
  job: any;
  onArchive: (jobId: string) => void;
  onRemove: (jobId: string) => void;
  onToggleActive: (jobId: string, isActive: boolean) => void;
  onUnassignWorker: (jobId: string, workerId: string) => void;
  assignWorkerPattern: (index: number) => string;
  setAssignWorkersModal: (modal: { isOpen: boolean; jobId: string }) => void;
  setExportModal: (modal: { isOpen: boolean; jobId: string; jobName: string }) => void;
  setExtraItemsModal: (modal: { isOpen: boolean; jobId: string; jobName: string }) => void;
}

export function JobCardWithLiveProgress({
  job,
  onArchive,
  onRemove,
  onToggleActive,
  onUnassignWorker,
  assignWorkerPattern,
  setAssignWorkersModal,
  setExportModal,
  setExtraItemsModal,
}: JobCardWithLiveProgressProps) {
  // Fetch live progress data every 10 seconds
  const { data: liveProgressData } = useQuery({
    queryKey: [`/api/jobs/${job.id}/progress`],
    enabled: !!job.id,
    refetchInterval: 10000, // 10 second polling interval
  });

  // Use live progress data if available, fallback to static job data
  const liveProgress = (liveProgressData as any)?.progressSummary 
    ? Math.round(((liveProgressData as any).progressSummary.completedItems / (liveProgressData as any).progressSummary.totalProducts) * 100)
    : null;
  
  const progressPercentage = liveProgress !== null 
    ? liveProgress 
    : Math.round((job.completedItems / job.totalProducts) * 100);
  
  const isCompleted = progressPercentage === 100;

  return (
    <div
      className={`border border-gray-200 rounded-lg p-4 relative ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}
      data-testid={`job-card-${job.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium text-gray-900">{job.name}</h3>
          <p className="text-sm text-gray-600">
            {job.totalProducts} products, {job.totalCustomers} boxes
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
            variant={job.isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onToggleActive(job.id, !job.isActive)}
            disabled={job.status === "completed"}
            className="h-6 px-2 text-xs font-medium"
            data-testid={`button-toggle-scanning-${job.id}`}
          >
            {job.isActive ? "Scanning Active" : "Scanning Paused"}
          </Button>
          <span className="text-sm text-gray-600">Created: {new Date(job.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Progress Bar with Real-time Percentage */}
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
                  onRemove(job.id);
                }}
                data-testid={`button-remove-${job.id}`}
              >
                Remove Job
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(job.id);
                }}
                data-testid={`button-archive-${job.id}`}
              >
                <Archive className="h-3 w-3 mr-1" />
                Archive
              </Button>
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
                    onClick={() => onUnassignWorker(job.id, assignment.assignee.id)}
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

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          asChild
          data-testid={`button-monitor-${job.id}`}
        >
          <Link href={`/supervisor?jobId=${job.id}`}>
            <Eye className="h-3 w-3 mr-1" />
            Monitor
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setAssignWorkersModal({
            isOpen: true,
            jobId: job.id,
          })}
          data-testid={`button-assign-workers-${job.id}`}
        >
          <UserPlus className="h-3 w-3 mr-1" />
          Assign Workers
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExportModal({
            isOpen: true,
            jobId: job.id,
            jobName: job.name,
          })}
          data-testid={`button-export-${job.id}`}
        >
          <Download className="h-3 w-3 mr-1" />
          Export
        </Button>

        {/* Extra Items Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExtraItemsModal({
            isOpen: true,
            jobId: job.id,
            jobName: job.name,
          })}
          data-testid={`button-extra-items-${job.id}`}
        >
          <Package className="h-3 w-3 mr-1" />
          Extra Items
        </Button>
      </div>

      {/* Box Completion Status Badge */}
      <div className="absolute bottom-6 right-4">
        <Badge variant="outline" className="text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          {job.completedBoxes || 0}/{job.totalCustomers} Boxes
        </Badge>
      </div>
    </div>
  );
}