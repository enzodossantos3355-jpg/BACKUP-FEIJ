import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { setStoredToken } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const hash = window.location.hash;
        const search = window.location.search;
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const searchParams = new URLSearchParams(search);

        const sessionId = hashParams.get("session_id") || searchParams.get("session_id");

        if (!sessionId) {
          setError("Sessão não encontrada na URL.");
          return;
        }

        const { data } = await api.post("/auth/session", { session_id: sessionId });
        if (data.token || sessionId) {
          setStoredToken(data.token || sessionId);
        }
        setUser(data);
        toast.success("Autenticado com sucesso!");
        navigate("/dashboard", { replace: true });
      } catch (err) {
        console.error("Falha no callback de autenticação:", err);
        setError("Não foi possível validar sua sessão. Redirecionando para login...");
        setTimeout(() => navigate("/login", { replace: true }), 2500);
      }
    };

    handleAuth();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6]">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm p-6 bg-white rounded-xl shadow-sm border border-stone-200">
        <Loader2 className="w-8 h-8 animate-spin text-[#C5533B]" />
        <div>
          <h2 className="font-semibold text-stone-900 text-lg">Autenticando</h2>
          <p className="text-sm text-stone-500 mt-1">
            {error || "Validando suas credenciais de acesso..."}
          </p>
        </div>
      </div>
    </div>
  );
}
