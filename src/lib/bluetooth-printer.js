const STORAGE_KEY = "marmita_bt_printer";

export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

export function getPairedPrinter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function pairPrinter() {
  if (isBluetoothSupported()) {
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
      });
      const info = {
        id: device.id,
        name: device.name || "Impressora Térmica Bluetooth",
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
      return info;
    } catch (err) {
      if (err.name === "NotFoundError" || err.message?.includes("cancelled")) {
        throw new Error("Pareamento cancelado pelo usuário.");
      }
      throw err;
    }
  }

  // Fallback simulation for unsupported browsers/environments
  const demoPrinter = {
    id: "bt-printer-demo",
    name: "Impressora Térmica 58mm (Simulação)",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoPrinter));
  return demoPrinter;
}

export function clearPairedPrinter() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}
