
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function WorkerDebugPage() {
  const { jobId } = useParams<{ jobId: string }>();
  
  const { data: debugData, isLoading, refetch } = useQuery({
    queryKey: [`/api/jobs/${jobId}/worker-debug`],
    enabled: !!jobId
  });

  if (isLoading) {
    return <div className="p-6">Loading debug information...</div>;
  }

  if (!debugData) {
    return <div className="p-6">No debug data available</div>;
  }

  const { analysis } = debugData;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Worker ID Debug Analysis</h1>
        <Button onClick={() => refetch()}>Refresh Data</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Box Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Total Records: {analysis.boxRequirementsCount}</p>
              <p>Unique Worker IDs: {analysis.uniqueWorkerIdsInBoxReqs}</p>
              <p>Missing Workers: {analysis.missingWorkers.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Total Workers: {analysis.availableWorkerIds.length}</p>
              <p>Assigned Workers: {analysis.assignedWorkerIds.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ID Format Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Box Req ID Lengths: {analysis.idPatterns.boxReqWorkerIdLengths.join(', ')}</p>
              <p>Worker ID Lengths: {analysis.idPatterns.workerIdLengths.join(', ')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Worker IDs in Box Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>Worker IDs in Box Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.workerIdsInBoxReqs.map((id: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="outline">{id}</Badge>
                  <span className="text-sm text-gray-600">({id.length} chars)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Available Workers */}
        <Card>
          <CardHeader>
            <CardTitle>Available Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.availableWorkerIds.map((worker: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="secondary">{worker.staffId}</Badge>
                  <span className="text-sm">{worker.name}</span>
                  <Badge variant="outline" className="text-xs">{worker.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missing Workers */}
      {analysis.missingWorkers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Missing Workers (Found in Box Reqs but not in Users)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.missingWorkers.map((id: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="destructive">{id}</Badge>
                  <span className="text-sm text-red-600">Not found in users table</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Example IDs Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>ID Format Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Box Requirement Worker IDs (Examples):</h4>
              {analysis.idPatterns.exampleBoxReqIds.map((id: string, index: number) => (
                <div key={index} className="font-mono text-sm bg-gray-100 p-2 rounded mb-1">
                  {id} ({id.length} chars)
                </div>
              ))}
            </div>
            <div>
              <h4 className="font-medium mb-2">Valid Worker IDs (Examples):</h4>
              {analysis.idPatterns.exampleWorkerIds.map((id: string, index: number) => (
                <div key={index} className="font-mono text-sm bg-blue-100 p-2 rounded mb-1">
                  {id} ({id.length} chars)
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
