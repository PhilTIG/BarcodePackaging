import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Helper function to calculate if text should be white or black based on background color brightness
function getContrastingTextColor(hexColor: string): string {
  // Remove # if present
  const color = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Calculate brightness using standard formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return black for light backgrounds, white for dark backgrounds
  return brightness > 128 ? '#000000' : '#FFFFFF';
}

interface PerformanceDashboardProps {
  jobId: string;
  supervisorView?: boolean;
}

export function PerformanceDashboard({ jobId, supervisorView = false }: PerformanceDashboardProps) {
  // Progress data includes ALL customer items (allocated + unallocated) for accurate percentage
  const { data: progressData } = useQuery({
    queryKey: ["/api/jobs", jobId, "progress"],
    enabled: !!jobId,
    refetchInterval: 10000, // Reduced from 5s to 10s for better performance
  });

  if (!(progressData as any)?.progress?.workers || (progressData as any)?.progress?.workers?.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No assigned workers found
      </div>
    );
  }

  const workers = (progressData as any)?.progress?.workers || [];

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
              {/* Worker StaffId Box Icon */}
              <div className="flex items-center space-x-2">
                <div 
                  className="px-2 py-1 rounded text-xs font-bold min-w-[2.5rem] text-center"
                  style={{ 
                    backgroundColor: worker.assignedColor || '#6B7280',
                    color: getContrastingTextColor(worker.assignedColor || '#6B7280')
                  }}
                  title={`Worker: ${worker.staffId || 'Worker'}`}
                  data-testid={`worker-staffid-icon-${worker.id}`}
                >
                  {worker.staffId || 'Worker'}
                </div>
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
