import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ForkKnife, House, ShoppingBag, Package, ChartBar, SignOut, Gear, Archive,
  Moped, WhatsappLogo, Users,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CounterModeProvider } from "@/contexts/CounterModeContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: House, testId: "nav-dashboard" },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingBag, testId: "nav-pedidos" },
  { to: "/entregadores", label: "Entregadores", icon: Moped, testId: "nav-entregadores" },
  { to: "/whatsapp", label: "WhatsApp & IA", icon: WhatsappLogo, testId: "nav-whatsapp" },
  { to: "/produtos", label: "Produtos", icon: Package, testId: "nav-produtos" },
  { to: "/clientes", label: "Clientes", icon: Users, testId: "nav-clientes" },
  { to: "/armazenamento", label: "Armazenamento", icon: Archive, testId: "nav-armazenamento" },
  { to: "/relatorios", label: "Relatórios", icon: ChartBar, testId: "nav-relatorios" },
  { to: "/configuracoes", label: "Configurações", icon: Gear, testId: "nav-configuracoes" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <CounterModeProvider>
      <div className="min-h-screen flex bg-[#F9F8F6]">
      {/* Sidebar */}
      <aside data-testid="app-sidebar" className="w-64 shrink-0 bg-[#F4F2EF] border-r border-stone-200 flex flex-col">
        <div className="p-6 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#C5533B] flex items-center justify-center">
              <ForkKnife size={20} weight="duotone" className="text-white" />
            </div>
            <div>
              <div className="font-display font-semibold text-stone-900 leading-tight">Marmita Hub</div>
              <div className="text-xs text-stone-500 leading-tight">Gestão de pedidos</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, testId }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-white text-[#C5533B] shadow-sm"
                    : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
                }`
              }
            >
              <Icon size={20} weight="duotone" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-stone-200">
          <div className="flex items-center gap-3 p-2 mb-2">
            <Avatar className="h-9 w-9">
              {user?.picture && <AvatarImage src={user.picture} alt={user.name} />}
              <AvatarFallback className="bg-[#C5533B] text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div data-testid="user-name" className="text-sm font-medium text-stone-900 truncate">{user?.name}</div>
              <div className="text-xs text-stone-500 truncate">{user?.email}</div>
            </div>
          </div>
          <Button
            data-testid="logout-button"
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
          >
            <SignOut size={18} weight="duotone" className="mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="p-6 sm:p-8 lg:p-10 fade-in">
          <Outlet />
        </div>
      </main>
    </div>
    </CounterModeProvider>
  );
}
