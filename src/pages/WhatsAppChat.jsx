import { useState, useRef, useEffect } from "react";
import { useWhatsAppChat } from "@/contexts/WhatsAppChatContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChatCircleDots, Robot, User, PaperPlaneRight, Play, Pause,
  WhatsappLogo, ArrowClockwise, Sparkle, Phone, MapPin, Storefront,
  QrCode, Key, CheckCircle, Warning, Receipt, ShieldCheck, Gear,
  Copy, Check, Plus, ShoppingBag, Eye, ArrowSquareOut, DeviceMobile,
} from "@phosphor-icons/react";
import api, { formatApiErrorDetail, BRL } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function formatPhone(num) {
  if (!num) return "";
  const cleaned = String(num).replace(/\D/g, "");
  const base = cleaned.startsWith("55") && cleaned.length >= 12 ? cleaned.slice(2) : cleaned;
  if (base.length === 11) {
    return `(${base.slice(0, 2)}) ${base.slice(2, 7)}-${base.slice(7)}`;
  }
  if (base.length === 10) {
    return `(${base.slice(0, 2)}) ${base.slice(2, 6)}-${base.slice(6)}`;
  }
  return num;
}

export default function WhatsAppChat() {
  const navigate = useNavigate();
  const {
    conversations,
    activePhone,
    activeConversation,
    setActivePhone,
    config,
    baileysSession,
    refresh,
    sendMessage,
    toggleAi,
    takeOver,
    handoverToAi,
    connectBaileys,
    disconnectBaileys,
    generatePairingCode,
    saveConfig,
    verifyPixReceipt,
  } = useWhatsAppChat();

  const [mainTab, setMainTab] = useState("chat"); // "chat" | "baileys" | "config"
  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const messagesViewportRef = useRef(null);

  // Baileys state - Remember linked phone across sessions
  const [pairingPhone, setPairingPhone] = useState(() => {
    try {
      return (
        localStorage.getItem("marmita_linked_phone") ||
        localStorage.getItem("marmita_last_phone") ||
        "11987654321"
      );
    } catch (_) {
      return "11987654321";
    }
  });
  const [loadingBaileys, setLoadingBaileys] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (baileysSession?.phone && baileysSession.phone !== pairingPhone) {
      setPairingPhone(baileysSession.phone);
    } else if (baileysSession?.last_linked_phone && (!pairingPhone || pairingPhone === "11987654321")) {
      setPairingPhone(baileysSession.last_linked_phone);
    }
  }, [baileysSession?.phone, baileysSession?.last_linked_phone]);

  // Active status polling when waiting for WhatsApp scan/pair
  useEffect(() => {
    if (baileysSession?.status === "connecting") {
      const timer = setInterval(() => {
        refresh();
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [baileysSession?.status, refresh]);

  // AI & Pix Config state
  const [configForm, setConfigForm] = useState({
    accept_orders: true,
    paused_message: "",
    custom_ai_instructions: "",
    pix_key: "",
    pix_key_type: "Celular",
    pix_name: "",
    custom_gemini_api_key: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  // Pix Verification Dialog state
  const [pixDialog, setPixDialog] = useState(false);
  const [pixReceiptText, setPixReceiptText] = useState("");
  const [verifyingPix, setVerifyingPix] = useState(false);

  // Simulator test client
  const [simName, setSimName] = useState("Ana Clara");
  const [simPhone, setSimPhone] = useState("11988887777");
  const [simText, setSimText] = useState("Olá! Quero 2 marmitas M de carne sem cebola e bem passada");
  const [simLoading, setSimLoading] = useState(false);

  // Initialize config form when config loads
  useEffect(() => {
    if (config) {
      setConfigForm({
        accept_orders: config.accept_orders ?? true,
        paused_message: config.paused_message ?? "Olá! Nossos pedidos estão pausados no momento, retornaremos em breve!",
        custom_ai_instructions: config.custom_ai_instructions ?? "",
        pix_key: config.pix_key ?? "",
        pix_key_type: config.pix_key_type || "Celular",
        pix_name: config.pix_name ?? "",
        custom_gemini_api_key: "",
      });
    }
  }, [config]);

  // Auto scroll messages viewport to bottom on change (contained strictly inside chat window, zero window scroll)
  useEffect(() => {
    if (messagesViewportRef.current) {
      messagesViewportRef.current.scrollTop = messagesViewportRef.current.scrollHeight;
    }
  }, [activeConversation?.messages?.length, activePhone]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputMsg.trim() || !activePhone) return;
    const msgToSend = inputMsg;
    setInputMsg("");
    setSending(true);
    try {
      await sendMessage(activePhone, msgToSend);
    } catch (err) {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleSimulate = async () => {
    if (!simText.trim()) return;
    setSimLoading(true);
    try {
      const { data } = await api.post("/whatsapp/simulate-incoming", {
        sender_phone: simPhone,
        sender_name: simName,
        text: simText,
      });
      toast.success("Mensagem processada pelo robô IA!");
      setActivePhone(data.phone);
      await refresh();
      setSimText("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erro ao simular");
    } finally {
      setSimLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e?.preventDefault();
    setSavingConfig(true);
    try {
      await saveConfig(configForm);
      toast.success("Configurações da IA e Pix salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestKey = async () => {
    setTestingKey(true);
    try {
      const { data } = await api.post("/whatsapp/test-gemini-key", {
        api_key: configForm.custom_gemini_api_key.trim() || undefined,
      });
      if (data.ok) {
        toast.success("Conexão OK! Chave Gemini validada com sucesso.");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Falha ao testar chave Gemini");
    } finally {
      setTestingKey(false);
    }
  };

  const handleConnectQr = async () => {
    setLoadingBaileys(true);
    try {
      await connectBaileys(pairingPhone.trim() || undefined);
      toast.success("QR Code gerado com sucesso! Aponte a câmera do WhatsApp para conectar.");
    } catch (err) {
      toast.error("Erro ao gerar QR Code");
    } finally {
      setLoadingBaileys(false);
    }
  };

  const handleGeneratePairing = async () => {
    if (!pairingPhone.trim()) {
      toast.error("Digite o número de telefone");
      return;
    }
    setLoadingBaileys(true);
    try {
      const res = await generatePairingCode(pairingPhone.trim());
      toast.success(`Código de pareamento oficial gerado: ${res.code}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao gerar código de pareamento");
    } finally {
      setLoadingBaileys(false);
    }
  };

  const handleDisconnect = async () => {
    setLoadingBaileys(true);
    try {
      await disconnectBaileys();
      toast.success("Conexão com WhatsApp encerrada. O número vinculado continuará salvo para reconexão rápida.");
    } catch (err) {
      toast.error("Erro ao desconectar");
    } finally {
      setLoadingBaileys(false);
    }
  };

  const handleVerifyPix = async () => {
    if (!pixReceiptText.trim() && !activeConversation) return;
    setVerifyingPix(true);
    try {
      const res = await verifyPixReceipt(activePhone, pixReceiptText);
      if (res.verified) {
        toast.success(res.message || "Comprovante aprovado pela IA!");
        setPixDialog(false);
        setPixReceiptText("");
      } else {
        toast.warning(res.message || "Comprovante com divergência.");
      }
    } catch (err) {
      toast.error("Erro ao verificar comprovante");
    } finally {
      setVerifyingPix(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.customer_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
  });

  return (
    <div className="space-y-6" data-testid="whatsapp-chat-page">
      {/* Top Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Central WhatsApp</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1 flex items-center gap-2">
            <WhatsappLogo size={36} weight="duotone" className="text-[#25D366]" />
            Atendimento WhatsApp & IA
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Robô humanizado Gemini, conexão Baileys, detecção automática de gostos e validação inteligente de Pix.
          </p>
        </div>

        {/* Global Connection Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {baileysSession?.status === "connected" ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              WhatsApp Conectado ({formatPhone(baileysSession.phone || baileysSession.last_linked_phone) || "Ativo"})
            </Badge>
          ) : baileysSession?.status === "connecting" ? (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Aguardando Leitura QR / Conexão ({formatPhone(pairingPhone)})
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-stone-100 text-stone-600 border-stone-300 flex items-center gap-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-stone-400" />
              {baileysSession?.last_linked_phone
                ? `Desconectado (Último: ${formatPhone(baileysSession.last_linked_phone)})`
                : "WhatsApp Desconectado"}
            </Badge>
          )}

          <Badge
            variant="outline"
            className={
              config?.accept_orders
                ? "bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/30 py-1"
                : "bg-[#FCEDED] text-[#B94B4B] border-[#B94B4B]/30 py-1"
            }
          >
            {config?.accept_orders ? "Modo: Aceitando Pedidos" : "Modo: Pedidos Pausados"}
          </Badge>

          <Button variant="outline" size="sm" onClick={refresh} className="border-stone-200 h-8">
            <ArrowClockwise size={16} />
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="bg-stone-100 p-1 border border-stone-200">
          <TabsTrigger value="chat" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-stone-900">
            <ChatCircleDots size={16} />
            Conversas & Atendimento
            {conversations.length > 0 && (
              <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded-full ml-1">
                {conversations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="baileys" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-stone-900">
            <QrCode size={16} />
            Conexão WhatsApp (Baileys)
            {baileysSession?.status === "connected" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1" />
            )}
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-stone-900">
            <Gear size={16} />
            Configurações da IA & Pix
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: CHAT & LIVE CONVERSATIONS ================= */}
        <TabsContent value="chat" className="space-y-4 mt-4">
          {/* Simulator Quick Widget */}
          <Card className="border-stone-200 bg-gradient-to-r from-[#FCEEE6]/40 via-white to-stone-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-700">
                  <Sparkle size={15} weight="fill" className="text-[#C5533B]" />
                  Simulador de Mensagens Recebidas (Testar Atendimento Inteligente do Robô)
                </div>
                <span className="text-[11px] text-stone-500">
                  A IA detecta gostos, extrai pedidos e envia localização automaticamente
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <Input
                  placeholder="Nome do cliente"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="bg-white text-sm h-9"
                />
                <Input
                  placeholder="Telefone com DDD"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="bg-white text-sm h-9"
                />
                <Input
                  placeholder="Mensagem (ex: Quero 2 marmitas M de carne sem cebola)"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="bg-white text-sm h-9"
                />
                <Button
                  onClick={handleSimulate}
                  disabled={simLoading || !simText.trim()}
                  className="bg-[#25D366] hover:bg-[#1EBE5D] text-white h-9 text-sm font-medium"
                >
                  <PaperPlaneRight size={16} className="mr-1.5" />
                  {simLoading ? "Robô respondendo..." : "Simular Mensagem"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-stone-100 text-xs text-stone-500">
                <span>Sugestões de teste:</span>
                <button
                  onClick={() => setSimText("Olá, onde fica o local de retirada de vocês?")}
                  className="hover:underline text-[#C5533B]"
                >
                  "Onde fica?"
                </button>
                <span>·</span>
                <button
                  onClick={() => setSimText("Quero pedir 2 marmitas grandes de bife bem passado e odeio cebola")}
                  className="hover:underline text-[#C5533B]"
                >
                  "2 marmitas G (detectar gosto)"
                </button>
                <span>·</span>
                <button
                  onClick={() => setSimText("Quero pagar por Pix, qual a chave?")}
                  className="hover:underline text-[#C5533B]"
                >
                  "Pagar por Pix"
                </button>
                <span>·</span>
                <button
                  onClick={() => setSimText("Já fiz o Pix de R$ 44,00 pelo Nubank para Marmita Hub. Comprovante autenticado!")}
                  className="hover:underline text-[#C5533B]"
                >
                  "Envio de Comprovante"
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Main Chat Interface */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-[650px] bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {/* Left: Conversations list (Stable Independent Scroll Container) */}
            <div className="md:col-span-4 border-r border-stone-200 flex flex-col h-full min-h-0 bg-stone-50/50 overflow-hidden">
              <div className="p-3 border-b border-stone-200 bg-white shrink-0">
                <Input
                  placeholder="Buscar cliente ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-stone-50 text-sm h-9"
                />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-stone-100 overscroll-contain">
                {filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-sm">
                    <ChatCircleDots size={36} className="mx-auto mb-2 opacity-50" />
                    Nenhuma conversa no momento.
                    <div className="text-xs text-stone-400 mt-1">Dispare uma mensagem simulada acima!</div>
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = conv.phone === activePhone;
                    const lastMsg = conv.messages[conv.messages.length - 1];
                    return (
                      <div
                        key={conv.phone}
                        onClick={() => setActivePhone(conv.phone)}
                        className={`p-3.5 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#FCEEE6]/80 border-l-4 border-[#C5533B]"
                            : "hover:bg-stone-100/80 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-stone-900 text-sm truncate flex items-center gap-1.5">
                            {conv.customer_name || "Cliente"}
                            {conv.order_count > 0 && (
                              <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full font-normal">
                                {conv.order_count} {conv.order_count === 1 ? "ped." : "peds."}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-400 shrink-0">
                            {conv.last_message_at
                              ? new Date(conv.last_message_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>

                        {/* Customer tastes preview */}
                        {conv.tastes && (
                          <div className="text-[11px] text-[#D99A45] font-medium truncate mb-1">
                            ⭐ {conv.tastes}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-stone-500 gap-2">
                          <span className="truncate flex-1">
                            {lastMsg ? (
                              <>
                                {lastMsg.sender === "ai" && <span className="text-[#C5533B] font-semibold mr-1">[IA]</span>}
                                {lastMsg.sender === "attendant" && <span className="text-[#4A6E8C] font-semibold mr-1">[Humano]</span>}
                                {lastMsg.text}
                              </>
                            ) : (
                              "Nova conversa"
                            )}
                          </span>
                          {conv.ai_paused ? (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded shrink-0 font-medium">
                              👤 Humano
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0 font-medium">
                              🤖 IA Ativa
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Message history & Chat controls */}
            <div className="md:col-span-8 flex flex-col h-full min-h-0 bg-stone-50/30 overflow-hidden">
              {activeConversation ? (
                <>
                  {/* Top Bar with Customer Info and Takeover Action */}
                  <div className="p-3.5 border-b border-stone-200 bg-white">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center font-bold">
                          <WhatsappLogo size={24} weight="fill" />
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                            {activeConversation.customer_name || "Cliente WhatsApp"}
                            <span className="text-xs font-mono text-stone-400">({activeConversation.phone})</span>
                          </div>
                          <div className="text-xs text-stone-500 flex items-center gap-2">
                            <span>{activeConversation.order_count || 0} pedidos anteriores</span>
                            {activeConversation.address && (
                              <span>· 📍 {activeConversation.address}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* AI / Human takeover action button */}
                      <div className="flex items-center gap-2">
                        {activeConversation.ai_paused ? (
                          <Button
                            size="sm"
                            onClick={() => handoverToAi(activeConversation.phone)}
                            className="bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs h-8 shadow-xs"
                          >
                            <Play size={14} weight="fill" className="mr-1.5" />
                            Retomar Atendimento pela IA
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => takeOver(activeConversation.phone)}
                            className="border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs h-8 font-medium shadow-xs"
                          >
                            <Pause size={14} weight="fill" className="mr-1.5" />
                            Assumir Atendimento (Pausar IA)
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPixDialog(true)}
                          className="border-stone-200 text-xs h-8 text-stone-700"
                        >
                          <Receipt size={14} className="mr-1" />
                          Validar Pix
                        </Button>
                      </div>
                    </div>

                    {/* Detected Tastes Pill & Active Orders Strip */}
                    <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-500 font-medium">Gostos Detectados:</span>
                        {activeConversation.tastes ? (
                          <span className="bg-[#FDF6EA] text-[#D99A45] border border-[#D99A45]/30 px-2 py-0.5 rounded font-medium">
                            ⭐ {activeConversation.tastes}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">Nenhum gosto registrado ainda</span>
                        )}
                      </div>

                      {activeConversation.active_orders?.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-stone-500">Pedidos hoje:</span>
                          {activeConversation.active_orders.map((ord) => (
                            <Badge
                              key={ord.order_id}
                              variant="outline"
                              onClick={() => navigate("/pedidos")}
                              className="cursor-pointer bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                            >
                              #{ord.order_id.slice(-4)}: {ord.status} ({BRL.format(ord.total)})
                              {ord.pix_receipt_verified && " ✓ Pix"}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mode Banner Indicator */}
                  {activeConversation.ai_paused ? (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User size={14} weight="bold" />
                        <strong>Atendimento Manual:</strong> Você está no controle da conversa. O robô IA está pausado para este cliente.
                      </span>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/70 border-b border-emerald-200 px-4 py-1.5 text-xs text-emerald-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Robot size={14} weight="bold" className="text-emerald-700" />
                        <strong>Atendimento IA Ativo:</strong> O robô Gemini está respondendo automaticamente mensagens sobre cardápio, localização e pedidos.
                      </span>
                    </div>
                  )}

                  {/* Messages Viewport */}
                  <div
                    ref={messagesViewportRef}
                    className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3 overscroll-contain"
                  >
                    {activeConversation.messages.map((m) => {
                      const isCustomer = m.sender === "customer";
                      const isAi = m.sender === "ai";
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 text-[11px] text-stone-400">
                            {isCustomer ? (
                              <>
                                <User size={12} /> Cliente ({activeConversation.customer_name})
                              </>
                            ) : isAi ? (
                              <>
                                <Robot size={12} className="text-[#C5533B]" /> Robô IA (Gemini)
                              </>
                            ) : (
                              <>
                                <User size={12} className="text-[#4A6E8C]" /> Atendente Humano
                              </>
                            )}
                            <span>·</span>
                            <span>
                              {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                              isCustomer
                                ? "bg-white border border-stone-200 text-stone-900 rounded-tl-sm shadow-sm"
                                : isAi
                                ? "bg-[#C5533B] text-white rounded-tr-sm shadow-sm"
                                : "bg-[#4A6E8C] text-white rounded-tr-sm shadow-sm"
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Message Input Footer */}
                  <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-200 flex gap-2">
                    <Input
                      placeholder={
                        activeConversation.ai_paused
                          ? "Digite sua resposta manual ao cliente..."
                          : "Digite para responder manualmente (recomendado pausar a IA antes)..."
                      }
                      value={inputMsg}
                      onChange={(e) => setInputMsg(e.target.value)}
                      className="bg-stone-50 h-10 text-sm"
                    />
                    <Button
                      type="submit"
                      disabled={sending || !inputMsg.trim()}
                      className="bg-[#C5533B] hover:bg-[#A6432E] text-white h-10 px-4"
                    >
                      <PaperPlaneRight size={18} weight="bold" />
                    </Button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-stone-400">
                  <WhatsappLogo size={56} className="mb-3 opacity-30 text-[#25D366]" />
                  <div className="font-display font-medium text-lg text-stone-700">Selecione uma conversa ao lado</div>
                  <p className="text-sm text-stone-500 max-w-sm mt-1">
                    Ou utilize o simulador acima para disparar mensagens e ver o robô com IA em ação.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 2: BAILEYS WHATSAPP CONNECTION ================= */}
        <TabsContent value="baileys" className="space-y-4 mt-4">
          <Card className="border-stone-200 shadow-sm">
            <CardHeader className="border-b border-stone-100 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-xl font-display flex items-center gap-2 text-stone-900">
                    <WhatsappLogo size={24} weight="duotone" className="text-[#25D366]" />
                    Conexão WhatsApp & Memorização de Número
                  </CardTitle>
                  <p className="text-sm text-stone-500 mt-1">
                    Vincule o número de WhatsApp da sua marmitaria. O sistema sempre lembrará deste número até que você decida encerrar a conexão.
                  </p>
                </div>
                {baileysSession?.status === "connected" && (
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={loadingBaileys}
                    className="border-red-200 text-red-700 hover:bg-red-50 text-xs gap-1.5"
                  >
                    Encerrar Conexão / Desconectar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {baileysSession?.status === "connected" ? (
                /* STATUS: CONECTADO COM SUCESSO E LEMBRANDO NÚMERO */
                <div className="bg-gradient-to-b from-emerald-50 to-white border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center max-w-xl mx-auto shadow-sm space-y-5">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#25D366] flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle size={40} weight="fill" />
                  </div>

                  <div>
                    <Badge variant="outline" className="bg-emerald-100/80 text-emerald-800 border-emerald-300 text-xs px-3 py-1 font-semibold mb-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                      Número Vinculado & Memorizado com Sucesso
                    </Badge>
                    <h3 className="font-display text-2xl font-bold text-stone-900 mt-1">
                      WhatsApp Conectado e Ativo!
                    </h3>
                    <p className="text-sm text-stone-600 max-w-md mx-auto mt-1">
                      O robô IA está online interagindo automaticamente com clientes que enviarem mensagens para:
                    </p>
                  </div>

                  <div className="bg-white py-3 px-6 rounded-xl border border-emerald-200 inline-flex items-center gap-3 shadow-xs">
                    <Phone size={22} weight="fill" className="text-[#25D366]" />
                    <span className="font-mono text-xl font-bold text-emerald-950 tracking-wide">
                      {formatPhone(baileysSession.phone || baileysSession.last_linked_phone)}
                    </span>
                  </div>

                  <div className="text-xs text-stone-500 space-y-1">
                    <div>
                      Conectado em: {new Date(baileysSession.connected_at || Date.now()).toLocaleString("pt-BR")}
                    </div>
                    <div className="text-emerald-700 font-medium">
                      ✓ Este número permanecerá vinculado continuamente até você clicar em encerrar.
                    </div>
                  </div>

                  <div className="pt-4 border-t border-emerald-100 flex flex-wrap justify-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => setMainTab("chat")}
                      className="bg-[#25D366] hover:bg-[#1EBE5D] text-white gap-1.5"
                    >
                      <ChatCircleDots size={16} weight="bold" />
                      Ir para Conversas (Chat)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const target = baileysSession.phone || "5511987654321";
                        const intl = target.startsWith("55") ? target : `55${target}`;
                        window.open(`https://wa.me/${intl}`, "_blank");
                      }}
                      className="border-stone-300 text-stone-700 hover:bg-stone-50 gap-1.5"
                    >
                      <ArrowSquareOut size={16} />
                      Abrir no WhatsApp Web
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDisconnect}
                      disabled={loadingBaileys}
                      className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 text-xs"
                    >
                      Encerrar Conexão
                    </Button>
                  </div>
                </div>
              ) : (
                /* STATUS: DESCONECTADO OU CONECTANDO - CONFIGURAR E ESCANEAR QR */
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Card de Configuração do Número */}
                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                          <Phone size={16} weight="bold" className="text-[#25D366]" />
                          Número do WhatsApp da Marmitaria (Opcional para QR Code)
                        </div>
                        <div className="text-sm text-stone-600 font-medium">
                          Para ler o <strong>QR Code</strong>, <em>não é necessário digitar o número</em> — basta clicar em <strong>&quot;Gerar QR Code Agora&quot;</strong> e escanear; seu número será detectado e vinculado automaticamente.
                        </div>
                        <div className="text-xs text-stone-500">
                          (O número de telefone só é obrigatório se você optar pelo Método 2: Código de Pareamento de 8 dígitos).
                        </div>
                        {baileysSession?.last_linked_phone && (
                          <div className="text-xs text-stone-500 flex items-center gap-1.5 pt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Último número conectado:</span>
                            <strong className="text-stone-800 font-mono text-sm bg-white px-2 py-0.5 rounded border border-stone-200">
                              {formatPhone(baileysSession.last_linked_phone)}
                            </strong>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          placeholder="DDD + Telefone (ex: 77999849176)"
                          value={pairingPhone}
                          onChange={(e) => setPairingPhone(e.target.value)}
                          className="text-base h-11 w-64 bg-white font-mono font-medium border-stone-300 shadow-xs"
                        />
                        <Button
                          onClick={handleConnectQr}
                          disabled={loadingBaileys}
                          className="bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs sm:text-sm h-11 px-5 gap-1.5 font-bold shadow-xs"
                        >
                          <QrCode size={18} />
                          {loadingBaileys ? "Gerando..." : "Gerar QR Code Oficial"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs text-stone-600">
                      <div className="bg-white p-3.5 rounded-xl border border-stone-200/90 space-y-1 shadow-2xs">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5 text-[13px]">
                          <QrCode size={16} className="text-[#25D366]" />
                          Método 1: Escanear QR Code com a Câmera
                        </div>
                        <p className="text-stone-500 leading-relaxed">
                          Gere o QR Code oficial abaixo e aponte a câmera do seu WhatsApp em <strong>Aparelhos Conectados &gt; Conectar um aparelho</strong>.
                        </p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-stone-200/90 space-y-1 shadow-2xs">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5 text-[13px]">
                          <Key size={16} className="text-[#C5533B]" />
                          Método 2: Código de Pareamento de 8 Dígitos
                        </div>
                        <p className="text-stone-500 leading-relaxed">
                          Se preferir conectar sem usar a câmera, gere o código oficial de 8 dígitos e digite no WhatsApp em <strong>&quot;Conectar com número de telefone&quot;</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {/* Left: QR Code Oficial Válido */}
                    <div className="text-center p-6 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-800">
                          <QrCode size={18} className="text-[#25D366]" />
                          QR Code Oficial do WhatsApp
                        </div>
                        {baileysSession?.qr_code && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleConnectQr}
                            disabled={loadingBaileys}
                            className="text-xs h-8 gap-1 border-stone-300"
                          >
                            <ArrowClockwise size={13} />
                            Atualizar QR
                          </Button>
                        )}
                      </div>

                      {baileysSession?.qr_code ? (
                        <div className="space-y-4">
                          <div className="relative inline-block p-4 bg-white rounded-2xl border-2 border-emerald-500 shadow-sm">
                            <img
                              src={baileysSession.qr_code}
                              alt="QR Code Oficial WhatsApp"
                              className="w-64 h-64 mx-auto rounded-lg"
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-[#25D366]">
                                <WhatsappLogo size={28} weight="fill" className="text-[#25D366]" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-emerald-50 text-emerald-950 border border-emerald-200 p-3 rounded-xl text-xs font-medium space-y-1">
                            <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-800">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Aguardando leitura pelo WhatsApp no celular...
                            </div>
                            <div className="text-stone-600 text-[11px]">
                              Abra o WhatsApp &gt; ⋮ ou Configurações &gt; Aparelhos Conectados &gt; Conectar um aparelho
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-10 space-y-4">
                          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                            <QrCode size={36} />
                          </div>
                          <div>
                            <div className="font-bold text-stone-800 text-base">QR Code Oficial Multi-Device</div>
                            <div className="text-xs text-stone-500 max-w-xs mx-auto mt-1">
                              Clique no botão abaixo para iniciar o Baileys e gerar o QR Code oficial compatível com o aplicativo do WhatsApp.
                            </div>
                          </div>
                          <Button
                            onClick={handleConnectQr}
                            disabled={loadingBaileys}
                            className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold px-6 py-2 h-11 shadow-xs"
                          >
                            <QrCode size={18} className="mr-1.5" />
                            {loadingBaileys ? "Conectando aos servidores do WhatsApp..." : "Gerar QR Code Agora"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Right: Passo a Passo & Código de 8 Dígitos */}
                    <div className="space-y-5">
                      {/* Código de 8 Dígitos */}
                      <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                            <Key size={16} className="text-[#C5533B]" />
                            Código de Pareamento de 8 Dígitos
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                            Sem Câmera
                          </Badge>
                        </div>

                        <p className="text-xs text-stone-600 leading-relaxed">
                          Gere um código de 8 dígitos diretamente pelo Baileys para digitar no WhatsApp (opção &quot;Conectar com número de telefone&quot;):
                        </p>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleGeneratePairing}
                            disabled={loadingBaileys}
                            className="bg-stone-900 hover:bg-stone-800 text-white text-xs h-10 w-full font-semibold shadow-xs"
                          >
                            <Key size={15} className="mr-1.5" />
                            {loadingBaileys ? "Solicitando ao WhatsApp..." : "Gerar Código de 8 Dígitos"}
                          </Button>
                        </div>

                        {baileysSession?.pairing_code && (
                          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                                  Seu Código Oficial de Pareamento:
                                </div>
                                <div className="font-mono text-2xl font-black tracking-widest text-[#C5533B] mt-0.5">
                                  {baileysSession.pairing_code}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(baileysSession.pairing_code.replace("-", ""));
                                  setCopiedCode(true);
                                  toast.success("Código copiado!");
                                  setTimeout(() => setCopiedCode(false), 2000);
                                }}
                                className="h-9 px-3 text-xs bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 gap-1.5 font-bold shadow-2xs"
                              >
                                {copiedCode ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                                {copiedCode ? "Copiado!" : "Copiar"}
                              </Button>
                            </div>

                            <div className="text-[11px] text-amber-950/80 bg-white/80 p-2.5 rounded-lg border border-amber-200/60 leading-relaxed">
                              <strong>Instruções no WhatsApp do Celular:</strong>
                              <ol className="list-decimal list-inside mt-1 space-y-0.5">
                                <li>Abra o <strong>WhatsApp</strong> &gt; <strong>Aparelhos Conectados</strong></li>
                                <li>Toque em <strong>Conectar um aparelho</strong></li>
                                <li>No rodapé da câmera, toque em <strong>&quot;Conectar com número de telefone&quot;</strong></li>
                                <li>Digite o código <strong className="font-mono text-[#C5533B]">{baileysSession.pairing_code}</strong></li>
                              </ol>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Instruções Detalhadas */}
                      <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
                        <h4 className="font-display font-semibold text-sm text-stone-900 flex items-center gap-2">
                          <DeviceMobile size={18} className="text-[#25D366]" />
                          Como Encontrar no WhatsApp do Smartphone:
                        </h4>
                        <ol className="list-decimal list-inside space-y-1.5 text-xs text-stone-600 leading-relaxed">
                          <li>Abra o aplicativo oficial do <strong>WhatsApp</strong> no smartphone.</li>
                          <li>Toque em <strong>Configurações</strong> (no iPhone) ou nos <strong>3 pontinhos</strong> (no Android).</li>
                          <li>Toque em <strong>Aparelhos Conectados</strong>.</li>
                          <li>Toque em <strong>Conectar um aparelho</strong> e aponte para o QR Code ao lado.</li>
                          <li>Assim que a leitura for concluída, o sistema detectará automaticamente a conexão e ativará o robô.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 3: AI BEHAVIOR & PIX CONFIGURATION ================= */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card className="border-stone-200 shadow-sm">
            <CardHeader className="border-b border-stone-100 pb-4">
              <CardTitle className="text-xl font-display flex items-center gap-2 text-stone-900">
                <Robot size={24} weight="duotone" className="text-[#C5533B]" />
                Comportamento da IA, Instruções Personalizadas & Chave Pix
              </CardTitle>
              <p className="text-sm text-stone-500 mt-1">
                Configure exatamente como o atendente virtual deve falar com os clientes, dados de pagamento e disponibilidade.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSaveConfig} className="space-y-6 max-w-3xl">
                {/* AI Persona & Behavior */}
                <div className="space-y-2">
                  <Label htmlFor="ai-instructions" className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
                    <Sparkle size={16} weight="fill" className="text-[#C5533B]" />
                    Instruções de Personalidade e Comportamento da IA (Prompt Personalizado)
                  </Label>
                  <p className="text-xs text-stone-500">
                    Defina o tom de voz, regras do dia, ofertas especiais ou restrições que a IA deve obedecer estritamente.
                  </p>
                  <Textarea
                    id="ai-instructions"
                    rows={4}
                    value={configForm.custom_ai_instructions}
                    onChange={(e) => setConfigForm({ ...configForm, custom_ai_instructions: e.target.value })}
                    placeholder="Ex: Seja curta, reta e objetiva. Nunca mande textão. Responda uma coisa por vez, deixando o cliente falar e responder antes de passar para a próxima etapa."
                    className="bg-stone-50 text-sm"
                  />
                </div>

                {/* Pix Details */}
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                    <Receipt size={16} className="text-[#C5533B]" />
                    Dados do Pix para Pagamento Automático
                  </div>
                  <p className="text-xs text-stone-500">
                    Sempre que a forma de pagamento for Pix, o robô enviará estes dados e solicitará o comprovante.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <Label className="text-xs text-stone-700">Tipo de Chave Pix</Label>
                      <Select
                        value={configForm.pix_key_type}
                        onValueChange={(val) => setConfigForm({ ...configForm, pix_key_type: val })}
                      >
                        <SelectTrigger className="bg-white mt-1 h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Celular">Celular</SelectItem>
                          <SelectItem value="CPF">CPF</SelectItem>
                          <SelectItem value="CNPJ">CNPJ</SelectItem>
                          <SelectItem value="E-mail">E-mail</SelectItem>
                          <SelectItem value="Aleatória">Chave Aleatória</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-xs text-stone-700">Chave Pix</Label>
                      <Input
                        value={configForm.pix_key}
                        onChange={(e) => setConfigForm({ ...configForm, pix_key: e.target.value })}
                        placeholder="Ex: 11987654321 ou pix@marmita.com"
                        className="bg-white mt-1 h-10 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-stone-700">Nome do Titular da Conta / Restaurante</Label>
                    <Input
                      value={configForm.pix_name}
                      onChange={(e) => setConfigForm({ ...configForm, pix_name: e.target.value })}
                      placeholder="Ex: Marmitaria Sabor de Casa Ltda"
                      className="bg-white mt-1 h-10 text-sm"
                    />
                  </div>
                </div>

                {/* Orders Acceptance Mode */}
                <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold text-stone-800">Aceitar Pedidos Automaticamente</Label>
                      <p className="text-xs text-stone-500">
                        Quando pausado, o robô enviará uma mensagem prévia avisando que os pedidos estão pausados.
                      </p>
                    </div>
                    <Switch
                      checked={configForm.accept_orders}
                      onCheckedChange={(checked) => setConfigForm({ ...configForm, accept_orders: checked })}
                    />
                  </div>

                  {!configForm.accept_orders && (
                    <div>
                      <Label className="text-xs text-stone-700">Mensagem de Pedidos Pausados</Label>
                      <Textarea
                        rows={2}
                        value={configForm.paused_message}
                        onChange={(e) => setConfigForm({ ...configForm, paused_message: e.target.value })}
                        className="bg-stone-50 mt-1 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Gemini API Key */}
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <Label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                        <Key size={14} className="text-[#C5533B]" />
                        Chave Própria da Google Gemini API (Opcional)
                      </Label>
                      <p className="text-xs text-stone-500">
                        O sistema já possui fallback inteligente para a chave do ambiente sem travar o aplicativo.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleTestKey}
                      disabled={testingKey}
                      className="text-xs h-8 border-stone-300"
                    >
                      {testingKey ? "Testando..." : "Testar Conexão"}
                    </Button>
                  </div>
                  <Input
                    type="password"
                    value={configForm.custom_gemini_api_key}
                    onChange={(e) => setConfigForm({ ...configForm, custom_gemini_api_key: e.target.value })}
                    placeholder="AIzaSy... (deixe em branco para usar a chave padrão)"
                    className="bg-white text-sm"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={savingConfig}
                    className="bg-[#C5533B] hover:bg-[#A6432E] text-white font-medium px-6 h-10"
                  >
                    {savingConfig ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pix Verification Modal Dialog */}
      <Dialog open={pixDialog} onOpenChange={setPixDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Receipt size={22} className="text-[#C5533B]" />
              Validador de Comprovante Pix com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-stone-500 leading-relaxed">
              Cole o texto do comprovante ou resumo enviado pelo cliente para a IA validar contra o total do pedido.
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Texto do Comprovante Pix</Label>
              <Textarea
                rows={4}
                value={pixReceiptText}
                onChange={(e) => setPixReceiptText(e.target.value)}
                placeholder="Cole o comprovante aqui (ex: Transferência Pix de R$ 44,00 realizada com sucesso para Marmita Hub em 11/10/2026 às 12:30. ID da transação: E123456...)"
                className="text-sm bg-stone-50"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPixDialog(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleVerifyPix}
              disabled={verifyingPix || !pixReceiptText.trim()}
              className="bg-[#25D366] hover:bg-[#1EBE5D] text-white"
            >
              {verifyingPix ? "Analisando..." : "Validar Comprovante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
