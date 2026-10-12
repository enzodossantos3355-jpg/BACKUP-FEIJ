import { useEffect, useState } from "react";
import api, { BRL, formatApiErrorDetail } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Archive, Calendar, FlagCheckered, Receipt, Trash, Eye, ShoppingBag, MapPin, House, CurrencyCircleDollar,
} from "@phosphor-icons/react";
import { PaymentBadge } from "@/components/PaymentIcon";

const STATUS_STYLES = {
  Novo: "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/20",
  "Em Preparo": "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/20",
  Pronto: "bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/20",
  "Em Entrega": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/20",
  Concluído: "bg-stone-100 text-stone-700 border-stone-300",
  Cancelado: "bg-[#FCEDED] text-[#B94B4B] border-[#B94B4B]/20",
};

function formatRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const opts = { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" };
  const fmtFull = (d) => d.toLocaleString("pt-BR", opts);
  if (sameDay) {
    return `${s.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })} · ${s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} → ${e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `${fmtFull(s)} → ${fmtFull(e)}`;
}

export default function Armazenamento() {
  const [closes, setCloses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [reportOpen, setReportOpen] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/day/closes");
      setCloses(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openReport = async (c) => {
    setReportOpen(c);
    setReportData(null);
    setLoadingReport(true);
    try {
      const { data } = await api.get(`/day/closes/${c.close_id}`);
      setReportData(data);
    } catch (e) {
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoadingReport(false);
    }
  };

  const deleteClose = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/day/closes/${confirmDelete.close_id}`);
      toast.success("Dia excluído do armazenamento");
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao excluir");
    }
  };

  return (
    <div className="space-y-8" data-testid="armazenamento-page">
      <div>
        <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Histórico</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1">Armazenamento</h1>
        <p className="text-sm text-stone-500 mt-1">
          Cada dia finalizado fica salvo aqui com seu relatório e pedidos.
        </p>
      </div>

      {loading ? (
        <div className="text-stone-500 text-center py-12">Carregando...</div>
      ) : closes.length === 0 ? (
        <Card className="border-stone-200 shadow-sm">
          <CardContent className="p-16 text-center">
            <Archive size={36} weight="duotone" className="mx-auto text-stone-300 mb-3" />
            <h3 className="font-display text-lg font-medium text-stone-700">Nenhum dia salvo ainda</h3>
            <p className="text-sm text-stone-500 mt-1">
              Ao finalizar um dia no Dashboard, ele aparecerá aqui com todos os dados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {closes.map((c) => (
            <Card
              key={c.close_id}
              data-testid={`close-card-${c.close_id}`}
              className="border-stone-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="h-1 bg-gradient-to-r from-[#C5533B] via-[#D99A45] to-[#6B8E7B]" />
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-lg bg-[#FCEEE6] text-[#C5533B] flex items-center justify-center shrink-0">
                      <FlagCheckered size={20} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">
                        Dia finalizado
                      </div>
                      <div className="text-sm text-stone-700 font-medium truncate">
                        {new Date(c.period_end).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-stone-500 flex items-center gap-1.5">
                  <Calendar size={12} />
                  {formatRange(c.period_start, c.period_end)}
                </div>

                <div className="rounded-xl bg-gradient-to-br from-[#FCEEE6] to-[#FDF6EA] border border-[#C5533B]/20 p-4 text-center">
                  <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Faturamento</div>
                  <div className="font-display text-3xl font-semibold text-[#C5533B] tabular-nums mt-1">
                    {BRL.format(c.revenue || 0)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-stone-50 p-2">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">Pedidos</div>
                    <div className="font-display text-lg font-semibold text-stone-900">{c.valid_orders ?? c.total_orders ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">Ticket</div>
                    <div className="font-display text-lg font-semibold text-stone-900">{BRL.format(c.avg_ticket || 0)}</div>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-stone-500">Cancel.</div>
                    <div className="font-display text-lg font-semibold text-stone-900">{c.cancelled_orders ?? 0}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    data-testid={`view-report-${c.close_id}`}
                    onClick={() => openReport(c)}
                    className="flex-1 bg-[#C5533B] hover:bg-[#A6432E] text-white"
                  >
                    <Eye size={16} weight="duotone" className="mr-1.5" />
                    Ver relatório
                  </Button>
                  <Button
                    data-testid={`delete-close-${c.close_id}`}
                    variant="outline"
                    onClick={() => setConfirmDelete(c)}
                    className="border-[#B94B4B]/30 text-[#B94B4B] hover:bg-[#FCEDED]"
                    title="Excluir do armazenamento"
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Excluir dia do armazenamento?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 text-sm">
            <p className="text-stone-600">
              Isso vai excluir <strong className="text-stone-900">permanentemente</strong> o relatório e os pedidos deste dia. Esta ação não pode ser desfeita.
            </p>
            {confirmDelete && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm space-y-1">
                <div className="text-xs text-stone-500">{formatRange(confirmDelete.period_start, confirmDelete.period_end)}</div>
                <div className="flex justify-between"><span className="text-stone-600">Pedidos</span><span className="font-medium tabular-nums">{confirmDelete.valid_orders ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-stone-600">Faturamento</span><span className="font-display font-semibold text-[#C5533B] tabular-nums">{BRL.format(confirmDelete.revenue || 0)}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button onClick={deleteClose} className="bg-[#B94B4B] hover:bg-[#A23F3F] text-white" data-testid="confirm-delete-close">
              Sim, excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report dialog */}
      <Dialog open={!!reportOpen} onOpenChange={(o) => { if (!o) { setReportOpen(null); setReportData(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Receipt size={20} weight="duotone" className="text-[#C5533B]" />
              Relatório do dia
            </DialogTitle>
          </DialogHeader>
          {loadingReport ? (
            <div className="text-stone-500 text-center py-12">Carregando relatório...</div>
          ) : reportData ? (
            <div className="mt-2 space-y-4 text-sm">
              <div className="text-xs text-stone-500">
                {formatRange(reportData.period_start, reportData.period_end)}
              </div>

              <div className="bg-gradient-to-r from-[#FCEEE6] to-[#FDF6EA] border border-[#C5533B]/20 rounded-xl p-5 text-center">
                <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold">Faturamento</div>
                <div className="font-display text-4xl font-semibold text-[#C5533B] tabular-nums mt-1">
                  {BRL.format(reportData.revenue || 0)}
                </div>
                <div className="text-xs text-stone-600 mt-2">
                  {reportData.valid_orders} pedido{reportData.valid_orders !== 1 ? "s" : ""} · ticket médio {BRL.format(reportData.avg_ticket || 0)}
                </div>
              </div>

              {/* By type */}
              <div className="grid grid-cols-2 gap-3">
                {reportData.by_type?.map((t) => (
                  <div key={t.type} className="rounded-lg border border-stone-200 bg-white p-3">
                    <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold flex items-center gap-1">
                      {t.type === "Entrega" ? <MapPin size={11} /> : <House size={11} />} {t.type}
                    </div>
                    <div className="font-display text-xl font-semibold text-stone-900 mt-1">{BRL.format(t.total)}</div>
                    <div className="text-xs text-stone-500">{t.count} pedido{t.count !== 1 ? "s" : ""}</div>
                  </div>
                ))}
              </div>

              {/* By payment */}
              {reportData.by_payment?.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">Por forma de pagamento</div>
                  <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white">
                    {reportData.by_payment.map((p) => (
                      <li key={p.method} className="flex items-center justify-between px-3 py-2">
                        <PaymentBadge method={p.method} size="sm" />
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-stone-500">{p.count}×</span>
                          <span className="font-display font-semibold tabular-nums">{BRL.format(p.total)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top products */}
              {reportData.top_products?.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">Top produtos</div>
                  <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white">
                    {reportData.top_products.map((p, i) => (
                      <li key={i} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-display font-semibold text-stone-400 w-5 text-right">{i + 1}</span>
                          <span className="font-medium text-stone-800 truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-stone-500">{p.quantity} un.</span>
                          <span className="font-display font-semibold tabular-nums">{BRL.format(p.total)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Courier summaries breakdown */}
              {reportData.courier_summaries?.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2 flex items-center gap-1.5">
                    Faturamento de Taxas a Pagar por Entregador
                  </div>
                  <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white overflow-hidden">
                    {reportData.courier_summaries.map((c) => (
                      <li key={c.courier_id} className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50">
                        <div>
                          <div className="font-medium text-stone-900 text-sm">{c.name}</div>
                          <div className="text-xs text-stone-500">
                            {c.vehicle || "Moto"} · {c.deliveries_count || 0} entrega{(c.deliveries_count || 0) !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-stone-500">Taxas a pagar</div>
                          <div className="font-display font-semibold text-[#C5533B] text-base tabular-nums">
                            {BRL.format(c.total_fees || 0)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Orders list */}
              {reportData.orders?.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-2">Pedidos do dia</div>
                  <ul className="space-y-2">
                    {reportData.orders.map((o) => (
                      <li key={o.order_id} className="border border-stone-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${STATUS_STYLES[o.status]} text-[10px]`}>{o.status}</Badge>
                            <span className="font-medium text-stone-900 text-sm">{o.customer_name}</span>
                          </div>
                          <span className="font-display font-semibold text-stone-900 tabular-nums">{BRL.format(o.total)}</span>
                        </div>
                        <ul className="text-xs text-stone-600 space-y-0.5 mb-1">
                          {o.items.map((it, idx) => (
                            <li key={idx}>{it.quantity}× {it.name}</li>
                          ))}
                        </ul>
                        <div className="flex items-center gap-2 flex-wrap">
                          <PaymentBadge method={o.payment_method} size="xs" />
                          <span className="text-[10px] text-stone-500 inline-flex items-center gap-1">
                            {o.delivery_type === "Entrega" ? <MapPin size={9} /> : <House size={9} />}
                            {o.delivery_type}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setReportOpen(null)} variant="outline">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
