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
  } | null;
  runtimeSingleBoxMode?: boolean;
  onRuntimeToggle?: (enabled: boolean) => void;
  onLogout?: () => void;
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
  runtimeSingleBoxMode = false,
  onRuntimeToggle,
  onLogout
}: MobileScannerInterfaceProps) {
  const [, setLocation] = useLocation();
  const { preferences, updatePreference } = useUserPreferences();
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input for mobile scanning
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [lastScanEvent]);

  // Handle barcode input submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
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
      {/* Red Error Screen Overlay */}
      {scanError && (
        <div className="fixed inset-0 bg-red-500 bg-opacity-95 z-50 flex items-center justify-center">
          <div className="text-center text-white p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <div className="text-3xl font-bold mb-4">Scan Error</div>
            <div className="text-xl mb-6">{scanError}</div>
            <Button
              onClick={() => {
                // Error will be cleared automatically by the parent component
                if (barcodeInputRef.current) {
                  barcodeInputRef.current.focus();
                }
              }}
              className="bg-white text-red-500 hover:bg-gray-100"
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
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Single Box</span>
              <Switch
                checked={runtimeSingleBoxMode}
                onCheckedChange={handleSingleBoxToggle}
                data-testid="single-box-toggle"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/settings')}
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
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
            placeholder="Scan barcode here..."
            className="text-lg h-12 border-2 border-green-400"
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
        {/* Very large box number display */}
        <div className="text-center mb-8">
          <div className={`text-[120px] font-bold leading-none ${
            scanResult && scanResult.isExtraItem ? 'text-orange-500' : 'text-blue-500'
          }`} data-testid="box-number-display">
            {scanResult ? (scanResult.isExtraItem ? 'EXTRA' : scanResult.boxNumber) : (currentCustomer === 'Ready to Scan' ? '-' : (currentBoxNumber || '-'))}
          </div>
        </div>

        {/* Customer name */}
        <div className="text-center mb-6">
          <div className={`text-2xl font-semibold mb-2 ${
            scanResult && scanResult.isExtraItem ? 'text-orange-600' : 'text-gray-900'
          }`} data-testid="customer-name">
            {scanResult ? (
              scanResult.isExtraItem ? 'Extra Item' : scanResult.customerName
            ) : (
              currentCustomer === 'Ready to Scan' ? 'Ready to Scan' : currentCustomer
            )}
          </div>
          
          {scanResult && (
            <div className={`text-lg ${
              scanResult.isExtraItem ? 'text-orange-600' : 'text-gray-600'
            }`} data-testid="product-name">
              {scanResult.productName}
            </div>
          )}
          {!scanResult && lastScanEvent && currentCustomer !== 'Ready to Scan' && (
            <div className="text-lg text-gray-600" data-testid="product-name">
              {lastScanEvent.productName}
            </div>
          )}
          {!scanResult && (currentCustomer === 'Ready to Scan' || !lastScanEvent) && (
            <div className="text-lg text-gray-500" data-testid="scan-instruction">
              Scan a barcode to begin
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {scanResult && scanResult.progress && (
          <div className="text-center">
            <div className={`inline-flex items-center px-4 py-2 border-2 rounded-full ${
              scanResult.isExtraItem 
                ? 'bg-orange-100 border-orange-300' 
                : 'bg-green-100 border-green-300'
            }`}>
              <span className={`text-lg font-medium ${
                scanResult.isExtraItem ? 'text-orange-800' : 'text-green-800'
              }`} data-testid="progress-indicator">
                {scanResult.progress}
              </span>
            </div>
          </div>
        )}
        {!scanResult && currentBoxProgress.total > 0 && currentCustomer !== 'Ready to Scan' && (
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-green-100 border-2 border-green-300 rounded-full">
              <span className="text-lg font-medium text-green-800" data-testid="progress-indicator">
                {currentBoxProgress.completed}/{currentBoxProgress.total} items
              </span>
            </div>
          </div>
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