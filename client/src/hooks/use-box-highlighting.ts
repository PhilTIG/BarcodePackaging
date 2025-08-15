/**
 * POC-Style Box Highlighting Hook
 * Manages single box highlighting with worker color coordination
 */

import { useState, useCallback } from 'react';

export interface BoxHighlighting {
  lastScannedBoxNumber: number | null;
  workerColors: Map<number, string>; // boxNumber -> worker color
  justScannedBoxes: Set<number>; // boxes that show green highlight
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
  });

  // Update box highlighting when a scan occurs
  const updateBoxHighlighting = useCallback((
    boxNumber: number,
    workerId?: string,
    workerColor?: string
  ) => {
    setHighlighting(prev => {
      const newHighlighting = {
        lastScannedBoxNumber: boxNumber,
        workerColors: new Map(prev.workerColors),
        justScannedBoxes: new Set([boxNumber]), // Only one box highlighted at a time - PERSISTENT until next scan
      };

      // Track worker color for this box
      if (workerId && workerColor) {
        newHighlighting.workerColors.set(boxNumber, workerColor);
      }

      return newHighlighting;
    });

    // REMOVED AUTO-CLEAR: Green highlighting now persists until next scan
    // The green color will only be cleared when a new scan occurs (above line creates new Set with only current box)
  }, []);

  // Clear all highlighting
  const clearHighlighting = useCallback(() => {
    setHighlighting({
      lastScannedBoxNumber: null,
      workerColors: new Map(),
      justScannedBoxes: new Set(),
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
  } => {
    const isJustScanned = highlighting.justScannedBoxes.has(boxNumber);
    const workerColor = highlighting.workerColors.get(boxNumber);
    
    // Priority: GREEN (just-scanned) > Grey-Red (complete) > Worker Color > Grey (empty)
    if (isJustScanned) {
      return {
        backgroundColor: 'bg-green-500', // CHANGED: Completely green background instead of light green
        borderColor: 'border-green-600',
        textColor: 'text-white', // White text for contrast against green background
        badgeColor: 'bg-green-700', // Darker green for badge
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
      // Convert hex color to Tailwind-compatible classes
      const colorClass = hexToTailwindColor(workerColor);
      return {
        backgroundColor: `${colorClass}-50`,
        borderColor: `${colorClass}-300`,
        textColor: `${colorClass}-700`,
        badgeColor: workerColor, // Use exact hex for badge
      };
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

// Helper function to convert hex colors to Tailwind color classes
function hexToTailwindColor(hexColor: string): string {
  const colorMap: { [key: string]: string } = {
    '#3b82f6': 'blue',    // Worker 1 - blue
    '#ef4444': 'red',     // Worker 2 - red  
    '#10b981': 'emerald', // Worker 3 - green
    '#f59e0b': 'amber',   // Worker 4 - yellow
  };
  
  return colorMap[hexColor?.toLowerCase()] || 'gray';
}