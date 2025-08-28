import { useMemo, useEffect, useState, memo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useBoxHighlighting } from "@/hooks/use-box-highlighting";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAuth } from "@/hooks/use-auth";
import { BoxDetailsModal } from "./box-details-modal";
import { useQuery } from "@tanstack/react-query";
import { useFilteredBoxData } from "@/hooks/use-filtered-box-data";

interface Product {
  id: string;
  customerName: string;
  qty: number;
  scannedQty: number;
  boxNumber: number;
  isComplete: boolean;
  lastWorkerUserId?: string;
  lastWorkerColor?: string;
  lastWorkerStaffId?: string;
}

interface CustomerBoxGridProps {
  products: Product[];
  jobId: string;
  supervisorView?: boolean;
  lastScannedBoxNumber?: number | null; // For POC-style single box highlighting
  onBoxScanUpdate?: (boxNumber: number, workerId?: string, workerColor?: string, workerStaffId?: string) => void;
  onCheckCount?: (boxNumber: number, jobId: string) => void;
  filterByProducts?: string[]; // Array of product names to filter by
  filterByGroups?: string[]; // Array of group names to filter by
}

const CustomerBoxGridComponent = memo(function CustomerBoxGrid({ products, jobId, supervisorView = false, lastScannedBoxNumber = null, onBoxScanUpdate, onCheckCount, filterByProducts = [], filterByGroups = [] }: CustomerBoxGridProps) {

  // Use filtered box data when filtering is requested
  const { boxData: filteredBoxData, availableProducts, isLoading: filterDataLoading } = useFilteredBoxData(
    (filterByProducts.length > 0 || filterByGroups.length > 0) ? jobId : "", // Only fetch when filtering is active
    filterByProducts,
    filterByGroups
  );
  // State for box details modal
  const [selectedBox, setSelectedBox] = useState<{
    boxNumber: number;
    customerName: string;
    totalQty: number;
    scannedQty: number;
    isComplete: boolean;
    lastWorkerColor?: string;
  } | null>(null);
  // Use actual user preferences for box layout
  const { preferences } = useUserPreferences();

  // Get current user for worker filtering
  const { user } = useAuth();

  // Worker box highlighting system - behavior depends on supervisorView
  const { highlighting, updateHighlighting, clearHighlighting } = useBoxHighlighting(user);

  // WebSocket handler for real-time highlighting
  const handleWebSocketUpdate = useCallback((boxNumber: number, workerId: string, workerColor?: string, workerStaffId?: string) => {
    console.log(`[CustomerBoxGrid] WebSocket scan update: Box ${boxNumber}, Worker ${workerId}`, {
      workerColor,
      workerStaffId,
      supervisorView,
      currentUser: user?.id
    });

    if (supervisorView && workerColor && workerStaffId) {
      // Managers/Supervisors: Show all worker colors
      updateHighlighting(boxNumber, workerId, workerColor, workerStaffId);
    } else if (!supervisorView && workerColor && workerStaffId && workerId === user?.id) {
      // Workers: Only show their own color background
      updateHighlighting(boxNumber, workerId, workerColor, workerStaffId);
    }
    // Note: All numerical updates (box counts, percentages) happen via React Query invalidation
  }, [supervisorView, user?.id, updateHighlighting]);

  // Connect WebSocket for all views (workers need numerical updates, supervisors need highlighting)
  useWebSocket(jobId, handleWebSocketUpdate);

  // Query for check sessions to show completion status
  const { data: checkSessionsData } = useQuery({
    queryKey: [`/api/check-sessions?jobId=${jobId}`],
    enabled: !!jobId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  const checkSessions = (checkSessionsData as any)?.sessions || [];

  // Function to get check status for a box
  const getCheckStatus = (boxNumber: number): 'completed' | 'rejected' | null => {
    if (!checkSessions) return null;

    const boxSession = checkSessions.find((s: any) => s.boxNumber === boxNumber && s.status === 'completed');
    if (!boxSession) return null;

    // Visual indicator logic:
    // - Green check: No discrepancies found OR corrections were applied
    // - Red cross: Discrepancies found AND corrections were NOT applied (rejected)
    console.log(`[CheckStatus] Box ${boxNumber}: discrepancies=${boxSession.discrepanciesFound}, corrections=${boxSession.correctionsApplied}`);

    if (boxSession.discrepanciesFound > 0 && boxSession.correctionsApplied === false) {
      return 'rejected';
    }
    return 'completed';
  };

  // Helper function to determine box background color and styling
  const getBoxHighlight = useCallback((boxNumber: number, products: any[], isComplete: boolean, lastWorkerColor: string | null, lastWorkerUserId: string | null) => {
    // Check if box is empty (no scanned items and no products assigned)
    const isEmptyBox = !products.some(p => p.scannedQty > 0);

    // Priority 1: WORKER COLOR WITH 60% TRANSPARENCY - Just scanned (highest priority)
    if (highlighting.lastScannedBoxNumber === boxNumber) {
      const workerColor = highlighting.workerColors[boxNumber] || lastWorkerColor;
      const workerStaffId = highlighting.workerStaffIds[boxNumber] || lastWorkerUserId;
      if (workerColor) {
        // Convert hex to rgba with 60% opacity
        const hex = workerColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return {
          backgroundColor: `rgba(${r}, ${g}, ${b}, 0.6)`, // 60% transparency
          borderColor: workerColor,
          textColor: 'black',
          workerStaffId: workerStaffId,
          numberCircleColor: workerColor
        };
      }
      // Fallback if no worker color
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.6)', // Green with 60% transparency
        borderColor: '#16a34a',
        textColor: 'black',
        workerStaffId: highlighting.workerStaffIds[boxNumber],
        numberCircleColor: isEmptyBox ? '#6b7280' : undefined // Grey for empty boxes only
      };
    }

    // Priority 2: GREY-RED - Complete box (second priority)
    if (isComplete) {
      return {
        backgroundColor: '#dc2626', // Red-600
        borderColor: '#b91c1c', // Red-700
        textColor: 'white'
      };
    }

    // Priority 3: NO BACKGROUND COLOR - Box has items but not just scanned (third priority)
    // The number circle should keep the worker color, but no background highlight
    // Use highlighting state worker color if available, otherwise fallback to database worker color
    const workerColor = highlighting.workerColors[boxNumber] || lastWorkerColor;
    const workerStaffId = highlighting.workerStaffIds[boxNumber] || lastWorkerUserId;
    
    // Filter products for this specific box to check if it has scanned items
    const boxProducts = products.filter(p => p.boxNumber === boxNumber);
    const hasScannedItems = boxProducts.some(p => p.scannedQty > 0);
    
    if (workerColor && hasScannedItems) {
      return {
        backgroundColor: '#f3f4f6', // Gray-100 (default)
        borderColor: '#d1d5db', // Gray-300 (default)
        textColor: 'black',
        workerStaffId: workerStaffId,
        numberCircleColor: workerColor // Keep the worker color on number circle
      };
    }

    // Priority 4: GREY - Empty box (lowest priority)
    return {
      backgroundColor: '#f3f4f6', // Gray-100
      borderColor: '#d1d5db', // Gray-300
      textColor: 'black',
      numberCircleColor: '#6b7280' // Grey circle for empty boxes only
    };
  }, [highlighting]);

  // Choose between filtered data (from box requirements) or legacy product data
  const boxData = useMemo(() => {
    const isFiltering = filterByProducts.length > 0 || filterByGroups.length > 0;

    // When filtering is active, use the filtered box data
    if (isFiltering && filteredBoxData.length > 0) {
      return filteredBoxData;
    }

    // Otherwise, use legacy product-based calculation
    const boxes: { [key: number]: {
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
    }} = {};

    // BOX LIMIT FIX: Filter out NULL boxNumber products as backup protection
    products
      .filter(product => product.boxNumber !== null && product.boxNumber !== undefined)
      .forEach(product => {
        if (!boxes[product.boxNumber]) {
          boxes[product.boxNumber] = {
            boxNumber: product.boxNumber,
            customerName: product.customerName,
            totalQty: 0,
            scannedQty: 0,
            isComplete: false,
            lastWorkerColor: product.lastWorkerColor,
            filteredTotalQty: 0,
            filteredScannedQty: 0,
          };
        }

      boxes[product.boxNumber].totalQty += product.qty;
      boxes[product.boxNumber].scannedQty += product.scannedQty;

      // Box Complete = 100% fulfillment: scannedQty exactly equals totalQty
      boxes[product.boxNumber].isComplete = boxes[product.boxNumber].totalQty > 0 &&
                                           boxes[product.boxNumber].scannedQty === boxes[product.boxNumber].totalQty;

      // Update worker color and staffId tracking
      if (product.lastWorkerColor) {
        boxes[product.boxNumber].lastWorkerColor = product.lastWorkerColor;
      }
      if (product.lastWorkerStaffId) {
        boxes[product.boxNumber].lastWorkerStaffId = product.lastWorkerStaffId;
      }
    });

    return Object.values(boxes).sort((a, b) => a.boxNumber - b.boxNumber);
  }, [products, preferences.maxBoxesPerRow, filterByProducts, filterByGroups, filteredBoxData]);

  // Determine if we should use simplified design (when > 16 boxes per row)
  const isSimplifiedMode = preferences.maxBoxesPerRow > 16;

  // Create responsive grid classes based on actual box count and user preference
  const getGridClasses = () => {
    const actualBoxCount = boxData.length;
    const maxCols = preferences.maxBoxesPerRow;

    // Base classes for mobile (always 2 columns)
    let gridClasses = "grid grid-cols-2 gap-3";

    // Reduce gap for simplified mode
    if (isSimplifiedMode) {
      gridClasses = "grid grid-cols-2 gap-2";
    }

    // Tablet and desktop responsive classes based on maxBoxesPerRow preference
    if (maxCols <= 4 || actualBoxCount <= 4) {
      gridClasses += " md:grid-cols-4";
    } else if (maxCols <= 6 || actualBoxCount <= 6) {
      gridClasses += " md:grid-cols-4 lg:grid-cols-6";
    } else if (maxCols <= 8 || actualBoxCount <= 8) {
      gridClasses += " md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";
    } else if (maxCols <= 12 || actualBoxCount <= 12) {
      gridClasses += " md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12";
    } else if (maxCols <= 16 || actualBoxCount <= 16) {
      gridClasses += " md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 2xl:grid-cols-16";
    } else if (maxCols <= 24 || actualBoxCount <= 24) {
      gridClasses += " md:grid-cols-8 lg:grid-cols-12 xl:grid-cols-16 2xl:grid-cols-24";
    } else if (maxCols <= 32 || actualBoxCount <= 32) {
      gridClasses += " md:grid-cols-8 lg:grid-cols-12 xl:grid-cols-20 2xl:grid-cols-32";
    } else {
      gridClasses += " md:grid-cols-8 lg:grid-cols-12 xl:grid-cols-24 2xl:grid-cols-48";
    }

    return gridClasses;
  };

  // Update highlighting when lastScannedBoxNumber changes (worker view)
  useEffect(() => {
    if (lastScannedBoxNumber !== null && !supervisorView) {
      // Worker view: Use static box data for highlighting
      const scannedBox = boxData.find(box => box.boxNumber === lastScannedBoxNumber);
      if (scannedBox) {
        updateHighlighting(
          lastScannedBoxNumber,
          scannedBox.assignedWorker || user?.id || '',
          scannedBox.lastWorkerColor || '',
          scannedBox.lastWorkerStaffId || ''
        );
      }
    }
  }, [lastScannedBoxNumber, boxData, updateHighlighting, supervisorView, user?.id]);

  return (
    <div className={getGridClasses()} data-testid="customer-box-grid">
      {boxData.map((box) => {
        // Display logic: Use filtered quantities when filtering is active, otherwise use full quantities
        const isFiltering = filterByProducts.length > 0 || filterByGroups.length > 0;
        const displayTotalQty = isFiltering ? (box.filteredTotalQty || 0) : box.totalQty;
        const displayScannedQty = isFiltering ? (box.filteredScannedQty || 0) : box.scannedQty;
        const completionPercentage = displayTotalQty > 0 ? Math.round((displayScannedQty / displayTotalQty) * 100) : 0;

        // POC-style highlighting with worker color support
        const isLastScanned = highlighting.lastScannedBoxNumber === box.boxNumber;
        const boxHighlighting = getBoxHighlight(box.boxNumber, products, box.isComplete, box.lastWorkerColor, box.lastWorkerStaffId);

        // Handle custom background colors (rgba) vs Tailwind classes
        const customStyle = boxHighlighting.backgroundColor.startsWith('rgba') || boxHighlighting.backgroundColor.startsWith('#') ? {
          backgroundColor: boxHighlighting.backgroundColor,
          borderColor: boxHighlighting.borderColor,
        } : {};

        // Dynamic box sizing and styling based on mode
        const getBoxHeight = () => {
          if (!isSimplifiedMode) return '150px';
          return preferences.maxBoxesPerRow <= 32 ? '100px' : '80px';
        };

        const getPadding = () => {
          if (!isSimplifiedMode) return 'p-3';
          return preferences.maxBoxesPerRow <= 32 ? 'p-2' : 'p-1';
        };

        const boxClasses = [
          "border rounded-lg relative transition-all duration-200 cursor-pointer hover:shadow-lg group",
          getPadding(),
          !boxHighlighting.backgroundColor.startsWith('rgba') && !boxHighlighting.backgroundColor.startsWith('#') ? boxHighlighting.backgroundColor : '',
          !boxHighlighting.borderColor.startsWith('rgba') && !boxHighlighting.borderColor.startsWith('#') ? boxHighlighting.borderColor : '',
        ].filter(Boolean).join(" ");

        const handleBoxClick = () => {
          // Allow all users to click boxes and view details
          setSelectedBox({
            boxNumber: box.boxNumber,
            customerName: box.customerName,
            totalQty: box.totalQty,
            scannedQty: box.scannedQty,
            isComplete: box.isComplete,
            lastWorkerColor: box.lastWorkerColor
          });
        };

        return (
          <div
            key={box.boxNumber}
            className={boxClasses}
            style={{ minHeight: getBoxHeight(), ...customStyle }}
            data-testid={`box-${box.boxNumber}`}
            onClick={handleBoxClick}
            title={isSimplifiedMode ? `Customer: ${box.customerName}\nQty: ${displayScannedQty}/${displayTotalQty}` : undefined}
          >
            {isSimplifiedMode ? (
              /* SIMPLIFIED MODE - Box number and percentage only */
              <>
                {/* Lock icon for completed boxes */}
                {box.isComplete && (
                  <div className="absolute top-1 right-1 z-10">
                    <Lock className={`w-3 h-3 ${boxHighlighting.textColor === 'white' ? 'text-white' : 'text-black'}`} />
                  </div>
                )}

                {/* Green indicator for just-scanned box */}
                {isLastScanned && !box.isComplete && (
                  <div className="absolute top-1 left-1 z-10">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                )}

                {/* Simplified layout: Box number badge (center top) and percentage (center bottom) */}
                <div className="flex flex-col items-center justify-between h-full">
                  {/* Box Number Badge */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border border-white shadow text-white ${
                        (boxHighlighting.numberCircleColor || box.lastWorkerColor || highlighting.workerColors[box.boxNumber]) ? '' : 'bg-primary'
                      }`}
                      style={(boxHighlighting.numberCircleColor || box.lastWorkerColor || highlighting.workerColors[box.boxNumber]) ? {
                        backgroundColor: boxHighlighting.numberCircleColor || box.lastWorkerColor || highlighting.workerColors[box.boxNumber]
                      } : undefined}
                    >
                      {box.boxNumber}
                    </div>

                    {/* Check status indicator with higher z-index */}
                    {getCheckStatus(box.boxNumber) && (
                      <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-20" data-testid={`check-status-${box.boxNumber}`}>
                        {getCheckStatus(box.boxNumber) === 'completed' ? (
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : getCheckStatus(box.boxNumber) === 'rejected' ? (
                          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Percentage */}
                  <div className="flex-shrink-0 mb-1">
                    {box.isComplete ? (
                      <div className="bg-red-500 text-white px-1 py-0.5 rounded text-xs font-medium">
                        100%
                      </div>
                    ) : (
                      <p className={`text-xs font-medium ${boxHighlighting.textColor === 'white' ? 'text-gray-200' : 'text-gray-700'}`} data-testid={`percentage-${box.boxNumber}`}>
                        {completionPercentage}%
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* STANDARD MODE - Full box content */
              <>
                {/* Lock icon for 100% completed boxes */}
                {box.isComplete && (
                  <div className="absolute top-1 right-1">
                    <Lock className={`w-5 h-5 ${highlighting.textColor}`} />
                  </div>
                )}

                {/* Green indicator for just-scanned box */}
                {isLastScanned && !box.isComplete && (
                  <div className="absolute top-1 left-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                )}

                {/* Customer name spanning full width with proper spacing */}
                <div className="mb-4 pr-2">
                  <h3 className={`font-medium text-sm truncate ${highlighting.textColor}`} data-testid={`customer-name-${box.boxNumber}`}>
                    {(box.customerName === "Empty" || box.customerName === "Unassigned" || !box.customerName) ? "Empty" : box.customerName}
                  </h3>
                  {supervisorView && box.assignedWorker && (
                    <p className={`text-xs truncate ${highlighting.textColor === 'text-white' ? 'text-gray-200' : 'text-gray-600'}`}>Worker: {box.assignedWorker}</p>
                  )}
                </div>

                {/* Box Number Badge - Top Right with spacing from customer name */}
                <div className="absolute top-10 right-2">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 border-white shadow-lg text-white ${
                      (boxHighlighting.numberCircleColor || box.lastWorkerColor || highlighting.workerColors[box.boxNumber]) ? '' : 'bg-primary'
                    }`}
                    style={(boxHighlighting.numberCircleColor || box.lastWorkerColor || highlighting.workerColors[box.boxNumber]) ? {
                      backgroundColor: boxHighlighting.numberCircleColor || box.lastWorkerColor || highlighting.workerColors[box.boxNumber]
                    } : undefined}
                  >
                    {box.boxNumber}
                  </div>

                  {/* Check status indicator under box number */}
                  {getCheckStatus(box.boxNumber) && (
                    <div className="absolute top-14 right-2 z-20" data-testid={`check-status-${box.boxNumber}`}>
                      {getCheckStatus(box.boxNumber) === 'completed' ? (
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : getCheckStatus(box.boxNumber) === 'rejected' ? (
                        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Quantity fraction - Left side at same height as box number */}
                <div className="absolute top-12 left-2">
                  <div className={`text-lg font-bold ${highlighting.textColor}`} data-testid={`quantity-${box.boxNumber}`}>
                    {displayScannedQty}/{displayTotalQty}
                  </div>
                  {/* Worker staffId under quantity if available */}
                  {highlighting.workerStaffId && (
                    <div className={`text-xs font-medium mt-1 ${highlighting.textColor === 'text-white' ? 'text-gray-200' : 'text-gray-700'}`} data-testid={`worker-code-${box.boxNumber}`}>
                      {highlighting.workerStaffId}
                    </div>
                  )}
                </div>

                {/* Centered percentage text and progress bar at bottom */}
                <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center">
                  {box.isComplete ? (
                    <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium mb-1">
                      100%
                    </div>
                  ) : (
                    <p className={`text-xs text-center mb-1 ${highlighting.textColor === 'text-white' ? 'text-gray-200' : 'text-gray-600'}`} data-testid={`percentage-${box.boxNumber}`}>
                      {completionPercentage}%
                    </p>
                  )}

                  {/* Centered progress bar */}
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isLastScanned ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${completionPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Box Details Modal */}
      <BoxDetailsModal
        isOpen={selectedBox !== null}
        onClose={() => setSelectedBox(null)}
        boxNumber={selectedBox?.boxNumber || null}
        jobId={jobId}
        customerName={selectedBox?.customerName || ''}
        totalQty={selectedBox?.totalQty || 0}
        scannedQty={selectedBox?.scannedQty || 0}
        isComplete={selectedBox?.isComplete || false}
        lastWorkerColor={selectedBox?.lastWorkerColor}
        onCheckCount={onCheckCount}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.jobId === nextProps.jobId &&
    prevProps.supervisorView === nextProps.supervisorView &&
    prevProps.lastScannedBoxNumber === nextProps.lastScannedBoxNumber &&
    JSON.stringify(prevProps.filterByProducts) === JSON.stringify(nextProps.filterByProducts) &&
    JSON.stringify(prevProps.filterByGroups) === JSON.stringify(nextProps.filterByGroups) &&
    // Deep compare products array for actual changes
    JSON.stringify(prevProps.products) === JSON.stringify(nextProps.products)
  );
});

export { CustomerBoxGridComponent as CustomerBoxGrid };