import { useEffect, useState } from "react";
import api, { BRL, formatApiErrorDetail } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Moped, Plus, Phone, Motorcycle, Bicycle, Car, CheckCircle, Package, ArrowRight,
  CurrencyCircleDollar, UserSwitch, CalendarCheck,
} from "@phosphor-icons/react";

export default function Entregadores() {
  const [couriers, setCouriers] = useState([]);
  const [dayStatus, setDayStatus] = useState(null);
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("Moto");
  const [saving, setSaving] = useState(false);

  // Dispatch dialog
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchOrder, setDispatchOrder] = useState(null);
  const [dispatchCourierId, setDispatchCourierId] = useState("");
  const [pendingDeliveryOrders, setPendingDeliveryOrders] = useState([]);

  const loadData = async () => {
    try {
      const [cRes, dRes, oRes] = await Promise.all([
        api.get("/couriers"),
        api.get("/day/status"),
        api.get("/orders"),
      ]);
      setCouriers(cRes.data || []);
      setDayStatus(dRes.data || null);

      // Pending delivery orders waiting to be dispatched or completed
      const orders = oRes.data || [];
      const pendingDelivery = orders.filter(
        (o) =>
          o.delivery_type === "Entrega" &&
          !o.archived &&
          o.status !== "Cancelado" &&
          o.status !== "Entregue" &&
          o.status !== "Concluído"
      );
      setPendingDeliveryOrders(pendingDelivery);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      await api.post("/couriers", { name, phone, vehicle });
      toast.success("Entregador cadastrado com sucesso!");
      setName("");
      setPhone("");
      setVehicle("Moto");
      setOpenNew(false);
      await loadData();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActiveToday = async (courier) => {
    try {
      const { data } = await api.patch(`/couriers/${courier.courier_id}/toggle-today`, {
        active: !courier.active_today,
      });
      toast.success(
        data.active_today
          ? `${courier.name} escalado para hoje!`
          : `${courier.name} removido da escala de hoje.`
      );
      await loadData();
    } catch {
      toast.error("Erro ao atualizar escala");
    }
  };

  const handleDispatch = async () => {
    if (!dispatchOrder || !dispatchCourierId) {
      toast.error("Selecione um entregador");
      return;
    }
    try {
      await api.patch(`/orders/${dispatchOrder.order_id}/assign-courier`, {
        courier_id: dispatchCourierId,
      });
      toast.success(`Pedido despachado!`);
      setDispatchOpen(false);
      setDispatchOrder(null);
      await loadData();
    } catch {
      toast.error("Erro ao despachar pedido");
    }
  };

  const activeCouriers = couriers.filter((c) => c.active_today);

  return (
    <div className="space-y-8" data-testid="entregadores-page">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Logística</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1 flex items-center gap-2">
            <Moped size={36} weight="duotone" className="text-[#C5533B]" />
            Entregadores & Escala do Dia
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Escalação diária, faturamento composto 100% pelas taxas de entrega e despacho em tempo real.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
              <Plus size={16} weight="bold" className="mr-1.5" />
              Novo Entregador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Cadastrar Entregador</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <Label>Nome Completo</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Oliveira"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Telefone WhatsApp</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98888-7777"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Veículo</Label>
                <Select value={vehicle} onValueChange={setVehicle}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Moto">Moto</SelectItem>
                    <SelectItem value="Bicicleta">Bicicleta</SelectItem>
                    <SelectItem value="Carro">Carro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#C5533B] text-white">
                  {saving ? "Salvando..." : "Salvar Entregador"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Day Summary Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-stone-200 shadow-sm bg-gradient-to-br from-white to-[#FCEEE6]/30">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">
                Entregadores Escalados Hoje
              </div>
              <div className="font-display text-3xl font-semibold text-stone-900 mt-1">
                {activeCouriers.length} / {couriers.length}
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[#FCEEE6] text-[#C5533B] flex items-center justify-center">
              <CalendarCheck size={24} weight="duotone" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-sm bg-gradient-to-br from-white to-[#EEF3F0]/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">
                Total de Taxas a Pagar Hoje
              </div>
              <div className="font-display text-3xl font-semibold text-[#6B8E7B] mt-1 tabular-nums">
                {BRL.format(
                  couriers.reduce((acc, c) => acc + (c.fees_earned_today || 0), 0)
                )}
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[#EEF3F0] text-[#6B8E7B] flex items-center justify-center">
              <CurrencyCircleDollar size={24} weight="duotone" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-sm bg-gradient-to-br from-white to-[#EFF4F8]/50">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">
                Entregas Concluídas Hoje
              </div>
              <div className="font-display text-3xl font-semibold text-[#4A6E8C] mt-1">
                {couriers.reduce((acc, c) => acc + (c.deliveries_today || 0), 0)}
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[#EFF4F8] text-[#4A6E8C] flex items-center justify-center">
              <CheckCircle size={24} weight="duotone" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Despacho de Pedidos Delivery Pendentes */}
      {pendingDeliveryOrders.length > 0 && (
        <Card className="border-[#C5533B]/20 bg-gradient-to-br from-[#FCEEE6]/20 to-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-900 flex items-center gap-2">
                  <Package size={20} weight="duotone" className="text-[#C5533B]" />
                  Despacho de Pedidos Delivery ({pendingDeliveryOrders.length} pendentes)
                </h2>
                <p className="text-xs text-stone-500">
                  Atribua um motorista escalado para cada pedido com taxa de entrega.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingDeliveryOrders.map((o) => {
                const assigned = couriers.find((c) => c.courier_id === o.courier_id);
                return (
                  <div
                    key={o.order_id}
                    className="p-3.5 bg-white border border-stone-200 rounded-xl flex flex-col justify-between shadow-xs hover:border-stone-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-stone-400">#{o.order_id.slice(-6)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {o.status}
                        </Badge>
                      </div>
                      <div className="font-medium text-stone-900 text-sm truncate">{o.customer_name}</div>
                      <div className="text-xs text-stone-500 truncate mt-0.5">{o.address || "Sem endereço"}</div>
                      <div className="text-xs font-semibold text-[#C5533B] mt-2">
                        Taxa de Entrega: {BRL.format(o.delivery_fee || 0)}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
                      <span className="text-xs text-stone-500 truncate">
                        {assigned ? (
                          <span className="text-stone-800 font-medium">🏍️ {assigned.name}</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Sem entregador</span>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDispatchOrder(o);
                          setDispatchCourierId(o.courier_id || "");
                          setDispatchOpen(true);
                        }}
                        className="text-xs h-7 px-2.5"
                      >
                        {assigned ? "Trocar" : "Despachar"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista Geral de Entregadores */}
      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-0">
          <div className="p-5 border-b border-stone-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-stone-900">
                Quadro de Entregadores Cadastrados
              </h2>
              <p className="text-xs text-stone-500">
                Ative ou desative quem está trabalhando no dia de hoje para compor a escala.
              </p>
            </div>
          </div>

          {couriers.length === 0 ? (
            <div className="p-12 text-center text-stone-400">
              <Moped size={48} className="mx-auto mb-2 opacity-40 text-[#C5533B]" />
              <div className="font-medium text-stone-700">Nenhum entregador cadastrado ainda.</div>
              <p className="text-xs text-stone-500 mt-1">
                Clique no botão acima para cadastrar seus motoboys e entregadores.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {couriers.map((c) => {
                const VehicleIcon =
                  c.vehicle === "Bicicleta" ? Bicycle : c.vehicle === "Carro" ? Car : Motorcycle;
                return (
                  <div
                    key={c.courier_id}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap hover:bg-stone-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                        <VehicleIcon size={22} weight="duotone" />
                      </div>
                      <div>
                        <div className="font-medium text-stone-900 flex items-center gap-2">
                          {c.name}
                          <Badge variant="outline" className="text-[10px] uppercase font-normal">
                            {c.vehicle || "Moto"}
                          </Badge>
                        </div>
                        <div className="text-xs text-stone-500 flex items-center gap-3 mt-0.5">
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} /> {c.phone}
                            </span>
                          )}
                          <span>·</span>
                          <span>Cadastrado desde {new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats today + toggle */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-stone-500">Entregas Hoje</div>
                        <div className="font-display font-semibold text-stone-900">
                          {c.deliveries_today || 0}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-stone-500">Taxas a Receber</div>
                        <div className="font-display font-semibold text-[#6B8E7B] tabular-nums">
                          {BRL.format(c.fees_earned_today || 0)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-3 border-l border-stone-200">
                        <span className="text-xs font-medium text-stone-600">
                          {c.active_today ? "Escalado" : "Folga"}
                        </span>
                        <Switch
                          checked={c.active_today}
                          onCheckedChange={() => toggleActiveToday(c)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Despachar Pedido */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Atribuir Entregador ao Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {dispatchOrder && (
              <div className="p-3 bg-stone-50 rounded-lg text-sm border border-stone-200 space-y-1">
                <div>
                  <span className="text-stone-500">Cliente: </span>
                  <span className="font-medium">{dispatchOrder.customer_name}</span>
                </div>
                <div>
                  <span className="text-stone-500">Endereço: </span>
                  <span>{dispatchOrder.address}</span>
                </div>
                <div>
                  <span className="text-stone-500">Taxa de Entrega: </span>
                  <span className="font-bold text-[#C5533B]">
                    {BRL.format(dispatchOrder.delivery_fee || 0)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label>Selecione um Entregador Escalado</Label>
              <Select value={dispatchCourierId} onValueChange={setDispatchCourierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o motorista..." />
                </SelectTrigger>
                <SelectContent>
                  {activeCouriers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum entregador escalado hoje!
                    </SelectItem>
                  ) : (
                    activeCouriers.map((c) => (
                      <SelectItem key={c.courier_id} value={c.courier_id}>
                        {c.name} ({c.vehicle}) — {c.deliveries_today || 0} entregas hoje
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDispatch} className="bg-[#C5533B] text-white">
              Confirmar Despacho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
