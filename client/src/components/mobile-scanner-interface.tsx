import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Camera, CameraOff, Package, Undo, Settings, RefreshCw, Target, Clock, TrendingUp, LogOut } from "lucide-react";
import { useUserPreferences } from "@/hooks/use-user-preferences";

interface MobileScannerInterfaceProps {
  currentCustomer?: string;
  currentBoxNumber?: number;
  assignedColor?: string;
  totalBoxes?: number;
  completedBoxes?: number;
  currentBoxProgress?: { completed: number; total: number };
  scanStats: {
    totalScans: number;
    scansPerHour: number;
    accuracy: number;
    score: number;
  };
  lastScanEvent?: {
    productName: string;
    barCode: string;
    customerName: string;
    boxNumber: number;
    scanTime?: string;
  } | null;
  onScan: (barcode: string) => void;
  onUndo?: () => void;
  onSwitchSession?: () => void;
  isUndoAvailable?: boolean;
  isConnected?: boolean;
  scanError?: string | null;
  scanResult?: {
    boxNumber: number | null;
    customerName: string;
    productName: string;
    progress: string | null;
    isExtraItem?: boolean;
    timestamp?: string;
  } | null;
  undoDisplay?: Array<{
    productName: string;
    barCode: string;
    customerName: string;
    boxNumber: number | null;
    timestamp: string;
  }> | null;
  runtimeSingleBoxMode?: boolean;
  onRuntimeToggle?: (enabled: boolean) => void;
  onLogout?: () => void;
  userStaffId: string;
  isPaused?: boolean;
}

