import { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'farmer' | 'lgu' | 'da';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  barangay?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    // Mock login - in production, this would call an API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Demo users
    if (email.includes('admin') || email.includes('lgu')) {
      setUser({
        id: '1',
        name: 'Admin User',
        email: email,
        role: 'lgu',
      });
    } else if (email.includes('da')) {
      setUser({
        id: '2',
        name: 'DA Official',
        email: email,
        role: 'da',
      });
    } else {
      setUser({
        id: '3',
        name: 'Juan Dela Cruz',
        email: email,
        role: 'farmer',
        barangay: 'San Roque',
      });
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
