import { useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useBoxHighlighting } from "@/hooks/use-box-highlighting";

interface Product {
  id: string;
  customerName: string;
  qty: number;
  scannedQty: number;
  boxNumber: number;
  isComplete: boolean;
  lastWorkerUserId?: string;
  lastWorkerColor?: string;
}

interface CustomerBoxGridProps {
  products: Product[];
  jobId: string;
  supervisorView?: boolean;
  lastScannedBoxNumber?: number | null; // For POC-style single box highlighting
  onBoxScanUpdate?: (boxNumber: number, workerId?: string, workerColor?: string) => void;
}

export function CustomerBoxGrid({ products, supervisorView = false, lastScannedBoxNumber = null, onBoxScanUpdate }: CustomerBoxGridProps) {
  // Use actual user preferences for box layout
  const { preferences } = useUserPreferences();
  
  // POC-style box highlighting system - PERSISTENT green until next scan
  const { updateBoxHighlighting, clearHighlighting, getBoxHighlight } = useBoxHighlighting({
    autoResetDelay: 0 // DISABLED: Green highlighting now persists until next scan
  });
  
  const boxData = useMemo(() => {
    const boxes: { [key: number]: {
      boxNumber: number;
      customerName: string;
      totalQty: number;
      scannedQty: number;
      isComplete: boolean;
      assignedWorker?: string;
      lastWorkerColor?: string;
    }} = {};

    products.forEach(product => {
      if (!boxes[product.boxNumber]) {
        boxes[product.boxNumber] = {
          boxNumber: product.boxNumber,
          customerName: product.customerName,
          totalQty: 0,
          scannedQty: 0,
          isComplete: false,
          lastWorkerColor: product.lastWorkerColor,
        };
      }

      boxes[product.boxNumber].totalQty += product.qty;
      boxes[product.boxNumber].scannedQty += product.scannedQty;
      
      // Box Complete = 100% fulfillment: scannedQty exactly equals totalQty
      boxes[product.boxNumber].isComplete = boxes[product.boxNumber].totalQty > 0 && 
                                           boxes[product.boxNumber].scannedQty === boxes[product.boxNumber].totalQty;
      
      // Update worker color tracking
      if (product.lastWorkerColor) {
        boxes[product.boxNumber].lastWorkerColor = product.lastWorkerColor;
      }
    });

    // Fill in empty boxes up to maxBoxesPerRow * 2 (to allow for multiple rows)
    const maxBoxes = Math.min(preferences.maxBoxesPerRow * 2, 16);
    for (let i = 1; i <= maxBoxes; i++) {
      if (!boxes[i]) {
        boxes[i] = {
          boxNumber: i,
          customerName: "Unassigned",
          totalQty: 0,
          scannedQty: 0,
          isComplete: false,
        };
      }
    }

    return Object.values(boxes).sort((a, b) => a.boxNumber - b.boxNumber);
  }, [products, preferences.maxBoxesPerRow]);

  // Create responsive grid classes based on user preference
  const getGridClasses = () => {
    const maxCols = preferences.maxBoxesPerRow;
    
    // Base classes for mobile (always 2 columns)
    let gridClasses = "grid grid-cols-2 gap-3";
    
    // Tablet and desktop responsive classes based on maxBoxesPerRow
    if (maxCols <= 4) {
      gridClasses += " md:grid-cols-4";
    } else if (maxCols <= 6) {
      gridClasses += " md:grid-cols-4 lg:grid-cols-6";
    } else if (maxCols <= 8) {
      gridClasses += " md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";
    } else if (maxCols <= 12) {
      gridClasses += " md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12";
    } else {
      gridClasses += " md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 2xl:grid-cols-16";
    }
    
    return gridClasses;
  };

  // Update highlighting when lastScannedBoxNumber changes
  useEffect(() => {
    if (lastScannedBoxNumber !== null) {
      // Find the box that was scanned to get worker color info
      const scannedBox = boxData.find(box => box.boxNumber === lastScannedBoxNumber);
      updateBoxHighlighting(
        lastScannedBoxNumber,
        scannedBox?.assignedWorker,
        scannedBox?.lastWorkerColor
      );
    }
  }, [lastScannedBoxNumber, boxData, updateBoxHighlighting]);

  return (
    <div className={getGridClasses()} data-testid="customer-box-grid">
      {boxData.map((box) => {
        const completionPercentage = box.totalQty > 0 ? Math.round((box.scannedQty / box.totalQty) * 100) : 0;
        
        // POC-style highlighting with worker color support
        const isLastScanned = lastScannedBoxNumber === box.boxNumber;
        const highlighting = getBoxHighlight(box.boxNumber, box.isComplete);
        
        const boxClasses = [
          "border rounded-lg p-3 relative transition-all duration-200",
          highlighting.backgroundColor,
          highlighting.borderColor
        ].join(" ");

        return (
          <div
            key={box.boxNumber}
            className={boxClasses}
            style={{ minHeight: '150px' }}
            data-testid={`box-${box.boxNumber}`}
          >
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
                {box.customerName === "Unassigned" ? "Unassigned" : box.customerName}
              </h3>
              {supervisorView && box.assignedWorker && (
                <p className={`text-xs truncate ${highlighting.textColor === 'text-white' ? 'text-gray-200' : 'text-gray-600'}`}>Worker: {box.assignedWorker}</p>
              )}
            </div>

            {/* Box Number Badge - Top Right with spacing from customer name */}
            <div className="absolute top-10 right-2">
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 border-white shadow-lg text-white ${
                  box.lastWorkerColor ? '' : 'bg-primary'
                }`}
                style={box.lastWorkerColor ? { 
                  backgroundColor: box.lastWorkerColor
                } : undefined}
              >
                {box.boxNumber}
              </div>
            </div>

            {/* Quantity fraction - Left side at same height as box number */}
            <div className="absolute top-12 left-2">
              <div className={`text-lg font-bold ${highlighting.textColor}`} data-testid={`quantity-${box.boxNumber}`}>
                {box.scannedQty}/{box.totalQty}
              </div>
            </div>

            {/* Centered percentage text and progress bar */}
            <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center">
              {box.isComplete ? (
                <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium mb-2">
                  100%
                </div>
              ) : (
                <p className={`text-xs text-center mb-2 ${highlighting.textColor === 'text-white' ? 'text-gray-200' : 'text-gray-600'}`} data-testid={`percentage-${box.boxNumber}`}>
                  {completionPercentage}%
                </p>
              )}
              
              {/* Centered progress bar */}
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Status badges at bottom */}
            <div className="absolute bottom-2 left-2">
              {!box.isComplete && box.totalQty === 0 && (
                <Badge variant="outline" className="text-xs">
                  Empty
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
