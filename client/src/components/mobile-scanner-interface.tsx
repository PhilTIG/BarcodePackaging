import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Package, Undo, Check, Target, Clock, TrendingUp } from "lucide-react";
import { useUserPreferences } from "@/hooks/use-user-preferences";

interface MobileScannerInterfaceProps {
  currentCustomer?: string;
  currentBoxNumber?: number;
  assignedColor?: string;
  totalBoxes?: number;
  completedBoxes?: number;
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
  onSwitchBox?: (direction: 'next' | 'prev') => void;
  isUndoAvailable?: boolean;
  isConnected?: boolean;
}

export function MobileScannerInterface({
  currentCustomer = "No Customer Selected",
  currentBoxNumber = 0,
  assignedColor = "#3B82F6",
  totalBoxes = 0,
  completedBoxes = 0,
  scanStats,
  lastScanEvent,
  onScan,
  onUndo,
  onSwitchBox,
  isUndoAvailable = false,
  isConnected = true
}: MobileScannerInterfaceProps) {
  const { preferences } = useUserPreferences();
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-focus input for mobile scanning
  useEffect(() => {
    if (barcodeInputRef.current && !showCamera) {
      barcodeInputRef.current.focus();
    }
  }, [showCamera, lastScanEvent]);

  // Handle barcode input submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      onScan(barcodeInput.trim());
      
      // Play feedback sounds/vibration if enabled
      if (preferences.soundFeedback) {
        // Simple beep sound - can be enhanced with actual audio files
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      }

      if (preferences.vibrationFeedback && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }

      if (preferences.autoClearInput) {
        setBarcodeInput("");
      }
    }
  };

  // Camera handling for mobile
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setShowCamera(true);
      setIsScanning(true);
    } catch (error) {
      console.error("Camera access denied:", error);
      setShowCamera(false);
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setShowCamera(false);
    setIsScanning(false);
    
    // Return focus to input
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, 100);
  };

  // Calculate performance level for gamification
  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return { emoji: "🏆", level: "Expert", color: "text-yellow-600" };
    if (score >= 80) return { emoji: "⭐", level: "Great", color: "text-blue-600" };
    if (score >= 70) return { emoji: "👍", level: "Good", color: "text-green-600" };
    if (score >= 60) return { emoji: "📈", level: "Learning", color: "text-orange-600" };
    return { emoji: "💪", level: "Getting Started", color: "text-gray-600" };
  };

  const performanceLevel = getPerformanceLevel(scanStats.score);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Status Bar */}
      <div className="bg-white border-b shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: assignedColor }}
              data-testid="worker-color-indicator"
            />
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Offline"}
            </Badge>
          </div>
          
          <div className="text-center">
            <div className="text-sm font-medium text-gray-900">
              Box {currentBoxNumber} of {totalBoxes}
            </div>
            <div className="text-xs text-gray-500">
              {completedBoxes} completed
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-sm font-medium ${performanceLevel.color}`}>
              {performanceLevel.emoji} {performanceLevel.level}
            </div>
            <div className="text-xs text-gray-500">
              Score: {scanStats.score}
            </div>
          </div>
        </div>
      </div>

      {/* Current Box Information */}
      <div className="bg-white border-b p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-1" data-testid="current-customer">
            {currentCustomer}
          </h2>
          <div className="flex justify-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center">
              <Package className="w-4 h-4 mr-1" />
              Box #{currentBoxNumber}
            </div>
          </div>
        </div>
        
        {/* Box Navigation - Single Box Mode */}
        {preferences.singleBoxMode && onSwitchBox && (
          <div className="flex justify-center space-x-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSwitchBox('prev')}
              disabled={currentBoxNumber <= 1}
              data-testid="button-prev-box"
            >
              ← Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSwitchBox('next')}
              disabled={currentBoxNumber >= totalBoxes}
              data-testid="button-next-box"
            >
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* Camera View or Barcode Input */}
      <div className="flex-1 p-4">
        {showCamera ? (
          <Card className="w-full h-full">
            <CardContent className="p-4 h-full">
              <div className="relative h-full bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  data-testid="camera-view"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-white w-64 h-32 rounded-lg opacity-50" />
                </div>
                <div className="absolute top-4 left-4 right-4 text-white text-center">
                  <p className="text-sm">Position barcode within the frame</p>
                </div>
                <Button
                  className="absolute bottom-4 right-4"
                  onClick={stopCamera}
                  variant="secondary"
                  data-testid="button-stop-camera"
                >
                  <CameraOff className="w-4 h-4 mr-2" />
                  Stop Camera
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full">
            <CardContent className="p-6">
              <form onSubmit={handleBarcodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scan or Enter Barcode
                  </label>
                  <Input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan barcode or type manually..."
                    className="text-lg h-12"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-testid="input-barcode-mobile"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="submit"
                    disabled={!barcodeInput.trim()}
                    className="h-12 text-lg"
                    data-testid="button-scan-submit"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Scan
                  </Button>
                  
                  {preferences.scannerType === "camera" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startCamera}
                      className="h-12 text-lg"
                      data-testid="button-start-camera"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Camera
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Last Scan Information */}
      {lastScanEvent && (
        <div className="bg-green-50 border-t border-green-200 p-4">
          <div className="text-center">
            <div className="text-sm font-medium text-green-800 mb-1">
              ✓ Last Scan Successful
            </div>
            <div className="text-xs text-green-600">
              {lastScanEvent.productName} → {lastScanEvent.customerName}
            </div>
            <div className="text-xs text-green-500">
              Barcode: {lastScanEvent.barCode}
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-white border-t p-4">
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={onUndo}
            disabled={!isUndoAvailable}
            className="h-12"
            data-testid="button-undo-mobile"
          >
            <Undo className="w-4 h-4 mr-2" />
            Undo
          </Button>
          
          <div className="text-center py-2">
            <div className="text-lg font-bold text-gray-900">
              {scanStats.totalScans}
            </div>
            <div className="text-xs text-gray-500">
              Total Scans
            </div>
          </div>
          
          <div className="text-center py-2">
            <div className="text-lg font-bold text-blue-600">
              {scanStats.scansPerHour}
            </div>
            <div className="text-xs text-gray-500">
              Per Hour
            </div>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      {preferences.showRealtimeStats && (
        <div className="bg-blue-50 border-t border-blue-200 p-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center mb-1">
                <Target className="w-4 h-4 text-blue-600 mr-1" />
                <span className="text-sm font-medium text-blue-800">Target</span>
              </div>
              <div className="text-lg font-bold text-blue-900">
                {preferences.targetScansPerHour}
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-1">
                <Clock className="w-4 h-4 text-green-600 mr-1" />
                <span className="text-sm font-medium text-green-800">Accuracy</span>
              </div>
              <div className="text-lg font-bold text-green-900">
                {scanStats.accuracy}%
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-center mb-1">
                <TrendingUp className="w-4 h-4 text-purple-600 mr-1" />
                <span className="text-sm font-medium text-purple-800">Score</span>
              </div>
              <div className="text-lg font-bold text-purple-900">
                {scanStats.score}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}