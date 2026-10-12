import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api, { BRL, formatApiErrorDetail } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus, DotsThreeVertical, Trash, MapPin, House, Phone, Note, CreditCard,
  FloppyDisk, UserCirclePlus, UserCircle, Receipt, ShoppingBag, PencilSimple,
  PlusCircle, MinusCircle, Archive, ArrowCounterClockwise, Sparkle, Microphone, Storefront, Printer,
  Moped,
} from "@phosphor-icons/react";
import CustomerAutocomplete from "@/components/CustomerAutocomplete";
import PaymentIcon, { PaymentBadge, PAYMENT_META } from "@/components/PaymentIcon";
import VoiceOrderDialog from "@/components/VoiceOrderDialog";
import { useCounterMode } from "@/contexts/CounterModeContext";
import { printReceipt, getAutoPrint } from "@/lib/print";
import ProductionCounter from "@/components/ProductionCounter";

const STATUS = ["Em Análise", "Confirmado", "Preparando", "Pronto", "Em Rota", "Entregue", "Cancelado"];
const STATUS_STYLES = {
  "Em Análise": "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/30",
  Confirmado: "bg-blue-50 text-blue-700 border-blue-300",
  Novo: "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/30",
  Preparando: "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/30",
  "Em Preparo": "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/30",
  Pronto: "bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/30",
  "Em Rota": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/30",
  "Em Entrega": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/30",
  Entregue: "bg-emerald-50 text-emerald-700 border-emerald-300",
  Concluído: "bg-stone-100 text-stone-700 border-stone-300",
  Cancelado: "bg-[#FCEDED] text-[#B94B4B] border-[#B94B4B]/30",
};
const PAYMENTS = ["Pendente", "Dinheiro", "Cartão Crédito", "Cartão Débito", "Pix", "Outro"];

const emptyOrder = {
  customer_name: "",
  customer_phone: "",
  delivery_type: "Entrega",
  address: "",
  items: [],
  payment_method: "Pendente",
  delivery_fee: 0,
  surcharge: 0,
  discount: 0,
  notes: "",
  status: "Em Análise",
  delivery_zone_id: null,
  courier_id: null,
};

