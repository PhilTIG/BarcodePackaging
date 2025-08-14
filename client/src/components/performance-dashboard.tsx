import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PerformanceDashboardProps {
  jobId: string;
  supervisorView?: boolean;
}

export function PerformanceDashboard({ jobId, supervisorView = false }: PerformanceDashboardProps) {
  const { data: progressData } = useQuery({
    queryKey: ["/api/jobs", jobId, "progress"],
    enabled: !!jobId,
    refetchInterval: 5000,
  });

  if (!progressData?.progress?.workers || progressData.progress.workers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No assigned workers found
      </div>
    );
  }

  const workers = progressData.progress.workers;

  return (
    <div className="space-y-4" data-testid="performance-dashboard">
      {workers.map((worker: any) => {
        const performanceLevel = worker.scansPerHour >= 90 ? "high" : worker.scansPerHour >= 60 ? "medium" : "low";
        const initials = worker.name.split(" ").map((n: string) => n[0]).join("").toUpperCase();
        
        return (
          <div 
            key={worker.id} 
            className={`flex items-center justify-between p-4 border rounded-lg ${
              performanceLevel === "high" 
                ? "bg-success-50 border-success-200" 
                : performanceLevel === "medium"
                  ? "bg-warning-50 border-warning-200"
                  : "bg-gray-50 border-gray-200"
            }`}
            data-testid={`worker-performance-${worker.id}`}
          >
            <div className="flex items-center space-x-3">
              {/* Worker Color Icon */}
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: worker.assignedColor || '#3B82F6' }}
                  title={`Worker color: ${worker.assignedColor || '#3B82F6'}`}
                  data-testid={`worker-color-icon-${worker.id}`}
                />
                <Avatar className={`w-10 h-10 ${
                  performanceLevel === "high" 
                    ? "bg-success-500" 
                    : performanceLevel === "medium"
                      ? "bg-warning-500"
                      : "bg-gray-500"
                }`}>
                  <AvatarFallback className="text-white font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{worker.name}</h3>
                <p className="text-sm text-gray-600">
                  {worker.currentBox ? `Box ${worker.currentBox} - ${worker.currentCustomer}` : "Not assigned"}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      worker.isActive ? "border-success-500 text-success-700" : "border-gray-400 text-gray-600"
                    }`}
                  >
                    {worker.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {supervisorView && (
                    <span className="text-xs text-gray-500">
                      Last scan: {worker.lastScan ? new Date(worker.lastScan).toLocaleTimeString() : "Never"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className={`font-bold ${
                performanceLevel === "high" 
                  ? "text-success-600" 
                  : performanceLevel === "medium"
                    ? "text-warning-600"
                    : "text-gray-600"
              }`} data-testid={`scans-per-hour-${worker.id}`}>
                {worker.scansPerHour} items/hr
              </p>
              <p className="text-sm text-gray-600" data-testid={`score-${worker.id}`}>
                Score: {worker.score}/10
              </p>
              {supervisorView && (
                <p className="text-xs text-gray-500">
                  {worker.totalScans} scans today
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
