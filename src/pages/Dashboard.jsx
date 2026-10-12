import { useEffect, useState } from "react";
import api, { BRL, formatApiErrorDetail } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendUp, ShoppingBag, Clock, CheckCircle, ArrowRight, FlagCheckered, Calendar, Receipt, Confetti, Sun, MoonStars,
  Users, Moped, CurrencyCircleDollar,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const STATUS_STYLES = {
  "Em Análise": "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/20",
  Novo: "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/20",
  Preparando: "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/20",
  "Em Preparo": "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/20",
  Pronto: "bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/20",
  "Em Rota": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/20",
  "Em Entrega": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/20",
  Entregue: "bg-emerald-50 text-emerald-700 border-emerald-300",
  Concluído: "bg-stone-100 text-stone-700 border-stone-300",
  Cancelado: "bg-[#FCEDED] text-[#B94B4B] border-[#B94B4B]/20",
};

function Kpi({ label, value, icon: Icon, accent, testId }) {
  return (
    <Card data-testid={testId} className="border-stone-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">{label}</div>
            <div className="font-display text-3xl font-semibold text-stone-900 mt-2">{value}</div>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon size={22} weight="duotone" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [dayStatus, setDayStatus] = useState(null);
  const [customersCount, setCustomersCount] = useState(0);

  // Open day flow
  const [openDayModal, setOpenDayModal] = useState(false);
  const [initialCash, setInitialCash] = useState("0");
  const [couriers, setCouriers] = useState([]);
  const [selectedCourierIds, setSelectedCourierIds] = useState([]);
  const [opening, setOpening] = useState(false);

  // Close day flow
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [report, setReport] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    try {
      const [s, o, d, c, cr] = await Promise.all([
        api.get("/reports/summary?days=7"),
        api.get("/orders"),
        api.get("/day/status"),
        api.get("/customers"),
        api.get("/couriers"),
      ]);
      setSummary(s.data);
      setRecent(o.data.slice(0, 6));
      setDayStatus(d.data);
      setCustomersCount(c.data?.length || 0);
      setCouriers(cr.data || []);
      setSelectedCourierIds((cr.data || []).filter((x) => x.active_today).map((x) => x.courier_id));
    } catch (err) {
      console.warn("Aviso ao carregar dados do dashboard:", err);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStartDayOpen = () => {
    setSelectedCourierIds(couriers.filter((x) => x.active_today).map((x) => x.courier_id));
    setOpenDayModal(true);
  };

  const submitOpenDay = async (e) => {
    e?.preventDefault();
    setOpening(true);
    try {
      await api.post("/day/open", {
        initial_cash: parseFloat(initialCash) || 0,
        active_courier_ids: selectedCourierIds,
      });
      toast.success("Expediente iniciado com sucesso!");
      setOpenDayModal(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao abrir dia");
    } finally {
      setOpening(false);
    }
  };

  const closeDay = async () => {
    setClosing(true);
    try {
      const { data } = await api.post("/day/close");
      setReport(data);
      setConfirmOpen(false);
      setReportOpen(true);
      toast.success("Dia finalizado e salvo no Armazenamento!");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao finalizar");
    } finally {
      setClosing(false);
    }
  };

  const toggleCourierSelect = (id) => {
    setSelectedCourierIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isDayClosed = dayStatus?.day_state === "closed";

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Visão geral</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1">Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDayClosed ? (
            <Button
              data-testid="dashboard-open-day-btn"
              onClick={handleStartDayOpen}
              disabled={opening}
              className="bg-[#6B8E7B] hover:bg-[#56735F] text-white shadow-sm"
            >
              <Sun size={16} weight="duotone" className="mr-1.5" />
              Iniciar dia
            </Button>
          ) : (
            <>
              <Button
                data-testid="dashboard-close-day-btn"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                className="border-stone-300 text-stone-700 hover:bg-stone-100"
              >
                <FlagCheckered size={16} weight="duotone" className="mr-1.5" />
                Finalizar dia
              </Button>
              <Button asChild className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
                <Link data-testid="dashboard-new-order-btn" to="/pedidos?new=1">Novo Pedido</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Day state banner */}
      {isDayClosed && (
        <div className="rounded-xl border border-stone-300 bg-gradient-to-br from-stone-100 to-white p-5 flex items-center justify-between flex-wrap gap-3 fade-in" data-testid="day-closed-banner">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center shrink-0">
              <MoonStars size={22} weight="duotone" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold text-stone-900">Expediente Fechado</div>
              <p className="text-sm text-stone-600">
                Os pedidos anteriores foram consolidados no Armazenamento. Inicie o expediente para abrir o caixa e escalar os entregadores.
              </p>
            </div>
          </div>
          <Button onClick={handleStartDayOpen} disabled={opening} className="bg-[#6B8E7B] hover:bg-[#56735F] text-white">
            <Sun size={16} weight="duotone" className="mr-1.5" />
            Iniciar dia
          </Button>
        </div>
      )}

      {dayStatus && !isDayClosed && (
        <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-[#F4F2EF] to-white p-4 flex items-center justify-between flex-wrap gap-3 fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#FCEEE6] text-[#C5533B] flex items-center justify-center shrink-0">
              <Sun size={18} weight="duotone" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Expediente em Andamento</div>
              <div className="text-sm text-stone-800 font-medium">
                Aberto desde {formatDateTime(dayStatus.day_opened_at)}
              </div>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-xs text-stone-500">Pedidos no período</div>
              <div className="font-display text-xl font-semibold text-stone-900" data-testid="day-total-orders">{dayStatus.total_orders}</div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Em aberto</div>
              <div className="font-display text-xl font-semibold text-[#D99A45]" data-testid="day-open-orders">{dayStatus.open_orders}</div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Faturamento</div>
              <div className="font-display text-xl font-semibold text-[#C5533B] tabular-nums" data-testid="day-revenue">
                {BRL.format(dayStatus.revenue || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 KPIs em tempo real solicitados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          testId="kpi-today-revenue"
          label="Faturamento do Dia"
          value={summary ? BRL.format(summary.today_revenue) : "—"}
          icon={TrendUp}
          accent="bg-[#FCEEE6] text-[#C5533B]"
        />
        <Kpi
          testId="kpi-today-orders"
          label="Pedidos Realizados"
          value={summary?.today_orders ?? "—"}
          icon={ShoppingBag}
          accent="bg-[#EFF4F8] text-[#4A6E8C]"
        />
        <Kpi
          testId="kpi-customers-count"
          label="Clientes Cadastrados"
          value={customersCount}
          icon={Users}
          accent="bg-[#EEF3F0] text-[#6B8E7B]"
        />
        <Kpi
          testId="kpi-pending"
          label="Pedidos Pendentes em Preparo"
          value={summary?.pending_orders ?? "—"}
          icon={Clock}
          accent="bg-[#FDF6EA] text-[#D99A45]"
        />
      </div>

      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-stone-200">
            <div>
              <h2 className="font-display text-lg font-semibold text-stone-900">Pedidos recentes</h2>
              <p className="text-sm text-stone-500">Últimos 6 pedidos registrados</p>
            </div>
            <Link data-testid="dashboard-see-all-orders" to="/pedidos" className="text-sm text-[#C5533B] hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-10 text-center text-stone-500">Nenhum pedido ainda. Crie o primeiro para ver aqui.</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recent.map((o) => (
                <li key={o.order_id} data-testid={`recent-order-${o.order_id}`} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-stone-50 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-stone-900 truncate">{o.customer_name}</div>
                    <div className="text-sm text-stone-500 truncate">
                      {o.items.length} {o.items.length === 1 ? "item" : "itens"} · {o.payment_method} · {o.delivery_type}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Badge variant="outline" className={`${STATUS_STYLES[o.status] || "bg-stone-100 text-stone-700"} text-xs`}>{o.status}</Badge>
                    <div className="font-display font-semibold text-stone-900 tabular-nums w-24 text-right">{BRL.format(o.total)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Iniciar Dia Modal */}
      <Dialog open={openDayModal} onOpenChange={setOpenDayModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sun size={20} weight="duotone" className="text-[#6B8E7B]" />
              Iniciar Expediente do Dia
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitOpenDay} className="space-y-4 mt-2">
            <div>
              <Label className="text-stone-900 font-medium">Saldo Inicial do Caixa (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                placeholder="0,00"
                className="mt-1"
                data-testid="initial-cash-input"
              />
              <p className="text-xs text-stone-500 mt-1">Valor em dinheiro presente no caixa para troco.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-stone-900 font-medium">Escala de Entregadores do Dia</Label>
                <span className="text-xs text-stone-500">{selectedCourierIds.length} selecionado(s)</span>
              </div>
              <p className="text-xs text-stone-500 mb-2">
                Defina os entregadores que irão trabalhar hoje. As contagens de entregas e taxas zeram para a nova sessão.
              </p>

              {couriers.length === 0 ? (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-500 text-center">
                  Nenhum entregador cadastrado. Você pode cadastrar em "Entregadores".
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 border border-stone-200 rounded-lg p-2 bg-stone-50">
                  {couriers.map((c) => {
                    const checked = selectedCourierIds.includes(c.courier_id);
                    return (
                      <div
                        key={c.courier_id}
                        onClick={() => toggleCourierSelect(c.courier_id)}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                          checked ? "bg-white border border-[#6B8E7B]/40 shadow-xs" : "hover:bg-white/60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox checked={checked} />
                          <div>
                            <div className="text-sm font-medium text-stone-900">{c.name}</div>
                            <div className="text-[11px] text-stone-500">{c.vehicle} · {c.phone}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className={checked ? "text-[#6B8E7B] border-[#6B8E7B]/30" : "text-stone-400"}>
                          {checked ? "Escalado" : "Folga"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenDayModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={opening} className="bg-[#6B8E7B] hover:bg-[#56735F] text-white">
                {opening ? "Iniciando..." : "Iniciar Expediente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm close day */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FlagCheckered size={20} weight="duotone" className="text-[#C5533B]" />
              Finalizar o dia?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-stone-600">
              Esta ação vai <strong className="text-stone-900">consolidar os dados do dia</strong>,
              calcular o faturamento de taxas a pagar por entregador e enviar todo o expediente para o <strong className="text-stone-900">Armazenamento</strong>.
            </p>
            {dayStatus && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-stone-500">Início do período</span><span className="font-medium tabular-nums">{formatDateTime(dayStatus.period_start)}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Pedidos no período</span><span className="font-medium tabular-nums">{dayStatus.total_orders}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Em aberto (serão concluídos)</span><span className="font-medium tabular-nums text-[#D99A45]">{dayStatus.open_orders}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Faturamento</span><span className="font-display font-semibold text-[#C5533B] tabular-nums">{BRL.format(dayStatus.revenue || 0)}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={closeDay} disabled={closing} className="bg-[#C5533B] hover:bg-[#A6432E] text-white" data-testid="confirm-close-day-btn">
              {closing ? "Finalizando..." : "Sim, finalizar dia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daily report */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="day-report-dialog">
          {report && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Confetti size={20} weight="duotone" className="text-[#C5533B]" />
                  Expediente Finalizado & Armazenado
                </DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-4 text-sm">
                <div className="text-xs text-stone-500">
                  {formatDateTime(report.period_start)} → {formatDateTime(report.period_end)}
                </div>

                {/* Headline */}
                <div className="bg-gradient-to-r from-[#FCEEE6] to-[#FDF6EA] border border-[#C5533B]/20 rounded-xl p-5 text-center">
                  <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold">Faturamento Total do Dia</div>
                  <div className="font-display text-4xl font-semibold text-[#C5533B] tabular-nums mt-1" data-testid="report-revenue">
                    {BRL.format(report.revenue)}
                  </div>
                  <div className="text-xs text-stone-600 mt-2">
                    {report.valid_orders} pedido{report.valid_orders !== 1 ? "s" : ""} entregue{report.valid_orders !== 1 ? "s" : ""} · ticket médio {BRL.format(report.avg_ticket)}
                  </div>
                </div>

                {/* Courier fee payout summary */}
                {report.courier_summaries?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">
                      Taxas a Pagar por Entregador
                    </div>
                    <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white overflow-hidden">
                      {report.courier_summaries.map((c) => (
                        <li key={c.courier_id} className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-stone-900">{c.name}</div>
                            <div className="text-xs text-stone-500">{c.deliveries_count} entrega(s) realizada(s)</div>
                          </div>
                          <div className="text-right font-display font-semibold text-[#C5533B] tabular-nums">
                            {BRL.format(c.total_fees || 0)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* By type */}
                <div className="grid grid-cols-2 gap-3">
                  {report.by_type?.map((t) => (
                    <div key={t.type} className="rounded-lg border border-stone-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold">{t.type}</div>
                      <div className="font-display text-xl font-semibold text-stone-900 mt-1">{BRL.format(t.total)}</div>
                      <div className="text-xs text-stone-500">{t.count} pedidos</div>
                    </div>
                  ))}
                </div>

                {/* By payment */}
                {report.by_payment?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">Por forma de pagamento</div>
                    <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white">
                      {report.by_payment.map((p) => (
                        <li key={p.method} className="flex items-center justify-between px-3 py-2">
                          <span className="font-medium text-stone-700">{p.method}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-stone-500">{p.count}×</span>
                            <span className="font-display font-semibold tabular-nums">{BRL.format(p.total)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setReportOpen(false)} className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
