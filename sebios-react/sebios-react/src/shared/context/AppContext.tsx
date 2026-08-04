import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { NIVESH_DATA } from '../data/niveshData';

// Types
interface AppContextType {
  // User state
  activeUserId: string | null;
  setActiveUserId: (id: string | null) => void;
  
  // Theme state
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  // User-specific state (from localStorage)
  userState: {
    onboarded: boolean;
    riskProfile: 'conservative' | 'balanced' | 'aggressive' | null;
    riskScore: number | null;
    completedLessons: string[];
    purchases: any[];
    consents: any[];
    auditTrail: any[];
    assessment: any;
    importedHoldings: any[];
    goals: any[];
    alertConfig: {
      dropPct: number;
      concentrationPct: number;
      movePct: number;
    };
    alertsRead: string[];
    alertLog: any[];
  };
  setUserState: (state: Partial<AppContextType['userState']>) => void;
  
  // Data access
  getUserData: () => any;
  getUserHoldings: () => any[];
  getUserAccounts: () => any[];
  getUserHistory: () => any[];
  
  // Local storage helpers
  saveToLocalStorage: (key: string, value: any) => void;
  loadFromLocalStorage: <T>(key: string, defaultValue: T) => T;
}

// Default context value
const AppContext = createContext<AppContextType | undefined>(undefined);

// Local storage keys
const SESSION_KEY = "niveshos.session";
const THEME_KEY = "niveshos.theme";

// Context provider
export const AppProvider = ({ children }: { children: ReactNode }) => {
  // User state
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [userState, setUserState] = useState<any>({});

  // Initialize from localStorage
  useEffect(() => {
    // Load theme
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    }
    
    // Load user session
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      setActiveUserId(sessionId);
      
      // Load user state
      const userStateKey = `niveshos.u.${sessionId}`;
      const savedState = localStorage.getItem(userStateKey);
      if (savedState) {
        try {
          setUserState(JSON.parse(savedState));
        } catch (e) {
          console.error('Failed to parse user state from localStorage', e);
        }
      }
    }
  }, []);

  // Save user state to localStorage whenever it changes
  useEffect(() => {
    if (activeUserId) {
      const userStateKey = `niveshos.u.${activeUserId}`;
      const stateToSave = {
        ...userState,
        // Don't save theme here as it's global
      };
      localStorage.setItem(userStateKey, JSON.stringify(stateToSave));
    }
  }, [activeUserId, userState]);

  // User data helpers
  const getUserData = () => {
    if (!activeUserId) return null;
    return NIVESH_DATA.users.find(user => user.id === activeUserId) || null;
  };

  const getUserHoldings = () => {
    const user = getUserData();
    return user?.holdings || [];
  };

  const getUserAccounts = () => {
    const user = getUserData();
    return user?.accounts || [];
  };

  const getUserHistory = () => {
    const user = getUserData();
    return (user as any)?.history || [];
  };

  // Local storage helpers
  const saveToLocalStorage = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to save to localStorage: ${key}`, e);
    }
  };

  const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error(`Failed to load from localStorage: ${key}`, e);
      return defaultValue;
    }
  };

  // Update user state helper
  const updateUserState = (updates: Partial<any>) => {
    setUserState((prev: any) => ({ ...prev, ...updates }));
  };

  const value: AppContextType = {
    activeUserId,
    setActiveUserId,
    theme,
    setTheme,
    userState: userState || {
      onboarded: false,
      riskProfile: null,
      riskScore: null,
      completedLessons: [],
      purchases: [],
      consents: [],
      auditTrail: [],
      assessment: null,
      importedHoldings: [],
      goals: [],
      alertConfig: {
        dropPct: 3,
        concentrationPct: 30,
        movePct: 3,
      },
      alertsRead: [],
      alertLog: [],
    },
    setUserState: updateUserState,
    getUserData,
    getUserHoldings,
    getUserAccounts,
    getUserHistory,
    saveToLocalStorage,
    loadFromLocalStorage,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the app context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
