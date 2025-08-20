import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CheckBoxButtonProps {
  boxNumber: number;
  jobId: string;
  totalItemsExpected: number;
  isUserAuthorized: boolean;
  onCheckStart?: (sessionId: string) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

interface CheckSession {
  id: string;
  boxNumber: number;
  status: string;
  totalItemsExpected: number;
  totalItemsScanned: number;
  discrepanciesFound: number;
  isComplete: boolean;
}

export function CheckBoxButton({
  boxNumber,
  jobId,
  totalItemsExpected,
  isUserAuthorized,
  onCheckStart,
  className = '',
  size = 'default'
}: CheckBoxButtonProps) {
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCheckSessionMutation = useMutation({
    mutationFn: async (sessionData: { jobId: string; boxNumber: number; totalItemsExpected: number }) => {
      const response = await apiRequest('POST', '/api/check-sessions', sessionData);
      return await response.json();
    },
    onSuccess: (data: { session: CheckSession }) => {
      toast({
        title: "Check Session Started",
        description: `Box ${boxNumber} verification session created successfully.`
      });
      
      if (onCheckStart) {
        onCheckStart(data.session.id);
      }
      
      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/check-sessions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/progress`] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to start check session';
      toast({
        title: "Check Session Failed",
        description: errorMessage,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsChecking(false);
    }
  });

  const handleCheckBox = async () => {
    if (!isUserAuthorized) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to perform box checks. Contact your manager to enable this feature.",
        variant: "destructive"
      });
      return;
    }

    setIsChecking(true);
    
    createCheckSessionMutation.mutate({
      jobId,
      boxNumber,
      totalItemsExpected
    });
  };

  if (!isUserAuthorized) {
    return (
      <Button
        variant="ghost"
        size={size}
        className={`text-muted-foreground cursor-not-allowed ${className}`}
        disabled
        data-testid={`check-box-disabled-${boxNumber}`}
      >
        <Square className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleCheckBox}
      disabled={isChecking}
      className={`text-primary hover:text-primary-foreground hover:bg-primary ${className}`}
      data-testid={`check-box-button-${boxNumber}`}
    >
      {isChecking ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckSquare className="h-4 w-4" />
      )}
    </Button>
  );
}