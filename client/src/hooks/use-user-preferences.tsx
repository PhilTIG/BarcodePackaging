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
};

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  // Temporarily disable server fetch to stop 401 storm
  const { data: serverPreferences, isLoading } = useQuery({
    queryKey: ['/api/users/me/preferences'],
    retry: false,
    enabled: false, // Disable this query for now
  });

  // Temporarily disable mutation completely to stop 401 storm
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      console.log('Mutation disabled to debug auth issues');
      return Promise.resolve({ preferences: newPreferences });
    },
    onSuccess: () => {
      console.log('Mutation success (disabled)');
    },
  });

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
    
    // Temporarily disabled server sync to debug auth issues
    console.log('Preference update:', key, value);
    // updatePreferencesMutation.mutate(newPreferences);
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