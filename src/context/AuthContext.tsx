import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { AuthService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (phoneNumber: string, otp: string) => Promise<boolean>;
  logout: () => Promise<void>;
  sendOTP: (phoneNumber: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (phoneNumber: string): Promise<boolean> => {
    return await AuthService.sendOTP(phoneNumber);
  };

  const login = async (phoneNumber: string, otp: string): Promise<boolean> => {
    const verifiedUser = await AuthService.verifyOTP(phoneNumber, otp);
    if (verifiedUser) {
      setUser(verifiedUser);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, sendOTP }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