export function MobileScannerInterface({
  currentCustomer = "No Customer Selected",
  currentBoxNumber = 0,
  assignedColor = "#3B82F6",
  totalBoxes = 0,
  completedBoxes = 0,
  currentBoxProgress = { completed: 0, total: 0 },
  scanStats,
  lastScanEvent,
  onScan,
  onUndo,
  onSwitchSession,
  isUndoAvailable = false,
  isConnected = true,
  scanError = null,
  scanResult = null,
  undoDisplay = null,
  runtimeSingleBoxMode = false,
  onRuntimeToggle,
  onLogout,
  userStaffId,
  isPaused = false,
}: MobileScannerInterfaceProps) {
  const [, setLocation] = useLocation();
  const { preferences, updatePreference } = useUserPreferences();
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  
  // State for same-box scan orange flash effect
  const [previousBoxNumber, setPreviousBoxNumber] = useState<number | null>(null);
  const [showOrangeFlash, setShowOrangeFlash] = useState(false);

  // Auto-focus input for mobile scanning
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [lastScanEvent]);

  // Detect same-box scans for orange flash effect
  useEffect(() => {
    if (lastScanEvent && lastScanEvent.boxNumber) {
      // Check if this is a successful scan to the same box as previous scan
      if (previousBoxNumber !== null && previousBoxNumber === lastScanEvent.boxNumber) {
        // Same box - trigger orange flash for 4 seconds
        setShowOrangeFlash(true);
        const timeout = setTimeout(() => setShowOrangeFlash(false), 4000);
        return () => clearTimeout(timeout);
      }
      // Update previous box number for next comparison
      setPreviousBoxNumber(lastScanEvent.boxNumber);
    }
  }, [lastScanEvent, previousBoxNumber]);

  // Handle barcode input submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim() && !isPaused) {
      onScan(barcodeInput.trim());
      setBarcodeInput("");
    }
  };

  // Handle single box toggle change (runtime only, don't save to preferences)
  const handleSingleBoxToggle = (enabled: boolean) => {
    // This will be handled by the parent component's runtime state
    // Don't save to preferences from here
    if (onRuntimeToggle) {
      onRuntimeToggle(enabled);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Error/Status Screen Overlay */}
      {scanError && (
        <div className={`fixed inset-0 ${scanError.startsWith('Creating session') ? 'bg-green-500' : 'bg-red-500'} bg-opacity-95 z-50 flex items-center justify-center`}>
          <div className="text-center text-white p-8">
            <div className="text-6xl mb-4">{scanError.startsWith('Creating session') ? '✅' : '⚠️'}</div>
            <div className="text-3xl font-bold mb-4">{scanError.startsWith('Creating session') ? 'Scanner Activated' : 'Scan Error'}</div>
            <div className="text-xl mb-6">{scanError}</div>
            <Button
              onClick={() => {
                // Error will be cleared automatically by the parent component
                if (barcodeInputRef.current) {
                  barcodeInputRef.current.focus();
                }
              }}
              className={`bg-white ${scanError.startsWith('Creating session') ? 'text-green-500 hover:bg-gray-100' : 'text-red-500 hover:bg-gray-100'}`}
              data-testid="button-error-dismiss"
            >
              Continue Scanning
            </Button>
          </div>
        </div>
      )}

      {/* Header with title and controls */}
      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Warehouse Sorting Scanner</h1>
              <p className="text-sm text-gray-600">Efficient barcode scanning for customer order sorting</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Box</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={runtimeSingleBoxMode}
                  onChange={(e) => onRuntimeToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchSession}
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <div className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm font-medium">
              {userStaffId}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (onLogout) onLogout();
              }}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Top action bar with undo and switch session */}
      <div className="bg-white px-4 py-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={!isUndoAvailable}
            data-testid="button-undo-mobile"
          >
            <Undo className="w-4 h-4 mr-1" />
            Undo
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onSwitchSession}
            data-testid="button-switch-session"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Switch Session
          </Button>
        </div>
      </div>

      {/* Barcode input */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <form onSubmit={handleBarcodeSubmit}>
          <Input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder={isPaused ? "Scanning is paused..." : "Scan barcode here..."}
            className={`text-lg h-12 border-2 ${
              isPaused ? 'border-yellow-400 opacity-50' : 'border-green-400'
            }`}
            disabled={isPaused}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-testid="input-barcode-mobile"
          />
        </form>
      </div>

      {/* Main content area - Large box number display */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 bg-gray-50">
        
        {/* Show paused message instead of box content when paused */}
        {isPaused ? (
          <div className="text-center">
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-12 h-12 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-yellow-800 mb-4">Scanning is Paused</h2>
              <p className="text-lg text-yellow-700">
                A manager has paused scanning for this job.<br />
                Please wait for scanning to be resumed.
              </p>
            </div>
          </div>
        ) : (
          <>
        {/* Very large box number display */}
        <div className="text-center mb-8">
          <div className={`text-[120px] font-bold leading-none ${
            (() => {
              // Check for undo display first (red color for undo)
              if (undoDisplay && undoDisplay.length > 0) {
                return 'text-red-500';
              }
              
              const scanResultTime = scanResult?.timestamp ? new Date(scanResult.timestamp).getTime() : 0;
              const lastScanTime = lastScanEvent?.scanTime ? new Date(lastScanEvent.scanTime).getTime() : 0;
              return (scanResult && scanResult.isExtraItem && scanResultTime >= lastScanTime) ? 'text-orange-500' : 'text-blue-500';
            })()
          }`} data-testid="box-number-display">
            {(() => {
              // Check for undo display first (highest priority)
              if (undoDisplay && undoDisplay.length > 0) {
                return 'UNDONE';
              }

              // Determine which scan was most recent by comparing timestamps
              const scanResultTime = scanResult?.timestamp ? new Date(scanResult.timestamp).getTime() : 0;
              const lastScanTime = lastScanEvent?.scanTime ? new Date(lastScanEvent.scanTime).getTime() : 0;

              // Show most recent scan result
              if (scanResult && scanResultTime >= lastScanTime) {
                return scanResult.isExtraItem ? 'EXTRA' : scanResult.boxNumber;
              } else if (lastScanEvent && currentCustomer !== 'Ready to Scan') {
                return lastScanEvent.boxNumber;
              } else {
                return currentCustomer === 'Ready to Scan' ? '-' : (currentBoxNumber || '-');
              }
            })()}
          </div>
        </div>

        {/* Customer name */}
        <div className="text-center mb-6">
          <div className={`text-2xl font-semibold mb-2 ${
            (() => {
              // Check for undo display first (red text for undo)
              if (undoDisplay && undoDisplay.length > 0) {
                return 'text-red-600';
              }
              
              const scanResultTime = scanResult?.timestamp ? new Date(scanResult.timestamp).getTime() : 0;
              const lastScanTime = lastScanEvent?.scanTime ? new Date(lastScanEvent.scanTime).getTime() : 0;
              return (scanResult && scanResult.isExtraItem && scanResultTime >= lastScanTime) ? 'text-orange-600' : 'text-gray-900';
            })()
          }`} data-testid="customer-name">
            {(() => {
              // Check for undo display first (highest priority)
              if (undoDisplay && undoDisplay.length > 0) {
                const firstUndo = undoDisplay[0];
                return firstUndo.customerName;
              }

              // Determine which scan was most recent by comparing timestamps
              const scanResultTime = scanResult?.timestamp ? new Date(scanResult.timestamp).getTime() : 0;
              const lastScanTime = lastScanEvent?.scanTime ? new Date(lastScanEvent.scanTime).getTime() : 0;

              // Show most recent scan (successful or extra item)
              if (scanResult && scanResultTime >= lastScanTime) {
                return scanResult.isExtraItem ? 'Extra Item' : scanResult.customerName;
              } else if (lastScanEvent && currentCustomer !== 'Ready to Scan') {
                return lastScanEvent.customerName;
              } else {
                return currentCustomer === 'Ready to Scan' ? 'Ready to Scan' : currentCustomer;
              }
            })()}
          </div>

          {(() => {
            // Check for undo display first (highest priority)
            if (undoDisplay && undoDisplay.length > 0) {
              const firstUndo = undoDisplay[0];
              return (
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="undo-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <div className="text-lg text-red-600" data-testid="product-name">
                    Undid: {firstUndo.productName}
                    {firstUndo.boxNumber ? ` from Box ${firstUndo.boxNumber}` : ''}
                  </div>
                </div>
              );
            }

            // Determine which scan was most recent by comparing timestamps
            const scanResultTime = scanResult?.timestamp ? new Date(scanResult.timestamp).getTime() : 0;
            const lastScanTime = lastScanEvent?.scanTime ? new Date(lastScanEvent.scanTime).getTime() : 0;

            if (scanResult && scanResultTime >= lastScanTime) {
              // Show scanResult (extra item) product name
              return (
                <div className={`text-lg ${
                  scanResult.isExtraItem ? 'text-orange-600' : 'text-gray-600'
                }`} data-testid="product-name">
                  {scanResult.productName}
                </div>
              );
            } else if (lastScanEvent && currentCustomer !== 'Ready to Scan') {
              // Show lastScanEvent (successful scan) product name
              return (
                <div className="text-lg text-gray-600" data-testid="product-name">
                  {lastScanEvent.productName}
                </div>
              );
            } else {
              // Show default instruction
              return (
                <div className="text-lg text-gray-500" data-testid="scan-instruction">
                  Scan a barcode to begin
                </div>
              );
            }
          })()}
        </div>

        {/* Progress indicator */}
        {(() => {
          // Check for undo display first (highest priority)
          if (undoDisplay && undoDisplay.length > 0) {
            const firstUndo = undoDisplay[0];
            return (
              <div className="text-center">
                <div className="inline-flex items-center px-4 py-2 border-2 rounded-full bg-red-100 border-red-300">
                  <span className="text-lg font-medium text-red-800" data-testid="progress-indicator">
                    Undo at {new Date(firstUndo.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          }

          // Determine which scan was most recent by comparing timestamps
          const scanResultTime = scanResult?.timestamp ? new Date(scanResult.timestamp).getTime() : 0;
          const lastScanTime = lastScanEvent?.scanTime ? new Date(lastScanEvent.scanTime).getTime() : 0;

          // Show progress based on most recent scan
          if (scanResult && scanResult.isExtraItem && scanResultTime >= lastScanTime) {
            // Extra item - show orange message
            return (
              <div className="text-center">
                <div className="inline-flex items-center px-4 py-2 border-2 rounded-full bg-orange-100 border-orange-300">
                  <span className="text-lg font-medium text-orange-800" data-testid="progress-indicator">
                    Added to Extra Items
                  </span>
                </div>
              </div>
            );
          } else if (currentBoxProgress.total > 0 && currentCustomer !== 'Ready to Scan') {
            // Regular scan or returning to view - show current box progress
            return (
              <div className="text-center">
                <div className={`inline-flex items-center px-4 py-2 border-2 rounded-full ${showOrangeFlash ? 'bg-orange-100 border-orange-300' : 'bg-green-100 border-green-300'}`}>
                  <span className="font-medium text-green-800 text-[30px]" data-testid="progress-indicator">
                    {currentBoxProgress.completed}/{currentBoxProgress.total} items
                  </span>
                </div>
              </div>
            );
          }
          return null;
        })()}
          </>
        )}
      </div>

      {/* Bottom stats section - Light blue background */}
      <div className="bg-blue-50 border-t border-blue-200 p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-blue-900" data-testid="stat-total-scans">
              {scanStats.totalScans}
            </div>
            <div className="text-sm text-blue-700">Total Scans</div>
          </div>

          <div>
            <div className="text-lg font-bold text-blue-900" data-testid="stat-scans-per-hour">
              {scanStats.scansPerHour}
            </div>
            <div className="text-sm text-blue-700">Per Hour</div>
          </div>

          <div>
            <div className="text-lg font-bold text-blue-900" data-testid="stat-accuracy">
              {scanStats.accuracy}%
            </div>
            <div className="text-sm text-blue-700">Accuracy</div>
          </div>
        </div>
      </div>
    </div>
  );
}