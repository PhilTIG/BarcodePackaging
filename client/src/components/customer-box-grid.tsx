import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";
import { useUserPreferences } from "@/hooks/use-user-preferences";

interface Product {
  id: string;
  customerName: string;
  qty: number;
  scannedQty: number;
  boxNumber: number;
  isComplete: boolean;
}

interface CustomerBoxGridProps {
  products: Product[];
  jobId: string;
  supervisorView?: boolean;
  lastScannedBoxNumber?: number | null; // For POC-style single box highlighting
}

export function CustomerBoxGrid({ products, supervisorView = false, lastScannedBoxNumber = null }: CustomerBoxGridProps) {
  // Use actual user preferences for box layout
  const { preferences } = useUserPreferences();
  
  const boxData = useMemo(() => {
    const boxes: { [key: number]: {
      boxNumber: number;
      customerName: string;
      totalQty: number;
      scannedQty: number;
      isComplete: boolean;
      assignedWorker?: string;
      isActive: boolean;
    }} = {};

    products.forEach(product => {
      if (!boxes[product.boxNumber]) {
        boxes[product.boxNumber] = {
          boxNumber: product.boxNumber,
          customerName: product.customerName,
          totalQty: 0,
          scannedQty: 0,
          isComplete: false,
          isActive: false,
        };
      }

      boxes[product.boxNumber].totalQty += product.qty;
      boxes[product.boxNumber].scannedQty += product.scannedQty;
      
      // Box Complete = 100% fulfillment: scannedQty exactly equals totalQty
      boxes[product.boxNumber].isComplete = boxes[product.boxNumber].totalQty > 0 && 
                                           boxes[product.boxNumber].scannedQty === boxes[product.boxNumber].totalQty;
      
      // Mark as active if any items have been scanned but not complete
      if (boxes[product.boxNumber].scannedQty > 0 && !boxes[product.boxNumber].isComplete) {
        boxes[product.boxNumber].isActive = true;
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
          isActive: false,
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

  return (
    <div className={getGridClasses()} data-testid="customer-box-grid">
      {boxData.map((box) => {
        const completionPercentage = box.totalQty > 0 ? Math.round((box.scannedQty / box.totalQty) * 100) : 0;
        
        // POC-style highlighting logic
        const isLastScanned = lastScannedBoxNumber === box.boxNumber;
        
        const boxClasses = [
          "border rounded-lg p-3 relative transition-all duration-200",
          box.isComplete 
            ? "border-red-300 bg-red-100" // Grey-red for completed boxes
            : isLastScanned 
              ? "border-green-300 bg-green-100" // Green for just-scanned box
              : "border-gray-200 bg-white" // Default for all other boxes
        ].join(" ");

        return (
          <div
            key={box.boxNumber}
            className={boxClasses}
            id={box.isActive ? "scan-flash-target" : undefined}
            data-testid={`box-${box.boxNumber}`}
          >
            {/* Box Number Badge - Center Right, 2x Size */}
            <div className="absolute top-1/2 right-2 transform -translate-y-1/2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                box.isComplete 
                  ? "bg-red-400" // Grey-red badge for completed boxes
                  : isLastScanned 
                    ? "bg-green-500" // Green badge for just-scanned box
                    : "bg-gray-400" // Default grey badge
              }`}>
                {box.boxNumber}
              </div>
            </div>

            {/* Lock icon for 100% completed boxes */}
            {box.isComplete && (
              <div className="absolute top-1 left-1">
                <Lock className="w-4 h-4 text-red-600" />
              </div>
            )}

            {/* Green indicator for just-scanned box */}
            {isLastScanned && !box.isComplete && (
              <div className="absolute top-1 left-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
            )}

            <div className="mb-3 pr-16">
              <h3 className="font-medium text-gray-900 text-sm truncate" data-testid={`customer-name-${box.boxNumber}`}>
                {box.customerName === "Unassigned" ? "Unassigned" : `Customer: ${box.customerName}`}
              </h3>
              {supervisorView && box.assignedWorker && (
                <p className="text-xs text-gray-600">Worker: {box.assignedWorker}</p>
              )}
            </div>

            <div className="space-y-2 pr-16">
              <div className={`text-lg font-bold ${
                box.isComplete 
                  ? "text-red-700" // Dark red text for completed boxes
                  : isLastScanned 
                    ? "text-green-700" // Dark green text for just-scanned box
                    : "text-gray-500" // Default grey text
              }`} data-testid={`quantity-${box.boxNumber}`}>
                {box.scannedQty}/{box.totalQty}
              </div>
              
              <Progress 
                value={completionPercentage} 
                className={`h-2 ${
                  box.isComplete 
                    ? "text-red-600" // Red progress for completed boxes
                    : isLastScanned 
                      ? "text-green-600" // Green progress for just-scanned box
                      : "text-gray-400" // Default grey progress
                }`} 
                data-testid={`progress-${box.boxNumber}`}
              />
              
              <p className="text-xs text-gray-600" data-testid={`percentage-${box.boxNumber}`}>
                {completionPercentage}% Complete
              </p>
            </div>

            {/* Status badges - Removed "Scanning" and "Pending" badges per requirements */}
            <div className="mt-2">
              {box.isComplete && (
                <Badge variant="default" className="text-xs bg-red-500 text-white">
                  100% Complete
                </Badge>
              )}
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