export default function Pedidos() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [zones, setZones] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [filter, setFilter] = useState("Todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyOrder);
  const [saving, setSaving] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [typeFilter, setTypeFilter] = useState("Todos"); // Todos | Entrega | Retirada
  const [paymentFilter, setPaymentFilter] = useState("Todos"); // Todos | specific method
  const [dayStatus, setDayStatus] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);

  // Item editor (for choosing additionals)
  const [itemDialog, setItemDialog] = useState(null);
  const [itemDraft, setItemDraft] = useState(null);

  // AI parse from text
  const [aiDialog, setAiDialog] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Voice mode
  const [voiceDialog, setVoiceDialog] = useState(false);
  const { open: openCounterMode } = useCounterMode();

  const [searchParams, setSearchParams] = useSearchParams();

  const load = async () => {
    try {
      const [o, p, z, c, ds, cr] = await Promise.all([
        api.get("/orders"),
        api.get("/products"),
        api.get("/delivery-zones"),
        api.get("/customers"),
        api.get("/day/status"),
        api.get("/couriers"),
      ]);
      setOrders(o.data || []);
      setProducts((p.data || []).filter((x) => x.active));
      setZones(z.data || []);
      setCustomers(c.data || []);
      setDayStatus(ds.data);
      setCouriers(cr.data || []);
    } catch (err) {
      console.warn("Aviso ao carregar dados de pedidos:", err);
    }
  };

  useEffect(() => { load(); }, []);

  // Reload when counter mode saves an order
  useEffect(() => {
    const onSaved = () => load();
    window.addEventListener("counter-order-saved", onSaved);
    return () => window.removeEventListener("counter-order-saved", onSaved);
  }, []);

  const isDayClosed = dayStatus?.day_state === "closed";

  const openDay = async () => {
    try {
      await api.post("/day/open");
      toast.success("Novo dia aberto!");
      await load();
    } catch (e) {
      toast.error("Erro ao abrir dia");
    }
  };

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openNew();
      setSearchParams({});
    }
    // eslint-disable-next-line
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = orders;
    if (typeFilter !== "Todos") list = list.filter((o) => o.delivery_type === typeFilter);
    if (paymentFilter !== "Todos") list = list.filter((o) => o.payment_method === paymentFilter);
    if (filter !== "Todos") list = list.filter((o) => o.status === filter);
    return list;
  }, [orders, filter, typeFilter, paymentFilter]);

  const typeCounts = useMemo(() => ({
    Todos: orders.length,
    Entrega: orders.filter((o) => o.delivery_type === "Entrega").length,
    Retirada: orders.filter((o) => o.delivery_type === "Retirada").length,
  }), [orders]);

  const paymentCounts = useMemo(() => {
    const counts = { Todos: orders.length };
    PAYMENTS.forEach((m) => {
      counts[m] = orders.filter((o) => o.payment_method === m).length;
    });
    return counts;
  }, [orders]);

  const openNew = () => {
    setForm(emptyOrder);
    setSelectedCustomerId(null);
    setEditingOrder(null);
    setOpen(true);
  };

  const openAiParse = () => {
    setAiText("");
    setAiDialog(true);
  };

  const applyAiOrder = (data) => {
    setEditingOrder(null);
    setSelectedCustomerId(null);
    setForm({
      customer_name: data.customer_name || "",
      customer_phone: data.customer_phone || "",
      delivery_type: data.delivery_type || "Entrega",
      address: data.address || "",
      items: (data.items || []).map((i) => ({
        product_id: i.product_id || null,
        name: i.name || "",
        price: i.price || 0,
        quantity: i.quantity || 1,
        additionals: [],
        notes: "",
      })),
      payment_method: data.payment_method || "Pendente",
      delivery_fee: 0,
      surcharge: 0,
      discount: 0,
      notes: data.notes || "",
      status: "Novo",
      delivery_zone_id: null,
    });
    setOpen(true);
    const unmatched = (data.items || []).filter((i) => !i.product_id).length;
    if (unmatched > 0) {
      toast.warning(`Pedido preenchido. ${unmatched} item(ns) não bateu(ram) com o catálogo — revise antes de salvar.`);
    } else {
      toast.success("Pedido preenchido pela IA. Confira e salve.");
    }
  };

  const handleVoiceFilled = (data) => {
    setVoiceDialog(false);
    applyAiOrder(data);
  };

  const parseFromAi = async () => {
    if (!aiText.trim()) {
      toast.error("Cole a mensagem do cliente primeiro");
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/parse-order", { text: aiText });
      setAiDialog(false);
      applyAiOrder(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Não consegui entender a mensagem");
    } finally {
      setAiLoading(false);
    }
  };

  const openEditOrder = (o) => {
    setEditingOrder(o);
    setForm({
      customer_name: o.customer_name || "",
      customer_phone: o.customer_phone || "",
      delivery_type: o.delivery_type || "Entrega",
      address: o.address || "",
      items: (o.items || []).map((i) => ({
        product_id: i.product_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        additionals: i.additionals || [],
        notes: i.notes || "",
      })),
      payment_method: o.payment_method || "Pendente",
      delivery_fee: o.delivery_fee || 0,
      surcharge: o.surcharge || 0,
      discount: o.discount || 0,
      notes: o.notes || "",
      status: o.status || "Em Análise",
      delivery_zone_id: o.delivery_zone_id || null,
      courier_id: o.courier_id || null,
    });
    setSelectedCustomerId(null);
    setOpen(true);
    setDetailOrder(null);
  };

  const assignCourier = async (order, courierId) => {
    try {
      await api.patch(`/orders/${order.order_id}/assign-courier`, { courier_id: courierId });
      toast.success(courierId ? "Entregador atribuído com sucesso!" : "Entregador removido");
      await load();
      if (detailOrder?.order_id === order.order_id) {
        setDetailOrder((prev) => (prev ? { ...prev, courier_id: courierId } : null));
      }
    } catch {
      toast.error("Erro ao atribuir entregador");
    }
  };

  const pickCustomer = (c) => {
    setSelectedCustomerId(c.customer_id);
    const next = {
      ...form,
      customer_name: c.name || form.customer_name,
      customer_phone: c.phone || form.customer_phone,
      address: c.address || form.address,
    };
    if (c.delivery_zone_id) {
      const z = zones.find((x) => x.zone_id === c.delivery_zone_id);
      if (z) {
        next.delivery_zone_id = z.zone_id;
        next.delivery_fee = z.fee;
      }
    }
    setForm(next);
  };

  const saveCustomer = async () => {
    if (!form.customer_name.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (!form.customer_phone.trim()) {
      toast.error("Informe o telefone para salvar o cliente");
      return;
    }
    setSavingCustomer(true);
    try {
      const payload = {
        name: form.customer_name.trim(),
        phone: form.customer_phone.trim(),
        address: form.address || "",
        delivery_zone_id: form.delivery_zone_id || null,
      };
      const { data } = await api.post("/customers", payload);
      setSelectedCustomerId(data.customer_id);
      setCustomers((prev) => {
        const without = prev.filter((c) => c.customer_id !== data.customer_id);
        return [data, ...without];
      });
      toast.success("Cliente salvo!");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao salvar cliente");
    } finally {
      setSavingCustomer(false);
    }
  };

  const canSaveCustomer = !!(form.customer_name.trim() && form.customer_phone.trim());

  const handleProductSelect = (productId) => {
    const p = products.find((x) => x.product_id === productId);
    if (!p) return;
    if (p.additionals?.length > 0) {
      // Open additional picker
      setItemDraft({
        product_id: p.product_id,
        name: p.name,
        price: p.price,
        quantity: 1,
        additionals: [],
        notes: "",
        _available: p.additionals,
      });
      setItemDialog("new");
    } else {
      addItemDirect({
        product_id: p.product_id,
        name: p.name,
        price: p.price,
        quantity: 1,
        additionals: [],
        notes: "",
      });
    }
  };

  const addItemDirect = (item) => {
    setForm((f) => ({ ...f, items: [...f.items, item] }));
  };

  const confirmItem = () => {
    const { _available, ...item } = itemDraft;
    addItemDirect(item);
    setItemDraft(null);
    setItemDialog(null);
  };

  const toggleDraftAdditional = (a, checked) => {
    setItemDraft((d) => ({
      ...d,
      additionals: checked
        ? [...d.additionals, { name: a.name, price: a.price }]
        : d.additionals.filter((x) => x.name !== a.name),
    }));
  };

  const updateQty = (idx, qty) => {
    const q = Math.max(1, parseInt(qty) || 1);
    setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, quantity: q } : it)) });
  };

  const removeItem = (idx) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const handleZoneChange = (zoneId) => {
    if (zoneId === "__none__") {
      setForm({ ...form, delivery_zone_id: null, delivery_fee: 0 });
      return;
    }
    const z = zones.find((x) => x.zone_id === zoneId);
    if (z) setForm({ ...form, delivery_zone_id: z.zone_id, delivery_fee: z.fee });
  };

  const total = useMemo(() => {
    const sub = form.items.reduce(
      (s, i) =>
        s +
        i.price * i.quantity +
        (i.additionals || []).reduce((a, x) => a + x.price, 0) * i.quantity,
      0
    );
    const fee = form.delivery_type === "Retirada" ? 0 : (parseFloat(form.delivery_fee) || 0);
    return sub + fee + (parseFloat(form.surcharge) || 0) - (parseFloat(form.discount) || 0);
  }, [form]);

  const save = async () => {
    if (!form.customer_name) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }
    if (form.items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }
    setSaving(true);
    try {
      const isRetirada = form.delivery_type === "Retirada";
      const payload = {
        ...form,
        // Retirada nunca tem taxa nem endereço/zona/entregador
        address: isRetirada ? "" : form.address,
        delivery_zone_id: isRetirada ? null : form.delivery_zone_id,
        delivery_fee: isRetirada ? 0 : (parseFloat(form.delivery_fee) || 0),
        courier_id: isRetirada ? null : form.courier_id,
        surcharge: parseFloat(form.surcharge) || 0,
        discount: parseFloat(form.discount) || 0,
      };
      if (editingOrder) {
        await api.put(`/orders/${editingOrder.order_id}`, payload);
        toast.success("Pedido atualizado!");
      } else {
        const { data: created } = await api.post("/orders", payload);
        toast.success("Pedido criado!");
        if (getAutoPrint()) {
          try { printReceipt({ ...payload, ...created }); } catch (_) {}
        }
      }
      setOpen(false);
      setEditingOrder(null);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (order, status) => {
    try {
      await api.patch(`/orders/${order.order_id}/status`, { status });
      toast.success(`Pedido marcado como ${status}`);
      await load();
      if (detailOrder?.order_id === order.order_id) {
        setDetailOrder({ ...detailOrder, status });
      }
    } catch (e) {
      toast.error("Erro ao atualizar status");
    }
  };

  const changePayment = async (order, payment_method) => {
    try {
      const { data } = await api.patch(`/orders/${order.order_id}/payment`, { payment_method });
      toast.success(`Pagamento: ${payment_method}`);
      await load();
      if (detailOrder?.order_id === order.order_id) {
        setDetailOrder(data);
      }
    } catch (e) {
      toast.error("Erro ao atualizar pagamento");
    }
  };

  const unarchiveOrder = async (order) => {
    try {
      await api.patch(`/orders/${order.order_id}/unarchive`);
      toast.success("Pedido voltou para o painel");
      await load();
      setDetailOrder(null);
    } catch (e) {
      toast.error("Erro ao trazer de volta");
    }
  };

  const archiveOrder = async (order) => {
    try {
      await api.patch(`/orders/${order.order_id}/archive`);
      toast.success("Pedido arquivado");
      await load();
      setDetailOrder(null);
    } catch (e) {
      toast.error("Erro ao arquivar");
    }
  };

  const removeOrder = async (order) => {
    try {
      await api.delete(`/orders/${order.order_id}`);
      toast.success("Pedido excluído");
      await load();
      setDetailOrder(null);
    } catch (e) {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <div className="space-y-8" data-testid="pedidos-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Operação</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1">Pedidos</h1>
        </div>
        <div className="flex gap-2">
          {!isDayClosed && (
            <>
              <Button
                data-testid="counter-mode-btn"
                onClick={openCounterMode}
                variant="outline"
                className="border-[#6B8E7B]/40 text-[#5B7A69] hover:bg-[#EEF3F0]"
              >
                <Storefront size={16} weight="fill" className="mr-1.5" />
                Modo balcão
              </Button>
              <Button
                data-testid="voice-order-btn"
                onClick={() => setVoiceDialog(true)}
                variant="outline"
                className="border-[#C5533B]/30 text-[#C5533B] hover:bg-[#FCEEE6]"
              >
                <Microphone size={16} weight="fill" className="mr-1.5" />
                Modo voz
              </Button>
              <Button
                data-testid="ai-parse-order-btn"
                onClick={openAiParse}
                variant="outline"
                className="border-[#C5533B]/30 text-[#C5533B] hover:bg-[#FCEEE6]"
              >
                <Sparkle size={16} weight="fill" className="mr-1.5" />
                Preencher com IA
              </Button>
              <Button data-testid="new-order-btn" onClick={openNew} className="bg-[#C5533B] hover:bg-[#A6432E] text-white rounded-lg shadow-sm">
                <Plus size={18} weight="bold" className="mr-1.5" />
                Novo pedido
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Day closed banner */}
      {isDayClosed && (
        <div className="rounded-xl border-2 border-dashed border-stone-300 bg-white p-10 text-center" data-testid="pedidos-day-closed-banner">
          <div className="h-14 w-14 mx-auto rounded-full bg-stone-100 text-stone-500 flex items-center justify-center mb-3">
            <Archive size={26} weight="duotone" />
          </div>
          <h2 className="font-display text-xl font-semibold text-stone-900">Dia finalizado</h2>
          <p className="text-stone-600 max-w-md mx-auto mt-1.5">
            Todos os pedidos foram movidos para o <strong className="text-stone-800">Armazenamento</strong>.
            Abra um novo dia para começar a receber pedidos.
          </p>
          <div className="flex gap-2 justify-center mt-5">
            <Button onClick={openDay} className="bg-[#6B8E7B] hover:bg-[#56735F] text-white" data-testid="pedidos-open-day-btn">
              Abrir novo dia
            </Button>
            <Button variant="outline" asChild className="border-stone-300">
              <a href="/armazenamento">Ver armazenamento</a>
            </Button>
          </div>
        </div>
      )}

      {(!isDayClosed) && (<>
      {/* Production counter (kitchen view) */}
      <ProductionCounter orders={orders} />

      {/* Type tabs: Entrega x Retirada */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "Todos", label: "Todos", icon: ShoppingBag },
          { key: "Entrega", label: "Entrega", icon: MapPin },
          { key: "Retirada", label: "Retirada", icon: House },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            data-testid={`type-filter-${key}`}
            onClick={() => setTypeFilter(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all duration-200 ${
              typeFilter === key
                ? "bg-[#C5533B] border-[#C5533B] text-white shadow-sm"
                : "bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
            }`}
          >
            <Icon size={16} weight="duotone" />
            <span className="font-medium text-sm">{label}</span>
            <span className={`text-xs ${typeFilter === key ? "text-white/80" : "text-stone-400"}`}>
              {typeCounts[key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Payment method filter chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="text-xs uppercase tracking-widest font-semibold text-stone-500 mr-1">
          Pagamento
        </div>
        <button
          key="pay-Todos"
          data-testid="payment-filter-Todos"
          onClick={() => setPaymentFilter("Todos")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-200 ${
            paymentFilter === "Todos"
              ? "bg-stone-900 border-stone-900 text-white"
              : "bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
          }`}
        >
          Todos
          <span className={`text-xs ${paymentFilter === "Todos" ? "text-white/70" : "text-stone-400"}`}>
            {paymentCounts.Todos ?? 0}
          </span>
        </button>
        {PAYMENTS.map((m) => {
          const meta = PAYMENT_META[m];
          const Icon = meta.icon;
          const active = paymentFilter === m;
          return (
            <button
              key={`pay-${m}`}
              data-testid={`payment-filter-${m}`}
              onClick={() => setPaymentFilter(m)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-medium transition-all duration-200 ${
                active ? "shadow-sm" : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"
              }`}
              style={
                active
                  ? { background: meta.bg, color: meta.color, borderColor: `${meta.color}40` }
                  : { color: meta.color }
              }
            >
              <Icon size={18} weight="duotone" />
              {m}
              <span className={`text-xs ${active ? "opacity-70" : "text-stone-400"}`}>
                {paymentCounts[m] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 border-b border-stone-200 overflow-x-auto">
        {["Todos", ...STATUS].map((s) => (
          <button
            key={s}
            data-testid={`filter-${s}`}
            onClick={() => setFilter(s)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              filter === s
                ? "border-[#C5533B] text-[#C5533B]"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {s}{" "}
            <span className="text-xs text-stone-400">
              ({s === "Todos"
                ? (typeFilter === "Todos" ? orders.length : orders.filter((o) => o.delivery_type === typeFilter).length)
                : orders.filter((o) => o.status === s && (typeFilter === "Todos" || o.delivery_type === typeFilter)).length})
            </span>
          </button>
        ))}
      </div>

      <Card className="border-stone-200 shadow-sm overflow-hidden bg-transparent">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-16 text-center">
              <ShoppingBag size={36} weight="duotone" className="mx-auto text-stone-300 mb-3" />
              <div className="text-stone-500">Nenhum pedido nesta categoria.</div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((o) => {
                const accent = {
                  "Em Análise": { bar: "bg-[#4A6E8C]", tint: "from-[#EFF4F8]" },
                  Novo: { bar: "bg-[#4A6E8C]", tint: "from-[#EFF4F8]" },
                  Preparando: { bar: "bg-[#D99A45]", tint: "from-[#FDF6EA]" },
                  "Em Preparo": { bar: "bg-[#D99A45]", tint: "from-[#FDF6EA]" },
                  Pronto: { bar: "bg-[#6B8E7B]", tint: "from-[#EEF3F0]" },
                  "Em Rota": { bar: "bg-[#C5533B]", tint: "from-[#FCEEE6]" },
                  "Em Entrega": { bar: "bg-[#C5533B]", tint: "from-[#FCEEE6]" },
                  Entregue: { bar: "bg-emerald-500", tint: "from-emerald-50" },
                  Concluído: { bar: "bg-stone-300", tint: "from-stone-100" },
                  Cancelado: { bar: "bg-[#B94B4B]", tint: "from-[#FCEDED]" },
                }[o.status] || { bar: "bg-stone-200", tint: "from-stone-50" };
                const isPaid = o.payment_method !== "Pendente";
                const assignedCourier = couriers.find((c) => c.courier_id === o.courier_id);
                return (
                  <li
                    key={o.order_id}
                    data-testid={`order-row-${o.order_id}`}
                    className="relative bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
                  >
                    {/* Status bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${accent.bar}`} />
                    <div
                      className={`absolute top-0 left-0 right-0 h-12 bg-gradient-to-b ${accent.tint} to-transparent pointer-events-none opacity-50`}
                    />

                    <div className="relative p-4 cursor-pointer" onClick={() => setDetailOrder(o)}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`${STATUS_STYLES[o.status] || "bg-stone-100 text-stone-700"} text-[10px] font-semibold uppercase tracking-widest`}>
                              {o.status}
                            </Badge>
                            {o.origin === "ia" && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                <Sparkle size={10} weight="fill" className="text-purple-600" /> Pedido via IA
                              </span>
                            )}
                            {o.pix_receipt_verified && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                <CheckCircle size={10} weight="fill" className="text-emerald-600" /> Pix Verificado
                              </span>
                            )}
                            <span className="text-xs text-stone-400 tabular-nums">
                              {new Date(o.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <h3 className="font-display font-semibold text-stone-900 text-lg mt-1 truncate">
                            {o.customer_name}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              {o.delivery_type === "Entrega" ? <MapPin size={11} /> : <House size={11} />}
                              {o.delivery_type}
                            </span>
                            {o.customer_phone && (
                              <span className="inline-flex items-center gap-1"><Phone size={11} /> {o.customer_phone}</span>
                            )}
                            {o.delivery_type === "Entrega" && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${
                                  assignedCourier
                                    ? "bg-amber-50 text-amber-700 font-medium border border-amber-200"
                                    : "bg-stone-100 text-stone-500"
                                }`}
                              >
                                <Moped size={13} weight="duotone" />
                                {assignedCourier ? assignedCourier.name : "Sem entregador"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-2xl font-semibold text-stone-900 tabular-nums leading-none">
                            {BRL.format(o.total)}
                          </div>
                          <div className="mt-2 flex justify-end">
                            <PaymentBadge method={o.payment_method} size="sm" />
                          </div>
                        </div>
                      </div>

                      {o.address && o.delivery_type === "Entrega" && (
                        <div className="text-xs text-stone-500 mb-2 truncate inline-flex items-center gap-1">
                          <MapPin size={11} className="shrink-0" /> {o.address}
                        </div>
                      )}

                      {/* Items */}
                      <ul className="space-y-1 text-sm border-t border-stone-100 pt-2">
                        {o.items.map((it, idx) => {
                          const addTotal = (it.additionals || []).reduce((a, x) => a + x.price, 0);
                          return (
                            <li key={idx} className="flex items-baseline justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-stone-500 mr-1 tabular-nums">{it.quantity}×</span>
                                <span className="text-stone-800">{it.name}</span>
                                {it.additionals?.length > 0 && (
                                  <span className="text-xs text-[#6B8E7B] ml-1">
                                    + {it.additionals.map((a) => a.name).join(", ")}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-stone-500 tabular-nums shrink-0">
                                {BRL.format((it.price + addTotal) * it.quantity)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {o.notes && (
                        <div className="mt-2 text-xs text-[#D99A45] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#FDF6EA]">
                          <Note size={11} weight="duotone" /> {o.notes}
                        </div>
                      )}

                      {(o.delivery_fee > 0 || o.surcharge > 0 || o.discount > 0) && (
                        <div className="mt-2 flex gap-3 text-[11px] text-stone-500 flex-wrap">
                          {o.delivery_fee > 0 && <span>Taxa {BRL.format(o.delivery_fee)}</span>}
                          {o.surcharge > 0 && <span className="text-[#D99A45]">Acréscimo +{BRL.format(o.surcharge)}</span>}
                          {o.discount > 0 && <span className="text-[#6B8E7B]">Desconto -{BRL.format(o.discount)}</span>}
                        </div>
                      )}
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center justify-between gap-1 px-4 py-2 border-t border-stone-100 bg-stone-50/60 flex-wrap">
                      <div>
                        {o.status === "Em Análise" && (
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); changeStatus(o, "Confirmado"); }}
                            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                          >
                            <CheckCircle size={14} className="mr-1" /> Confirmar Pedido
                          </Button>
                        )}
                        {o.status === "Confirmado" && (
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); changeStatus(o, "Preparando"); }}
                            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
                          >
                            👨‍🍳 Iniciar Preparo
                          </Button>
                        )}
                        {o.status === "Preparando" && (
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); changeStatus(o, "Pronto"); }}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          >
                            🍱 Marcar Pronto
                          </Button>
                        )}
                        {o.status === "Pronto" && (
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); changeStatus(o, "Em Rota"); }}
                            className="h-8 text-xs bg-[#C5533B] hover:bg-[#A6432E] text-white font-medium"
                          >
                            🛵 Despachar (Em Rota)
                          </Button>
                        )}
                        {o.status === "Em Rota" && (
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); changeStatus(o, "Entregue"); }}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          >
                            🎉 Marcar Entregue
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          data-testid={`edit-order-${o.order_id}`}
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); openEditOrder(o); }}
                          className="h-8 text-xs text-stone-600 hover:text-stone-900"
                        >
                          <PencilSimple size={13} className="mr-1" /> Editar
                        </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button data-testid={`order-menu-${o.order_id}`} size="sm" variant="ghost" className="h-8 text-xs text-stone-600 hover:text-stone-900">
                            <DotsThreeVertical size={14} weight="bold" className="mr-1" /> Mais
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-56">
                          <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
                          {STATUS.map((s) => (
                            <DropdownMenuItem
                              key={s}
                              data-testid={`status-${o.order_id}-${s}`}
                              onClick={() => changeStatus(o, s)}
                              disabled={o.status === s}
                            >
                              {s}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs">Pagamento</DropdownMenuLabel>
                          {PAYMENTS.map((p) => (
                            <DropdownMenuItem
                              key={p}
                              data-testid={`pay-${o.order_id}-${p}`}
                              onClick={() => changePayment(o, p)}
                              disabled={o.payment_method === p}
                            >
                              {p}
                            </DropdownMenuItem>
                          ))}
                          {o.delivery_type === "Entrega" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs">Despachar Entregador</DropdownMenuLabel>
                              {couriers.length === 0 ? (
                                <DropdownMenuItem disabled className="text-xs text-stone-400">
                                  Nenhum entregador cadastrado
                                </DropdownMenuItem>
                              ) : (
                                couriers.map((c) => (
                                  <DropdownMenuItem
                                    key={c.courier_id}
                                    onClick={() => assignCourier(o, c.courier_id)}
                                  >
                                    <Moped size={14} className="mr-2" />
                                    {c.name} {o.courier_id === c.courier_id ? "✓" : ""}
                                  </DropdownMenuItem>
                                ))
                              )}
                              {o.courier_id && (
                                <DropdownMenuItem onClick={() => assignCourier(o, null)} className="text-stone-500 text-xs">
                                  Remover entregador
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEditOrder(o)}>
                            <PencilSimple size={14} className="mr-2" /> Editar pedido
                          </DropdownMenuItem>
                          <DropdownMenuItem data-testid={`print-order-${o.order_id}`} onClick={() => { try { printReceipt(o); } catch (_) {} }}>
                            <Printer size={14} className="mr-2" /> Imprimir cupom
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => removeOrder(o)} className="text-[#B94B4B]">
                            <Trash size={14} className="mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      </>)}

      {/* Voice mode dialog */}
      <VoiceOrderDialog
        open={voiceDialog}
        onOpenChange={setVoiceDialog}
        onFilled={handleVoiceFilled}
      />

      {/* AI parse dialog */}
      <Dialog open={aiDialog} onOpenChange={setAiDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkle size={20} weight="fill" className="text-[#C5533B]" />
              Preencher pedido com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-stone-600">
              Cole a mensagem que o cliente enviou (WhatsApp, SMS, etc.) e a IA vai extrair automaticamente
              nome, telefone, endereço, itens e forma de pagamento.
            </p>
            <Textarea
              data-testid="ai-parse-textarea"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder={"Ex: Oi, boa noite! Aqui é o Carlos (11 99999-1234), pode mandar 2 marmita de frango e 1 refrigerante na Rua das Flores 123, ap 45? Pagamento no pix."}
              rows={7}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialog(false)}>Cancelar</Button>
            <Button
              data-testid="ai-parse-submit-btn"
              onClick={parseFromAi}
              disabled={aiLoading}
              className="bg-gradient-to-r from-[#C5533B] to-[#D99A45] hover:opacity-90 text-white"
            >
              <Sparkle size={14} weight="fill" className="mr-1.5" />
              {aiLoading ? "Analisando..." : "Preencher pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New / Edit order dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingOrder(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingOrder ? "Editar pedido" : "Novo pedido"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Customer block */}
            <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <UserCircle size={18} weight="duotone" className="text-[#C5533B]" />
                  Cliente
                  {selectedCustomerId && (
                    <span className="text-xs text-[#6B8E7B] font-normal flex items-center gap-1">
                      • cliente cadastrado
                    </span>
                  )}
                </div>
                {canSaveCustomer && (
                  <button
                    type="button"
                    onClick={saveCustomer}
                    disabled={savingCustomer}
                    data-testid="save-customer-btn"
                    className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FCEEE6] text-[#C5533B] hover:bg-[#C5533B] hover:text-white transition-colors font-medium disabled:opacity-50"
                  >
                    {selectedCustomerId ? <FloppyDisk size={13} /> : <UserCirclePlus size={13} />}
                    {savingCustomer ? "Salvando..." : selectedCustomerId ? "Atualizar cliente" : "Salvar cliente"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-stone-600">Nome do cliente</Label>
                  <CustomerAutocomplete
                    testId="order-customer-name"
                    value={form.customer_name}
                    customers={customers}
                    mode="name"
                    placeholder="João Silva"
                    onChange={(v) => { setForm({ ...form, customer_name: v }); setSelectedCustomerId(null); }}
                    onSelect={pickCustomer}
                  />
                </div>
                <div>
                  <Label className="text-xs text-stone-600 flex items-center gap-1">
                    Telefone <span className="text-stone-400 font-normal">(opcional no pedido)</span>
                  </Label>
                  <CustomerAutocomplete
                    testId="order-customer-phone"
                    value={form.customer_phone}
                    customers={customers}
                    mode="phone"
                    placeholder="(11) 9..."
                    onChange={(v) => { setForm({ ...form, customer_phone: v }); setSelectedCustomerId(null); }}
                    onSelect={pickCustomer}
                  />
                </div>
              </div>
              {form.customer_name.trim() && !form.customer_phone.trim() && (
                <p className="text-xs text-stone-500 -mt-1">
                  Para salvar este cliente para próximos pedidos, informe o telefone.
                </p>
              )}
            </div>

            {/* Delivery block */}
            <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <MapPin size={18} weight="duotone" className="text-[#C5533B]" />
                Entrega & Pagamento
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-stone-600">Tipo</Label>
                  <Select value={form.delivery_type} onValueChange={(v) => setForm({ ...form, delivery_type: v })}>
                    <SelectTrigger data-testid="order-delivery-type" className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Entrega">Entrega</SelectItem>
                      <SelectItem value="Retirada">Retirada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-stone-600 flex items-center gap-1">
                    Pagamento <span className="text-stone-400 font-normal">(pode definir depois)</span>
                  </Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger data-testid="order-payment-method" className="mt-1 bg-white h-11">
                      <SelectValue>
                        <span className="inline-flex items-center gap-2">
                          <PaymentIcon method={form.payment_method} size={18} />
                          {form.payment_method}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="inline-flex items-center gap-2">
                            <PaymentIcon method={p} size={18} />
                            {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.delivery_type === "Entrega" && (
                <>
                  <div>
                    <Label className="text-xs text-stone-600">Endereço</Label>
                    <Textarea data-testid="order-address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 bg-white" placeholder="Rua, número, complemento, bairro..." />
                  </div>
                  {zones.length > 0 && (
                    <div>
                      <Label className="text-xs text-stone-600">Zona de entrega <span className="text-stone-400 font-normal">(preenche a taxa)</span></Label>
                      <Select value={form.delivery_zone_id || "__none__"} onValueChange={handleZoneChange}>
                        <SelectTrigger data-testid="order-zone-select" className="mt-1 bg-white"><SelectValue placeholder="Selecione uma zona" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma (taxa manual)</SelectItem>
                          {zones.map((z) => (
                            <SelectItem key={z.zone_id} value={z.zone_id}>
                              {z.name} — {BRL.format(z.fee)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {couriers.length > 0 && (
                    <div>
                      <Label className="text-xs text-stone-600">Entregador Responsável (Escala)</Label>
                      <Select
                        value={form.courier_id || "__none__"}
                        onValueChange={(v) => setForm({ ...form, courier_id: v === "__none__" ? null : v })}
                      >
                        <SelectTrigger className="mt-1 bg-white">
                          <SelectValue placeholder="Selecione um entregador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum (despachar depois)</SelectItem>
                          {couriers.map((c) => (
                            <SelectItem key={c.courier_id} value={c.courier_id}>
                              {c.name} ({c.vehicle}) {c.active_today ? "· Hoje" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Items block */}
            <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <ShoppingBag size={18} weight="duotone" className="text-[#C5533B]" />
                Itens do pedido
              </div>
              <Select value="" onValueChange={handleProductSelect}>
                <SelectTrigger data-testid="order-add-item" className="bg-white">
                  <SelectValue placeholder={products.length ? "+ Adicionar produto..." : "Cadastre produtos primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.product_id} value={p.product_id}>
                      {p.name} — {BRL.format(p.price)}
                      {p.additionals?.length > 0 && (
                        <span className="text-xs text-stone-500 ml-1">• {p.additionals.length} adicionais</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {form.items.length > 0 && (
                <ul className="border border-stone-200 rounded-lg divide-y divide-stone-100 bg-white overflow-hidden">
                  {form.items.map((it, idx) => {
                    const addTotal = (it.additionals || []).reduce((a, x) => a + x.price, 0);
                    const lineTotal = (it.price + addTotal) * it.quantity;
                    return (
                      <li key={idx} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-stone-900 truncate">{it.name}</div>
                            <div className="text-xs text-stone-500">
                              {BRL.format(it.price)} cada{addTotal > 0 ? ` · +${BRL.format(addTotal)} adicionais` : ""}
                            </div>
                            {it.additionals?.length > 0 && (
                              <div className="text-xs text-[#6B8E7B] mt-1">
                                + {it.additionals.map((a) => a.name).join(", ")}
                              </div>
                            )}
                          </div>
                          <Input
                            data-testid={`item-qty-${idx}`}
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => updateQty(idx, e.target.value)}
                            className="w-16 h-9 text-center"
                          />
                          <div className="font-display font-semibold w-20 text-right tabular-nums">
                            {BRL.format(lineTotal)}
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} className="h-8 w-8 text-[#B94B4B]">
                            <Trash size={16} />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Adjustments + notes */}
            <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <Receipt size={18} weight="duotone" className="text-[#C5533B]" />
                Valores & observações
              </div>
              <div className={`grid gap-3 ${form.delivery_type === "Entrega" ? "grid-cols-3" : "grid-cols-2"}`}>
                {form.delivery_type === "Entrega" && (
                  <div>
                    <Label className="text-xs text-stone-600">Taxa entrega</Label>
                    <Input data-testid="order-delivery-fee" type="number" step="0.01" value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value, delivery_zone_id: null })} className="mt-1 bg-white" placeholder="R$ 0,00" />
                  </div>
                )}
                <div>
                  <Label className="text-xs text-stone-600 flex items-center gap-1">
                    <PlusCircle size={11} weight="duotone" className="text-[#D99A45]" />
                    Acréscimo
                  </Label>
                  <Input data-testid="order-surcharge" type="number" step="0.01" value={form.surcharge} onChange={(e) => setForm({ ...form, surcharge: e.target.value })} className="mt-1 bg-white" placeholder="R$ 0,00" />
                </div>
                <div>
                  <Label className="text-xs text-stone-600 flex items-center gap-1">
                    <MinusCircle size={11} weight="duotone" className="text-[#6B8E7B]" />
                    Desconto
                  </Label>
                  <Input data-testid="order-discount" type="number" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="mt-1 bg-white" placeholder="R$ 0,00" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-stone-600">Observações</Label>
                <Textarea data-testid="order-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 bg-white" placeholder="Sem cebola, ponto da carne, etc." />
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#FCEEE6] to-[#FDF6EA] border border-[#C5533B]/20 rounded-xl p-4 flex items-center justify-between">
              <span className="font-medium text-stone-700">Total do pedido</span>
              <span data-testid="order-total" className="font-display text-3xl font-semibold text-[#C5533B] tabular-nums">{BRL.format(total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button data-testid="save-order-btn" onClick={save} disabled={saving} className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
              {saving ? "Salvando..." : (editingOrder ? "Atualizar pedido" : "Criar pedido")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item additionals dialog */}
      <Dialog open={!!itemDialog} onOpenChange={(o) => !o && (setItemDialog(null), setItemDraft(null))}>
        <DialogContent className="sm:max-w-md">
          {itemDraft && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{itemDraft.name}</DialogTitle>
                <p className="text-sm text-stone-500">Escolha os adicionais</p>
              </DialogHeader>
              <div className="space-y-2 mt-2 max-h-72 overflow-y-auto">
                {itemDraft._available.map((a, idx) => {
                  const checked = itemDraft.additionals.some((x) => x.name === a.name);
                  return (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors"
                      data-testid={`additional-option-${idx}`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={checked} onCheckedChange={(v) => toggleDraftAdditional(a, v)} />
                        <span className="font-medium text-stone-800">{a.name}</span>
                      </div>
                      <span className="text-sm text-[#C5533B] font-medium">+ {BRL.format(a.price)}</span>
                    </label>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setItemDialog(null); setItemDraft(null); }}>Cancelar</Button>
                <Button onClick={confirmItem} className="bg-[#C5533B] hover:bg-[#A6432E] text-white" data-testid="confirm-item-btn">
                  Adicionar ao pedido
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Order detail */}
      <Dialog open={!!detailOrder} onOpenChange={(o) => !o && setDetailOrder(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {detailOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-3 flex-wrap">
                  Pedido — {detailOrder.customer_name}
                  <Badge variant="outline" className={`${STATUS_STYLES[detailOrder.status]} text-xs`}>{detailOrder.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 -mt-1">
                <Button
                  data-testid="detail-edit-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => openEditOrder(detailOrder)}
                  className="text-xs"
                >
                  <PencilSimple size={14} className="mr-1" />
                  Editar pedido
                </Button>
              </div>
              <div className="space-y-3 mt-2 text-sm">
                <div className="text-stone-500 text-xs">
                  {new Date(detailOrder.created_at).toLocaleString("pt-BR")}
                </div>
                {detailOrder.customer_phone && (
                  <div className="flex items-center gap-2 text-stone-700"><Phone size={16} /> {detailOrder.customer_phone}</div>
                )}
                <div className="flex items-center gap-2 text-stone-700">
                  {detailOrder.delivery_type === "Entrega" ? <MapPin size={16} /> : <House size={16} />}
                  <span className="font-medium">{detailOrder.delivery_type}</span>
                  {detailOrder.address && <span className="text-stone-500">— {detailOrder.address}</span>}
                </div>
                <div className="border border-stone-200 rounded-lg divide-y divide-stone-100">
                  {detailOrder.items.map((i, idx) => {
                    const addTotal = (i.additionals || []).reduce((a, x) => a + x.price, 0);
                    return (
                      <div key={idx} className="p-3">
                        <div className="flex justify-between font-medium">
                          <span>{i.quantity}× {i.name}</span>
                          <span className="tabular-nums">{BRL.format((i.price + addTotal) * i.quantity)}</span>
                        </div>
                        {i.additionals?.length > 0 && (
                          <ul className="text-xs text-stone-500 mt-1 ml-3 list-disc list-inside">
                            {i.additionals.map((a, ai) => (
                              <li key={ai}>{a.name} — {BRL.format(a.price)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="text-sm space-y-1">
                  {detailOrder.delivery_fee > 0 && <div className="flex justify-between"><span>Taxa entrega</span><span>{BRL.format(detailOrder.delivery_fee)}</span></div>}
                  {detailOrder.discount > 0 && <div className="flex justify-between text-[#6B8E7B]"><span>Desconto</span><span>-{BRL.format(detailOrder.discount)}</span></div>}
                  <div className="flex justify-between font-display text-lg font-semibold text-stone-900 pt-2 border-t border-stone-200">
                    <span>Total</span>
                    <span className="text-[#C5533B]">{BRL.format(detailOrder.total)}</span>
                  </div>
                </div>

                {/* Payment method - changeable */}
                <div className="flex items-center justify-between border border-stone-200 rounded-lg p-3 bg-stone-50">
                  <div className="flex items-center gap-2">
                    <PaymentBadge method={detailOrder.payment_method} size="md" />
                  </div>
                  <Select value={detailOrder.payment_method} onValueChange={(v) => changePayment(detailOrder, v)}>
                    <SelectTrigger className="w-44 h-9 bg-white" data-testid="detail-payment-select">
                      <SelectValue>
                        <span className="inline-flex items-center gap-2">
                          <PaymentIcon method={detailOrder.payment_method} size={16} />
                          {detailOrder.payment_method}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="inline-flex items-center gap-2">
                            <PaymentIcon method={p} size={16} />
                            {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Courier selection for delivery orders */}
                {detailOrder.delivery_type === "Entrega" && (
                  <div className="flex items-center justify-between border border-stone-200 rounded-lg p-3 bg-stone-50">
                    <div className="flex items-center gap-2 text-stone-700 text-xs font-medium">
                      <Moped size={18} className="text-[#C5533B]" weight="duotone" />
                      <span>Entregador Despachado</span>
                    </div>
                    <Select
                      value={detailOrder.courier_id || "__none__"}
                      onValueChange={(v) => assignCourier(detailOrder, v === "__none__" ? null : v)}
                    >
                      <SelectTrigger className="w-48 h-9 bg-white text-xs">
                        <SelectValue placeholder="Selecione entregador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem entregador</SelectItem>
                        {couriers.map((c) => (
                          <SelectItem key={c.courier_id} value={c.courier_id}>
                            {c.name} ({c.vehicle})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {detailOrder.notes && (
                  <div className="bg-[#FDF6EA] border border-[#D99A45]/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#D99A45] mb-1 font-semibold"><Note size={14} /> Observações</div>
                    <p className="text-stone-700">{detailOrder.notes}</p>
                  </div>
                )}

                {/* Status quick change */}
                <div className="grid grid-cols-3 gap-1.5 pt-2">
                  {STATUS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeStatus(detailOrder, s)}
                      disabled={detailOrder.status === s}
                      data-testid={`detail-status-${s}`}
                      className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                        detailOrder.status === s
                          ? `${STATUS_STYLES[s]} font-medium cursor-default`
                          : "border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
