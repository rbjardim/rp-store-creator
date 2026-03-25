import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API_URL } from "@/lib/api";

type AuthUser = {
  id: string;
  login: string;
  email: string;
  role: "admin" | "user";
};

type SignInResult = {
  error: Error | null;
};

type AuthContextType = {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (login: string, password: string, rememberMe?: boolean) => Promise<SignInResult>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          localStorage.removeItem("token");
          setUser(null);
          setLoading(false);
          return;
        }

        const data = await res.json();
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
        setLoading(false);
      });
  }, []);

  const signIn = async (
  login: string,
  password: string,
  rememberMe = false
): Promise<SignInResult> => {
  try {
    console.log("Tentando login com:", { login, password });

    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ login, password }),
    });

    console.log("Status da resposta:", response.status);

    const data = await response.json();
    console.log("Resposta do backend:", data);

    if (!response.ok) {
      return {
        error: new Error(data.message || "Usuário não encontrado ou falha na conexão"),
      };
    }

    localStorage.setItem("token", data.token);
    setUser(data.user);

    if (rememberMe) {
      localStorage.setItem("rememberLogin", login);
    } else {
      localStorage.removeItem("rememberLogin");
    }

    return { error: null };
  } catch (error) {
    console.error("Erro no signIn:", error);
    return {
      error: new Error("Falha na conexão com o servidor"),
    };
  }
};

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("rememberLogin");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }

  return context;
};