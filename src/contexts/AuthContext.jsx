import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail, setStoredToken } from "@/lib/api";
import { auth, googleProvider, signInWithPopup, signOut } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      if (data.token) {
        setStoredToken(data.token);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) {
      setStoredToken(data.token);
    }
    setUser(data);
    return data;
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    const { data } = await api.post("/auth/firebase-login", {
      uid: fbUser.uid,
      email: fbUser.email,
      name: fbUser.displayName || fbUser.email?.split("@")[0] || "Usuário",
      picture: fbUser.photoURL || "",
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    setUser(data);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    if (data.token) {
      setStoredToken(data.token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
    try {
      await api.post("/auth/logout");
    } catch (e) {
      // ignore
    }
    setStoredToken("");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        firebaseUser,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        checkAuth,
        formatApiErrorDetail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
