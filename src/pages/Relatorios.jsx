import { useEffect, useState, useMemo } from "react";
import api, { BRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Sun, FlagCheckered, MapPin, House, Sparkle } from "@phosphor-icons/react";
import { PaymentBadge } from "@/components/PaymentIcon";

const PIE_COLORS = ["#C5533B", "#6B8E7B", "#D99A45", "#4A6E8C", "#E28B61"];

const STATUS_STYLES = {
  Novo: "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/20",
  "Em Preparo": "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/20",
  Pronto: "bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/20",
  "Em Entrega": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/20",
  Concluído: "bg-stone-100 text-stone-700 border-stone-300",
  Cancelado: "bg-[#FCEDED] text-[#B94B4B] border-[#B94B4B]/20",
};

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Relatorios() {
  const [closes, setCloses] = useState([]);
  const [dayStatus, setDayStatus] = useState(null);
  const [periodKey, setPeriodKey] = useState("current"); // "current" or "close:<id>"
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/day/closes"), api.get("/day/status")])
      .then(([c, s]) => {
        setCloses(c.data || []);
        setDayStatus(s.data);
      })
      .catch((err) => {
        console.warn("Aviso ao carregar dados de relatórios:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Load data when period changes
  useEffect(() => {
    if (!dayStatus) return;
    setData(null);
    setInsights("");
    if (periodKey === "current") {
      const from = encodeURIComponent(dayStatus.day_opened_at || dayStatus.period_start);
      const to = encodeURIComponent(dayStatus.now);
      api.get(`/reports/summary?date_from=${from}&date_to=${to}`).then(({ data }) => setData({ ...data, kind: "current" }));
    } else if (periodKey.startsWith("close:")) {
      const id = periodKey.split(":")[1];
      api.get(`/day/closes/${id}`).then(({ data }) => setData({ ...data, kind: "close" }));
    }
  }, [periodKey, dayStatus]);

  const generateInsights = async () => {
    if (!data) return;
    setAiLoading(true);
    setInsights("");
    try {
      // Send a compact summary to the AI
      const payload = {
        revenue: data.period_revenue ?? data.revenue ?? 0,
        orders: data.completed_orders != null
          ? (data.completed_orders + (data.pending_orders || 0))
          : (data.valid_orders || 0),
        avg_ticket: data.avg_ticket || 0,
        cancelled: data.cancelled_orders || 0,
        by_payment: data.by_payment || [],
        by_type: data.by_type || [],
        top_products: (data.top_products || []).slice(0, 5),
      };
      const { data: r } = await api.post("/ai/report-insights", payload);
      setInsights(r.insights);
    } catch (e) {
      toast.error("Erro ao gerar análise");
    } finally {
      setAiLoading(false);
    }
  };

  const isCurrent = data?.kind === "current";
  const isClose = data?.kind === "close";

  // Normalized fields for both shapes
  const revenue = isCurrent ? data?.period_revenue : data?.revenue;
  const orderCount = isCurrent ? data?.completed_orders + (data?.pending_orders ?? 0) : data?.valid_orders;
  const ticket = data?.avg_ticket;
  const byDay = isCurrent ? data?.by_day : null;
  const byPayment = data?.by_payment || [];
  const byType = isClose ? data?.by_type || [] : [];
  const topProducts = data?.top_products || [];
  const orders = isClose ? data?.orders || [] : [];

  const periodLabel = useMemo(() => {
    if (periodKey === "current") {
      return dayStatus?.day_opened_at
        ? `Dia atual · aberto desde ${formatDateTime(dayStatus.day_opened_at)}`
        : "Dia atual";
    }
    const c = closes.find((x) => x.close_id === periodKey.split(":")[1]);
    return c ? `Dia salvo · ${formatDate(c.period_end)}` : "";
  }, [periodKey, dayStatus, closes]);

  return (
    <div className="space-y-8" data-testid="relatorios-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Análise</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1">Relatórios</h1>
          <p className="text-sm text-stone-500 mt-1">{periodLabel}</p>
        </div>
        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger data-testid="period-select" className="w-80 h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">
              <span className="flex items-center gap-2"><Sun size={14} weight="duotone" /> Dia atual (em aberto)</span>
            </SelectItem>
            {closes.length > 0 && (
              <div className="text-xs px-2 pt-2 pb-1 text-stone-500 font-semibold uppercase tracking-widest">
                Dias salvos
              </div>
            )}
            {closes.map((c) => (
              <SelectItem key={c.close_id} value={`close:${c.close_id}`}>
                <span className="flex items-center gap-2">
                  <FlagCheckered size={14} weight="duotone" /> {formatDate(c.period_end)} · {BRL.format(c.revenue || 0)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-stone-500 text-center py-12">Carregando...</div>
      ) : (
        <>
          {/* Headline KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-stone-200 shadow-sm">
              <CardContent className="p-5">
                <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Faturamento</div>
                <div className="font-display text-3xl font-semibold text-[#C5533B] mt-2 tabular-nums">
                  {data ? BRL.format(revenue || 0) : "—"}
                </div>
              </CardContent>
            </Card>
            <Card className="border-stone-200 shadow-sm">
              <CardContent className="p-5">
                <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Pedidos</div>
                <div className="font-display text-3xl font-semibold text-stone-900 mt-2">{orderCount ?? "—"}</div>
              </CardContent>
            </Card>
            <Card className="border-stone-200 shadow-sm">
              <CardContent className="p-5">
                <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Ticket médio</div>
                <div className="font-display text-3xl font-semibold text-stone-900 mt-2">
                  {data ? BRL.format(ticket || 0) : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          {data && (
            <Card className="border-[#C5533B]/30 shadow-sm bg-gradient-to-br from-[#FCEEE6] via-white to-[#FDF6EA]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-white text-[#C5533B] flex items-center justify-center shadow-sm">
                      <Sparkle size={18} weight="fill" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-semibold text-stone-900">Análise da IA</h2>
                      <p className="text-xs text-stone-500">Resumo inteligente do desempenho</p>
                    </div>
                  </div>
                  <Button
                    onClick={generateInsights}
                    disabled={aiLoading}
                    data-testid="ai-insights-btn"
                    className="bg-gradient-to-r from-[#C5533B] to-[#D99A45] hover:opacity-90 text-white shadow-sm"
                  >
                    <Sparkle size={14} weight="fill" className="mr-1.5" />
                    {aiLoading ? "Analisando..." : insights ? "Gerar novamente" : "Analisar com IA"}
                  </Button>
                </div>
                {insights && (
                  <div className="mt-3 whitespace-pre-line text-sm text-stone-800 leading-relaxed" data-testid="ai-insights-content">
                    {insights}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* By type (closes only) */}
          {isClose && byType.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {byType.map((t) => (
                <Card key={t.type} className="border-stone-200 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                      {t.type === "Entrega" ? <MapPin size={18} weight="duotone" /> : <House size={18} weight="duotone" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">{t.type}</div>
                      <div className="font-display text-xl font-semibold text-stone-900">{BRL.format(t.total)}</div>
                      <div className="text-xs text-stone-500">{t.count} pedido{t.count !== 1 ? "s" : ""}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* By day (current only - shows hourly distribution of day) */}
          {isCurrent && byDay && byDay.length > 0 && (
            <Card className="border-stone-200 shadow-sm">
              <CardContent className="p-5">
                <h2 className="font-display text-lg font-semibold text-stone-900 mb-1">Faturamento</h2>
                <p className="text-sm text-stone-500 mb-4">Distribuição diária</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                      <XAxis dataKey="day" tick={{ fill: "#57534E", fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fill: "#57534E", fontSize: 12 }} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip
                        formatter={(value) => BRL.format(value)}
                        contentStyle={{ background: "#fff", border: "1px solid #E7E5E4", borderRadius: 8 }}
                      />
                      <Bar dataKey="total" fill="#C5533B" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* By payment + top products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-stone-200 shadow-sm">
              <CardContent className="p-5">
                <h2 className="font-display text-lg font-semibold text-stone-900 mb-1">Por forma de pagamento</h2>
                <p className="text-sm text-stone-500 mb-4">Distribuição do faturamento</p>
                {byPayment.length === 0 ? (
                  <div className="text-stone-500 text-sm py-6 text-center">Sem dados.</div>
                ) : (
                  <>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={byPayment}
                            dataKey="total"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={(e) => e.method}
                          >
                            {byPayment.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => BRL.format(value)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="mt-3 divide-y divide-stone-100 border-t border-stone-200">
                      {byPayment.slice().sort((a, b) => b.total - a.total).map((p, i) => (
                        <li key={p.method} className="flex items-center justify-between py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <PaymentBadge method={p.method} size="sm" />
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-xs text-stone-500 tabular-nums">{p.count} pedido{p.count !== 1 ? "s" : ""}</span>
                            <span className="font-display font-semibold text-stone-900 tabular-nums w-24 text-right">{BRL.format(p.total)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-stone-200 shadow-sm">
              <CardContent className="p-5">
                <h2 className="font-display text-lg font-semibold text-stone-900 mb-1">Top produtos</h2>
                <p className="text-sm text-stone-500 mb-4">Mais vendidos</p>
                {topProducts.length === 0 ? (
                  <div className="text-stone-500 text-sm py-6 text-center">Sem dados.</div>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {topProducts.map((p, i) => (
                      <li key={i} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-display font-semibold text-stone-400 w-6 text-right">{i + 1}</span>
                          <span className="font-medium text-stone-900 truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-xs text-stone-500">{p.quantity} un.</span>
                          <span className="font-display font-semibold text-stone-900 tabular-nums">{BRL.format(p.total)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Orders list (closes only) */}
          {isClose && orders.length > 0 && (
            <Card className="border-stone-200 shadow-sm">
              <CardContent className="p-5">
                <h2 className="font-display text-lg font-semibold text-stone-900 mb-1">Pedidos do dia</h2>
                <p className="text-sm text-stone-500 mb-4">{orders.length} pedido{orders.length !== 1 ? "s" : ""} salvos</p>
                <ul className="space-y-2">
                  {orders.map((o) => (
                    <li key={o.order_id} className="border border-stone-200 rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className={`${STATUS_STYLES[o.status]} text-[10px]`}>{o.status}</Badge>
                          <span className="font-medium text-stone-900 text-sm truncate">{o.customer_name}</span>
                          <span className="text-xs text-stone-400">
                            {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <span className="font-display font-semibold text-stone-900 tabular-nums">{BRL.format(o.total)}</span>
                      </div>
                      <ul className="text-xs text-stone-600 space-y-0.5 mb-1.5">
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
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
