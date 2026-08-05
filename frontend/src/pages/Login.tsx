import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(searchParams.get("erro"));
  const [carregando, setCarregando] = useState(false);
  const [provedores, setProvedores] = useState({ google: false, microsoft: false });

  useEffect(() => {
    api.get<{ google: boolean; microsoft: boolean }>("/auth/oauth-providers").then(setProvedores).catch(() => {});
  }, []);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await login(email, senha);
      navigate("/");
    } catch (e: any) {
      setErro(e.message || "Não foi possível entrar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
      {/* textura sutil de "topologia de rede" ao fundo, coerente com o produto */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #6366F1 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.svg" alt="InfraMonitor AI" className="w-14 h-14 rounded-2xl mb-3 shadow-lg shadow-brand/20" />
          <h1 className="text-xl font-semibold text-foreground">InfraMonitor AI</h1>
          <p className="text-sm text-foreground-subtle mt-1">Monitoramento de infraestrutura de TI</p>
        </div>

        <div className="card space-y-4">
          {(provedores.google || provedores.microsoft) && (
            <div className="space-y-2">
              {provedores.google && (
                <a href={`${api.baseUrl}/api/auth/google`} className="btn-secondary w-full">
                  <IconeGoogle /> Entrar com Google
                </a>
              )}
              {provedores.microsoft && (
                <a href={`${api.baseUrl}/api/auth/microsoft`} className="btn-secondary w-full">
                  <IconeMicrosoft /> Entrar com Microsoft
                </a>
              )}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px bg-surface-border flex-1" />
                <span className="text-xs text-foreground-subtle">ou</span>
                <div className="h-px bg-surface-border flex-1" />
              </div>
            </div>
          )}

          <form onSubmit={aoEnviar} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Senha</label>
              <input
                type="password"
                className="input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {erro && <p className="text-sm text-red-400">{erro}</p>}

            <button type="submit" className="btn-primary w-full" disabled={carregando}>
              {carregando && <Loader2 size={16} className="animate-spin" />}
              Entrar
            </button>

            <p className="text-xs text-foreground-subtle text-center">
              Primeiro acesso? Use o e-mail/senha impressos no log do backend na primeira subida.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function IconeGoogle() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9h11.8c-.5 2.8-2.1 5.1-4.5 6.7v5.5h7.2c4.2-3.9 6.6-9.6 6.6-16.6z" />
      <path fill="#34A853" d="M24 46c6.1 0 11.2-2 14.9-5.5l-7.2-5.5c-2 1.4-4.6 2.2-7.7 2.2-5.9 0-10.9-4-12.7-9.3H3.9v5.7C7.6 41.1 15.2 46 24 46z" />
      <path fill="#FBBC05" d="M11.3 27.9c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-5.7H3.9C2.3 16.6 1.4 20.2 1.4 24s.9 7.4 2.5 10.6z" />
      <path fill="#EA4335" d="M24 10.7c3.3 0 6.3 1.1 8.6 3.4l6.4-6.4C35.2 4 30.1 2 24 2 15.2 2 7.6 6.9 3.9 14.2l7.4 5.7c1.8-5.3 6.8-9.2 12.7-9.2z" />
    </svg>
  );
}

function IconeMicrosoft() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
