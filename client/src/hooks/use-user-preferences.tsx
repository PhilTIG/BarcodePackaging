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

  // Fetch user preferences from server
  const { data: serverPreferences, isLoading } = useQuery({
    queryKey: ['/api/users/me/preferences'],
    retry: false,
  });

  // Mutation to update preferences on server
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      const response = await apiRequest('PUT', '/api/users/me/preferences', {
        preferences: newPreferences
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data?.preferences) {
        setPreferences(data.preferences);
        // Also sync to localStorage as fallback
        localStorage.setItem('userPreferences', JSON.stringify(data.preferences));
      }
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/preferences'] });
    },
  });

  // Initialize preferences from server or localStorage fallback
  useEffect(() => {
    if (serverPreferences?.preferences) {
      setPreferences(serverPreferences.preferences);
      // Sync to localStorage for offline fallback
      localStorage.setItem('userPreferences', JSON.stringify(serverPreferences.preferences));
    } else if (!isLoading) {
      // Fallback to localStorage if server request fails
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const mergedPrefs = { ...defaultPreferences, ...parsed };
          setPreferences(mergedPrefs);
          
          // Attempt to migrate localStorage preferences to server
          updatePreferencesMutation.mutate(mergedPrefs);
        } catch (error) {
          console.error('Failed to parse stored preferences:', error);
        }
      }
    }
  }, [serverPreferences, isLoading, updatePreferencesMutation]);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    // Update localStorage immediately for responsiveness
    localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
    
    // Update server
    updatePreferencesMutation.mutate(newPreferences);
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