import { useEffect, useState } from "react";
import api, { BRL, formatApiErrorDetail } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, PencilSimple, Trash, MapPinLine, UsersThree, MagnifyingGlass, Phone, Printer, Bluetooth, BluetoothSlash,
  MapPin, WhatsappLogo, Key, CheckCircle, ArrowSquareOut, Robot, HardDrives, CloudArrowUp,
} from "@phosphor-icons/react";
import { getAutoPrint, setAutoPrint, printReceipt } from "@/lib/print";
import { isBluetoothSupported, getPairedPrinter, pairPrinter, clearPairedPrinter } from "@/lib/bluetooth-printer";
import GoogleDriveBackupModal from "@/components/GoogleDriveBackupModal";

export default function Configuracoes() {
  // Auto-print setting
  const [autoPrint, setAutoPrintLocal] = useState(() => getAutoPrint());
  const [pairedPrinter, setPairedPrinter] = useState(() => getPairedPrinter());
  const [pairing, setPairing] = useState(false);
  const btSupported = isBluetoothSupported();

  // Location / Google Maps
  const [location, setLocation] = useState({
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    zip_code: "",
    reference_point: "",
    maps_url: "",
  });
  const [savingLocation, setSavingLocation] = useState(false);

  // WhatsApp & Gemini API Key Settings
  const [waConfig, setWaConfig] = useState({
    accept_orders: true,
    paused_message: "",
    has_custom_key: false,
  });
  const [customKeyInput, setCustomKeyInput] = useState("");
  const [testingKey, setTestingKey] = useState(false);
  const [savingWa, setSavingWa] = useState(false);

  // Zones
  const [zones, setZones] = useState([]);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneEditing, setZoneEditing] = useState(null);
  const [zoneForm, setZoneForm] = useState({ name: "", fee: "" });

  // Customers
  const [customers, setCustomers] = useState([]);
  const [custOpen, setCustOpen] = useState(false);
  const [custEditing, setCustEditing] = useState(null);
  const [custForm, setCustForm] = useState({
    name: "",
    phone: "",
    address: "",
    neighborhood: "",
    delivery_zone_id: null,
    notes: "",
  });
  const [custSearch, setCustSearch] = useState("");

  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [z, c, locRes, waRes] = await Promise.all([
        api.get("/delivery-zones"),
        api.get("/customers"),
        api.get("/store/location"),
        api.get("/whatsapp/config"),
      ]);
      setZones(z.data || []);
      setCustomers(c.data || []);
      if (locRes.data) setLocation(locRes.data);
      if (waRes.data) setWaConfig(waRes.data);
    } catch (err) {
      console.warn("Aviso ao carregar dados de configurações:", err);
    }
  };

  useEffect(() => { load(); }, []);

  // Save Store Location
  const handleSaveLocation = async (e) => {
    e?.preventDefault();
    setSavingLocation(true);
    try {
      const { data } = await api.post("/store/location", location);
      setLocation(data);
      toast.success("Localização e link do Google Maps atualizados com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar localização");
    } finally {
      setSavingLocation(false);
    }
  };

  // Save WhatsApp & Gemini Config
  const handleSaveWaConfig = async () => {
    setSavingWa(true);
    try {
      const payload = {
        accept_orders: waConfig.accept_orders,
        paused_message: waConfig.paused_message,
      };
      if (customKeyInput.trim()) {
        payload.custom_gemini_api_key = customKeyInput.trim();
      }
      const { data } = await api.post("/whatsapp/config", payload);
      setWaConfig(data);
      setCustomKeyInput("");
      toast.success("Configurações do WhatsApp salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações do WhatsApp");
    } finally {
      setSavingWa(false);
    }
  };

  // Test Gemini API Key
  const handleTestGeminiKey = async () => {
    setTestingKey(true);
    try {
      const { data } = await api.post("/whatsapp/test-gemini-key", {
        api_key: customKeyInput.trim() || undefined,
      });
      if (data.ok) {
        toast.success(`Conexão OK! Gemini respondeu com sucesso.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Falha ao testar chave Gemini.");
    } finally {
      setTestingKey(false);
    }
  };

  // -------- Zones --------
  const openZoneNew = () => { setZoneEditing(null); setZoneForm({ name: "", fee: "" }); setZoneOpen(true); };
  const openZoneEdit = (z) => { setZoneEditing(z); setZoneForm({ name: z.name, fee: String(z.fee) }); setZoneOpen(true); };
  const saveZone = async () => {
    if (!zoneForm.name || zoneForm.fee === "") {
      toast.error("Preencha nome e taxa");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: zoneForm.name, fee: parseFloat(zoneForm.fee) || 0 };
      if (zoneEditing) await api.put(`/delivery-zones/${zoneEditing.zone_id}`, payload);
      else await api.post("/delivery-zones", payload);
      toast.success("Zona salva");
      setZoneOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    } finally { setSaving(false); }
  };
  const removeZone = async (z) => {
    try { await api.delete(`/delivery-zones/${z.zone_id}`); toast.success("Zona excluída"); await load(); }
    catch (e) { toast.error("Erro ao excluir"); }
  };

  // -------- Customers --------
  const openCustNew = () => {
    setCustEditing(null);
    setCustForm({ name: "", phone: "", address: "", neighborhood: "", delivery_zone_id: null, notes: "" });
    setCustOpen(true);
  };
  const openCustEdit = (c) => {
    setCustEditing(c);
    setCustForm({
      name: c.name || "",
      phone: c.phone || "",
      address: c.address || "",
      neighborhood: c.neighborhood || "",
      delivery_zone_id: c.delivery_zone_id || null,
      notes: c.notes || "",
    });
    setCustOpen(true);
  };
  const saveCustomer = async () => {
    if (!custForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!custForm.phone.trim()) {
      toast.error("Telefone é obrigatório para salvar o cliente");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...custForm, delivery_zone_id: custForm.delivery_zone_id || null };
      if (custEditing) await api.put(`/customers/${custEditing.customer_id}`, payload);
      else await api.post("/customers", payload);
      toast.success("Cliente salvo");
      setCustOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    } finally { setSaving(false); }
  };
  const removeCustomer = async (c) => {
    try { await api.delete(`/customers/${c.customer_id}`); toast.success("Cliente excluído"); await load(); }
    catch (e) { toast.error("Erro ao excluir"); }
  };

  const filteredCust = customers.filter((c) => {
    if (!custSearch) return true;
    const q = custSearch.toLowerCase();
    return (c.name || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q);
  });

  const [backupModalOpen, setBackupModalOpen] = useState(false);

  return (
    <div className="space-y-8" data-testid="configuracoes-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Operação</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1">Configurações</h1>
        </div>
        <Button onClick={() => setBackupModalOpen(true)} className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
          <HardDrives size={18} weight="bold" className="mr-2" />
          Backup Google Drive (ZIP)
        </Button>
      </div>

      <GoogleDriveBackupModal open={backupModalOpen} onOpenChange={setBackupModalOpen} />

      {/* Google Drive Backup Card Overview */}
      <Card className="border-[#C5533B]/20 bg-gradient-to-br from-[#FCEEE6]/30 via-white to-white shadow-sm">
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-[#FCEEE6] text-[#C5533B] flex items-center justify-center shrink-0">
              <CloudArrowUp size={28} weight="duotone" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-stone-900 flex items-center gap-2">
                Backup Automático Diário e Restauração em ZIP no Google Drive
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Faça backups manuais ou agende exportações automáticas em ZIP diretamente para sua conta do Google Drive.
              </p>
            </div>
          </div>
          <Button onClick={() => setBackupModalOpen(true)} variant="outline" className="border-[#C5533B]/30 text-[#C5533B] hover:bg-[#FCEEE6]/50">
            Gerenciar Backups
          </Button>
        </CardContent>
      </Card>

      {/* 1. Google Maps & Local de Retirada */}
      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-stone-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#FCEEE6] text-[#C5533B] flex items-center justify-center">
                <MapPin size={22} weight="duotone" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-stone-900">
                  Google Maps & Local de Retirada Inteligente
                </h2>
                <p className="text-xs text-stone-500">
                  A IA enviará este endereço completo com ponto de referência e link direto do Google Maps no WhatsApp.
                </p>
              </div>
            </div>
            {location.maps_url && (
              <Button variant="outline" size="sm" asChild className="text-xs">
                <a href={location.maps_url} target="_blank" rel="noopener noreferrer">
                  <ArrowSquareOut size={14} className="mr-1.5" /> Abrir no Maps
                </a>
              </Button>
            )}
          </div>

          <form onSubmit={handleSaveLocation} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label>Rua / Avenida</Label>
                <Input
                  value={location.street}
                  onChange={(e) => setLocation({ ...location, street: e.target.value })}
                  placeholder="Ex: Rua das Marmitas"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Número</Label>
                <Input
                  value={location.number}
                  onChange={(e) => setLocation({ ...location, number: e.target.value })}
                  placeholder="123"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Bairro</Label>
                <Input
                  value={location.neighborhood}
                  onChange={(e) => setLocation({ ...location, neighborhood: e.target.value })}
                  placeholder="Centro"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={location.city}
                  onChange={(e) => setLocation({ ...location, city: e.target.value })}
                  placeholder="São Paulo"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CEP</Label>
                <Input
                  value={location.zip_code}
                  onChange={(e) => setLocation({ ...location, zip_code: e.target.value })}
                  placeholder="01001-000"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Ponto de Referência (Crucial para o cliente achar fácil)</Label>
              <Input
                value={location.reference_point}
                onChange={(e) => setLocation({ ...location, reference_point: e.target.value })}
                placeholder="Ex: Em frente à praça principal, portão vermelho com placa Marmita Hub"
                className="mt-1"
              />
            </div>

            {/* Google Maps Embed Preview */}
            <div className="rounded-xl overflow-hidden border border-stone-200 mt-2 bg-stone-100 h-56 relative">
              <iframe
                title="Google Maps Preview"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  [location.street, location.number, location.neighborhood, location.city].filter(Boolean).join(", ") ||
                    "São Paulo, Brasil"
                )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={savingLocation} className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
                {savingLocation ? "Salvando..." : "Salvar Localização"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Atendimento WhatsApp & Chave Gemini */}
      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-stone-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                <WhatsappLogo size={22} weight="duotone" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-stone-900">
                  Atendimento WhatsApp & Inteligência Artificial (Google Gemini)
                </h2>
                <p className="text-xs text-stone-500">
                  Controle do modo aceitar/recusar pedidos e gestão flexível da chave Gemini API.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Modo Aceitar / Recusar pedidos */}
            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-200">
              <div>
                <div className="font-medium text-stone-900">Status dos Pedidos via IA</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {waConfig.accept_orders
                    ? "A IA está acolhendo clientes, tirando dúvidas e anotando novos pedidos."
                    : "Pedidos pausados. A IA enviará a mensagem de pausa automática configurada abaixo."}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-700">
                  {waConfig.accept_orders ? "Aceitando Pedidos" : "Pausado"}
                </span>
                <Switch
                  checked={waConfig.accept_orders}
                  onCheckedChange={(val) => setWaConfig({ ...waConfig, accept_orders: val })}
                />
              </div>
            </div>

            <div>
              <Label>Mensagem Automática quando Pedidos Estiverem Pausados</Label>
              <Textarea
                rows={2}
                value={waConfig.paused_message}
                onChange={(e) => setWaConfig({ ...waConfig, paused_message: e.target.value })}
                placeholder="Ex: Olá! Agradecemos o contato. Nossos pedidos estão pausados no momento, retornaremos em breve!"
                className="mt-1"
              />
            </div>

            {/* Chave de API Flexivel */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-1.5 text-stone-900">
                    <Key size={16} className="text-[#C5533B]" />
                    Chave Gemini API Personalizada (Opcional)
                  </Label>
                  <p className="text-xs text-stone-500">
                    Insira sua própria chave se desejar. Caso vazia, o app utiliza a chave integrada padrão sem travar.
                  </p>
                </div>
                {waConfig.has_custom_key && (
                  <Badge variant="outline" className="bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/30 text-xs">
                    <CheckCircle size={12} className="mr-1" /> Chave personalizada ativa
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={waConfig.has_custom_key ? "••••••••••••••••••••••••••••••••" : "AIzaSy..."}
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestGeminiKey}
                  disabled={testingKey}
                  className="shrink-0"
                >
                  {testingKey ? "Testando..." : "Testar Conexão"}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleSaveWaConfig}
                disabled={savingWa}
                className="bg-[#C5533B] hover:bg-[#A6432E] text-white"
              >
                {savingWa ? "Salvando..." : "Salvar Configurações do WhatsApp"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Printing */}
      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-stone-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#EEF3F0] text-[#5B7A69] flex items-center justify-center">
                <Printer size={20} weight="duotone" />
              </div>
              <div>
                <div className="font-display font-semibold text-stone-900">Impressão de cupom</div>
                <div className="text-xs text-stone-500">Cupom térmico 58mm — usa a impressora padrão do dispositivo</div>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-stone-900">Imprimir automaticamente ao salvar</div>
                <div className="text-sm text-stone-500">Ao criar um pedido (normal ou via Modo Balcão), abre o diálogo de impressão automaticamente.</div>
              </div>
              <Button
                data-testid="auto-print-toggle"
                variant={autoPrint ? "default" : "outline"}
                className={autoPrint ? "bg-[#6B8E7B] hover:bg-[#5B7A69] text-white" : ""}
                onClick={() => { const nv = !autoPrint; setAutoPrintLocal(nv); setAutoPrint(nv); toast.success(nv ? "Impressão automática ativada" : "Impressão automática desativada"); }}
              >
                <Printer size={16} weight="fill" className="mr-1.5" />
                {autoPrint ? "Ativado" : "Desativado"}
              </Button>
            </div>
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-stone-900">Teste de impressão</div>
                <div className="text-sm text-stone-500">Gera um cupom de exemplo pra conferir a formatação.</div>
              </div>
              <Button
                data-testid="print-test-btn"
                variant="outline"
                onClick={() => { printReceipt({
                  order_id: "TESTE001",
                  customer_name: "Cliente Teste",
                  customer_phone: "(11) 99999-0000",
                  delivery_type: "Entrega",
                  address: "Rua Exemplo, 123 - Bairro Centro",
                  items: [
                    { name: "Marmita Frango Grelhado", price: 18.90, quantity: 2, additionals: [{ name: "Farofa extra", price: 3 }] },
                    { name: "Refrigerante Lata", price: 6, quantity: 1, additionals: [] },
                  ],
                  delivery_fee: 5,
                  surcharge: 0,
                  discount: 0,
                  payment_method: "Pix",
                  notes: "Sem cebola, por favor.",
                  total: 51.80,
                  created_at: new Date().toISOString(),
                }).catch((e) => toast.error(e?.message || "Falha ao imprimir")); }}
              >
                <Printer size={16} weight="fill" className="mr-1.5" />
                Imprimir cupom de teste
              </Button>
            </div>

            {/* Bluetooth printer pairing */}
            <div className="pt-3 border-t border-stone-100">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-[#EFF4F8] text-[#4A6E8C] flex items-center justify-center shrink-0">
                  {pairedPrinter ? <Bluetooth size={18} weight="fill" /> : <BluetoothSlash size={18} weight="fill" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-900">Impressora Bluetooth (ESC/POS)</div>
                  {pairedPrinter ? (
                    <div className="text-sm text-[#4A6E8C]">
                      Pareada: <b>{pairedPrinter.name}</b>
                    </div>
                  ) : (
                    <div className="text-sm text-stone-500">
                      {btSupported
                        ? "Nenhuma impressora pareada. Se não parear, o app usa a impressora padrão do sistema."
                        : "Bluetooth não é suportado neste navegador. Use Chrome ou Edge (desktop ou Android)."}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  data-testid="bt-pair-btn"
                  variant="outline"
                  disabled={!btSupported || pairing}
                  onClick={async () => {
                    try {
                      setPairing(true);
                      const info = await pairPrinter();
                      setPairedPrinter(info);
                      toast.success(`Pareada com ${info.name}`);
                    } catch (e) {
                      if (e && (e.name === "NotFoundError" || String(e).includes("cancel"))) {
                        // user cancelled
                      } else {
                        toast.error(e?.message || "Falha ao parear");
                      }
                    } finally {
                      setPairing(false);
                    }
                  }}
                >
                  <Bluetooth size={16} weight="fill" className="mr-1.5" />
                  {pairedPrinter ? "Trocar impressora" : "Parear impressora"}
                </Button>
                {pairedPrinter && (
                  <Button
                    data-testid="bt-unpair-btn"
                    variant="outline"
                    onClick={() => {
                      clearPairedPrinter();
                      setPairedPrinter(null);
                      toast.success("Impressora desconectada");
                    }}
                    className="text-[#B94B4B] border-[#B94B4B]/30 hover:bg-[#FCEDED]"
                  >
                    <BluetoothSlash size={16} weight="fill" className="mr-1.5" />
                    Desconectar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Zones */}
      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-stone-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#FCEEE6] text-[#C5533B] flex items-center justify-center">
                <MapPinLine size={20} weight="duotone" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-900">Taxas de entrega</h2>
                <p className="text-sm text-stone-500">Cadastre bairros / zonas com valor fixo</p>
              </div>
            </div>
            <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
              <DialogTrigger asChild>
                <Button onClick={openZoneNew} className="bg-[#C5533B] hover:bg-[#A6432E] text-white" data-testid="new-zone-btn">
                  <Plus size={16} className="mr-1" /> Nova zona
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display">{zoneEditing ? "Editar zona" : "Nova zona de entrega"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Nome da zona / bairro</Label>
                    <Input data-testid="zone-name-input" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Ex: Centro, Jardim das Flores..." className="mt-1" />
                  </div>
                  <div>
                    <Label>Taxa (R$)</Label>
                    <Input data-testid="zone-fee-input" type="number" step="0.01" value={zoneForm.fee} onChange={(e) => setZoneForm({ ...zoneForm, fee: e.target.value })} placeholder="0,00" className="mt-1" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setZoneOpen(false)}>Cancelar</Button>
                  <Button onClick={saveZone} disabled={saving} className="bg-[#C5533B] hover:bg-[#A6432E] text-white" data-testid="save-zone-btn">
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {zones.length === 0 ? (
            <div className="p-10 text-center text-stone-500">
              Nenhuma zona cadastrada.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {zones.map((z) => (
                <li key={z.zone_id} data-testid={`zone-row-${z.zone_id}`} className="px-5 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
                  <div className="font-medium text-stone-900">{z.name}</div>
                  <div className="flex items-center gap-4">
                    <span className="font-display font-semibold text-stone-900 tabular-nums">{BRL.format(z.fee)}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openZoneEdit(z)} className="h-8 w-8" data-testid={`edit-zone-${z.zone_id}`}>
                        <PencilSimple size={16} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeZone(z)} className="h-8 w-8 text-[#B94B4B] hover:bg-[#FCEDED]" data-testid={`delete-zone-${z.zone_id}`}>
                        <Trash size={16} />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Customers */}
      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-stone-200 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#EFF4F8] text-[#4A6E8C] flex items-center justify-center">
                <UsersThree size={20} weight="duotone" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-900">Clientes</h2>
                <p className="text-sm text-stone-500">Base de clientes e preferências gastronômicas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <Input
                  data-testid="customer-search"
                  placeholder="Buscar cliente..."
                  value={custSearch}
                  onChange={(e) => setCustSearch(e.target.value)}
                  className="pl-9 w-56 h-9"
                />
              </div>
              <Dialog open={custOpen} onOpenChange={setCustOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCustNew} className="bg-[#C5533B] hover:bg-[#A6432E] text-white" data-testid="new-customer-btn">
                    <Plus size={16} className="mr-1" /> Novo cliente
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display">{custEditing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label>Nome</Label>
                      <Input data-testid="customer-name-input" value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} className="mt-1" placeholder="João Silva" />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input data-testid="customer-phone-input" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} className="mt-1" placeholder="(11) 9..." />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Endereço</Label>
                        <Input data-testid="customer-address-input" value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} className="mt-1" placeholder="Rua, número..." />
                      </div>
                      <div>
                        <Label>Bairro</Label>
                        <Input value={custForm.neighborhood} onChange={(e) => setCustForm({ ...custForm, neighborhood: e.target.value })} className="mt-1" placeholder="Bairro" />
                      </div>
                    </div>
                    {zones.length > 0 && (
                      <div>
                        <Label>Zona de entrega padrão <span className="text-xs text-stone-400 font-normal">(opcional)</span></Label>
                        <Select
                          value={custForm.delivery_zone_id || "__none__"}
                          onValueChange={(v) => setCustForm({ ...custForm, delivery_zone_id: v === "__none__" ? null : v })}
                        >
                          <SelectTrigger data-testid="customer-zone-select" className="mt-1"><SelectValue placeholder="Sem zona padrão" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sem zona padrão</SelectItem>
                            {zones.map((z) => (
                              <SelectItem key={z.zone_id} value={z.zone_id}>{z.name} — {BRL.format(z.fee)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Observações / Preferências <span className="text-xs text-stone-400 font-normal">(usado pela IA)</span></Label>
                      <Textarea data-testid="customer-notes-input" rows={2} value={custForm.notes} onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })} className="mt-1" placeholder="Sem cebola, prefere feijão preto, etc." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCustOpen(false)}>Cancelar</Button>
                    <Button onClick={saveCustomer} disabled={saving} className="bg-[#C5533B] hover:bg-[#A6432E] text-white" data-testid="save-customer-btn">
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {filteredCust.length === 0 ? (
            <div className="p-10 text-center text-stone-500">
              {custSearch ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {filteredCust.map((c) => {
                const zone = zones.find((z) => z.zone_id === c.delivery_zone_id);
                return (
                  <li key={c.customer_id} data-testid={`customer-row-${c.customer_id}`} className="px-5 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-[#FCEEE6] text-[#C5533B] flex items-center justify-center font-display font-semibold shrink-0">
                        {c.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-stone-900 flex items-center gap-2 truncate">
                          {c.name}
                          {c.order_count ? (
                            <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-normal">
                              {c.order_count} {c.order_count === 1 ? "pedido" : "pedidos"}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-stone-500 flex items-center gap-3 flex-wrap mt-0.5">
                          {c.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {c.phone}</span>}
                          {c.address && <span className="truncate max-w-xs">{c.address} {c.neighborhood ? `(${c.neighborhood})` : ""}</span>}
                          {zone && <span className="text-[#4A6E8C]">{zone.name}</span>}
                          {c.notes && <span className="text-amber-700 italic max-w-xs truncate">Obs: {c.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => openCustEdit(c)} className="h-8 w-8" data-testid={`edit-customer-${c.customer_id}`}>
                        <PencilSimple size={16} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeCustomer(c)} className="h-8 w-8 text-[#B94B4B] hover:bg-[#FCEDED]" data-testid={`delete-customer-${c.customer_id}`}>
                        <Trash size={16} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
