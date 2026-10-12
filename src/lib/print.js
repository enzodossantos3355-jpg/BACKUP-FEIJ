export function getAutoPrint() {
  try {
    return localStorage.getItem("marmita_autoprint") === "true";
  } catch (e) {
    return false;
  }
}

export function setAutoPrint(enabled) {
  try {
    localStorage.setItem("marmita_autoprint", enabled ? "true" : "false");
  } catch (e) {}
}

export function printReceipt(order) {
  if (!order) return;
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return;

  const items = Array.isArray(order.items)
    ? order.items
        .map(
          (i) =>
            `<tr>
              <td style="text-align: left; padding: 4px 0;">${i.quantity}x ${i.product_name || i.name}</td>
              <td style="text-align: right; padding: 4px 0;">R$ ${(Number(i.unit_price || 0) * (i.quantity || 1)).toFixed(2)}</td>
            </tr>`
        )
        .join("")
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cupom - Pedido #${order.order_id?.slice(-4) || ""}</title>
        <style>
          body { font-family: monospace; font-size: 13px; margin: 15px; }
          .center { text-align: center; }
          hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 style="margin: 0;">MARMITA HUB</h2>
          <p style="margin: 4px 0;">Pedido #${order.order_id?.slice(-6) || "NOVO"}</p>
        </div>
        <hr />
        <p><strong>Cliente:</strong> ${order.customer_name || "Balcão"}<br />
        <strong>Telefone:</strong> ${order.customer_phone || "Não informado"}<br />
        <strong>Entrega:</strong> ${order.delivery_type || "Entrega"}<br />
        ${order.address ? `<strong>Endereço:</strong> ${order.address}<br />` : ""}
        <strong>Pagamento:</strong> ${order.payment_method || "Pendente"}</p>
        <hr />
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Item</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items}
          </tbody>
        </table>
        <hr />
        <p style="text-align: right; font-size: 15px;"><strong>TOTAL: R$ ${Number(order.total_amount || 0).toFixed(2)}</strong></p>
        ${order.notes ? `<p><em>Obs: ${order.notes}</em></p>` : ""}
        <hr />
        <div class="center">
          <p>Obrigado pela preferência!</p>
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
