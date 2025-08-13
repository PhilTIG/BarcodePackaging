import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";

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
}

export function CustomerBoxGrid({ products, supervisorView = false }: CustomerBoxGridProps) {
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
      boxes[product.boxNumber].isComplete = boxes[product.boxNumber].scannedQty >= boxes[product.boxNumber].totalQty;
      
      // Mark as active if any items have been scanned but not complete
      if (boxes[product.boxNumber].scannedQty > 0 && !boxes[product.boxNumber].isComplete) {
        boxes[product.boxNumber].isActive = true;
      }
    });

    // Fill in empty boxes up to 8
    for (let i = 1; i <= 8; i++) {
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
  }, [products]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="customer-box-grid">
      {boxData.map((box) => {
        const completionPercentage = box.totalQty > 0 ? Math.round((box.scannedQty / box.totalQty) * 100) : 0;
        
        const boxClasses = [
          "border rounded-lg p-3 relative transition-all duration-200",
          box.isComplete 
            ? "border-success-200 bg-success-50" 
            : box.isActive 
              ? "border-success-200 bg-success-50" 
              : "border-gray-200 bg-white"
        ].join(" ");

        return (
          <div
            key={box.boxNumber}
            className={boxClasses}
            id={box.isActive ? "scan-flash-target" : undefined}
            data-testid={`box-${box.boxNumber}`}
          >
            {/* Box Number Badge */}
            <div className="absolute top-2 right-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                box.isComplete 
                  ? "bg-success-500" 
                  : box.isActive 
                    ? "bg-success-500" 
                    : "bg-gray-400"
              }`}>
                {box.boxNumber}
              </div>
            </div>

            {/* Lock icon for completed boxes */}
            {box.isComplete && (
              <div className="absolute top-1 left-1">
                <Lock className="w-3 h-3 text-success-600" />
              </div>
            )}

            {/* Activity indicator for active boxes */}
            {box.isActive && !box.isComplete && (
              <div className="absolute top-1 left-1">
                <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
              </div>
            )}

            <div className="mb-3">
              <h3 className="font-medium text-gray-900 text-sm truncate" data-testid={`customer-name-${box.boxNumber}`}>
                {box.customerName === "Unassigned" ? "Unassigned" : `Customer: ${box.customerName}`}
              </h3>
              {supervisorView && box.assignedWorker && (
                <p className="text-xs text-gray-600">Worker: {box.assignedWorker}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className={`text-lg font-bold ${
                box.isComplete 
                  ? "text-success-600" 
                  : box.isActive 
                    ? "text-success-600" 
                    : "text-gray-500"
              }`} data-testid={`quantity-${box.boxNumber}`}>
                {box.scannedQty}/{box.totalQty}
              </div>
              
              <Progress 
                value={completionPercentage} 
                className="h-2"
                data-testid={`progress-${box.boxNumber}`}
              />
              
              <p className="text-xs text-gray-600" data-testid={`percentage-${box.boxNumber}`}>
                {completionPercentage}% Complete
              </p>
            </div>

            {/* Status badges */}
            <div className="mt-2">
              {box.isComplete && (
                <Badge variant="outline" className="text-xs">
                  Complete
                </Badge>
              )}
              {box.isActive && !box.isComplete && (
                <Badge variant="secondary" className="text-xs">
                  In Progress
                </Badge>
              )}
              {!box.isActive && !box.isComplete && box.totalQty === 0 && (
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
