import { useState, useEffect } from 'react';

const CREDENTIALS = {
  username: 'admin',
  password: 'password'
};

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem('restaurant-auth');
    if (stored === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
      setIsLoggedIn(true);
      localStorage.setItem('restaurant-auth', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('restaurant-auth');
  };

  return {
    isLoggedIn,
    login,
    logout
  };
};