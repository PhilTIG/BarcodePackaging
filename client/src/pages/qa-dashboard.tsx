import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Clock, 
  Eye,
  BarChart3,
  Target,
  Shield,
  Activity
} from "lucide-react";

interface QADashboardData {
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
      userId: string;
    }>;
    topWorkers: Array<{
      userId: string;
      accuracy: number;
      totalSessions: number;
      totalDiscrepancies: number;
    }>;
  }>;
}

interface JobSpecificQAData {
  report: {
    jobInfo: {
      id: string;
      name: string;
      status: string;
      totalBoxes: number;
      verifiedBoxes: number;
    };
    verificationRate: number;
    accuracyScore: number;
    discrepancyAnalysis: {
      totalDiscrepancies: number;
      discrepancyRate: number;
      commonIssues: Array<{
        type: string;
        count: number;
        percentage: number;
      }>;
    };
    workerPerformance: Array<{
      userId: string;
      staffId: string;
      name: string;
      totalSessions: number;
      accuracySessions: number;
      accuracyRate: number;
      totalDiscrepancies: number;
      avgDiscrepanciesPerSession: number;
    }>;
    timeline: Array<{
      date: string;
      sessionsCompleted: number;
      discrepanciesFound: number;
      accuracyRate: number;
    }>;
  };
}

