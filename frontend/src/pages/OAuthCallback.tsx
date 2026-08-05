import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";

export default function OAuthCallback() {
  const { loginComToken } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("token");

    if (!token) {
      setErro("Não recebemos um token de acesso válido.");
      return;
    }

    loginComToken(token)
      .then(() => navigate("/", { replace: true }))
      .catch(() => setErro("Não foi possível concluir o login social."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        {erro ? (
          <>
            <p className="text-red-400 text-sm mb-3">{erro}</p>
            <button className="btn-secondary" onClick={() => navigate("/login")}>Voltar para o login</button>
          </>
        ) : (
          <>
            <Loader2 className="animate-spin mx-auto mb-3 text-brand" size={28} />
            <p className="text-foreground-subtle text-sm">Concluindo login…</p>
          </>
        )}
      </div>
    </div>
  );
}
