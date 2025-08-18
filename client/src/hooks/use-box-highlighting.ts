/**
 * POC-Style Box Highlighting Hook
 * Manages single box highlighting with worker color coordination
 */

import { useState, useCallback } from 'react';

export interface BoxHighlighting {
  lastScannedBoxNumber: number | null;
  workerColors: Map<number, string>; // boxNumber -> worker color
  justScannedBoxes: Set<number>; // boxes that show green highlight
  activeWorkerBoxes: Map<string, number>; // workerId -> current active box number
  workerStaffIds: Map<number, string>; // boxNumber -> worker staffId for display
}

interface UseBoxHighlightingOptions {
  autoResetDelay?: number; // ms to clear green highlighting
}

export function useBoxHighlighting(options: UseBoxHighlightingOptions = {}) {
  const { autoResetDelay = 2000 } = options;
  
  const [highlighting, setHighlighting] = useState<BoxHighlighting>({
    lastScannedBoxNumber: null,
    workerColors: new Map(),
    justScannedBoxes: new Set(),
    activeWorkerBoxes: new Map(),
    workerStaffIds: new Map(),
  });

  // Update box highlighting when a scan occurs
  const updateBoxHighlighting = useCallback((
    boxNumber: number,
    workerId?: string,
    workerColor?: string,
    workerStaffId?: string
  ) => {
    setHighlighting(prev => {
      const newActiveWorkerBoxes = new Map(prev.activeWorkerBoxes);
      const newWorkerColors = new Map(prev.workerColors);
      const newWorkerStaffIds = new Map(prev.workerStaffIds);

      // If this worker was previously highlighting another box, remove that highlighting
      if (workerId) {
        const previousBox = prev.activeWorkerBoxes.get(workerId);
        if (previousBox && previousBox !== boxNumber) {
          // Clear previous box's worker highlighting (keep other data)
          newWorkerColors.delete(previousBox);
          newWorkerStaffIds.delete(previousBox);
        }
        
        // Set current box as this worker's active box
        newActiveWorkerBoxes.set(workerId, boxNumber);
      }

      const newHighlighting = {
        lastScannedBoxNumber: boxNumber,
        workerColors: newWorkerColors,
        justScannedBoxes: new Set([boxNumber]), // Only one box highlighted at a time - PERSISTENT until next scan
        activeWorkerBoxes: newActiveWorkerBoxes,
        workerStaffIds: newWorkerStaffIds,
      };

      // Track worker color and staffId for this box
      if (workerId && workerColor && workerStaffId) {
        newHighlighting.workerColors.set(boxNumber, workerColor);
        newHighlighting.workerStaffIds.set(boxNumber, workerStaffId);
      }

      return newHighlighting;
    });
  }, []);

  // Clear all highlighting
  const clearHighlighting = useCallback(() => {
    setHighlighting({
      lastScannedBoxNumber: null,
      workerColors: new Map(),
      justScannedBoxes: new Set(),
      activeWorkerBoxes: new Map(),
      workerStaffIds: new Map(),
    });
  }, []);

  // Get box highlight style based on priority system
  const getBoxHighlight = useCallback((
    boxNumber: number,
    isComplete: boolean
  ): {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    badgeColor: string;
    workerStaffId?: string;
  } => {
    const isJustScanned = highlighting.justScannedBoxes.has(boxNumber);
    const workerColor = highlighting.workerColors.get(boxNumber);
    const workerStaffId = highlighting.workerStaffIds.get(boxNumber);
    
    // Priority: GREEN (just-scanned) > Grey-Red (complete) > Worker Color > Grey (empty)
    if (isJustScanned) {
      return {
        backgroundColor: 'bg-green-500', // CHANGED: Completely green background instead of light green
        borderColor: 'border-green-600',
        textColor: 'text-white', // White text for contrast against green background
        badgeColor: 'bg-green-700', // Darker green for badge
        workerStaffId,
      };
    }
    
    if (isComplete) {
      return {
        backgroundColor: 'bg-red-50',
        borderColor: 'border-red-300',
        textColor: 'text-red-700',
        badgeColor: 'bg-red-400',
      };
    }
    
    if (workerColor) {
      // Convert hex color to CSS with 50% transparency for subtlety
      const rgbColor = hexToRgb(workerColor);
      if (rgbColor) {
        return {
          backgroundColor: `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.5)`, // 50% transparency
          borderColor: `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.8)`, // 80% for border
          textColor: 'text-gray-800', // Darker text for readability
          badgeColor: workerColor, // Use exact hex for badge
          workerStaffId,
        };
      }
    }
    
    // Default grey for empty/unassigned
    return {
      backgroundColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-500',
      badgeColor: 'bg-gray-400',
    };
  }, [highlighting]);

  return {
    highlighting,
    updateBoxHighlighting,
    clearHighlighting,
    getBoxHighlight,
  };
}

// Helper function to convert hex colors to RGB for transparency
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Helper function to convert hex colors to Tailwind color classes (kept for fallback)
function hexToTailwindColor(hexColor: string): string {
  const colorMap: { [key: string]: string } = {
    '#3b82f6': 'blue',    // Worker 1 - blue
    '#ef4444': 'red',     // Worker 2 - red  
    '#10b981': 'emerald', // Worker 3 - green
    '#f59e0b': 'amber',   // Worker 4 - yellow
  };
  
  return colorMap[hexColor?.toLowerCase()] || 'gray';
}