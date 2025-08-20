import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Package2, Clock, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

interface JobSwitcherProps {
  assignments: any[];
  currentJobId?: string;
  onJobSwitch?: (jobId: string) => void;
  className?: string;
}

export function JobSwitcher({ assignments, currentJobId, onJobSwitch, className = "" }: JobSwitcherProps) {
  const [, setLocation] = useLocation();

  const currentAssignment = assignments.find(a => a.jobId === currentJobId);
  const currentJob = currentAssignment?.job;

  const handleJobSwitch = (jobId: string) => {
    if (onJobSwitch) {
      onJobSwitch(jobId);
    } else {
      setLocation(`/scanner/${jobId}`);
    }
  };

  if (assignments.length <= 1) {
    return null;
  }

  return (
    <Card className={`w-full ${className}`} data-testid="job-switcher">
      <CardContent className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full h-auto p-2 justify-between hover:bg-gray-50"
              data-testid="job-switcher-trigger"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Worker Color Indicator */}
                <div
                  className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0"
                  style={{ backgroundColor: currentAssignment?.assignedColor || '#3B82F6' }}
                />
                
                {/* Job Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-sm truncate">
                    {currentJob?.name || 'Select Job'}
                  </div>
                  {currentJob && (
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Package2 className="w-3 h-3" />
                        {currentJob.totalProducts || 0} items
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.round(((currentJob.completedItems || 0) / (currentJob.totalProducts || 1)) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="secondary" className="text-xs">
                  {assignments.length} jobs
                </Badge>
                <ChevronDown className="w-4 h-4" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto" align="start">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 mb-2">Your Assigned Jobs</div>
            </div>
            
            {assignments.map((assignment, index) => {
              const job = assignment.job;
              const isActive = assignment.jobId === currentJobId;
              const completionPercentage = job ? Math.round(((job.completedItems || 0) / (job.totalProducts || 1)) * 100) : 0;
              
              return (
                <div key={assignment.id}>
                  <DropdownMenuItem
                    onClick={() => handleJobSwitch(assignment.jobId)}
                    className={`p-3 cursor-pointer ${isActive ? 'bg-blue-50' : ''}`}
                    data-testid={`job-option-${assignment.jobId}`}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {/* Worker Color Indicator */}
                      <div
                        className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: assignment.assignedColor }}
                      />
                      
                      {/* Job Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">
                            {job?.name || 'Loading...'}
                          </span>
                          {isActive && (
                            <Badge variant="default" className="text-xs ml-2">
                              Active
                            </Badge>
                          )}
                        </div>
                        
                        {job && (
                          <>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                              <span className="flex items-center gap-1">
                                <Package2 className="w-3 h-3" />
                                {job.totalProducts || 0} items
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {(job.assignments || []).length} workers
                              </span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="w-full">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Progress</span>
                                <span>{completionPercentage}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${completionPercentage}%` }}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </DropdownMenuItem>
                  
                  {index < assignments.length - 1 && <DropdownMenuSeparator />}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}