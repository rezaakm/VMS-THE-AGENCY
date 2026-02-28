import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }
    setIsInitialized(true);
  }, []);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['auth', 'profile'],
    queryFn: async () => {
      const response = await api.get('/auth/profile');
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user } = response.data;
    
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(access_token);
    setIsAuthenticated(true);
    
    return { user, token: access_token };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setIsAuthenticated(false);
  };

  return {
    user: user || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null),
    token,
    isAuthenticated,
    isInitialized,
    isLoading: !isInitialized || (isLoading && isAuthenticated),
    login,
    logout,
  };
}

