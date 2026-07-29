import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authAPI } from '../services/api';

// Represents an authenticated user's data
interface User {
  id: number;
  username: string;
  role: string;
  email: string;
  organizationId?: number;
  photo?: string;
  fullName?: string;
  passwordChangeRequired?: boolean;
}

function serializeUser(user: User): string {
  return JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    organizationId: user.organizationId,
    photo: user.photo,
    fullName: user.fullName,
    passwordChangeRequired: user.passwordChangeRequired,
  });
}

function deserializeUser(raw: string): User | null {
  const data = JSON.parse(raw);
  if (data && data.id && data.username && data.role) {
    return data as User;
  }
  return null;
}

// Shape of the authentication context value
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
  loading: boolean;
}

// React context for authentication state
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provides auth state (user, login, logout, updateUser, isAuthenticated, loading) to the component tree
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
      setLoading(false);
      return;
    }

    try {
      const userData = deserializeUser(storedUser);
      if (userData) {
        setUser(userData);
      } else {
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }
    } catch {
      localStorage.removeItem('user');
      setLoading(false);
      return;
    }

    authAPI.me().then(response => {
      const userData = response.data as User;
      if (userData) {
        setUser(userData);
        localStorage.setItem('user', serializeUser(userData));
      } else {
        setUser(null);
        localStorage.removeItem('user');
      }
    }).catch(() => {
      setUser(null);
      localStorage.removeItem('user');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const login = async (username: string, password: string) => {
    localStorage.removeItem('user');
    setUser(null);

    const response = await authAPI.login(username, password);
    const userData = response.data as User;
    setUser(userData);
    localStorage.setItem('user', serializeUser(userData));
    return userData;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch { /* ignore */ }
    setUser(null);
    localStorage.removeItem('user');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData } as User;
      setUser(updatedUser);
      localStorage.setItem('user', serializeUser(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook to access the AuthContext – throws if used outside AuthProvider
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
