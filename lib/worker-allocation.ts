/**
 * Worker Allocation System for Multi-Worker Warehouse Scanning
 * Implements POC-compliant box allocation patterns for up to 4 workers
 */

export type WorkerAllocationPattern = 'ascending' | 'descending' | 'middle_up' | 'middle_down';

export interface WorkerAssignment {
  workerId: string;
  pattern: WorkerAllocationPattern;
  assignedColor: string;
  currentBoxIndex?: number;
}

export interface AllocationContext {
  totalBoxes: number;
  maxBoxNumber: number;
  minBoxNumber: number;
  middleBoxNumber: number;
}

/**
 * Automatically assigns allocation patterns based on worker order
 * 1st Worker: Ascending (1, 2, 3, 4...)
 * 2nd Worker: Descending (100, 99, 98, 97...)  
 * 3rd Worker: Middle Up (50, 51, 52, 53...)
 * 4th Worker: Middle Down (49, 48, 47, 46...)
 */
export function assignWorkerPattern(workerIndex: number): WorkerAllocationPattern {
  switch (workerIndex % 4) {
    case 0: return 'ascending';
    case 1: return 'descending';
    case 2: return 'middle_up';
    case 3: return 'middle_down';
    default: return 'ascending';
  }
}

/**
 * Get the next available box number for a worker based on their allocation pattern
 */
export function getNextBoxForWorker(
  pattern: WorkerAllocationPattern,
  availableBoxNumbers: number[],
  context: AllocationContext,
  currentBoxIndex: number = 0
): number | null {
  if (availableBoxNumbers.length === 0) return null;

  const sortedBoxes = [...availableBoxNumbers].sort((a, b) => a - b);
  
  switch (pattern) {
    case 'ascending':
      // Start from box 1 and go up: 1, 2, 3, 4...
      return sortedBoxes[0];
      
    case 'descending':
      // Start from highest box and go down: 100, 99, 98, 97...
      return sortedBoxes[sortedBoxes.length - 1];
      
    case 'middle_up':
      // Start from middle and go up: 50, 51, 52, 53...
      const middleIndex = Math.floor(sortedBoxes.length / 2);
      return sortedBoxes[middleIndex] || sortedBoxes[0];
      
    case 'middle_down':
      // Start from middle-1 and go down: 49, 48, 47, 46...
      const middleDownIndex = Math.floor(sortedBoxes.length / 2) - 1;
      return sortedBoxes[Math.max(0, middleDownIndex)];
      
    default:
      return sortedBoxes[0];
  }
}

/**
 * Get all boxes that a worker should work on based on their pattern
 * Returns the complete sequence a worker will follow
 */
export function getWorkerBoxSequence(
  pattern: WorkerAllocationPattern,
  maxBoxes: number = 100
): number[] {
  const allBoxes = Array.from({ length: maxBoxes }, (_, i) => i + 1);
  
  switch (pattern) {
    case 'ascending':
      return allBoxes; // [1, 2, 3, ..., 100]
      
    case 'descending':
      return allBoxes.reverse(); // [100, 99, 98, ..., 1]
      
    case 'middle_up': {
      const middle = Math.floor(maxBoxes / 2);
      const upperHalf = allBoxes.slice(middle); // [50, 51, ..., 100]
      const lowerHalf = allBoxes.slice(0, middle).reverse(); // [49, 48, ..., 1]
      return [...upperHalf, ...lowerHalf]; // [50, 51, ..., 100, 49, 48, ..., 1]
    }
      
    case 'middle_down': {
      const middle = Math.floor(maxBoxes / 2);
      const lowerHalf = allBoxes.slice(0, middle).reverse(); // [49, 48, ..., 1]
      const upperHalf = allBoxes.slice(middle); // [50, 51, ..., 100]
      return [...lowerHalf, ...upperHalf]; // [49, 48, ..., 1, 50, 51, ..., 100]
    }
      
    default:
      return allBoxes;
  }
}

/**
 * Determine which worker should scan a specific item based on allocation patterns
 * Returns the worker ID that should handle this item according to their pattern
 */
export function getWorkerForBox(
  boxNumber: number,
  workerAssignments: WorkerAssignment[],
  maxBoxes: number = 100
): string | null {
  // Sort workers by their allocation pattern priority
  const sortedWorkers = [...workerAssignments].sort((a, b) => {
    const patternPriority = { 'ascending': 0, 'descending': 1, 'middle_up': 2, 'middle_down': 3 };
    return (patternPriority[a.pattern] || 0) - (patternPriority[b.pattern] || 0);
  });

  // Find the worker whose pattern should handle this box number
  for (const worker of sortedWorkers) {
    const sequence = getWorkerBoxSequence(worker.pattern, maxBoxes);
    const currentIndex = worker.currentBoxIndex || 0;
    
    // Check if this box number is in the worker's upcoming sequence
    const boxIndex = sequence.indexOf(boxNumber);
    if (boxIndex !== -1 && boxIndex >= currentIndex) {
      return worker.workerId;
    }
  }
  
  // Fallback: assign to first worker
  return workerAssignments[0]?.workerId || null;
}

/**
 * Get the next box number a worker should scan into based on their allocation pattern
 */
export function getNextBoxForWorkerById(
  workerId: string,
  workerAssignments: WorkerAssignment[],
  availableBoxNumbers: number[],
  maxBoxes: number = 100
): number | null {
  const worker = workerAssignments.find(w => w.workerId === workerId);
  if (!worker || availableBoxNumbers.length === 0) return null;
  
  const sequence = getWorkerBoxSequence(worker.pattern, maxBoxes);
  const currentIndex = worker.currentBoxIndex || 0;
  
  // Find the next available box in the worker's sequence
  for (let i = currentIndex; i < sequence.length; i++) {
    const nextBox = sequence[i];
    if (availableBoxNumbers.includes(nextBox)) {
      return nextBox;
    }
  }
  
  return null;
}

/**
 * Validate if a worker can scan into a specific box based on their allocation pattern
 */
export function canWorkerScanBox(
  workerId: string,
  boxNumber: number,
  workerAssignments: WorkerAssignment[],
  maxBoxes: number = 100
): boolean {
  const worker = workerAssignments.find(w => w.workerId === workerId);
  if (!worker) return false;
  
  const sequence = getWorkerBoxSequence(worker.pattern, maxBoxes);
  const currentIndex = worker.currentBoxIndex || 0;
  
  // Check if the box is in the worker's upcoming sequence
  const boxIndex = sequence.indexOf(boxNumber);
  return boxIndex !== -1 && boxIndex >= currentIndex;
}

/**
 * Update worker's current position after they scan into a box
 */
export function updateWorkerProgress(
  workerId: string,
  scannedBoxNumber: number,
  workerAssignments: WorkerAssignment[],
  maxBoxes: number = 100
): WorkerAssignment[] {
  return workerAssignments.map(worker => {
    if (worker.workerId === workerId) {
      const sequence = getWorkerBoxSequence(worker.pattern, maxBoxes);
      const boxIndex = sequence.indexOf(scannedBoxNumber);
      
      return {
        ...worker,
        currentBoxIndex: boxIndex >= 0 ? boxIndex + 1 : worker.currentBoxIndex
      };
    }
    return worker;
  });
}

/**
 * Get worker assignment colors (default colors for up to 4 workers)
 */
export function getDefaultWorkerColors(): string[] {
  return ['#3b82f6', '#ef4444', '#10b981', '#f59e0b']; // blue, red, green, yellow
}