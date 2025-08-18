import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserPreferences {
  maxBoxesPerRow: number;
  autoClearInput: boolean;
  soundFeedback: boolean;
  vibrationFeedback: boolean;
  scannerType: string;
  targetScansPerHour: number;
  autoSaveSessions: boolean;
  showRealtimeStats: boolean;
  mobileModePreference: boolean;
  singleBoxMode: boolean;
  theme: string;
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  isLoading: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

const defaultPreferences: UserPreferences = {
  maxBoxesPerRow: 12,
  autoClearInput: true,
  soundFeedback: true,
  vibrationFeedback: false,
  scannerType: "camera",
  targetScansPerHour: 71,
  autoSaveSessions: true,
  showRealtimeStats: true,
  mobileModePreference: false,
  singleBoxMode: false,
  theme: "blue",
};

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  // Re-enabled with proper backend implementation
  const { data: serverPreferences, isLoading } = useQuery({
    queryKey: ['/api/users/me/preferences'],
    retry: false,
    enabled: true, // Re-enabled now that backend is fixed
  });

  // Re-enabled mutation with proper backend implementation and retry limit
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      return apiRequest('PUT', '/api/users/me/preferences', newPreferences);
    },
    onSuccess: (data: any) => {
      if (data?.preferences) {
        setPreferences(data.preferences);
        localStorage.setItem('userPreferences', JSON.stringify(data.preferences));
      }
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/preferences'] });
    },
    retry: 1, // Limit retries to prevent infinite loops
  });

  // Apply theme to document body when preferences change
  useEffect(() => {
    const applyTheme = (theme: string) => {
      // Remove all theme classes
      document.body.classList.remove('theme-blue', 'theme-green', 'theme-orange', 'theme-teal', 'theme-red', 'theme-dark');
      // Add the selected theme class
      document.body.classList.add(`theme-${theme}`);
    };

    applyTheme(preferences.theme);
  }, [preferences.theme]);

  // Initialize preferences from server or localStorage fallback
  useEffect(() => {
    if ((serverPreferences as any)?.preferences) {
      setPreferences((serverPreferences as any).preferences);
      // Sync to localStorage for offline fallback
      localStorage.setItem('userPreferences', JSON.stringify((serverPreferences as any).preferences));
    } else if (!isLoading && !serverPreferences) {
      // Only use localStorage fallback if server data failed to load
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const mergedPrefs = { ...defaultPreferences, ...parsed };
          setPreferences(mergedPrefs);
          
          // TODO: localStorage migration can be added later when auth is stable
          // For now, just use localStorage as fallback without server sync
        } catch (error) {
          console.error('Failed to parse stored preferences:', error);
          setPreferences(defaultPreferences);
        }
      } else {
        setPreferences(defaultPreferences);
      }
    }
  }, [serverPreferences, isLoading]);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    // Update localStorage immediately for responsiveness
    localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
    
    // Send only the changed field to the server
    console.log('Preference update:', key, value);
    updatePreferencesMutation.mutate({ [key]: value } as Partial<UserPreferences>);
  };

  return (
    <UserPreferencesContext.Provider value={{ preferences, updatePreference, isLoading }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}