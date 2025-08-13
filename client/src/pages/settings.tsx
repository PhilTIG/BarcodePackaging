import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { ArrowLeft, Trash2 } from "lucide-react";

const AVAILABLE_THEMES = [
  { name: "blue", label: "Blue", colors: ["#3B82F6", "#2563EB", "#1D4ED8"] },
  { name: "green", label: "Green", colors: ["#10B981", "#059669", "#047857"] },
  { name: "orange", label: "Orange", colors: ["#F59E0B", "#D97706", "#B45309"] },
  { name: "teal", label: "Teal", colors: ["#14B8A6", "#0D9488", "#0F766E"] },
  { name: "red", label: "Red", colors: ["#EF4444", "#DC2626", "#B91C1C"] },
  { name: "dark", label: "Dark", colors: ["#6B7280", "#4B5563", "#374151"] },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    autoClearInput: true,
    soundFeedback: true,
    vibrationFeedback: false,
    scannerType: "camera",
    targetScansPerHour: 71,
    autoSaveSessions: true,
    showRealtimeStats: true,
  });

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    toast({
      title: "Theme updated",
      description: `Switched to ${newTheme} theme`,
    });
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      localStorage.clear();
      toast({
        title: "Data cleared",
        description: "All local data has been removed",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/login")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-600">Customize your experience</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Color Theme Section */}
        <Card data-testid="theme-settings">
          <CardHeader>
            <CardTitle>Color Theme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {AVAILABLE_THEMES.map((themeOption) => (
                <div
                  key={themeOption.name}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    theme === themeOption.name
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  onClick={() => handleThemeChange(themeOption.name)}
                  data-testid={`theme-${themeOption.name}`}
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: themeOption.colors[0] }}
                    ></div>
                    <span className="font-medium text-gray-900">{themeOption.label}</span>
                    {theme === themeOption.name && (
                      <div className="text-primary-500 ml-auto">✓</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {themeOption.colors.map((color, index) => (
                      <div
                        key={index}
                        className="h-2 rounded"
                        style={{ backgroundColor: color }}
                      ></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scanner Settings */}
        <Card data-testid="scanner-settings">
          <CardHeader>
            <CardTitle>Scanner Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Auto-clear Input</h3>
                <p className="text-sm text-gray-600">Automatically clear input field after successful scan</p>
              </div>
              <Switch
                checked={settings.autoClearInput}
                onCheckedChange={(checked) => handleSettingChange("autoClearInput", checked)}
                data-testid="switch-auto-clear"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Sound Feedback</h3>
                <p className="text-sm text-gray-600">Play sound on successful scan</p>
              </div>
              <Switch
                checked={settings.soundFeedback}
                onCheckedChange={(checked) => handleSettingChange("soundFeedback", checked)}
                data-testid="switch-sound"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Vibration Feedback</h3>
                <p className="text-sm text-gray-600">Vibrate device on scan (mobile only)</p>
              </div>
              <Switch
                checked={settings.vibrationFeedback}
                onCheckedChange={(checked) => handleSettingChange("vibrationFeedback", checked)}
                data-testid="switch-vibration"
              />
            </div>

            <div>
              <Label className="text-base font-medium text-gray-900">Scanner Type</Label>
              <Select
                value={settings.scannerType}
                onValueChange={(value) => handleSettingChange("scannerType", value)}
              >
                <SelectTrigger className="mt-2" data-testid="select-scanner-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera">Camera Scanner</SelectItem>
                  <SelectItem value="usb">USB HID Scanner</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth Scanner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Performance Settings */}
        <Card data-testid="performance-settings">
          <CardHeader>
            <CardTitle>Performance Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium text-gray-900">Target Scans Per Hour</Label>
              <Input
                type="number"
                value={settings.targetScansPerHour}
                onChange={(e) => handleSettingChange("targetScansPerHour", parseInt(e.target.value))}
                min="1"
                max="500"
                className="mt-2"
                data-testid="input-target-scans"
              />
              <p className="text-sm text-gray-600 mt-1">Industry average is 71 items/hour</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Auto-save Sessions</h3>
                <p className="text-sm text-gray-600">Automatically save progress every 5 minutes</p>
              </div>
              <Switch
                checked={settings.autoSaveSessions}
                onCheckedChange={(checked) => handleSettingChange("autoSaveSessions", checked)}
                data-testid="switch-auto-save"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Show Real-time Stats</h3>
                <p className="text-sm text-gray-600">Display performance metrics during scanning</p>
              </div>
              <Switch
                checked={settings.showRealtimeStats}
                onCheckedChange={(checked) => handleSettingChange("showRealtimeStats", checked)}
                data-testid="switch-realtime-stats"
              />
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card data-testid="system-info">
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">App Version</span>
                <span className="font-medium text-gray-900">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Updated</span>
                <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Device Type</span>
                <span className="font-medium text-gray-900">
                  {/Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Storage Used</span>
                <span className="font-medium text-gray-900">
                  {Math.round(JSON.stringify(localStorage).length / 1024)} KB
                </span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleClearData}
                data-testid="button-clear-data"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
