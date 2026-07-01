import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api from '../api';
import { isAdmin as checkIsAdmin, isProfesional as checkIsProfesional, isCliente as checkIsCliente, normalizeRole } from '../utils/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then(res => setUser({ ...res.data, role: normalizeRole(res.data.role) }))
        .catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('token');
            setToken(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { token: newToken, user: userData } = res.data;
    const normalizedUser = { ...userData, role: normalizeRole(userData.role) };
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(normalizedUser);
    return normalizedUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return null;
    const res = await api.get('/auth/me');
    const normalizedUser = { ...res.data, role: normalizeRole(res.data.role) };
    setUser(normalizedUser);
    return normalizedUser;
  };

  const value = useMemo(() => ({
    user,
    login,
    logout,
    refreshUser,
    loading,
    isAdmin: checkIsAdmin(user),
    isProfesional: checkIsProfesional(user),
    isCliente: checkIsCliente(user),
  }), [user, loading, token]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
