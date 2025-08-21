import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { CheckCircle2, AlertTriangle, TrendingUp, Users, Clock, Eye } from "lucide-react";

interface QASummaryData {
  summary: {
    totalActiveJobs: number;
    overallVerificationRate: number;
    overallAccuracyScore: number;
    totalSessions: number;
    totalCompletedSessions: number;
    totalDiscrepancies: number;
    dataTimestamp: string;
  };
  jobs: Array<{
    jobId: string;
    jobName: string;
    verificationRate: number;
    accuracyScore: number;
    totalSessions: number;
    completedSessions: number;
    totalDiscrepancies: number;
    recentActivity: Array<{
      id: string;
      boxNumber: number;
      status: string;
      startTime: string;
      endTime: string | null;
      discrepanciesFound: number;
    }>;
    topWorkers: Array<{
      userId: string;
      accuracy: number;
      totalSessions: number;
      totalDiscrepancies: number;
    }>;
  }>;
}

export function QASummaryPanel() {
  const [, setLocation] = useLocation();

  // Fetch QA summary data
  const { data: qaSummary, isLoading, error } = useQuery<QASummaryData>({
    queryKey: ["/api/qa/summary"],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  if (isLoading) {
    return (
      <Card data-testid="qa-summary-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Quality Assurance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="qa-summary-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Quality Assurance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-gray-500">Unable to load QA summary data</p>
            <p className="text-sm text-gray-400 mt-1">Please check your permissions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!qaSummary || qaSummary.summary.totalActiveJobs === 0) {
    return (
      <Card data-testid="qa-summary-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Quality Assurance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-gray-500">No active jobs with QA data available</p>
            <p className="text-sm text-gray-400 mt-1">QA metrics will appear when jobs have CheckCount activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, jobs } = qaSummary;

  // Helper function to get accuracy color
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 95) return "text-green-600";
    if (accuracy >= 85) return "text-yellow-600";
    return "text-red-600";
  };

  const getVerificationColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card data-testid="qa-summary-panel">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Quality Assurance Summary
          </div>
          <Badge variant="secondary" className="text-xs">
            {summary.totalActiveJobs} Active Job{summary.totalActiveJobs !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getVerificationColor(summary.overallVerificationRate)}`}>
              {summary.overallVerificationRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Verification Rate</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getAccuracyColor(summary.overallAccuracyScore)}`}>
              {summary.overallAccuracyScore.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Accuracy Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {summary.totalCompletedSessions}
            </div>
            <div className="text-xs text-gray-500">CheckCounts Done</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {summary.totalDiscrepancies}
            </div>
            <div className="text-xs text-gray-500">Discrepancies</div>
          </div>
        </div>

        {/* Job-Specific Summary */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Job Performance (Last 7 Days)
          </h4>
          
          {jobs.slice(0, 3).map((job) => (
            <div key={job.jobId} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h5 className="font-medium text-sm truncate max-w-[200px]" title={job.jobName}>
                    {job.jobName}
                  </h5>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {job.completedSessions} checks
                    </span>
                    {job.totalDiscrepancies > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        {job.totalDiscrepancies} issues
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setLocation(`/qa-dashboard/${job.jobId}`)}
                  data-testid={`button-qa-details-${job.jobId}`}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Details
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Verification:</span>
                    <span className={`font-medium ${getVerificationColor(job.verificationRate)}`}>
                      {job.verificationRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={job.verificationRate} 
                    className="h-1 mt-1"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Accuracy:</span>
                    <span className={`font-medium ${getAccuracyColor(job.accuracyScore)}`}>
                      {job.accuracyScore.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={job.accuracyScore} 
                    className="h-1 mt-1"
                  />
                </div>
              </div>
            </div>
          ))}

          {jobs.length > 3 && (
            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/qa-dashboard")}
                data-testid="button-view-all-qa"
                className="text-xs"
              >
                View All QA Reports ({jobs.length} jobs)
              </Button>
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        {jobs.some(job => job.recentActivity.length > 0) && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent CheckCount Activity
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {jobs
                .flatMap(job => 
                  job.recentActivity.map(activity => ({
                    ...activity,
                    jobName: job.jobName,
                    jobId: job.jobId
                  }))
                )
                .sort((a, b) => new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime())
                .slice(0, 5)
                .map((activity) => (
                  <div key={`${activity.jobId}-${activity.id}`} className="flex items-center justify-between text-xs p-2 bg-white rounded border">
                    <div>
                      <span className="font-medium">Box {activity.boxNumber}</span>
                      <span className="text-gray-500 ml-2">{activity.jobName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {activity.discrepanciesFound > 0 ? (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          {activity.discrepanciesFound} issues
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs px-1 py-0 bg-green-600">
                          Perfect
                        </Badge>
                      )}
                      <span className="text-gray-400">
                        {new Date(activity.endTime || activity.startTime).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t text-xs text-gray-400 text-center">
          Last updated: {new Date(summary.dataTimestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}