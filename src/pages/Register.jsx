import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ForkKnife, GoogleLogo } from "@phosphor-icons/react";

export default function Register() {
  const { register, loginWithGoogle, formatApiErrorDetail } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success("Conta criada com sucesso!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Falha ao registrar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      await loginWithGoogle();
      toast.success("Conta vinculada com Google!");
      navigate("/dashboard");
    } catch (err) {
      const redirectUrl = window.location.origin + "/auth/callback";
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-stone-50">
      <div className="hidden lg:flex relative overflow-hidden">
        <img
          src="https://static.prod-images.emergentagent.com/jobs/3902cf64-244c-4c85-b121-742028aab87f/images/cac5a669c2b1c379a713fded35cbcba22131ce47bdb6e0457b5e90a0ddec9160.png"
          alt="Marmitaria"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900/60 via-stone-900/30 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div className="flex items-center gap-2 mb-3">
            <ForkKnife size={32} weight="fill" className="text-[#E07A5F]" />
            <span className="text-2xl font-bold tracking-tight">Marmita Hub</span>
          </div>
          <p className="text-stone-200 text-lg max-w-md">
            Cadastre sua marmitaria e acelere seus pedidos com inteligência artificial e WhatsApp.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 lg:hidden mb-2">
              <ForkKnife size={28} weight="fill" className="text-[#C5533B]" />
              <span className="text-xl font-bold">Marmita Hub</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Criar nova conta</h1>
            <p className="text-sm text-stone-500">
              Preencha os dados abaixo para começar a gerenciar sua operação
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome completo ou da Marmitaria</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Marmitaria da Maria"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@marmitaria.com"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#C5533B] hover:bg-[#A6432E] text-white"
            >
              {loading ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-stone-50 px-2 text-stone-500">ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full h-11 border-stone-200 hover:bg-stone-100 flex items-center justify-center gap-2"
          >
            <GoogleLogo size={20} weight="bold" className="text-red-500" />
            <span>Cadastrar com Google</span>
          </Button>

          <p className="text-center text-xs text-stone-500">
            Já possui uma conta?{" "}
            <Link to="/login" className="text-[#C5533B] hover:underline font-semibold">
              Entrar aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