export default function QADashboard() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const selectedJobId = params.jobId;
  
  // Fetch overall QA summary
  const { data: qaSummary, isLoading: summaryLoading } = useQuery<QADashboardData>({
    queryKey: ["/api/qa/summary"],
    refetchInterval: 30000,
  });

  // Fetch job-specific QA data when a job is selected
  const { data: jobQAData, isLoading: jobLoading } = useQuery<JobSpecificQAData>({
    queryKey: [`/api/jobs/${selectedJobId}/qa-report`],
    enabled: !!selectedJobId,
    refetchInterval: 30000,
  });

  // Helper functions for color coding
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

  const getAccuracyBadgeVariant = (accuracy: number) => {
    if (accuracy >= 95) return "default";
    if (accuracy >= 85) return "secondary";
    return "destructive";
  };

  if (summaryLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-80 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/manager")}
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="bg-blue-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  QA Dashboard
                  {selectedJobId && jobQAData?.report?.jobInfo && (
                    <span className="text-gray-600 font-normal"> - {jobQAData.report.jobInfo.name}</span>
                  )}
                </h1>
                <p className="text-sm text-gray-600">
                  Quality assurance analytics and reporting
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              Last updated: {qaSummary?.summary?.dataTimestamp ? 
                new Date(qaSummary.summary.dataTimestamp).toLocaleTimeString() : 
                'Loading...'
              }
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Overall Summary Cards */}
        {!selectedJobId && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {qaSummary?.summary?.totalActiveJobs || 0}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overall Verification</p>
                    <p className={`text-2xl font-bold ${getVerificationColor(qaSummary?.summary?.overallVerificationRate || 0)}`}>
                      {qaSummary?.summary?.overallVerificationRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overall Accuracy</p>
                    <p className={`text-2xl font-bold ${getAccuracyColor(qaSummary?.summary?.overallAccuracyScore || 0)}`}>
                      {qaSummary?.summary?.overallAccuracyScore?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Discrepancies</p>
                    <p className="text-2xl font-bold text-red-600">
                      {qaSummary?.summary?.totalDiscrepancies || 0}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        {selectedJobId && jobQAData ? (
          <JobSpecificQAView jobData={jobQAData} />
        ) : (
          <AllJobsQAView qaSummary={qaSummary} onJobSelect={(jobId) => setLocation(`/qa-dashboard/${jobId}`)} />
        )}
      </div>
    </div>
  );
}

// Component for displaying all jobs QA overview
function AllJobsQAView({ 
  qaSummary, 
  onJobSelect 
}: { 
  qaSummary: QADashboardData | undefined; 
  onJobSelect: (jobId: string) => void;
}) {
  if (!qaSummary?.jobs?.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No QA Data Available</h3>
          <p className="text-gray-600">
            QA metrics will appear when jobs have CheckCount activity in the last 7 days.
          </p>
        </CardContent>
      </Card>
    );
  }

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Job Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {qaSummary.jobs.map((job) => (
              <div 
                key={job.jobId} 
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => onJobSelect(job.jobId)}
                data-testid={`job-qa-overview-${job.jobId}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{job.jobName}</h3>
                    <p className="text-sm text-gray-600">
                      {job.completedSessions} CheckCount sessions completed
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.totalDiscrepancies > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {job.totalDiscrepancies} issues
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" data-testid={`button-view-details-${job.jobId}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Verification Rate:</span>
                    <div className={`font-semibold ${getVerificationColor(job.verificationRate)}`}>
                      {job.verificationRate.toFixed(1)}%
                    </div>
                    <Progress value={job.verificationRate} className="h-2 mt-1" />
                  </div>
                  <div>
                    <span className="text-gray-500">Accuracy Score:</span>
                    <div className={`font-semibold ${getAccuracyColor(job.accuracyScore)}`}>
                      {job.accuracyScore.toFixed(1)}%
                    </div>
                    <Progress value={job.accuracyScore} className="h-2 mt-1" />
                  </div>
                  <div>
                    <span className="text-gray-500">Total Sessions:</span>
                    <div className="font-semibold text-blue-600">{job.totalSessions}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Top Worker:</span>
                    <div className="font-semibold text-gray-900">
                      {job.topWorkers[0] ? `${job.topWorkers[0].accuracy.toFixed(1)}%` : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Component for job-specific detailed QA view
function JobSpecificQAView({ jobData }: { jobData: JobSpecificQAData }) {
  if (!jobData?.report) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { report } = jobData;

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
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="workers">Worker Performance</TabsTrigger>
        <TabsTrigger value="discrepancies">Discrepancy Analysis</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Verification Rate</p>
                  <p className={`text-2xl font-bold ${getVerificationColor(report.verificationRate)}`}>
                    {report.verificationRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {report.jobInfo.verifiedBoxes}/{report.jobInfo.totalBoxes} boxes verified
                  </p>
                </div>
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Accuracy Score</p>
                  <p className={`text-2xl font-bold ${getAccuracyColor(report.accuracyScore)}`}>
                    {report.accuracyScore.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    Sessions with zero discrepancies
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Discrepancies</p>
                  <p className="text-2xl font-bold text-red-600">
                    {report.discrepancyAnalysis.totalDiscrepancies}
                  </p>
                  <p className="text-xs text-gray-500">
                    {report.discrepancyAnalysis.discrepancyRate.toFixed(1)}% of sessions
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Worker Performance Tab */}
      <TabsContent value="workers" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Worker QA Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.workerPerformance.map((worker) => (
                <div key={worker.userId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{worker.name}</h3>
                      <p className="text-sm text-gray-600">Staff ID: {worker.staffId}</p>
                    </div>
                    <Badge 
                      variant={worker.accuracyRate >= 95 ? "default" : worker.accuracyRate >= 85 ? "secondary" : "destructive"}
                    >
                      {worker.accuracyRate.toFixed(1)}% accuracy
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Sessions:</span>
                      <div className="font-semibold">{worker.totalSessions}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Accurate Sessions:</span>
                      <div className="font-semibold text-green-600">{worker.accuracySessions}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Issues:</span>
                      <div className="font-semibold text-red-600">{worker.totalDiscrepancies}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Avg Issues/Session:</span>
                      <div className="font-semibold">{worker.avgDiscrepanciesPerSession.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Discrepancy Analysis Tab */}
      <TabsContent value="discrepancies" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Discrepancy Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.discrepancyAnalysis.commonIssues.map((issue, index) => (
                <div key={index} className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div>
                    <p className="font-medium">{issue.type}</p>
                    <p className="text-sm text-gray-600">{issue.count} occurrences</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{issue.percentage.toFixed(1)}%</p>
                    <Progress value={issue.percentage} className="h-2 mt-1 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Timeline Tab */}
      <TabsContent value="timeline" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              QA Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.timeline.map((day, index) => (
                <div key={index} className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div>
                    <p className="font-medium">{new Date(day.date).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-600">{day.sessionsCompleted} sessions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{day.accuracyRate.toFixed(1)}% accuracy</p>
                    <p className="text-sm text-gray-600">{day.discrepanciesFound} issues</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}