import { useMemo } from "react";
import { CookingPot, CheckCircle2, Clock } from "lucide-react";

export default function ProductionCounter({ orders = [] }) {
  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === "Preparando" ||
        o.status === "Confirmado" ||
        o.status === "Em Análise"
    );
  }, [orders]);

  const itemCounts = useMemo(() => {
    const counts = {};
    for (const order of activeOrders) {
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const name = item.product_name || item.name || "Marmita";
          const qty = Number(item.quantity) || 1;
          counts[name] = (counts[name] || 0) + qty;
        }
      }
    }
    return counts;
  }, [activeOrders]);

  const totalActive = Object.values(itemCounts).reduce((a, b) => a + b, 0);

  if (totalActive === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 my-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
          <CookingPot className="w-5 h-5 text-amber-700" />
          <span>Fila de Produção da Cozinha</span>
          <span className="bg-amber-200/80 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold">
            {totalActive} un
          </span>
        </div>
        <div className="text-xs text-amber-800">
          {activeOrders.length} {activeOrders.length === 1 ? "pedido ativo" : "pedidos ativos"}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(itemCounts).map(([name, qty]) => (
          <div
            key={name}
            className="flex items-center gap-1.5 bg-white border border-amber-200 text-stone-800 px-2.5 py-1 rounded-lg text-xs font-medium shadow-2xs"
          >
            <span>{name}:</span>
            <span className="font-bold text-amber-700">{qty}x</span>
          </div>
        ))}
      </div>
    </div>
  );
}
