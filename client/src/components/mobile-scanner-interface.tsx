import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Camera, CameraOff, Package, Undo, Settings, RefreshCw, Target, Clock, TrendingUp } from "lucide-react";
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
  isConnected = true
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

  // Handle mobile toggle change
  const handleMobileToggle = async (enabled: boolean) => {
    await updatePreference('mobileModePreference', enabled);
    if (!enabled) {
      // If turning off mobile mode, stay on current page
      return;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
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
              <span className="text-sm text-gray-600">Mobile</span>
              <Switch
                checked={preferences.mobileModePreference}
                onCheckedChange={handleMobileToggle}
                data-testid="mobile-toggle"
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
          <div className="text-[120px] font-bold text-blue-500 leading-none" data-testid="box-number-display">
            {currentBoxNumber}
          </div>
        </div>

        {/* Customer name */}
        <div className="text-center mb-6">
          <div className="text-2xl font-semibold text-gray-900 mb-2" data-testid="customer-name">
            {currentCustomer}
          </div>
          
          {lastScanEvent && (
            <div className="text-lg text-gray-600" data-testid="product-name">
              {lastScanEvent.productName}
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {currentBoxProgress.total > 0 && (
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