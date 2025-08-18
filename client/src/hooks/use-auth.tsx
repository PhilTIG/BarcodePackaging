import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  staffId: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check for existing session on app load
  const { data: userData, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    enabled: !!localStorage.getItem("token") && !isInitialized,
    retry: false,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/me");
      return response.json();
    },
  });

  useEffect(() => {
    if (!isLoading) {
      setIsInitialized(true);
      if (userData?.user) {
        setUser(userData.user);
      }
    }
  }, [userData, isLoading]);

  const login = (token: string, user: User) => {
    setIsLoggingIn(true);
    localStorage.setItem("token", token);
    setUser(user);
    setIsLoggingIn(false);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    isLoading: (isLoading && !isInitialized) || isLoggingIn,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
