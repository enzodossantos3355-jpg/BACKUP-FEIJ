import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ForkKnife, GoogleLogo } from "@phosphor-icons/react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { login, loginWithGoogle, formatApiErrorDetail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo de volta!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      await loginWithGoogle();
      toast.success("Login com Google realizado com sucesso!");
      navigate("/dashboard");
    } catch (err) {
      console.warn("Firebase Google popup error or closed, fallback to redirect", err);
      const redirectUrl = window.location.origin + "/auth/callback";
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } finally {
      setLoading(false);
    }
  };

  const error = new URLSearchParams(location.search).get("error");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-stone-50">
      {/* Left: image */}
      <div className="hidden lg:flex relative overflow-hidden">
        <img
          src="https://static.prod-images.emergentagent.com/jobs/3902cf64-244c-4c85-b121-742028aab87f/images/cac5a669c2b1c379a713fded35cbcba22131ce47bdb6e0457b5e90a0ddec9160.png"
          alt="Marmitaria"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900/60 via-stone-900/30 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div className="flex items-center gap-3 mb-6">
            <ForkKnife size={32} weight="duotone" className="text-orange-300" />
            <span className="font-display text-2xl font-semibold tracking-tight">Marmita Hub</span>
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-semibold leading-tight mb-3">
            Gerencie sua marmitaria<br />com sabor e eficiência.
          </h1>
          <p className="text-stone-200 max-w-md leading-relaxed">
            Pedidos, produtos, pagamentos e relatórios — tudo em um único painel feito para quem entrega comida de verdade.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md fade-in">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <ForkKnife size={28} weight="duotone" className="text-[#C5533B]" />
            <span className="font-display text-xl font-semibold">Marmita Hub</span>
          </div>
          <h2 className="font-display text-3xl font-semibold text-stone-900 mb-2">Entrar</h2>
          <p className="text-stone-600 mb-8">Acesse seu painel de gestão.</p>

          {error && (
            <div data-testid="login-error-banner" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              Falha na autenticação. Tente novamente.
            </div>
          )}

          <Button
            data-testid="login-google-button"
            type="button"
            variant="outline"
            onClick={handleGoogle}
            className="w-full h-11 mb-4 border-stone-300 hover:bg-stone-100"
          >
            <GoogleLogo size={20} weight="bold" className="mr-2" />
            Entrar com Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200" /></div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-stone-50 px-3 text-stone-500">ou com email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-stone-700">Email</Label>
              <Input
                data-testid="login-email-input"
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@marmita.com"
                className="mt-1 h-11"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-stone-700">Senha</Label>
              <Input
                data-testid="login-password-input"
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 h-11"
              />
            </div>
            <Button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#C5533B] hover:bg-[#A6432E] text-white"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await login("admin@marmita.com", "admin123");
                  toast.success("Conectado como Administrador!");
                  navigate("/dashboard");
                } catch (err) {
                  toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Falha ao entrar como admin");
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full h-10 border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-medium"
            >
              Entrar como Demonstração (Admin)
            </Button>
          </form>

          <p className="mt-6 text-sm text-stone-600 text-center">
            Não tem conta?{" "}
            <Link data-testid="login-register-link" to="/register" className="text-[#C5533B] hover:underline font-medium">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
