import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

interface BoxRequirement {
  id: string;
  jobId: string;
  boxNumber: number;
  customerName: string;
  barCode: string;
  productName: string;
  requiredQty: number;
  scannedQty: number;
  isComplete: boolean;
  lastWorkerUserId?: string;
  lastWorkerColor?: string;
}

interface FilteredBoxData {
  boxNumber: number;
  customerName: string;
  totalQty: number;
  scannedQty: number;
  isComplete: boolean;
  assignedWorker?: string;
  lastWorkerColor?: string;
  lastWorkerStaffId?: string;
  filteredTotalQty?: number;
  filteredScannedQty?: number;
}

export function useFilteredBoxData(jobId: string, filterByProducts: string[] = []) {
  // Fetch box requirements data
  const { data: boxRequirementsResponse, isLoading, error } = useQuery({
    queryKey: [`/api/jobs/${jobId}/box-requirements`],
    enabled: !!jobId,
  });

  const processedData = useMemo(() => {
    if (!boxRequirementsResponse) {
      return { boxData: [], availableProducts: [], isLoading: true };
    }

    const boxRequirementsData = boxRequirementsResponse as { 
      boxRequirements: BoxRequirement[], 
      workers: Record<string, { id: string, name: string, staffId: string }> 
    };

    const boxRequirements = boxRequirementsData.boxRequirements || [];
    const workersData = boxRequirementsData.workers || {};

    // Get all unique product names for filtering, sorted alphabetically
    const productNamesSet = new Set(boxRequirements.map(req => req.productName));
    const availableProducts = Array.from(productNamesSet).sort();

    // Process box data
    const boxes: { [key: number]: FilteredBoxData } = {};
    const isFiltering = filterByProducts.length > 0;

    boxRequirements.forEach(requirement => {
      if (!boxes[requirement.boxNumber]) {
        boxes[requirement.boxNumber] = {
          boxNumber: requirement.boxNumber,
          customerName: requirement.customerName,
          totalQty: 0,
          scannedQty: 0,
          isComplete: true,
          assignedWorker: requirement.lastWorkerUserId ? workersData[requirement.lastWorkerUserId]?.name : undefined,
          lastWorkerColor: requirement.lastWorkerColor,
          lastWorkerStaffId: requirement.lastWorkerUserId ? workersData[requirement.lastWorkerUserId]?.staffId : undefined,
          filteredTotalQty: 0,
          filteredScannedQty: 0,
        };
      }

      // Always calculate full totals
      boxes[requirement.boxNumber].totalQty += requirement.requiredQty;
      boxes[requirement.boxNumber].scannedQty += requirement.scannedQty;

      // Update completion status - all items must be complete for box to be complete
      boxes[requirement.boxNumber].isComplete = boxes[requirement.boxNumber].isComplete && requirement.isComplete;

      // Calculate filtered quantities if filtering is active
      if (isFiltering && filterByProducts.includes(requirement.productName)) {
        boxes[requirement.boxNumber].filteredTotalQty! += requirement.requiredQty;
        boxes[requirement.boxNumber].filteredScannedQty! += requirement.scannedQty;
      }

      // Update worker tracking (use most recent worker info)
      if (requirement.lastWorkerColor) {
        boxes[requirement.boxNumber].lastWorkerColor = requirement.lastWorkerColor;
      }
      if (requirement.lastWorkerUserId && workersData[requirement.lastWorkerUserId]) {
        boxes[requirement.boxNumber].assignedWorker = workersData[requirement.lastWorkerUserId].name;
        boxes[requirement.boxNumber].lastWorkerStaffId = workersData[requirement.lastWorkerUserId].staffId;
      }
    });

    let boxList = Object.values(boxes);

    // Filter out boxes with 0 quantity of filtered items when filtering is active
    if (isFiltering) {
      boxList = boxList.filter(box => (box.filteredTotalQty || 0) > 0);
    }

    // Sort by box number
    boxList = boxList.sort((a, b) => a.boxNumber - b.boxNumber);

    return {
      boxData: boxList,
      availableProducts,
      isLoading: false,
    };
  }, [boxRequirementsResponse, filterByProducts]);

  return {
    ...processedData,
    isLoading: isLoading || processedData.isLoading,
    error,
  };
}