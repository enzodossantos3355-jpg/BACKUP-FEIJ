import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WhatsAppChatProvider } from "@/contexts/WhatsAppChatContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Pedidos from "@/pages/Pedidos";
import Produtos from "@/pages/Produtos";
import Entregadores from "@/pages/Entregadores";
import WhatsAppChat from "@/pages/WhatsAppChat";
import Clientes from "@/pages/Clientes";
import Relatorios from "@/pages/Relatorios";
import Configuracoes from "@/pages/Configuracoes";
import Armazenamento from "@/pages/Armazenamento";
import { Toaster } from "@/components/ui/sonner";

function AppRouter() {
  const location = useLocation();
  // Synchronously detect Emergent auth callback to avoid race conditions
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/entregadores" element={<Entregadores />} />
        <Route path="/whatsapp" element={<WhatsAppChat />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/armazenamento" element={<Armazenamento />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <WhatsAppChatProvider>
            <AppRouter />
            <Toaster richColors position="top-right" />
          </WhatsAppChatProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
