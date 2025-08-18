import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

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

  // Check authentication status first
  const { user } = useAuth();

  // Only fetch preferences if user is authenticated
  const { data: serverPreferences, isLoading, error } = useQuery({
    queryKey: ['/api/users/me/preferences'],
    retry: false,
    enabled: !!user, // Only enabled when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation with proper error handling
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      if (!user) {
        throw new Error('User not authenticated');
      }
      return apiRequest('/api/users/me/preferences', 'PUT', newPreferences);
    },
    onSuccess: (data: any) => {
      if (data?.preferences) {
        setPreferences(data.preferences);
        localStorage.setItem('userPreferences', JSON.stringify(data.preferences));
      }
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/preferences'] });
    },
    onError: (error: any) => {
      console.error('Failed to update preferences:', error);
      // Don't throw error, just log it to prevent UI breaks
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
    if (!user) {
      // User not authenticated, use localStorage or defaults
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const mergedPrefs = { ...defaultPreferences, ...parsed };
          setPreferences(mergedPrefs);
        } catch (error) {
          console.error('Failed to parse stored preferences:', error);
          setPreferences(defaultPreferences);
        }
      } else {
        setPreferences(defaultPreferences);
      }
      return;
    }

    // User is authenticated
    if ((serverPreferences as any)?.preferences) {
      setPreferences((serverPreferences as any).preferences);
      // Sync to localStorage for offline fallback
      localStorage.setItem('userPreferences', JSON.stringify((serverPreferences as any).preferences));
    } else if (!isLoading && error) {
      // Server failed, use localStorage fallback
      console.warn('Failed to load server preferences, using local fallback:', error);
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const mergedPrefs = { ...defaultPreferences, ...parsed };
          setPreferences(mergedPrefs);
        } catch (parseError) {
          console.error('Failed to parse stored preferences:', parseError);
          setPreferences(defaultPreferences);
        }
      } else {
        setPreferences(defaultPreferences);
      }
    } else if (!isLoading && !serverPreferences) {
      // No server data but no error, use defaults
      setPreferences(defaultPreferences);
    }
  }, [serverPreferences, isLoading, error, user]);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    // Update localStorage immediately for responsiveness
    localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
    
    // Only sync to server if user is authenticated
    if (user) {
      console.log('Preference update:', key, value);
      updatePreferencesMutation.mutate(newPreferences);
    } else {
      console.warn('User not authenticated, preferences saved locally only');
    }
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