import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { Usuario } from "../types";

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  loginComToken: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const salvo = localStorage.getItem("inframonitor_usuario");
    if (salvo) setUsuario(JSON.parse(salvo));
    setCarregando(false);
  }, []);

  async function login(email: string, senha: string) {
    const resposta = await api.post<{ token: string; usuario: any }>("/auth/login", { email, senha });
    localStorage.setItem("inframonitor_token", resposta.token);
    const usuarioNormalizado: Usuario = {
      sub: resposta.usuario.id,
      nome: resposta.usuario.nome,
      email: resposta.usuario.email,
      perfil: resposta.usuario.perfil,
    };
    localStorage.setItem("inframonitor_usuario", JSON.stringify(usuarioNormalizado));
    setUsuario(usuarioNormalizado);
  }

  // Usado pela tela de callback do login social (Google / Microsoft Entra ID):
  // o backend já validou a conta e devolveu um token nosso pronto para uso.
  async function loginComToken(token: string) {
    localStorage.setItem("inframonitor_token", token);
    const dados = await api.get<Usuario>("/auth/me");
    localStorage.setItem("inframonitor_usuario", JSON.stringify(dados));
    setUsuario(dados);
  }

  function logout() {
    localStorage.removeItem("inframonitor_token");
    localStorage.removeItem("inframonitor_usuario");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, loginComToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
