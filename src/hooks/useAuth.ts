import { useState, useEffect } from 'react';

const API_BASE = window.location.origin.replace(':8080', ':3001');

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Check session status with server instead of localStorage
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const storedSessionId = sessionStorage.getItem('restaurant-session-id');
      if (!storedSessionId) {
        setIsLoggedIn(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/auth/status`, {
        headers: {
          'X-Session-ID': storedSessionId
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.isAuthenticated) {
          setIsLoggedIn(true);
          setSessionId(storedSessionId);
        } else {
          setIsLoggedIn(false);
          setSessionId(null);
          sessionStorage.removeItem('restaurant-session-id');
        }
      } else {
        setIsLoggedIn(false);
        setSessionId(null);
        sessionStorage.removeItem('restaurant-session-id');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsLoggedIn(false);
      setSessionId(null);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsLoggedIn(true);
          setSessionId(result.sessionId);
          // Use sessionStorage instead of localStorage for session data
          sessionStorage.setItem('restaurant-session-id', result.sessionId);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error during login:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (sessionId) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'X-Session-ID': sessionId
          }
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoggedIn(false);
      setSessionId(null);
      sessionStorage.removeItem('restaurant-session-id');
    }
  };

  return {
    isLoggedIn,
    login,
    logout,
    sessionId
  };
};