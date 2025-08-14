import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ErrorContextType {
  detailedErrorMessages: boolean;
  setDetailedErrorMessages: (value: boolean) => void;
  formatError: (error: any, fallbackMessage?: string) => string;
  getErrorDetails: (error: any) => string[];
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [detailedErrorMessages, setDetailedErrorMessages] = useState(() => {
    const saved = localStorage.getItem('detailedErrorMessages');
    return saved ? JSON.parse(saved) : false;
  });

  const updateDetailedErrorMessages = (value: boolean) => {
    setDetailedErrorMessages(value);
    localStorage.setItem('detailedErrorMessages', JSON.stringify(value));
  };

  const formatError = (error: any, fallbackMessage = "An error occurred"): string => {
    if (!error) return fallbackMessage;
    
    if (typeof error === 'string') {
      return detailedErrorMessages ? error : fallbackMessage;
    }
    
    if (error.message) {
      // For CSV validation errors, always show detailed info for header errors
      if (error.message.includes('header error')) {
        return error.message;
      }
      
      // For other detailed errors, respect the setting
      if (detailedErrorMessages) {
        return error.message;
      }
    }
    
    return fallbackMessage;
  };

  const getErrorDetails = (error: any): string[] => {
    const details: string[] = [];
    
    if (!error) return details;
    
    if (typeof error === 'string') {
      details.push(error);
    } else if (error.message) {
      // Parse validation errors
      if (error.message.includes('CSV validation failed')) {
        const errorText = error.message;
        const errorMatch = errorText.match(/errors: (.+)/);
        if (errorMatch) {
          const errorList = errorMatch[1].split('; ');
          details.push(...errorList);
        }
      } else {
        details.push(error.message);
      }
    }
    
    if (error.details) {
      details.push(error.details);
    }
    
    return details;
  };

  return (
    <ErrorContext.Provider
      value={{
        detailedErrorMessages,
        setDetailedErrorMessages: updateDetailedErrorMessages,
        formatError,
        getErrorDetails,
      }}
    >
      {children}
    </ErrorContext.Provider>
  );
}

export function useErrorContext() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  return context;
}