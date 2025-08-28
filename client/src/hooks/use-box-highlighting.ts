
import { useState, useEffect, useCallback } from 'react';

interface BoxHighlighting {
  lastScannedBoxNumber: number | null;
  workerColors: Record<number, string>;
  activeWorkerBoxes: Record<string, number>;
  workerStaffIds: Record<number, string>;
}

export function useBoxHighlighting(currentUser?: { role: string; id: string }) {
  const [highlighting, setHighlighting] = useState<BoxHighlighting>({
    lastScannedBoxNumber: null,
    workerColors: {},
    activeWorkerBoxes: {},
    workerStaffIds: {}
  });

  const updateHighlighting = useCallback((
    boxNumber: number,
    workerId: string,
    workerColor?: string,
    workerStaffId?: string
  ) => {
    if (!currentUser) return;

    const mode = currentUser.role === 'worker' ? 'Worker' : 'Manager';
    
    console.log(`[useBoxHighlighting] Updated highlighting for box ${boxNumber} (${mode} mode):`, {
      workerId,
      workerColor,
      workerStaffId,
      highlighting
    });

    setHighlighting(prev => {
      const newState = {
        ...prev,
        lastScannedBoxNumber: boxNumber,
        workerColors: workerColor ? {
          ...prev.workerColors,
          [boxNumber]: workerColor
        } : prev.workerColors,
        activeWorkerBoxes: {
          ...prev.activeWorkerBoxes,
          [workerId]: boxNumber
        },
        workerStaffIds: workerStaffId ? {
          ...prev.workerStaffIds,
          [boxNumber]: workerStaffId
        } : prev.workerStaffIds
      };

      console.log(`[useBoxHighlighting] New highlighting state - worker colors will persist:`, {
        newWorkerColors: newState.workerColors,
        newWorkerStaffIds: newState.workerStaffIds
      });
      return newState;
    });
  }, [currentUser]);

  const clearHighlighting = useCallback((boxNumber: number) => {
    setHighlighting(prev => {
      const { [boxNumber]: removedColor, ...remainingColors } = prev.workerColors;
      const { [boxNumber]: removedStaffId, ...remainingStaffIds } = prev.workerStaffIds;
      
      return {
        ...prev,
        lastScannedBoxNumber: prev.lastScannedBoxNumber === boxNumber ? null : prev.lastScannedBoxNumber,
        workerColors: remainingColors,
        workerStaffIds: remainingStaffIds
      };
    });
  }, []);

  const clearAllHighlighting = useCallback(() => {
    setHighlighting({
      lastScannedBoxNumber: null,
      workerColors: {},
      activeWorkerBoxes: {},
      workerStaffIds: {}
    });
  }, []);

  // Auto-clear green highlighting after 3 seconds for manager/supervisor views
  // Note: Worker colors should persist indefinitely - only the green "just scanned" highlight gets cleared
  useEffect(() => {
    if (!currentUser || currentUser.role === 'worker') return;
    if (!highlighting.lastScannedBoxNumber) return;

    const timer = setTimeout(() => {
      console.log(`[useBoxHighlighting] Auto-clearing green highlight for box ${highlighting.lastScannedBoxNumber} while preserving worker colors:`, highlighting.workerColors);
      setHighlighting(prev => {
        // Create new state preserving all worker color data
        const newState = {
          ...prev,
          lastScannedBoxNumber: null
          // Explicitly keep workerColors and workerStaffIds - DO NOT clear them
        };
        console.log(`[useBoxHighlighting] Timer cleared - preserved worker colors:`, newState.workerColors);
        return newState;
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [highlighting.lastScannedBoxNumber, currentUser?.role]);

  return {
    highlighting,
    updateHighlighting,
    clearHighlighting,
    clearAllHighlighting
  };
}
