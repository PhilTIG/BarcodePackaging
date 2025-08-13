import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CameraOff } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function BarcodeScanner({ onScan, enabled = true }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup stream when component unmounts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setIsScanning(true);
      setHasPermission(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      setHasPermission(false);
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
    
    setIsScanning(false);
  };

  const toggleCamera = () => {
    if (isScanning) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Mock barcode detection - in production, integrate with a barcode scanning library
  const simulateScan = () => {
    const mockBarcodes = [
      "1152689",
      "1153606", 
      "1153708",
      "1154024",
      "1154088",
      "1154128",
      "1154256",
      "1154378",
      "1154525"
    ];
    
    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
    onScan(randomBarcode);
  };

  if (!enabled) {
    return null;
  }

  return (
    <Card className="bg-gray-50" data-testid="barcode-scanner">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Camera Scanner</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleCamera}
            data-testid="button-toggle-camera"
          >
            {isScanning ? (
              <>
                <CameraOff className="mr-2 h-4 w-4" />
                Stop Camera
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Start Camera
              </>
            )}
          </Button>
        </div>

        {hasPermission === false && (
          <div className="text-center py-4 text-red-600">
            Camera permission denied. Please enable camera access and try again.
          </div>
        )}

        {isScanning && (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-48 bg-black rounded-lg object-cover"
              playsInline
              muted
              data-testid="camera-video"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white w-48 h-32 rounded-lg opacity-50"></div>
            </div>
            
            {/* Mock scan button for demonstration */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
              <Button
                size="sm"
                onClick={simulateScan}
                className="bg-white text-gray-900 hover:bg-gray-100"
                data-testid="button-mock-scan"
              >
                Simulate Scan
              </Button>
            </div>
          </div>
        )}

        {!isScanning && hasPermission !== false && (
          <div className="text-center py-8 text-gray-500">
            Click "Start Camera" to begin scanning barcodes
          </div>
        )}
      </CardContent>
    </Card>
  );
}
