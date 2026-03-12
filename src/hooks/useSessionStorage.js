import { useEffect } from 'react';

export function useSessionStorage(key, value) {
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save session to localStorage', error);
    }
  }, [key, value]);
}
