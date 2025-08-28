
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

    setHighlighting(prev => ({
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
    }));
  }, [currentUser]);

  const clearHighlighting = useCallback((boxNumber: number) => {
    setHighlighting(prev => ({
      ...prev,
      lastScannedBoxNumber: prev.lastScannedBoxNumber === boxNumber ? null : prev.lastScannedBoxNumber,
      workerColors: {
        ...prev.workerColors,
        [boxNumber]: undefined
      },
      workerStaffIds: {
        ...prev.workerStaffIds,
        [boxNumber]: undefined
      }
    }));
  }, []);

  const clearAllHighlighting = useCallback(() => {
    setHighlighting({
      lastScannedBoxNumber: null,
      workerColors: {},
      activeWorkerBoxes: {},
      workerStaffIds: {}
    });
  }, []);

  // Auto-clear highlighting after 3 seconds for manager/supervisor views
  useEffect(() => {
    if (!currentUser || currentUser.role === 'worker') return;
    if (!highlighting.lastScannedBoxNumber) return;

    const timer = setTimeout(() => {
      setHighlighting(prev => ({
        ...prev,
        lastScannedBoxNumber: null,
        workerColors: {},
        workerStaffIds: {}
      }));
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
