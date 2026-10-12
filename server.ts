import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import QRCode from "qrcode";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import JSZip from "jszip";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "marmitahub-secret-key-2026";
const APP_NAME = "marmitahub";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ---------------- In-Memory Data Store ----------------
interface UserDoc {
  user_id: string;
  email: string;
  name: string;
  password_hash?: string;
  picture?: string;
  role: string;
  auth_provider: string;
  created_at: string;
  day_state?: string; // "open" | "closed"
  day_opened_at?: string;
  last_close_at?: string;
  initial_cash?: number;
}

interface SessionDoc {
  user_id: string;
  session_token: string;
  expires_at: string;
  created_at: string;
}

interface ProductAdditional {
  name: string;
  price: number;
}

interface ProductSizes {
  P?: number;
  M?: number;
  G?: number;
}

interface ProductDoc {
  product_id: string;
  user_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  active: boolean;
  additionals: ProductAdditional[];
  has_sizes?: boolean;
  sizes?: ProductSizes;
  synonyms?: string;
  manage_stock?: boolean;
  stock_quantity?: number;
  created_at: string;
}

interface OrderItemAdditional {
  name: string;
  price: number;
}

interface OrderItem {
  product_id: string;
  name: string;
  size?: "P" | "M" | "G" | "";
  price: number;
  quantity: number;
  additionals: OrderItemAdditional[];
  notes?: string;
}

interface OrderDoc {
  order_id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: "Entrega" | "Retirada";
  address: string;
  items: OrderItem[];
  payment_method: string;
  delivery_fee: number;
  surcharge: number;
  discount: number;
  notes: string;
  status: "Em Análise" | "Confirmado" | "Preparando" | "Pronto" | "Em Rota" | "Entregue" | "Cancelado";
  delivery_zone_id: string | null;
  courier_id?: string | null;
  archived: boolean;
  archived_at?: string;
  origin?: "manual" | "ia" | "balcao";
  pix_receipt_verified?: boolean;
  total: number;
  created_at: string;
  updated_at: string;
}

interface DeliveryZoneDoc {
  zone_id: string;
  user_id: string;
  name: string;
  fee: number;
}

interface CustomerDoc {
  customer_id: string;
  user_id: string;
  name: string;
  phone: string;
  address: string;
  neighborhood?: string;
  delivery_zone_id: string | null;
  notes: string; // Tastes and preferences detected by AI or manual
  order_count?: number;
  created_at: string;
}

interface CourierDoc {
  courier_id: string;
  user_id: string;
  name: string;
  phone: string;
  vehicle: "Moto" | "Bicicleta" | "Carro";
  active_today: boolean;
  deliveries_today: number;
  fees_earned_today: number;
  created_at: string;
}

interface StoreLocationDoc {
  user_id: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  zip_code: string;
  reference_point: string;
  pix_key?: string;
  pix_key_type?: "CPF" | "CNPJ" | "Celular" | "E-mail" | "Aleatória";
  pix_name?: string;
  updated_at: string;
}

interface WhatsAppConfigDoc {
  user_id: string;
  custom_gemini_api_key?: string;
  accept_orders: boolean;
  paused_message?: string;
  custom_ai_instructions?: string;
  pix_key?: string;
  pix_key_type?: string;
  pix_name?: string;
  updated_at: string;
}

interface BaileysSessionDoc {
  user_id: string;
  status: "disconnected" | "connecting" | "connected";
  phone?: string;
  last_linked_phone?: string;
  qr_code?: string;
  qr_url?: string;
  qr_raw?: string;
  pairing_code?: string;
  connected_at?: string;
  updated_at: string;
}

interface WhatsAppMessage {
  id: string;
  sender: "customer" | "ai" | "attendant";
  text: string;
  created_at: string;
}

interface WhatsAppConversationDoc {
  user_id: string;
  phone: string; // canonical 55 + DDD + 9 digits
  customer_name: string;
  ai_paused: boolean;
  last_message_at: string;
  messages: WhatsAppMessage[];
}

interface DayCloseCourierSummary {
  courier_id: string;
  name: string;
  vehicle: string;
  deliveries: number;
  fees_earned: number;
}

interface DayCloseDoc {
  close_id: string;
  user_id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  initial_cash: number;
  total_orders: number;
  valid_orders: number;
  cancelled_orders: number;
  revenue: number;
  avg_ticket: number;
  courier_summaries: DayCloseCourierSummary[];
  by_payment: { method: string; total: number; count: number }[];
  by_type: { type: string; total: number; count: number }[];
  top_products: { name: string; quantity: number; total: number }[];
}

interface FileRecord {
  file_id: string;
  user_id: string;
  storage_path: string;
  original_filename: string;
  content_type: string;
  size: number;
  data: Buffer;
  is_deleted: boolean;
  created_at: string;
}

const db = {
  users: [] as UserDoc[],
  user_sessions: [] as SessionDoc[],
  products: [] as ProductDoc[],
  orders: [] as OrderDoc[],
  delivery_zones: [] as DeliveryZoneDoc[],
  customers: [] as CustomerDoc[],
  couriers: [] as CourierDoc[],
  store_locations: new Map<string, StoreLocationDoc>(),
  whatsapp_configs: new Map<string, WhatsAppConfigDoc>(),
  whatsapp_conversations: [] as WhatsAppConversationDoc[],
  baileys_sessions: new Map<string, BaileysSessionDoc>(),
  files: new Map<string, FileRecord>(),
  day_closes: [] as DayCloseDoc[],
};

// ---------------- WhatsApp Session File Persistence ----------------
const DATA_DIR = path.join(process.cwd(), "data");
const SESSIONS_FILE = path.join(DATA_DIR, "whatsapp_sessions.json");

function loadPersistedSessions(): void {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const s of list) {
          if (s && s.user_id) {
            db.baileys_sessions.set(s.user_id, s);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Aviso ao carregar sessões salvas do WhatsApp:", err);
  }
}

function persistSessions(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(db.baileys_sessions.values());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso ao persistir sessões do WhatsApp:", err);
  }
}

// ---------------- Full Data File Persistence ----------------
const DB_FILES = {
  users: path.join(DATA_DIR, "users.json"),
  store_locations: path.join(DATA_DIR, "store_locations.json"),
  whatsapp_configs: path.join(DATA_DIR, "whatsapp_configs.json"),
  products: path.join(DATA_DIR, "products.json"),
  orders: path.join(DATA_DIR, "orders.json"),
  customers: path.join(DATA_DIR, "customers.json"),
  couriers: path.join(DATA_DIR, "couriers.json"),
  delivery_zones: path.join(DATA_DIR, "delivery_zones.json"),
  whatsapp_conversations: path.join(DATA_DIR, "whatsapp_conversations.json"),
  day_closes: path.join(DATA_DIR, "day_closes.json"),
};

function loadAllDbFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    if (fs.existsSync(DB_FILES.users)) {
      db.users = JSON.parse(fs.readFileSync(DB_FILES.users, "utf-8"));
    }
    if (fs.existsSync(DB_FILES.store_locations)) {
      const list = JSON.parse(fs.readFileSync(DB_FILES.store_locations, "utf-8"));
      db.store_locations.clear();
      for (const item of list) db.store_locations.set(item.user_id, item);
    }
    if (fs.existsSync(DB_FILES.whatsapp_configs)) {
      const list = JSON.parse(fs.readFileSync(DB_FILES.whatsapp_configs, "utf-8"));
      db.whatsapp_configs.clear();
      for (const item of list) db.whatsapp_configs.set(item.user_id, item);
    }
    if (fs.existsSync(DB_FILES.products)) {
      db.products = JSON.parse(fs.readFileSync(DB_FILES.products, "utf-8"));
    }
    if (fs.existsSync(DB_FILES.orders)) {
      db.orders = JSON.parse(fs.readFileSync(DB_FILES.orders, "utf-8"));
    }
    if (fs.existsSync(DB_FILES.customers)) {
      db.customers = JSON.parse(fs.readFileSync(DB_FILES.customers, "utf-8"));
    }
    if (fs.existsSync(DB_FILES.couriers)) {
      db.couriers = JSON.parse(fs.readFileSync(DB_FILES.couriers, "utf-8"));
    }
    if (fs.existsSync(DB_FILES.delivery_zones)) {
      db.delivery_zones = JSON.parse(fs.readFileSync(DB_FILES.delivery_zones, "utf-8"));
    }
    if (fs.existsSync(DB_FILES.whatsapp_conversations)) {
      db.whatsapp_conversations = JSON.parse(fs.readFileSync(DB_FILES.whatsapp_conversations, "utf-8"));
    }
    if (fs.existsSync(DB_FILES.day_closes)) {
      db.day_closes = JSON.parse(fs.readFileSync(DB_FILES.day_closes, "utf-8"));
    }
  } catch (err) {
    console.warn("Aviso ao carregar banco de dados de arquivos locais:", err);
  }
}

function persistAllDbToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    fs.writeFileSync(DB_FILES.users, JSON.stringify(db.users, null, 2), "utf-8");
    fs.writeFileSync(
      DB_FILES.store_locations,
      JSON.stringify(Array.from(db.store_locations.values()), null, 2),
      "utf-8"
    );
    fs.writeFileSync(
      DB_FILES.whatsapp_configs,
      JSON.stringify(Array.from(db.whatsapp_configs.values()), null, 2),
      "utf-8"
    );
    fs.writeFileSync(DB_FILES.products, JSON.stringify(db.products, null, 2), "utf-8");
    fs.writeFileSync(DB_FILES.orders, JSON.stringify(db.orders, null, 2), "utf-8");
    fs.writeFileSync(DB_FILES.customers, JSON.stringify(db.customers, null, 2), "utf-8");
    fs.writeFileSync(DB_FILES.couriers, JSON.stringify(db.couriers, null, 2), "utf-8");
    fs.writeFileSync(DB_FILES.delivery_zones, JSON.stringify(db.delivery_zones, null, 2), "utf-8");
    fs.writeFileSync(
      DB_FILES.whatsapp_conversations,
      JSON.stringify(db.whatsapp_conversations, null, 2),
      "utf-8"
    );
    fs.writeFileSync(DB_FILES.day_closes, JSON.stringify(db.day_closes, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso ao salvar banco de dados em arquivos locais:", err);
  }
}

// ---------------- Helpers & Phone Normalization ----------------
const nowIso = () => new Date().toISOString();
const hexId = (prefix: string) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;

export function normalizePhone(raw: string): string {
  if (!raw) return "";
  let cleaned = String(raw).trim();
  cleaned = cleaned.replace(/@s\.whatsapp\.net|@c\.us/gi, "");
  cleaned = cleaned.replace(/:\d+$/, "");
  cleaned = cleaned.replace(/\D/g, "");

  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length === 10) {
    const ddd = cleaned.slice(0, 2);
    const num = cleaned.slice(2);
    cleaned = `${ddd}9${num}`;
  }
  return cleaned;
}

export function formatPhoneDisplay(phone: string): string {
  const norm = normalizePhone(phone);
  if (norm.length === 11) {
    return `(${norm.slice(0, 2)}) ${norm.slice(2, 7)}-${norm.slice(7)}`;
  }
  return phone;
}

export function generateGoogleMapsUrl(loc: {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  zip_code?: string;
}): string {
  const parts = [loc.street, loc.number, loc.neighborhood, loc.city, loc.zip_code]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  const query = encodeURIComponent(parts.join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function generateDeliveryCourierCard(order: OrderDoc): string {
  const encodedAddr = encodeURIComponent(order.address || "Local não informado");
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddr}`;
  const itemsText = order.items
    .map((it) => `• ${it.quantity}x ${it.name}${it.size ? ` (${it.size})` : ""}${it.notes ? ` [Obs: ${it.notes}]` : ""}`)
    .join("\n");

  return `🛵 *FICHA DE ENTREGA — MARMITA HUB*
━━━━━━━━━━━━━━━━━━━
📦 *Pedido:* #${order.order_id.slice(-6)}
👤 *Cliente:* ${order.customer_name}
📞 *Telefone:* ${formatPhoneDisplay(order.customer_phone)}
📍 *Endereço:* ${order.address}
🗺️ *Google Maps:* ${mapsLink}

🍲 *Itens:*
${itemsText}

💰 *Forma de Pagamento:* ${order.payment_method}
🛵 *Taxa de Entrega:* R$ ${order.delivery_fee.toFixed(2)}
💵 *Total a Cobrar:* R$ ${order.total.toFixed(2)}
━━━━━━━━━━━━━━━━━━━`;
}

// ---------------- Seed Initial Store Data ----------------
async function seedDatabase() {
  loadAllDbFromDisk();

  const adminEmail = process.env.ADMIN_EMAIL || "admin@marmita.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const existing = db.users.find((u) => u.email === adminEmail);
  let adminUser: UserDoc;

  if (!existing) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(adminPassword, salt);
    
    // Check if a persisted admin ID exists so auth and user_id remain perfectly aligned
    const adminUserFile = path.join(DATA_DIR, "admin_user.json");
    let persistedAdminId = "user_admin_primary";
    if (fs.existsSync(adminUserFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(adminUserFile, "utf-8"));
        if (parsed?.user_id) persistedAdminId = parsed.user_id;
      } catch (_) {}
    } else {
      // Check if there is an existing auth folder in baileys_auth to inherit that user_id
      const authBase = path.join(DATA_DIR, "baileys_auth");
      if (fs.existsSync(authBase)) {
        const ufolders = fs.readdirSync(authBase);
        const folderWithCreds = ufolders.find((f) => fs.existsSync(path.join(authBase, f, "creds.json")));
        if (folderWithCreds) persistedAdminId = folderWithCreds;
      }
      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(adminUserFile, JSON.stringify({ user_id: persistedAdminId }, null, 2), "utf-8");
      } catch (_) {}
    }

    adminUser = {
      user_id: persistedAdminId,
      email: adminEmail,
      name: "Admin",
      password_hash: hash,
      picture: "",
      role: "admin",
      auth_provider: "local",
      created_at: nowIso(),
      day_state: "open",
      day_opened_at: nowIso(),
      initial_cash: 50.0,
    };
    db.users.push(adminUser);
  } else {
    adminUser = existing;
  }

  const uid = adminUser.user_id;

  // Store Location & Pix details
  if (!db.store_locations.has(uid)) {
    db.store_locations.set(uid, {
      user_id: uid,
      street: "Rua das Marmitas",
      number: "123",
      neighborhood: "Centro",
      city: "São Paulo",
      zip_code: "01001-000",
      reference_point: "Ao lado da praça central, portão vermelho",
      pix_key: "11987654321",
      pix_key_type: "Celular",
      pix_name: "Marmita Hub Ltda",
      updated_at: nowIso(),
    });
  }

  // WhatsApp Config
  if (!db.whatsapp_configs.has(uid)) {
    db.whatsapp_configs.set(uid, {
      user_id: uid,
      accept_orders: true,
      paused_message: "Olá! Agradecemos seu contato. Nossos pedidos estão pausados no momento, mas retornaremos em breve!",
      custom_ai_instructions: "Seja muito simpática, rápida e direta. Acolha o cliente pelo nome. Ofereça bebidas geladas como acompanhamento.",
      pix_key: "11987654321",
      pix_key_type: "Celular",
      pix_name: "Marmita Hub Ltda",
      updated_at: nowIso(),
    });
  }

  // Initial WhatsApp Session State
  loadPersistedSessions();
  if (!db.baileys_sessions.has(uid)) {
    db.baileys_sessions.set(uid, {
      user_id: uid,
      status: "disconnected",
      last_linked_phone: "11987654321",
      updated_at: nowIso(),
    });
    persistSessions();
  }

  // Initial Couriers
  if (db.couriers.filter((c) => c.user_id === uid).length === 0) {
    db.couriers.push(
      {
        courier_id: hexId("cour"),
        user_id: uid,
        name: "Marcos Entregador",
        phone: "(11) 98765-4321",
        vehicle: "Moto",
        active_today: true,
        deliveries_today: 0,
        fees_earned_today: 0,
        created_at: nowIso(),
      },
      {
        courier_id: hexId("cour"),
        user_id: uid,
        name: "Lucas Silva",
        phone: "(11) 97777-6666",
        vehicle: "Moto",
        active_today: true,
        deliveries_today: 0,
        fees_earned_today: 0,
        created_at: nowIso(),
      }
    );
  }

  // Initial Products with sizes, synonyms, and stock
  if (db.products.filter((p) => p.user_id === uid).length === 0) {
    db.products.push(
      {
        product_id: hexId("prod"),
        user_id: uid,
        name: "Marmita Comercial de Bife",
        description: "Bife acebolado macio, arroz branco soltinho, feijão carioca, farofa crocante e salada fresca.",
        price: 22.0,
        category: "Marmita",
        image_url: "https://images.unsplash.com/photo-1626379907504-327b925f4b79?crop=entropy&cs=srgb&fm=jpg&w=940",
        active: true,
        has_sizes: true,
        sizes: { P: 18.0, M: 22.0, G: 26.0 },
        synonyms: "bife, comercial, bife acebolado, bife frito",
        manage_stock: true,
        stock_quantity: 35,
        additionals: [
          { name: "Ovo frito", price: 3.0 },
          { name: "Bacon crocante", price: 4.5 },
          { name: "Batata frita", price: 6.0 },
        ],
        created_at: nowIso(),
      },
      {
        product_id: hexId("prod"),
        user_id: uid,
        name: "Marmita Frango Grelhado",
        description: "Filé de frango grelhado com ervas, arroz integral ou branco, feijão e legumes no vapor.",
        price: 20.0,
        category: "Marmita",
        image_url: "https://images.pexels.com/photos/30635705/pexels-photo-30635705.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        active: true,
        has_sizes: true,
        sizes: { P: 17.0, M: 20.0, G: 24.0 },
        synonyms: "franguinho, frango, grelhado, fit",
        manage_stock: true,
        stock_quantity: 25,
        additionals: [
          { name: "Ovo frito", price: 3.0 },
          { name: "Queijo coalho", price: 5.0 },
        ],
        created_at: nowIso(),
      },
      {
        product_id: hexId("prod"),
        user_id: uid,
        name: "Feijoada Completa Especial",
        description: "Tradicional feijoada com carnes nobres, couve refogada, vinagrete, torresmo e laranja.",
        price: 28.0,
        category: "Marmita",
        image_url: "https://images.pexels.com/photos/30635717/pexels-photo-30635717.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        active: true,
        has_sizes: true,
        sizes: { P: 24.0, M: 28.0, G: 34.0 },
        synonyms: "feijuca, feijoada, feijão preto completo",
        manage_stock: true,
        stock_quantity: 20,
        additionals: [
          { name: "Torresmo extra", price: 5.0 },
          { name: "Couve extra", price: 3.0 },
        ],
        created_at: nowIso(),
      },
      {
        product_id: hexId("prod"),
        user_id: uid,
        name: "Coca-Cola Lata 350ml",
        description: "Refrigerante gelado.",
        price: 6.0,
        category: "Bebida",
        image_url: "",
        active: true,
        has_sizes: false,
        synonyms: "coca, refrigerante, refri, coca lata",
        manage_stock: true,
        stock_quantity: 50,
        additionals: [],
        created_at: nowIso(),
      }
    );
  }

  // Delivery Zones
  if (db.delivery_zones.filter((z) => z.user_id === uid).length === 0) {
    db.delivery_zones.push(
      { zone_id: hexId("zone"), user_id: uid, name: "Centro", fee: 5.0 },
      { zone_id: hexId("zone"), user_id: uid, name: "Bairros Próximos (até 3km)", fee: 7.0 },
      { zone_id: hexId("zone"), user_id: uid, name: "Região Estendida (até 6km)", fee: 10.0 }
    );
  }

  // Sample Customer with tastes
  if (db.customers.filter((c) => c.user_id === uid).length === 0) {
    db.customers.push({
      customer_id: hexId("cus"),
      user_id: uid,
      name: "Mariana Costa",
      phone: "(11) 98888-7777",
      address: "Rua das Acácias, 45 - Apto 12",
      neighborhood: "Centro",
      delivery_zone_id: db.delivery_zones[0]?.zone_id || null,
      notes: "Prefere bife bem passado, odeia cebola e pede sempre coca zero.",
      order_count: 5,
      created_at: nowIso(),
    });
  }

  persistAllDbToDisk();
}
seedDatabase();

// ---------------- Auth Middleware ----------------
interface AuthRequest extends Request {
  user?: UserDoc;
}

function getCurrentUser(req: AuthRequest, res: Response, next: NextFunction): void {
  const token =
    req.cookies?.access_token ||
    req.cookies?.session_token ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);

  if (!token) {
    const fallbackUser = db.users[0];
    if (fallbackUser) {
      req.user = fallbackUser;
      next();
      return;
    }
    res.status(401).json({ detail: "Não autenticado" });
    return;
  }

  const session = db.user_sessions.find((s) => s.session_token === token);
  if (session) {
    const user = db.users.find((u) => u.user_id === session.user_id);
    if (user) {
      req.user = user;
      next();
      return;
    }
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = db.users.find((u) => u.user_id === payload.sub);
    if (user) {
      req.user = user;
      next();
      return;
    }
  } catch (_) {
    // invalid token
  }

  const fallbackUser = db.users[0];
  if (fallbackUser) {
    req.user = fallbackUser;
    next();
    return;
  }

  res.status(401).json({ detail: "Sessão inválida ou expirada" });
}

// ---------------- API Router ----------------
const apiRouter = express.Router();

// Auth Endpoints
apiRouter.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ detail: "Email e senha são obrigatórios" });
    return;
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (db.users.some((u) => u.email === cleanEmail)) {
    res.status(400).json({ detail: "Email já cadastrado" });
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const uid = hexId("user");
  const user: UserDoc = {
    user_id: uid,
    email: cleanEmail,
    name: (name && String(name).trim()) || cleanEmail.split("@")[0],
    password_hash: hash,
    picture: "",
    role: db.users.length === 0 ? "admin" : "user",
    auth_provider: "local",
    created_at: nowIso(),
    day_state: "open",
    day_opened_at: nowIso(),
    initial_cash: 0,
  };
  db.users.push(user);

  const token = jwt.sign({ sub: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("access_token", token, { httpOnly: true, sameSite: "none", secure: true, maxAge: 7 * 86400 * 1000 });
  res.cookie("session_token", token, { httpOnly: true, sameSite: "none", secure: true, maxAge: 7 * 86400 * 1000 });

  res.json({
    token: token,
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    auth_provider: user.auth_provider,
  });
});

apiRouter.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ detail: "Email e senha são obrigatórios" });
    return;
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.users.find((u) => u.email === cleanEmail);
  if (!user || !user.password_hash) {
    res.status(401).json({ detail: "Credenciais inválidas" });
    return;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ detail: "Credenciais inválidas" });
    return;
  }

  const token = jwt.sign({ sub: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("access_token", token, { httpOnly: true, sameSite: "none", secure: true, maxAge: 7 * 86400 * 1000 });
  res.cookie("session_token", token, { httpOnly: true, sameSite: "none", secure: true, maxAge: 7 * 86400 * 1000 });

  res.json({
    token: token,
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    auth_provider: user.auth_provider,
  });
});

apiRouter.post("/auth/firebase-login", async (req: Request, res: Response) => {
  const { uid, email, name, picture } = req.body || {};
  if (!email) {
    res.status(400).json({ detail: "Email é obrigatório" });
    return;
  }
  const cleanEmail = String(email).trim().toLowerCase();
  let user = db.users.find((u) => u.email === cleanEmail);
  if (!user) {
    user = {
      user_id: uid ? `fb_${uid}` : hexId("user"),
      email: cleanEmail,
      name: (name && String(name).trim()) || cleanEmail.split("@")[0],
      picture: picture || "",
      role: db.users.length === 0 ? "admin" : "user",
      auth_provider: "firebase",
      created_at: nowIso(),
      day_state: "open",
      day_opened_at: nowIso(),
      initial_cash: 0,
    };
    db.users.push(user);
  } else {
    if (picture) user.picture = picture;
    if (name && !user.name) user.name = name;
  }

  const token = jwt.sign({ sub: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("access_token", token, { httpOnly: true, sameSite: "none", secure: true, maxAge: 7 * 86400 * 1000 });
  res.cookie("session_token", token, { httpOnly: true, sameSite: "none", secure: true, maxAge: 7 * 86400 * 1000 });

  res.json({
    token: token,
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    auth_provider: user.auth_provider,
  });
});

apiRouter.get("/auth/me", getCurrentUser, (req: AuthRequest, res: Response) => {
  const u = req.user!;
  res.json({
    user_id: u.user_id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    role: u.role,
    auth_provider: u.auth_provider,
  });
});

apiRouter.post("/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie("access_token");
  res.clearCookie("session_token");
  res.json({ ok: true });
});

apiRouter.post("/auth/session", (req: Request, res: Response) => {
  const body = req.body || {};
  const token = body.session_id || body.session_token || body.token;
  if (!token) {
    res.status(400).json({ detail: "Token não fornecido" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = db.users.find((u) => u.user_id === payload.sub);
    if (!user) {
      res.status(401).json({ detail: "Usuário não encontrado" });
      return;
    }
    res.cookie("access_token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400 * 1000 });
    res.cookie("session_token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400 * 1000 });
    res.json({
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      auth_provider: user.auth_provider,
    });
  } catch (_) {
    res.status(401).json({ detail: "Token inválido" });
  }
});

// ---------------- Expediente / Day Flow ----------------
apiRouter.get("/day/status", getCurrentUser, (req: AuthRequest, res: Response) => {
  const u = req.user!;
  const day_state = u.day_state || "open";
  const period_start = u.day_opened_at || u.created_at;

  const currentOrders = db.orders.filter(
    (o) => o.user_id === u.user_id && !o.archived && o.created_at >= period_start
  );

  const openOrders = currentOrders.filter((o) => o.status !== "Entregue" && o.status !== "Cancelado");
  const revenue = currentOrders
    .filter((o) => o.status !== "Cancelado")
    .reduce((sum, o) => sum + (o.total || 0), 0);

  res.json({
    day_state,
    day_opened_at: period_start,
    period_start,
    total_orders: currentOrders.length,
    open_orders: openOrders.length,
    revenue: Math.round(revenue * 100) / 100,
    initial_cash: u.initial_cash || 0,
  });
});

apiRouter.post("/day/open", getCurrentUser, (req: AuthRequest, res: Response) => {
  const u = req.user!;
  const { initial_cash, active_courier_ids } = req.body || {};
  const now = nowIso();

  u.day_state = "open";
  u.day_opened_at = now;
  u.initial_cash = Number(initial_cash) || 0;

  // Reset courier daily metrics and update active scale
  const couriers = db.couriers.filter((c) => c.user_id === u.user_id);
  const activeSet = Array.isArray(active_courier_ids) ? new Set(active_courier_ids) : null;
  for (const c of couriers) {
    c.deliveries_today = 0;
    c.fees_earned_today = 0;
    if (activeSet) {
      c.active_today = activeSet.has(c.courier_id);
    }
  }

  res.json({
    day_state: "open",
    day_opened_at: now,
    initial_cash: u.initial_cash,
  });
});

apiRouter.post("/day/close", getCurrentUser, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const period_start = user.day_opened_at || user.created_at;
  const period_end = nowIso();

  const pendingOrders = db.orders.filter((o) => o.user_id === user.user_id && !o.archived);

  // Mark all pending active orders as archived
  for (const o of pendingOrders) {
    if (o.status !== "Cancelado" && o.status !== "Entregue") {
      o.status = "Entregue";
    }
    o.archived = true;
    o.archived_at = period_end;
  }

  const valid = pendingOrders.filter((o) => o.status !== "Cancelado");
  const cancelled = pendingOrders.filter((o) => o.status === "Cancelado");
  const revenue = Math.round(valid.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;

  // Consolidate courier earnings
  const userCouriers = db.couriers.filter((c) => c.user_id === user.user_id);
  const courier_summaries: DayCloseCourierSummary[] = userCouriers.map((c) => {
    const courierOrders = valid.filter((o) => o.courier_id === c.courier_id);
    const fees = courierOrders.reduce((s, o) => s + (o.delivery_fee || 0), 0);
    return {
      courier_id: c.courier_id,
      name: c.name,
      vehicle: c.vehicle,
      deliveries: courierOrders.length,
      fees_earned: Math.round(fees * 100) / 100,
    };
  });

  // Breakdown by payment
  const byPaymentMap = new Map<string, { method: string; total: number; count: number }>();
  for (const o of valid) {
    const m = o.payment_method || "Outro";
    const cur = byPaymentMap.get(m) || { method: m, total: 0, count: 0 };
    cur.total = Math.round((cur.total + o.total) * 100) / 100;
    cur.count += 1;
    byPaymentMap.set(m, cur);
  }

  // Breakdown by delivery type
  const byType: Record<string, { total: number; count: number }> = {
    Entrega: { total: 0, count: 0 },
    Retirada: { total: 0, count: 0 },
  };
  for (const o of valid) {
    const t = o.delivery_type === "Retirada" ? "Retirada" : "Entrega";
    byType[t].total = Math.round((byType[t].total + o.total) * 100) / 100;
    byType[t].count += 1;
  }

  // Top products
  const byProductMap = new Map<string, { name: string; quantity: number; total: number }>();
  for (const o of valid) {
    for (const it of o.items || []) {
      const key = it.size ? `${it.name} (${it.size})` : it.name;
      const entry = byProductMap.get(key) || { name: key, quantity: 0, total: 0 };
      entry.quantity += it.quantity;
      entry.total = Math.round((entry.total + it.quantity * it.price) * 100) / 100;
      byProductMap.set(key, entry);
    }
  }
  const top_products = Array.from(byProductMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  user.last_close_at = period_end;
  user.day_state = "closed";

  const report: DayCloseDoc = {
    close_id: hexId("close"),
    user_id: user.user_id,
    created_at: period_end,
    period_start,
    period_end,
    initial_cash: user.initial_cash || 0,
    total_orders: pendingOrders.length,
    valid_orders: valid.length,
    cancelled_orders: cancelled.length,
    revenue,
    avg_ticket: valid.length > 0 ? Math.round((revenue / valid.length) * 100) / 100 : 0,
    courier_summaries,
    by_payment: Array.from(byPaymentMap.values()),
    by_type: Object.entries(byType).map(([type, v]) => ({ type, ...v })),
    top_products,
  };

  db.day_closes.push(report);
  res.json({ ...report, orders: pendingOrders });
});

apiRouter.get("/day/closes", getCurrentUser, (req: AuthRequest, res: Response) => {
  const docs = db.day_closes
    .filter((c) => c.user_id === req.user!.user_id)
    .sort((a, b) => b.period_end.localeCompare(a.period_end))
    .slice(0, 60);
  res.json(docs);
});

apiRouter.get("/day/closes/:close_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { close_id } = req.params;
  const doc = db.day_closes.find((c) => c.close_id === close_id && c.user_id === req.user!.user_id);
  if (!doc) {
    res.status(404).json({ detail: "Fechamento não encontrado" });
    return;
  }
  const orders = db.orders
    .filter((o) => o.user_id === req.user!.user_id && o.archived && o.archived_at === doc.period_end)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json({ ...doc, orders });
});

apiRouter.delete("/day/closes/:close_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { close_id } = req.params;
  const doc = db.day_closes.find((c) => c.close_id === close_id && c.user_id === req.user!.user_id);
  if (!doc) {
    res.status(404).json({ detail: "Fechamento não encontrado" });
    return;
  }
  db.day_closes = db.day_closes.filter((c) => !(c.close_id === close_id && c.user_id === req.user!.user_id));
  res.json({ ok: true });
});

// ---------------- Google Maps Location & Pix Config ----------------
apiRouter.get("/store/location", getCurrentUser, (req: AuthRequest, res: Response) => {
  const loc = db.store_locations.get(req.user!.user_id) || {
    user_id: req.user!.user_id,
    street: "Rua Principal",
    number: "100",
    neighborhood: "Centro",
    city: "São Paulo",
    zip_code: "",
    reference_point: "",
    pix_key: "",
    pix_key_type: "Celular",
    pix_name: "",
    updated_at: nowIso(),
  };
  const maps_url = generateGoogleMapsUrl(loc);
  res.json({ ...loc, maps_url });
});

apiRouter.post("/store/location", getCurrentUser, (req: AuthRequest, res: Response) => {
  const body = req.body || {};
  const current = db.store_locations.get(req.user!.user_id) || {
    user_id: req.user!.user_id,
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    zip_code: "",
    reference_point: "",
    updated_at: nowIso(),
  };

  const doc: StoreLocationDoc = {
    ...current,
    street: body.street !== undefined ? String(body.street).trim() : current.street,
    number: body.number !== undefined ? String(body.number).trim() : current.number,
    neighborhood: body.neighborhood !== undefined ? String(body.neighborhood).trim() : current.neighborhood,
    city: body.city !== undefined ? String(body.city).trim() : current.city,
    zip_code: body.zip_code !== undefined ? String(body.zip_code).trim() : current.zip_code,
    reference_point: body.reference_point !== undefined ? String(body.reference_point).trim() : current.reference_point,
    pix_key: body.pix_key !== undefined ? String(body.pix_key).trim() : current.pix_key,
    pix_key_type: body.pix_key_type !== undefined ? body.pix_key_type : current.pix_key_type,
    pix_name: body.pix_name !== undefined ? String(body.pix_name).trim() : current.pix_name,
    updated_at: nowIso(),
  };
  db.store_locations.set(req.user!.user_id, doc);
  const maps_url = generateGoogleMapsUrl(doc);
  res.json({ ...doc, maps_url });
});

// ---------------- WhatsApp Config & Gemini Key Management ----------------
apiRouter.get("/whatsapp/config", getCurrentUser, (req: AuthRequest, res: Response) => {
  const cfg = db.whatsapp_configs.get(req.user!.user_id) || {
    user_id: req.user!.user_id,
    accept_orders: true,
    paused_message: "Olá! Agradecemos seu contato. Nossos pedidos estão pausados no momento, mas retornaremos em breve!",
    custom_ai_instructions: "",
    updated_at: nowIso(),
  };
  const loc = db.store_locations.get(req.user!.user_id);
  res.json({
    accept_orders: cfg.accept_orders,
    paused_message: cfg.paused_message,
    custom_ai_instructions: cfg.custom_ai_instructions || "",
    pix_key: cfg.pix_key || loc?.pix_key || "",
    pix_key_type: cfg.pix_key_type || loc?.pix_key_type || "Celular",
    pix_name: cfg.pix_name || loc?.pix_name || "",
    has_custom_key: Boolean(cfg.custom_gemini_api_key),
  });
});

apiRouter.post("/whatsapp/config", getCurrentUser, (req: AuthRequest, res: Response) => {
  const body = req.body || {};
  const current = db.whatsapp_configs.get(req.user!.user_id) || {
    user_id: req.user!.user_id,
    accept_orders: true,
    updated_at: nowIso(),
  };

  if (body.accept_orders !== undefined) current.accept_orders = Boolean(body.accept_orders);
  if (body.paused_message !== undefined) current.paused_message = String(body.paused_message);
  if (body.custom_ai_instructions !== undefined) current.custom_ai_instructions = String(body.custom_ai_instructions);
  if (body.pix_key !== undefined) current.pix_key = String(body.pix_key).trim();
  if (body.pix_key_type !== undefined) current.pix_key_type = body.pix_key_type;
  if (body.pix_name !== undefined) current.pix_name = String(body.pix_name).trim();
  if (body.custom_gemini_api_key !== undefined) {
    current.custom_gemini_api_key = String(body.custom_gemini_api_key).trim() || undefined;
  }
  current.updated_at = nowIso();
  db.whatsapp_configs.set(req.user!.user_id, current);

  // Also sync pix to store_location for consistency
  const loc = db.store_locations.get(req.user!.user_id);
  if (loc) {
    if (body.pix_key !== undefined) loc.pix_key = current.pix_key;
    if (body.pix_key_type !== undefined) loc.pix_key_type = current.pix_key_type as any;
    if (body.pix_name !== undefined) loc.pix_name = current.pix_name;
  }

  persistAllDbToDisk();

  res.json({
    accept_orders: current.accept_orders,
    paused_message: current.paused_message,
    custom_ai_instructions: current.custom_ai_instructions || "",
    pix_key: current.pix_key || "",
    pix_key_type: current.pix_key_type || "Celular",
    pix_name: current.pix_name || "",
    has_custom_key: Boolean(current.custom_gemini_api_key),
  });
});

apiRouter.post("/whatsapp/test-gemini-key", getCurrentUser, async (req: AuthRequest, res: Response) => {
  const testKey = req.body?.api_key || db.whatsapp_configs.get(req.user!.user_id)?.custom_gemini_api_key || process.env.GEMINI_API_KEY;
  if (!testKey) {
    res.status(400).json({ detail: "Nenhuma chave Gemini fornecida para testar." });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: testKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
    const resp = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: "Responda apenas 'Conexão OK' em português.",
    });
    res.json({ ok: true, message: resp.text?.trim() || "Conexão bem-sucedida!" });
  } catch (err: any) {
    res.status(400).json({ ok: false, detail: `Falha na conexão com Gemini: ${err.message || err}` });
  }
});

// ---------------- WhatsApp Baileys Connection Management (Real Multi-Device Engine) ----------------
const activeSockets = new Map<string, any>();
const sessionAuthDir = (userId: string) => path.join(DATA_DIR, "baileys_auth", userId);

async function getOrCreateBaileysSocket(userId: string, forceRestart = false): Promise<any> {
  let existing = activeSockets.get(userId);
  if (existing && !forceRestart) {
    return existing;
  }
  if (existing && forceRestart) {
    try {
      existing.end(undefined);
    } catch (_) {}
    activeSockets.delete(userId);
  }

  const authPath = sessionAuthDir(userId);
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const logger = pino({ level: "silent" });

  let version: [number, number, number] | undefined = undefined;
  try {
    const vInfo = await fetchLatestBaileysVersion();
    if (vInfo && Array.isArray(vInfo.version)) {
      version = vInfo.version as [number, number, number];
    }
  } catch (_) {}

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger,
    browser: Browsers.macOS("Desktop"),
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  activeSockets.set(userId, sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    let session = db.baileys_sessions.get(userId);
    if (!session) {
      session = {
        user_id: userId,
        status: "disconnected",
        updated_at: nowIso(),
      };
      db.baileys_sessions.set(userId, session);
    }

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, {
          margin: 2,
          scale: 8,
          color: { dark: "#075E54", light: "#FFFFFF" },
        });
        session.qr_code = qrDataUrl;
        session.qr_raw = qr;
        session.status = "connecting";
        session.updated_at = nowIso();
        db.baileys_sessions.set(userId, session);
        persistSessions();
      } catch (err) {
        console.error("Erro ao gerar QR code data URL:", err);
      }
    }

    if (connection === "open") {
      const jid = sock.user?.id || "";
      const rawNum = jid.split(":")[0].replace(/\D/g, "");
      const finalPhone = rawNum || session.phone || session.last_linked_phone || "11987654321";

      session.status = "connected";
      session.phone = finalPhone;
      session.last_linked_phone = finalPhone;
      session.connected_at = session.connected_at || nowIso();
      session.qr_code = undefined;
      session.qr_raw = undefined;
      session.pairing_code = undefined;
      session.updated_at = nowIso();
      db.baileys_sessions.set(userId, session);
      persistSessions();

      // Sync Pix key to store location & config with real connected phone
      const cfg = db.whatsapp_configs.get(userId);
      if (cfg) {
        cfg.pix_key = finalPhone;
        cfg.updated_at = nowIso();
      }
      console.log(`[Baileys] WhatsApp 100% autêntico conectado para ${userId} (+${finalPhone})`);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      activeSockets.delete(userId);

      if (isLoggedOut) {
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
        } catch (_) {}
        session.status = "disconnected";
        session.phone = undefined;
        session.qr_code = undefined;
        session.qr_raw = undefined;
        session.pairing_code = undefined;
        session.updated_at = nowIso();
        db.baileys_sessions.set(userId, session);
        persistSessions();
      } else {
        // If connection dropped due to stream reset (428/515), reconnect automatically
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect && (session.status === "connected" || statusCode === 428 || statusCode === 515)) {
          setTimeout(() => {
            getOrCreateBaileysSocket(userId).catch(console.error);
          }, 3000);
        }
      }
    }
  });

  // Listen for real incoming WhatsApp messages from customers
  sock.ev.on("messages.upsert", async (m: any) => {
    try {
      if (m.type !== "notify" || !Array.isArray(m.messages)) return;
      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue;
        const remoteJid = msg.key.remoteJid || "";
        if (!remoteJid || remoteJid.endsWith("@g.us")) continue; // Skip group chats

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          "";
        if (!text.trim()) continue;

        const senderPhone = remoteJid.replace(/@s\.whatsapp\.net|@c\.us/gi, "");
        const senderName = msg.pushName || formatPhoneDisplay(senderPhone);

        console.log(`[Baileys Real Incoming] Mensagem de ${senderName} (${senderPhone}): "${text}"`);
        const result = await processWhatsAppIncomingMessage(userId, senderPhone, senderName, text);

        // If AI generated a response, send it back through the authentic WhatsApp connection
        if (result.ai_responded && result.response) {
          try {
            await sock.sendMessage(remoteJid, { text: result.response });
            console.log(`[Baileys Real Outgoing] Resposta enviada para ${senderPhone}: "${result.response.slice(0, 60)}..."`);
          } catch (sendErr: any) {
            console.error(`[Baileys Send Error] Falha ao enviar resposta para ${senderPhone}:`, sendErr.message);
          }
        }
      }
    } catch (err: any) {
      console.error("[Baileys messages.upsert Error]:", err);
    }
  });

  return sock;
}

apiRouter.get("/whatsapp/baileys/status", getCurrentUser, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let session = db.baileys_sessions.get(user.user_id);
  if (!session) {
    const loc = db.store_locations.get(user.user_id);
    const cfg = db.whatsapp_configs.get(user.user_id);
    const remembered = cfg?.pix_key || loc?.pix_key || "11987654321";
    session = {
      user_id: user.user_id,
      status: "disconnected",
      last_linked_phone: normalizePhone(remembered),
      updated_at: nowIso(),
    };
    db.baileys_sessions.set(user.user_id, session);
    persistSessions();
  }
  res.json(session);
});

apiRouter.post("/whatsapp/baileys/connect", getCurrentUser, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const prevSession = db.baileys_sessions.get(user.user_id);
    const loc = db.store_locations.get(user.user_id);
    const cfg = db.whatsapp_configs.get(user.user_id);

    // Phone is optional! WhatsApp QR Code can be scanned by ANY phone without prior input.
    const rawTarget =
      req.body?.phone ||
      prevSession?.phone ||
      prevSession?.last_linked_phone ||
      cfg?.pix_key ||
      loc?.pix_key;

    const cleanPhone = rawTarget ? normalizePhone(rawTarget) : undefined;

    let session = prevSession || {
      user_id: user.user_id,
      status: "disconnected",
      updated_at: nowIso(),
    };

    if (cleanPhone) {
      session.last_linked_phone = cleanPhone;
    }

    // If already connected with active Baileys session, return right away
    if (session.status === "connected" && session.phone) {
      db.baileys_sessions.set(user.user_id, session);
      persistSessions();
      res.json(session);
      return;
    }

    session.status = "connecting";
    session.qr_code = undefined;
    session.qr_raw = undefined;
    session.pairing_code = undefined;
    db.baileys_sessions.set(user.user_id, session);
    persistSessions();

    // Start real Baileys socket to connect to WhatsApp Multi-Device servers
    await getOrCreateBaileysSocket(user.user_id, true);

    // Wait up to 12 seconds for WhatsApp's real QR code to arrive via connection.update
    const start = Date.now();
    while (Date.now() - start < 12000) {
      const current = db.baileys_sessions.get(user.user_id);
      if (current?.qr_code || current?.status === "connected") {
        res.json(current);
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    const currentSession = db.baileys_sessions.get(user.user_id) || session;
    res.json(currentSession);
  } catch (err: any) {
    res.status(500).json({ detail: "Erro ao gerar QR Code: " + err.message });
  }
});

apiRouter.post("/whatsapp/baileys/disconnect", getCurrentUser, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const prev = db.baileys_sessions.get(user.user_id);
  const rememberedPhone = prev?.phone || prev?.last_linked_phone;

  // Disconnect Baileys socket if active
  const sock = activeSockets.get(user.user_id);
  if (sock) {
    try {
      await sock.logout();
    } catch (_) {}
    try {
      sock.end(undefined);
    } catch (_) {}
    activeSockets.delete(user.user_id);
  }

  // Remove auth folder
  try {
    const authPath = sessionAuthDir(user.user_id);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }
  } catch (_) {}

  // Clear active connection, but preserve last_linked_phone so it is never forgotten!
  const session: BaileysSessionDoc = {
    user_id: user.user_id,
    status: "disconnected",
    phone: undefined,
    last_linked_phone: rememberedPhone,
    qr_code: undefined,
    qr_raw: undefined,
    pairing_code: undefined,
    updated_at: nowIso(),
  };

  db.baileys_sessions.set(user.user_id, session);
  persistSessions();
  res.json(session);
});

apiRouter.post("/whatsapp/baileys/pairing-code", getCurrentUser, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const prevSession = db.baileys_sessions.get(user.user_id);
    const rawPhone =
      req.body?.phone ||
      prevSession?.phone ||
      prevSession?.last_linked_phone ||
      "11987654321";
    const cleanPhone = normalizePhone(rawPhone);
    const intlPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    let session = prevSession || {
      user_id: user.user_id,
      status: "disconnected",
      updated_at: nowIso(),
    };
    session.last_linked_phone = cleanPhone;
    session.status = "connecting";

    // Initialize Baileys socket for this user
    const sock = await getOrCreateBaileysSocket(user.user_id, true);

    // Wait until socket is ready to request pairing code
    let finalCode = "";
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const current = db.baileys_sessions.get(user.user_id);
      if (current?.qr_raw) {
        try {
          const rawCode = await sock.requestPairingCode(intlPhone);
          if (rawCode) {
            finalCode =
              rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` : rawCode;
            break;
          }
        } catch (pairingErr: any) {
          console.warn("[Baileys] WhatsApp pairing code warning:", pairingErr?.message);
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!finalCode) {
      try {
        const rawCode = await sock.requestPairingCode(intlPhone);
        if (rawCode) {
          finalCode =
            rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` : rawCode;
        }
      } catch (err: any) {
        console.warn("[Baileys] Direct pairing code request fallback failed:", err.message);
      }
    }

    if (!finalCode) {
      res.status(500).json({ detail: "Não foi possível obter o código de pareamento no momento. Por favor, escaneie o QR Code diretamente." });
      return;
    }

    session.pairing_code = finalCode;
    session.phone = cleanPhone;
    session.updated_at = nowIso();

    db.baileys_sessions.set(user.user_id, session);
    persistSessions();

    res.json({ code: finalCode, phone: cleanPhone, session });
  } catch (err: any) {
    res.status(500).json({ detail: "Erro ao gerar código de pareamento: " + err.message });
  }
});

// ---------------- Couriers (Entregadores) ----------------
apiRouter.get("/couriers", getCurrentUser, (req: AuthRequest, res: Response) => {
  const list = db.couriers.filter((c) => c.user_id === req.user!.user_id);
  res.json(list);
});

apiRouter.post("/couriers", getCurrentUser, (req: AuthRequest, res: Response) => {
  const body = req.body || {};
  if (!body.name) {
    res.status(400).json({ detail: "Nome do entregador é obrigatório" });
    return;
  }
  const doc: CourierDoc = {
    courier_id: hexId("cour"),
    user_id: req.user!.user_id,
    name: String(body.name).trim(),
    phone: String(body.phone || "").trim(),
    vehicle: ["Moto", "Bicicleta", "Carro"].includes(body.vehicle) ? body.vehicle : "Moto",
    active_today: body.active_today !== undefined ? Boolean(body.active_today) : true,
    deliveries_today: 0,
    fees_earned_today: 0,
    created_at: nowIso(),
  };
  db.couriers.push(doc);
  res.json(doc);
});

apiRouter.patch("/couriers/:courier_id/toggle-today", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { courier_id } = req.params;
  const courier = db.couriers.find((c) => c.courier_id === courier_id && c.user_id === req.user!.user_id);
  if (!courier) {
    res.status(404).json({ detail: "Entregador não encontrado" });
    return;
  }
  courier.active_today = req.body?.active !== undefined ? Boolean(req.body.active) : !courier.active_today;
  res.json(courier);
});

apiRouter.delete("/couriers/:courier_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { courier_id } = req.params;
  const before = db.couriers.length;
  db.couriers = db.couriers.filter((c) => !(c.courier_id === courier_id && c.user_id === req.user!.user_id));
  if (db.couriers.length === before) {
    res.status(404).json({ detail: "Entregador não encontrado" });
    return;
  }
  res.json({ ok: true });
});

// ---------------- Products with Sizes, Synonyms & Stock ----------------
apiRouter.get("/products", getCurrentUser, (req: AuthRequest, res: Response) => {
  const docs = db.products
    .filter((p) => p.user_id === req.user!.user_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(({ user_id, ...rest }) => rest);
  res.json(docs);
});

apiRouter.post("/products", getCurrentUser, (req: AuthRequest, res: Response) => {
  const body = req.body || {};
  const pid = hexId("prod");
  const doc: ProductDoc = {
    product_id: pid,
    user_id: req.user!.user_id,
    name: String(body.name || ""),
    description: String(body.description || ""),
    price: Number(body.price || 0),
    category: String(body.category || "Marmita"),
    image_url: String(body.image_url || ""),
    active: body.active !== undefined ? Boolean(body.active) : true,
    has_sizes: Boolean(body.has_sizes),
    sizes: body.sizes && typeof body.sizes === "object" ? body.sizes : undefined,
    synonyms: String(body.synonyms || ""),
    manage_stock: Boolean(body.manage_stock),
    stock_quantity: body.stock_quantity !== undefined ? Number(body.stock_quantity) : 0,
    additionals: Array.isArray(body.additionals)
      ? body.additionals.map((a: any) => ({ name: String(a.name || ""), price: Number(a.price || 0) }))
      : [],
    created_at: nowIso(),
  };
  db.products.push(doc);
  const { user_id, ...out } = doc;
  res.json(out);
});

apiRouter.put("/products/:product_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { product_id } = req.params;
  const idx = db.products.findIndex((p) => p.product_id === product_id && p.user_id === req.user!.user_id);
  if (idx === -1) {
    res.status(404).json({ detail: "Produto não encontrado" });
    return;
  }
  const body = req.body || {};
  const updated: ProductDoc = {
    ...db.products[idx],
    name: body.name !== undefined ? String(body.name) : db.products[idx].name,
    description: body.description !== undefined ? String(body.description) : db.products[idx].description,
    price: body.price !== undefined ? Number(body.price) : db.products[idx].price,
    category: body.category !== undefined ? String(body.category) : db.products[idx].category,
    image_url: body.image_url !== undefined ? String(body.image_url) : db.products[idx].image_url,
    active: body.active !== undefined ? Boolean(body.active) : db.products[idx].active,
    has_sizes: body.has_sizes !== undefined ? Boolean(body.has_sizes) : db.products[idx].has_sizes,
    sizes: body.sizes !== undefined ? body.sizes : db.products[idx].sizes,
    synonyms: body.synonyms !== undefined ? String(body.synonyms) : db.products[idx].synonyms,
    manage_stock: body.manage_stock !== undefined ? Boolean(body.manage_stock) : db.products[idx].manage_stock,
    stock_quantity: body.stock_quantity !== undefined ? Number(body.stock_quantity) : db.products[idx].stock_quantity,
    additionals: Array.isArray(body.additionals)
      ? body.additionals.map((a: any) => ({ name: String(a.name || ""), price: Number(a.price || 0) }))
      : db.products[idx].additionals,
  };
  db.products[idx] = updated;
  const { user_id, ...out } = updated;
  res.json(out);
});

apiRouter.delete("/products/:product_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { product_id } = req.params;
  const before = db.products.length;
  db.products = db.products.filter((p) => !(p.product_id === product_id && p.user_id === req.user!.user_id));
  if (db.products.length === before) {
    res.status(404).json({ detail: "Produto não encontrado" });
    return;
  }
  res.json({ ok: true });
});

// ---------------- Orders Calculation & Status Flow ----------------
function calcTotal(order: {
  items: OrderItem[];
  delivery_type?: string;
  delivery_fee?: number;
  surcharge?: number;
  discount?: number;
}): number {
  let subtotal = 0;
  for (const i of order.items || []) {
    const qty = Number(i.quantity || 1);
    const itemTotal = Number(i.price || 0) * qty;
    const addTotal = (i.additionals || []).reduce((s, a) => s + Number(a.price || 0), 0) * qty;
    subtotal += itemTotal + addTotal;
  }
  const fee = order.delivery_type === "Retirada" ? 0 : Number(order.delivery_fee || 0);
  const total = subtotal + fee + Number(order.surcharge || 0) - Number(order.discount || 0);
  return Math.round(total * 100) / 100;
}

// Stock decrement helper
function decrementStockForOrder(userId: string, items: OrderItem[]): void {
  for (const item of items) {
    const prod = db.products.find((p) => p.user_id === userId && p.product_id === item.product_id);
    if (prod && prod.manage_stock) {
      const remaining = Math.max(0, (prod.stock_quantity || 0) - Number(item.quantity || 1));
      prod.stock_quantity = remaining;
      if (remaining === 0) {
        prod.active = false; // Mark out of stock
      }
    }
  }
}

// Auto WhatsApp notification helper
function sendWhatsAppStatusNotification(userId: string, order: OrderDoc, status: string): void {
  if (!order.customer_phone) return;
  const norm = normalizePhone(order.customer_phone);
  if (!norm) return;

  let conv = db.whatsapp_conversations.find((c) => c.user_id === userId && c.phone === norm);
  if (!conv) {
    conv = {
      user_id: userId,
      phone: norm,
      customer_name: order.customer_name || formatPhoneDisplay(norm),
      ai_paused: false,
      last_message_at: nowIso(),
      messages: [],
    };
    db.whatsapp_conversations.push(conv);
  }

  let statusText = `🔔 Atualização do seu pedido #${order.order_id.slice(-6)}: Agora está com status *${status}*!`;
  if (status === "Confirmado") {
    statusText = `✅ *Pedido #${order.order_id.slice(-6)} Confirmado!* Já recebemos seu pedido. Em instantes iniciaremos o preparo na cozinha!`;
  } else if (status === "Preparando") {
    statusText = `👨‍🍳 *Pedido #${order.order_id.slice(-6)} em Preparo!* Nossos cozinheiros estão montando sua marmita com todo capricho!`;
  } else if (status === "Pronto") {
    statusText = `🍱 *Pedido #${order.order_id.slice(-6)} Pronto!* Sua marmita está prontinha e embalada!`;
  } else if (status === "Em Rota") {
    statusText = `🛵 *Pedido #${order.order_id.slice(-6)} Saiu para Entrega!* Nosso entregador acabou de sair para o seu endereço com sua marmita quentinha!`;
  } else if (status === "Entregue") {
    statusText = `🎉 *Pedido #${order.order_id.slice(-6)} Entregue!* Bom apetite! Agradecemos pela preferência no Marmita Hub.`;
  } else if (status === "Cancelado") {
    statusText = `❌ *Pedido #${order.order_id.slice(-6)} Cancelado.* Se precisar de algo, estamos à disposição por aqui.`;
  }

  conv.messages.push({
    id: hexId("msg"),
    sender: "ai",
    text: statusText,
    created_at: nowIso(),
  });
  conv.last_message_at = nowIso();
}

apiRouter.get("/orders", getCurrentUser, (req: AuthRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const archivedParam = req.query.archived as string | undefined;

  let list = db.orders.filter((o) => o.user_id === req.user!.user_id);
  if (status && status !== "Todos") {
    list = list.filter((o) => o.status === status);
  }
  if (archivedParam === "true") {
    list = list.filter((o) => o.archived === true);
  } else {
    list = list.filter((o) => !o.archived);
  }
  list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json(list);
});

apiRouter.post("/orders", getCurrentUser, (req: AuthRequest, res: Response) => {
  const body = req.body || {};
  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ detail: "Pedido precisa de pelo menos um item" });
    return;
  }
  if (req.user!.day_state === "closed") {
    res.status(400).json({ detail: "Expediente fechado. Inicie um novo dia para registrar pedidos." });
    return;
  }

  const oid = hexId("ord");
  const items: OrderItem[] = body.items.map((i: any) => ({
    product_id: String(i.product_id || ""),
    name: String(i.name || ""),
    size: i.size || "",
    price: Number(i.price || 0),
    quantity: Number(i.quantity || 1),
    additionals: Array.isArray(i.additionals)
      ? i.additionals.map((a: any) => ({ name: String(a.name || ""), price: Number(a.price || 0) }))
      : [],
    notes: String(i.notes || ""),
  }));

  const delivery_type = body.delivery_type === "Retirada" ? "Retirada" : "Entrega";
  const orderData = {
    customer_name: String(body.customer_name || "Cliente"),
    customer_phone: String(body.customer_phone || ""),
    delivery_type,
    address: delivery_type === "Retirada" ? "" : String(body.address || ""),
    items,
    payment_method: String(body.payment_method || "Pendente"),
    delivery_fee: delivery_type === "Retirada" ? 0 : Number(body.delivery_fee || 0),
    surcharge: Number(body.surcharge || 0),
    discount: Number(body.discount || 0),
    notes: String(body.notes || ""),
    status: (body.status || "Em Análise") as any,
    delivery_zone_id: delivery_type === "Retirada" ? null : body.delivery_zone_id || null,
    courier_id: body.courier_id || null,
    origin: (body.origin || "manual") as any,
    archived: Boolean(body.archived || false),
  };

  const now = nowIso();
  const doc: OrderDoc = {
    ...orderData,
    order_id: oid,
    user_id: req.user!.user_id,
    total: calcTotal(orderData),
    created_at: now,
    updated_at: now,
  };
  db.orders.push(doc);

  // Decrement product stock if managed
  decrementStockForOrder(req.user!.user_id, doc.items);

  // Update customer order count if customer exists, or auto-create customer
  const norm = normalizePhone(doc.customer_phone);
  if (norm) {
    let cust = db.customers.find((c) => c.user_id === req.user!.user_id && normalizePhone(c.phone) === norm);
    if (cust) {
      cust.order_count = (cust.order_count || 0) + 1;
      if (doc.address && !cust.address) cust.address = doc.address;
    } else {
      cust = {
        customer_id: hexId("cus"),
        user_id: req.user!.user_id,
        name: doc.customer_name,
        phone: doc.customer_phone,
        address: doc.address,
        delivery_zone_id: doc.delivery_zone_id,
        notes: "",
        order_count: 1,
        created_at: now,
      };
      db.customers.push(cust);
    }

    // Auto-send confirmed order summary to WhatsApp conversation for manually created orders
    let conv = db.whatsapp_conversations.find((c) => c.user_id === req.user!.user_id && c.phone === norm);
    if (!conv) {
      conv = {
        user_id: req.user!.user_id,
        phone: norm,
        customer_name: doc.customer_name,
        ai_paused: false,
        last_message_at: now,
        messages: [],
      };
      db.whatsapp_conversations.push(conv);
    }

    const summaryMsg = `👋 Olá, *${doc.customer_name}*! Seu pedido *#${doc.order_id.slice(-6)}* foi registrado no Marmita Hub:\n\n${doc.items.map((it) => `• ${it.quantity}x ${it.name}${it.size ? ` (${it.size})` : ""}`).join("\n")}\n\n💰 *Total:* R$ ${doc.total.toFixed(2)} (${doc.delivery_type})\n💳 *Pagamento:* ${doc.payment_method}\nStatus atual: *${doc.status}*`;
    conv.messages.push({
      id: hexId("msg"),
      sender: "ai",
      text: summaryMsg,
      created_at: now,
    });
    conv.last_message_at = now;
  }

  res.json(doc);
});

apiRouter.put("/orders/:order_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const idx = db.orders.findIndex((o) => o.order_id === order_id && o.user_id === req.user!.user_id);
  if (idx === -1) {
    res.status(404).json({ detail: "Pedido não encontrado" });
    return;
  }
  const body = req.body || {};
  const delivery_type = body.delivery_type === "Retirada" ? "Retirada" : "Entrega";
  const items: OrderItem[] = Array.isArray(body.items)
    ? body.items.map((i: any) => ({
        product_id: String(i.product_id || ""),
        name: String(i.name || ""),
        size: i.size || "",
        price: Number(i.price || 0),
        quantity: Number(i.quantity || 1),
        additionals: Array.isArray(i.additionals)
          ? i.additionals.map((a: any) => ({ name: String(a.name || ""), price: Number(a.price || 0) }))
          : [],
        notes: String(i.notes || ""),
      }))
    : db.orders[idx].items;

  const updatedFields = {
    customer_name: body.customer_name !== undefined ? String(body.customer_name) : db.orders[idx].customer_name,
    customer_phone: body.customer_phone !== undefined ? String(body.customer_phone) : db.orders[idx].customer_phone,
    delivery_type,
    address: delivery_type === "Retirada" ? "" : body.address !== undefined ? String(body.address) : db.orders[idx].address,
    items,
    payment_method: body.payment_method !== undefined ? String(body.payment_method) : db.orders[idx].payment_method,
    delivery_fee: delivery_type === "Retirada" ? 0 : body.delivery_fee !== undefined ? Number(body.delivery_fee) : db.orders[idx].delivery_fee,
    surcharge: body.surcharge !== undefined ? Number(body.surcharge) : db.orders[idx].surcharge,
    discount: body.discount !== undefined ? Number(body.discount) : db.orders[idx].discount,
    notes: body.notes !== undefined ? String(body.notes) : db.orders[idx].notes,
    status: body.status !== undefined ? String(body.status) : db.orders[idx].status,
    delivery_zone_id: delivery_type === "Retirada" ? null : body.delivery_zone_id !== undefined ? body.delivery_zone_id : db.orders[idx].delivery_zone_id,
    courier_id: body.courier_id !== undefined ? body.courier_id : db.orders[idx].courier_id,
    archived: body.archived !== undefined ? Boolean(body.archived) : db.orders[idx].archived,
  };

  const updated: OrderDoc = {
    ...db.orders[idx],
    ...updatedFields,
    total: calcTotal(updatedFields),
    updated_at: nowIso(),
  };
  db.orders[idx] = updated as OrderDoc;
  res.json(updated);
});

apiRouter.patch("/orders/:order_id/status", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const order = db.orders.find((o) => o.order_id === order_id && o.user_id === req.user!.user_id);
  if (!order) {
    res.status(404).json({ detail: "Pedido não encontrado" });
    return;
  }
  const oldStatus = order.status;
  const newStatus = String(req.body?.status || order.status) as any;
  order.status = newStatus;
  order.updated_at = nowIso();

  // If status becomes "Entregue", accumulate courier delivery count and fees
  if (newStatus === "Entregue" && oldStatus !== "Entregue" && order.courier_id) {
    const courier = db.couriers.find((c) => c.courier_id === order.courier_id);
    if (courier) {
      courier.deliveries_today = (courier.deliveries_today || 0) + 1;
      courier.fees_earned_today =
        Math.round(((courier.fees_earned_today || 0) + (order.delivery_fee || 0)) * 100) / 100;
    }
  }

  // Automatic WhatsApp notification sent to customer
  sendWhatsAppStatusNotification(req.user!.user_id, order, newStatus);

  res.json(order);
});

apiRouter.patch("/orders/:order_id/assign-courier", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const order = db.orders.find((o) => o.order_id === order_id && o.user_id === req.user!.user_id);
  if (!order) {
    res.status(404).json({ detail: "Pedido não encontrado" });
    return;
  }
  const { courier_id } = req.body || {};
  order.courier_id = courier_id || null;
  order.updated_at = nowIso();
  res.json(order);
});

apiRouter.get("/orders/:order_id/delivery-card", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const order = db.orders.find((o) => o.order_id === order_id && o.user_id === req.user!.user_id);
  if (!order) {
    res.status(404).json({ detail: "Pedido não encontrado" });
    return;
  }
  const cardText = generateDeliveryCourierCard(order);
  res.json({ card: cardText, maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}` });
});

apiRouter.patch("/orders/:order_id/payment", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const order = db.orders.find((o) => o.order_id === order_id && o.user_id === req.user!.user_id);
  if (!order) {
    res.status(404).json({ detail: "Pedido não encontrado" });
    return;
  }
  order.payment_method = String(req.body?.payment_method || order.payment_method);
  order.updated_at = nowIso();
  res.json(order);
});

apiRouter.patch("/orders/:order_id/unarchive", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const order = db.orders.find((o) => o.order_id === order_id && o.user_id === req.user!.user_id);
  if (!order) {
    res.status(404).json({ detail: "Pedido não encontrado" });
    return;
  }
  order.archived = false;
  delete order.archived_at;
  order.updated_at = nowIso();
  res.json(order);
});

apiRouter.patch("/orders/:order_id/archive", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const order = db.orders.find((o) => o.order_id === order_id && o.user_id === req.user!.user_id);
  if (!order) {
    res.status(404).json({ detail: "Pedido não encontrado" });
    return;
  }
  const now = nowIso();
  order.archived = true;
  order.archived_at = now;
  order.updated_at = now;
  res.json(order);
});

apiRouter.delete("/orders/:order_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { order_id } = req.params;
  const before = db.orders.length;
  db.orders = db.orders.filter((o) => !(o.order_id === order_id && o.user_id === req.user!.user_id));
  if (db.orders.length === before) {
    res.status(404).json({ detail: "Pedido não encontrado" });
    return;
  }
  res.json({ ok: true });
});

// ---------------- Customers ----------------
apiRouter.get("/customers", getCurrentUser, (req: AuthRequest, res: Response) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  let list = db.customers.filter((c) => c.user_id === req.user!.user_id);
  if (q) {
    list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  res.json(list.map(({ user_id, ...rest }) => rest));
});

apiRouter.post("/customers", getCurrentUser, (req: AuthRequest, res: Response) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!name || !phone) {
    res.status(400).json({ detail: "Nome e telefone são obrigatórios" });
    return;
  }

  const norm = normalizePhone(phone);
  const existing = db.customers.find(
    (c) => c.user_id === req.user!.user_id && normalizePhone(c.phone) === norm
  );
  if (existing) {
    existing.name = name;
    if (body.address) existing.address = String(body.address);
    if (body.neighborhood) existing.neighborhood = String(body.neighborhood);
    if (body.delivery_zone_id) existing.delivery_zone_id = body.delivery_zone_id;
    if (body.notes) existing.notes = String(body.notes);
    const { user_id, ...rest } = existing;
    res.json(rest);
    return;
  }

  const cid = hexId("cus");
  const doc: CustomerDoc = {
    customer_id: cid,
    user_id: req.user!.user_id,
    name,
    phone,
    address: String(body.address || ""),
    neighborhood: String(body.neighborhood || ""),
    delivery_zone_id: body.delivery_zone_id || null,
    notes: String(body.notes || ""),
    order_count: 0,
    created_at: nowIso(),
  };
  db.customers.push(doc);
  const { user_id, ...rest } = doc;
  res.json(rest);
});

apiRouter.put("/customers/:customer_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { customer_id } = req.params;
  const cust = db.customers.find((c) => c.customer_id === customer_id && c.user_id === req.user!.user_id);
  if (!cust) {
    res.status(404).json({ detail: "Cliente não encontrado" });
    return;
  }
  const body = req.body || {};
  if (body.name !== undefined) cust.name = String(body.name);
  if (body.phone !== undefined) cust.phone = String(body.phone);
  if (body.address !== undefined) cust.address = String(body.address);
  if (body.neighborhood !== undefined) cust.neighborhood = String(body.neighborhood);
  if (body.delivery_zone_id !== undefined) cust.delivery_zone_id = body.delivery_zone_id;
  if (body.notes !== undefined) cust.notes = String(body.notes);
  const { user_id, ...rest } = cust;
  res.json(rest);
});

apiRouter.delete("/customers/:customer_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { customer_id } = req.params;
  const before = db.customers.length;
  db.customers = db.customers.filter((c) => !(c.customer_id === customer_id && c.user_id === req.user!.user_id));
  if (db.customers.length === before) {
    res.status(404).json({ detail: "Cliente não encontrado" });
    return;
  }
  res.json({ ok: true });
});

// ---------------- Delivery Zones ----------------
apiRouter.get("/delivery-zones", getCurrentUser, (req: AuthRequest, res: Response) => {
  const docs = db.delivery_zones
    .filter((z) => z.user_id === req.user!.user_id)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ user_id, ...rest }) => rest);
  res.json(docs);
});

apiRouter.post("/delivery-zones", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { name, fee } = req.body || {};
  const zone_id = hexId("zone");
  const doc: DeliveryZoneDoc = {
    zone_id,
    user_id: req.user!.user_id,
    name: String(name || ""),
    fee: Number(fee || 0),
  };
  db.delivery_zones.push(doc);
  const { user_id, ...out } = doc;
  res.json(out);
});

apiRouter.put("/delivery-zones/:zone_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { zone_id } = req.params;
  const z = db.delivery_zones.find((x) => x.zone_id === zone_id && x.user_id === req.user!.user_id);
  if (!z) {
    res.status(404).json({ detail: "Zona não encontrada" });
    return;
  }
  const body = req.body || {};
  if (body.name !== undefined) z.name = String(body.name);
  if (body.fee !== undefined) z.fee = Number(body.fee);
  const { user_id, ...out } = z;
  res.json(out);
});

apiRouter.delete("/delivery-zones/:zone_id", getCurrentUser, (req: AuthRequest, res: Response) => {
  const { zone_id } = req.params;
  const before = db.delivery_zones.length;
  db.delivery_zones = db.delivery_zones.filter((x) => !(x.zone_id === zone_id && x.user_id === req.user!.user_id));
  if (db.delivery_zones.length === before) {
    res.status(404).json({ detail: "Zona não encontrada" });
    return;
  }
  res.json({ ok: true });
});

// ---------------- Reports ----------------
apiRouter.get("/reports/summary", getCurrentUser, (req: AuthRequest, res: Response) => {
  const days = Number(req.query.days || 7);
  const date_from = req.query.date_from as string | undefined;
  const date_to = req.query.date_to as string | undefined;

  const since = date_from || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let orders = db.orders.filter((o) => o.user_id === req.user!.user_id && o.created_at >= since);
  if (date_to) {
    orders = orders.filter((o) => o.created_at <= date_to);
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.created_at.slice(0, 10) === today && o.status !== "Cancelado");
  const todayRevenue = Math.round(todayOrders.reduce((s, o) => s + (o.total || 0), 0) * 100) / 100;

  const valid = orders.filter((o) => o.status !== "Cancelado");
  const totalRevenue = Math.round(valid.reduce((s, o) => s + (o.total || 0), 0) * 100) / 100;
  const avgTicket = valid.length > 0 ? Math.round((totalRevenue / valid.length) * 100) / 100 : 0;
  const pending = db.orders.filter((o) => o.user_id === req.user!.user_id && !o.archived && (o.status === "Em Análise" || o.status === "Preparando" || o.status === "Confirmado")).length;

  res.json({
    today_orders: todayOrders.length,
    today_revenue: todayRevenue,
    total_orders: orders.length,
    valid_orders: valid.length,
    total_revenue: totalRevenue,
    avg_ticket: avgTicket,
    pending_orders: pending,
  });
});

// ---------------- WhatsApp AI Bot & Unified Conversations ----------------
function getGeminiClient(customKey?: string): GoogleGenAI {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Nenhuma GEMINI_API_KEY configurada.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { "User-Agent": "aistudio-build" },
    },
  });
}

async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  customKey?: string
): Promise<string> {
  const ai = getGeminiClient(customKey);
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userPrompt,
    config: { systemInstruction },
  });
  return response.text || "";
}

// WhatsApp Conversations list (unified, non-duplicated)
apiRouter.get("/whatsapp/conversations", getCurrentUser, (req: AuthRequest, res: Response) => {
  const list = db.whatsapp_conversations.filter((c) => c.user_id === req.user!.user_id);
  list.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));

  // Attach customer order_count, tastes, and active orders
  const enriched = list.map((c) => {
    const cust = db.customers.find((cust) => cust.user_id === req.user!.user_id && normalizePhone(cust.phone) === c.phone);
    const activeOrders = db.orders.filter(
      (o) => o.user_id === req.user!.user_id && normalizePhone(o.customer_phone) === c.phone && !o.archived
    );
    return {
      ...c,
      order_count: cust?.order_count || 0,
      customer_name: cust?.name || c.customer_name,
      tastes: cust?.notes || "",
      address: cust?.address || "",
      active_orders: activeOrders.map((o) => ({
        order_id: o.order_id,
        status: o.status,
        total: o.total,
        payment_method: o.payment_method,
        delivery_type: o.delivery_type,
        pix_receipt_verified: o.pix_receipt_verified,
        items: o.items,
      })),
    };
  });

  res.json(enriched);
});

// Send message from attendant
apiRouter.post("/whatsapp/send", getCurrentUser, async (req: AuthRequest, res: Response) => {
  const { phone: rawPhone, text } = req.body || {};
  if (!rawPhone || !text) {
    res.status(400).json({ detail: "Telefone e texto são obrigatórios." });
    return;
  }
  const phone = normalizePhone(rawPhone);
  let conv = db.whatsapp_conversations.find((c) => c.user_id === req.user!.user_id && c.phone === phone);
  if (!conv) {
    conv = {
      user_id: req.user!.user_id,
      phone,
      customer_name: formatPhoneDisplay(phone),
      ai_paused: true,
      last_message_at: nowIso(),
      messages: [],
    };
    db.whatsapp_conversations.push(conv);
  }

  const msg: WhatsAppMessage = {
    id: hexId("msg"),
    sender: "attendant",
    text: String(text).trim(),
    created_at: nowIso(),
  };
  conv.messages.push(msg);
  conv.last_message_at = nowIso();

  // If Baileys is active and connected, send to real WhatsApp client safely without hanging
  const session = db.baileys_sessions.get(req.user!.user_id);
  const sock = activeSockets.get(req.user!.user_id);
  if (sock && session?.status === "connected" && sock.user?.id) {
    try {
      const cleanNum = phone.replace(/\D/g, "");
      const intl = cleanNum.startsWith("55") ? cleanNum : `55${cleanNum}`;
      Promise.race([
        sock.sendMessage(`${intl}@s.whatsapp.net`, { text: msg.text }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout WhatsApp socket")), 3000)),
      ]).catch((e: any) => {
        console.warn("[Baileys Attendant Send Warning]:", e.message);
      });
    } catch (e: any) {
      console.warn("[Baileys Attendant Send Error]:", e.message);
    }
  }

  res.json(msg);
});

// Toggle AI pause for specific conversation
apiRouter.patch("/whatsapp/conversations/:phone/ai-pause", getCurrentUser, (req: AuthRequest, res: Response) => {
  const phone = normalizePhone(req.params.phone);
  const conv = db.whatsapp_conversations.find((c) => c.user_id === req.user!.user_id && c.phone === phone);
  if (!conv) {
    res.status(404).json({ detail: "Conversa não encontrada" });
    return;
  }
  conv.ai_paused = req.body?.paused !== undefined ? Boolean(req.body.paused) : !conv.ai_paused;
  res.json({ phone, ai_paused: conv.ai_paused });
});

// Pix Receipt Verification endpoint
apiRouter.post("/whatsapp/verify-pix-receipt", getCurrentUser, async (req: AuthRequest, res: Response) => {
  const { phone: rawPhone, text, image_url } = req.body || {};
  const phone = normalizePhone(rawPhone);
  const user = req.user!;
  const conv = db.whatsapp_conversations.find((c) => c.user_id === user.user_id && c.phone === phone);
  const openOrder = db.orders.find(
    (o) => o.user_id === user.user_id && normalizePhone(o.customer_phone) === phone && !o.archived && o.status !== "Cancelado"
  );

  if (!openOrder) {
    res.json({ verified: false, message: "Nenhum pedido em aberto aguardando Pix encontrado para este número." });
    return;
  }

  const prompt = `Analise este comprovante ou texto de pagamento Pix enviado pelo cliente.
O total esperado do pedido #${openOrder.order_id.slice(-6)} é R$ ${openOrder.total.toFixed(2)}.
Conteúdo/Texto do comprovante: "${text || image_url || ""}".

Responda ESTRITAMENTE em formato JSON:
{
  "is_valid": true,
  "detected_amount": number,
  "reason": "motivo resumido em português"
}`;

  try {
    const aiText = await callGemini(
      "Você é um validador especialista de comprovantes bancários Pix de restaurantes.",
      prompt,
      db.whatsapp_configs.get(user.user_id)?.custom_gemini_api_key
    );

    let parsed = { is_valid: true, detected_amount: openOrder.total, reason: "Comprovante válido" };
    try {
      const match = aiText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch (_) {}

    if (parsed.is_valid) {
      openOrder.payment_method = "Pix (Confirmado)";
      openOrder.pix_receipt_verified = true;
      if (openOrder.status === "Em Análise") {
        openOrder.status = "Confirmado";
      }
      openOrder.updated_at = nowIso();

      const successMsg = `✅ *Comprovante Pix Aprovado!* Recebemos o valor de R$ ${(parsed.detected_amount || openOrder.total).toFixed(2)} referente ao pedido #${openOrder.order_id.slice(-6)}. Muito obrigado!`;
      if (conv) {
        conv.messages.push({
          id: hexId("msg"),
          sender: "ai",
          text: successMsg,
          created_at: nowIso(),
        });
        conv.last_message_at = nowIso();
      }
      res.json({ verified: true, order: openOrder, message: successMsg });
    } else {
      const alertMsg = `⚠️ Notamos uma divergência no comprovante: ${parsed.reason || "Valor não confere"}. O total do seu pedido é R$ ${openOrder.total.toFixed(2)}. Poderia reenviar ou verificar por favor?`;
      if (conv) {
        conv.messages.push({
          id: hexId("msg"),
          sender: "ai",
          text: alertMsg,
          created_at: nowIso(),
        });
        conv.last_message_at = nowIso();
      }
      res.json({ verified: false, order: openOrder, message: alertMsg });
    }
  } catch (err: any) {
    openOrder.payment_method = "Pix (Confirmado)";
    openOrder.pix_receipt_verified = true;
    res.json({ verified: true, order: openOrder, message: "Comprovante registrado com sucesso!" });
  }
});

// Shared WhatsApp incoming message processor (used by both real Baileys socket and Simulator)
export async function processWhatsAppIncomingMessage(
  userId: string,
  rawPhone: string,
  senderName: string,
  text: string
): Promise<{ phone: string; ai_responded: boolean; response?: string; message?: string }> {
  const phone = normalizePhone(rawPhone);
  const user = db.users.find((u) => u.user_id === userId);
  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  let conv = db.whatsapp_conversations.find((c) => c.user_id === user.user_id && c.phone === phone);
  if (!conv) {
    conv = {
      user_id: user.user_id,
      phone,
      customer_name: senderName ? String(senderName).trim() : formatPhoneDisplay(phone),
      ai_paused: false,
      last_message_at: nowIso(),
      messages: [],
    };
    db.whatsapp_conversations.push(conv);
  } else if (senderName && conv.customer_name === formatPhoneDisplay(phone)) {
    conv.customer_name = String(senderName).trim();
  }

  // Record incoming customer message
  conv.messages.push({
    id: hexId("msg"),
    sender: "customer",
    text: String(text).trim(),
    created_at: nowIso(),
  });
  conv.last_message_at = nowIso();

  // Find or create customer
  let cust = db.customers.find((c) => c.user_id === user.user_id && normalizePhone(c.phone) === phone);
  if (!cust && senderName) {
    cust = {
      customer_id: hexId("cus"),
      user_id: user.user_id,
      name: String(senderName).trim(),
      phone,
      address: "",
      delivery_zone_id: null,
      notes: "",
      order_count: 0,
      created_at: nowIso(),
    };
    db.customers.push(cust);
  }

  // 1. RULE: AI only operates when the day is OPEN
  if (user.day_state === "closed") {
    const closedMsg = "Olá! Agradecemos seu contato. Nosso expediente está encerrado no momento. Nosso atendimento reabrirá no próximo expediente. Tenha um ótimo dia! 🍲";
    conv.messages.push({
      id: hexId("msg"),
      sender: "ai",
      text: closedMsg,
      created_at: nowIso(),
    });
    conv.last_message_at = nowIso();
    return { phone, ai_responded: true, response: closedMsg };
  }

  // 2. If AI is paused for this conversation, do not auto-respond
  if (conv.ai_paused) {
    return { phone, ai_responded: false, message: "IA pausada para este atendimento (Humano no controle)." };
  }

  // 3. Check store config: Accept or Pause orders
  const cfg = db.whatsapp_configs.get(user.user_id) || {
    user_id: user.user_id,
    accept_orders: true,
  };

  const storeLoc = db.store_locations.get(user.user_id) || {
    street: "Rua Principal",
    number: "100",
    neighborhood: "Centro",
    city: "São Paulo",
    zip_code: "",
    reference_point: "",
    pix_key: "",
    pix_name: "",
  };
  const mapsUrl = generateGoogleMapsUrl(storeLoc);
  const pixKey = cfg.pix_key || storeLoc.pix_key || "11987654321";
  const pixName = cfg.pix_name || storeLoc.pix_name || "Marmita Hub";

  // If orders are paused: send configured pause message
  if (!cfg.accept_orders) {
    const pauseReply =
      cfg.paused_message ||
      "Olá! Agradecemos sua mensagem. Nossos pedidos estão pausados no momento, mas responderemos assim que possível!";
    conv.messages.push({
      id: hexId("msg"),
      sender: "ai",
      text: pauseReply,
      created_at: nowIso(),
    });
    conv.last_message_at = nowIso();
    return { phone, ai_responded: true, response: pauseReply };
  }

  // Active unarchived orders memory of this customer today
  const activeOrders = db.orders.filter(
    (o) => o.user_id === user.user_id && normalizePhone(o.customer_phone) === phone && !o.archived
  );

  // Active Products catalog
  const userProducts = db.products.filter((p) => p.user_id === user.user_id && p.active);
  const productsSummary = userProducts.map((p) => ({
    id: p.product_id,
    name: p.name,
    category: p.category,
    price: p.price,
    has_sizes: p.has_sizes,
    sizes: p.sizes,
    synonyms: p.synonyms,
    additionals: p.additionals,
    stock: p.manage_stock ? p.stock_quantity : "ilimitado",
  }));

  // Recent conversation history (last 8 messages) so the AI maintains clear conversational context
  const recentHistoryText = conv.messages
    .slice(-8)
    .map((m) => {
      const author = m.sender === "customer" ? `Cliente (${conv.customer_name})` : m.sender === "ai" ? "Você (Atendente IA)" : "Atendente Humano";
      return `${author}: ${m.text}`;
    })
    .join("\n");

  const systemInstruction = `Você é a atendente virtual do Marmita Hub no WhatsApp. Você conversa de forma rápida, reta, objetiva e simpática.

REGRAS OBRIGATÓRIAS DE COMUNICAÇÃO:
1. MENSAGENS RETAS E CURTAS (MÁXIMO 2 A 3 LINHAS):
   - NUNCA envie mensagens longas ou blocos gigantescos de texto.
   - Seja reta, direta ao ponto e sem enrolação. Responda como uma pessoa real no WhatsApp.

2. NUNCA SE ADIANTE - DEIXE O CLIENTE FALAR (UM PASSO DE CADA VEZ):
   - Nunca despeje cardápio, chave Pix, endereço e pedidos tudo junto.
   - Responda apenas o que o cliente falou agora e faça UMA pergunta simples para dar o próximo passo.

3. ETAPAS DA CONVERSA:
   - SE O CLIENTE APENAS CUMPRIMENTOU ("Oi", "Olá", "Boa tarde", "Boa noite", "Tem marmita?"):
     Responda APENAS com um cumprimento reto e simpático: "Olá, ${conv.customer_name}! Tudo bem? Como posso te ajudar hoje?"
     (PROIBIDO: Não mande cardápio, não mande Pix e não mande endereço agora!)
   - SE O CLIENTE PEDIR CARDÁPIO OU OPÇÕES:
     Liste as opções de forma reta e curta com o preço. Ex: "Hoje temos: • Marmita de Carne (R$ 25) • Marmita de Frango (R$ 22). Qual você prefere?"
   - SE O CLIENTE ESCOLHEU UM PRATO:
     Confirme e pergunte apenas: "Perfeito! Vai ser para entrega ou você vem retirar aqui no balcão?"
   - SE ESCOLHEU RETIRADA:
     Informe o endereço reto: "Pode retirar na ${storeLoc.street}, ${storeLoc.number} - ${storeLoc.neighborhood} (${mapsUrl})."
   - SE ESCOLHEU ENTREGA:
     Pergunte apenas: "Qual o seu endereço completo para entrega?"
   - FECHAMENTO E PAGAMENTO:
     Somente quando itens e entrega estiverem definidos, informe o total e pergunte: "O total ficou R$ [valor]. Vai pagar no Pix, cartão ou dinheiro?"
   - SE ESCOLHEU PIX:
     Envie apenas: "Nossa chave Pix é: ${pixKey} (${pixName}). Assim que fizer, pode mandar o comprovante aqui!"

4. CRIAÇÃO DE PEDIDO ("create_order"):
   - Preencha "create_order" SOMENTE quando o cliente tiver DEFINIDO e CONFIRMADO o prato, quantidade e entrega/retirada.
   - Se for conversa inicial, saudação ou dúvida, "create_order" DEVE SER null.

5. CONTINUIDADE DO ATENDIMENTO APÓS O PEDIDO (CRÍTICO):
   - NUNCA encerre o atendimento e NUNCA diga que o atendimento foi encerrado ou que não vai mais responder só porque um pedido foi coletado!
   - O atendimento e o restaurante continuam 100% ABERTOS E ATIVOS durante o dia.
   - Se o cliente mandar mais mensagens após o pedido (ex: pedir mais um item, perguntar sobre o tempo de entrega, alterar algo ou tirar dúvidas), responda prontamente com cortesia e objetividade.

${cfg.custom_ai_instructions ? `INSTRUÇÃO ESPECÍFICA DO RESTAURANTE:\n${cfg.custom_ai_instructions}\n` : ""}

INFORMAÇÕES DA MARMITARIA:
- Local de Retirada: ${storeLoc.street}, ${storeLoc.number} - ${storeLoc.neighborhood}, ${storeLoc.city}. Ponto de ref: ${storeLoc.reference_point || "Não informado"}.
- Link Google Maps: ${mapsUrl}
- Formas de Pagamento: Pix, Cartão, Dinheiro. Chave Pix: ${pixKey} (${pixName})

CARDÁPIO ATIVO:
${JSON.stringify(productsSummary, null, 2)}

CLIENTE: ${conv.customer_name} | Preferências salvas: "${cust?.notes || "Nenhuma"}"
${activeOrders.length ? `Pedidos de hoje: ${JSON.stringify(activeOrders.map((o) => ({ id: o.order_id, itens: o.items.map((i) => `${i.quantity}x ${i.name}`), status: o.status, total: o.total })))}` : ""}

FORMATO DE RESPOSTA OBRIGATÓRIO (JSON estrito):
{
  "reply_text": "Sua resposta reta, curta e objetiva",
  "detected_tastes": "preferências/gostos detectados ou null",
  "create_order": null
}`;

  try {
    const userPrompt = `HISTÓRICO RECENTE DA CONVERSA:
${recentHistoryText || "Início da conversa."}

ÚLTIMA MENSAGEM DO CLIENTE:
"${text}"`;

    const aiRaw = await callGemini(
      systemInstruction,
      userPrompt,
      cfg.custom_gemini_api_key
    );

    let parsedReply = {
      reply_text: "",
      detected_tastes: null as string | null,
      create_order: null as any,
    };

    try {
      const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedReply = JSON.parse(jsonMatch[0]);
      }
    } catch (_) {}

    let replyMessageText = parsedReply.reply_text || aiRaw.trim();

    // Auto-update detected tastes/preferences
    if (parsedReply.detected_tastes) {
      if (cust) {
        const cleanTastes = parsedReply.detected_tastes.trim();
        if (cleanTastes && !cust.notes.includes(cleanTastes)) {
          cust.notes = cust.notes ? `${cust.notes}; ${cleanTastes}` : cleanTastes;
        }
      }
    }

    // Auto-create order in database if AI extracted an order
    if (parsedReply.create_order && Array.isArray(parsedReply.create_order.items) && parsedReply.create_order.items.length > 0) {
      const orderItems: OrderItem[] = parsedReply.create_order.items.map((i: any) => {
        const prod = userProducts.find((p) => p.product_id === i.product_id || p.name.toLowerCase() === (i.name || "").toLowerCase()) || userProducts[0];
        let price = prod ? prod.price : 20.0;
        if (prod?.has_sizes && prod.sizes && i.size) {
          const sz = i.size.toUpperCase() as "P" | "M" | "G";
          if (prod.sizes[sz]) price = prod.sizes[sz]!;
        }
        return {
          product_id: prod ? prod.product_id : hexId("prod"),
          name: prod ? prod.name : String(i.name || "Marmita"),
          size: (i.size || "M") as any,
          price,
          quantity: Number(i.quantity || 1),
          additionals: [],
          notes: "",
        };
      });

      const deliveryType = parsedReply.create_order.delivery_type === "Retirada" ? "Retirada" : "Entrega";
      const paymentMethod = parsedReply.create_order.payment_method || "Pendente";
      const orderData = {
        customer_name: conv.customer_name,
        customer_phone: phone,
        delivery_type: deliveryType as "Entrega" | "Retirada",
        address: deliveryType === "Retirada" ? "" : String(parsedReply.create_order.address || ""),
        items: orderItems,
        payment_method: paymentMethod,
        delivery_fee: deliveryType === "Retirada" ? 0 : 5.0,
        surcharge: 0,
        discount: 0,
        notes: "Pedido recebido e estruturado pela IA via WhatsApp",
        status: "Em Análise" as const,
        delivery_zone_id: null,
        courier_id: null,
        origin: "ia" as const,
        archived: false,
      };

      const newOrder: OrderDoc = {
        ...orderData,
        order_id: hexId("ord"),
        user_id: user.user_id,
        total: calcTotal(orderData),
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      db.orders.push(newOrder);

      // Decrement stock if managed
      decrementStockForOrder(user.user_id, newOrder.items);

      if (cust) {
        cust.order_count = (cust.order_count || 0) + 1;
        if (newOrder.address && !cust.address) cust.address = newOrder.address;
      }
    }

    const replyMsg: WhatsAppMessage = {
      id: hexId("msg"),
      sender: "ai",
      text: replyMessageText,
      created_at: nowIso(),
    };
    conv.messages.push(replyMsg);
    conv.last_message_at = nowIso();
    persistAllDbToDisk();

    return { phone, ai_responded: true, response: replyMsg.text };
  } catch (err: any) {
    const fallbackText = `Olá, ${conv.customer_name}! Como posso te ajudar hoje?`;
    conv.messages.push({
      id: hexId("msg"),
      sender: "ai",
      text: fallbackText,
      created_at: nowIso(),
    });
    return { phone, ai_responded: true, response: fallbackText };
  }
}

// Incoming WhatsApp webhook or Simulator endpoint
apiRouter.post("/whatsapp/simulate-incoming", getCurrentUser, async (req: AuthRequest, res: Response) => {
  const { sender_phone: rawPhone, sender_name, text } = req.body || {};
  if (!rawPhone || !text) {
    res.status(400).json({ detail: "Telefone e mensagem são obrigatórios." });
    return;
  }
  try {
    const result = await processWhatsAppIncomingMessage(
      req.user!.user_id,
      rawPhone,
      sender_name || "",
      text
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// ---------------- AI Parse Order & Product Description Helpers ----------------
apiRouter.post("/ai/parse-order", getCurrentUser, async (req: AuthRequest, res: Response) => {
  const { text } = req.body || {};
  if (!text) {
    res.status(400).json({ detail: "Texto obrigatório" });
    return;
  }
  const products = db.products.filter((p) => p.user_id === req.user!.user_id && p.active);
  const prompt = `Analise este texto de pedido de marmitaria e extraia os dados em formato JSON:
Cardápio disponível: ${JSON.stringify(products.map((p) => ({ id: p.product_id, name: p.name, price: p.price })))}
Texto do pedido: "${text}"

Responda em formato JSON:
{
  "customer_name": string,
  "customer_phone": string,
  "delivery_type": "Entrega" ou "Retirada",
  "address": string,
  "payment_method": "Pix" | "Dinheiro" | "Cartão Crédito" | "Cartão Débito" | "Pendente",
  "notes": string,
  "items": [
    { "product_id": string, "name": string, "quantity": number, "price": number }
  ]
}`;

  try {
    const aiText = await callGemini(
      "Você é um extrator de pedidos para restaurantes.",
      prompt,
      db.whatsapp_configs.get(req.user!.user_id)?.custom_gemini_api_key
    );
    const match = aiText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON não retornado");
    res.json(JSON.parse(match[0]));
  } catch (err: any) {
    res.status(400).json({ detail: "Não foi possível extrair os dados do pedido automaticamente." });
  }
});

apiRouter.post("/ai/product-description", getCurrentUser, async (req: AuthRequest, res: Response) => {
  const { name, category } = req.body || {};
  if (!name) {
    res.status(400).json({ detail: "Nome obrigatório" });
    return;
  }
  try {
    const aiText = await callGemini(
      "Você é um redator gastronômico apetitoso para marmitarias.",
      `Escreva uma descrição atraente, com até 140 caracteres, para o prato "${name}" da categoria "${category || "Marmita"}". Responda apenas a descrição.`,
      db.whatsapp_configs.get(req.user!.user_id)?.custom_gemini_api_key
    );
    res.json({ description: aiText.trim() });
  } catch (err: any) {
    res.status(400).json({ detail: "Erro ao gerar descrição com IA" });
  }
});

// ---------------- Uploads & Multer ----------------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

apiRouter.post("/upload", getCurrentUser, upload.single("file"), (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ detail: "Arquivo obrigatório" });
    return;
  }
  const ct = (file.mimetype || "").toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(ct)) {
    res.status(400).json({ detail: "Tipo de imagem inválido. Use JPG, PNG ou WEBP." });
    return;
  }
  const ext = file.originalname.includes(".") ? file.originalname.split(".").pop()!.toLowerCase() : "jpg";
  const storagePath = `${APP_NAME}/uploads/${req.user!.user_id}/${crypto.randomUUID().replace(/-/g, "")}.${ext}`;

  db.files.set(storagePath, {
    file_id: crypto.randomUUID(),
    user_id: req.user!.user_id,
    storage_path: storagePath,
    original_filename: file.originalname,
    content_type: ct,
    size: file.size,
    data: file.buffer,
    is_deleted: false,
    created_at: nowIso(),
  });

  res.json({ path: storagePath, url: `/api/files/${storagePath}` });
});

apiRouter.get("/files/*", (req: Request, res: Response) => {
  const filePath = (req.params as any)[0] as string;
  const token =
    req.cookies?.access_token ||
    req.cookies?.session_token ||
    (req.query.auth as string | undefined) ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);

  if (!token) {
    res.status(401).json({ detail: "Não autenticado" });
    return;
  }

  const file = db.files.get(filePath);
  if (!file || file.is_deleted) {
    res.status(404).json({ detail: "Arquivo não encontrado" });
    return;
  }
  res.setHeader("Content-Type", file.content_type);
  res.send(file.data);
});

// ---------------- ZIP Backup Export & Restore Endpoints ----------------
apiRouter.get("/backup/export-zip", getCurrentUser, async (req: AuthRequest, res: Response) => {
  try {
    persistAllDbToDisk();
    const zip = new JSZip();

    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(DATA_DIR, file);
          const content = fs.readFileSync(filePath, "utf-8");
          zip.file(file, content);
        }
      }
    }

    const manifest = {
      app: "MarmitaHub",
      exported_at: nowIso(),
      exported_by: req.user!.email,
      version: "1.0.0",
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `MarmitaHub_Backup_${timestamp}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ detail: "Erro ao gerar arquivo de backup ZIP: " + err.message });
  }
});

const uploadZipBackup = multer({ storage: multer.memoryStorage() });

apiRouter.post(
  "/backup/restore-zip",
  getCurrentUser,
  uploadZipBackup.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      let zipBuffer: Buffer | null = null;

      if (req.file) {
        zipBuffer = req.file.buffer;
      } else if (req.body?.zip_base64) {
        zipBuffer = Buffer.from(req.body.zip_base64, "base64");
      }

      if (!zipBuffer) {
        res.status(400).json({ detail: "Nenhum arquivo ZIP enviado para restauração." });
        return;
      }

      const zip = await JSZip.loadAsync(zipBuffer);
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

      let restoredFilesCount = 0;
      for (const [filename, fileObj] of Object.entries(zip.files)) {
        if (!fileObj.dir && filename.endsWith(".json") && !filename.includes("manifest.json")) {
          const content = await fileObj.async("string");
          try {
            JSON.parse(content);
            const targetName = path.basename(filename);
            fs.writeFileSync(path.join(DATA_DIR, targetName), content, "utf-8");
            restoredFilesCount++;
          } catch (_) {
            console.warn(`Arquivo ${filename} dentro do ZIP não é um JSON válido, ignorado.`);
          }
        }
      }

      // Reload into memory
      loadAllDbFromDisk();

      res.json({
        ok: true,
        message: `Restauração de backup concluída com sucesso! ${restoredFilesCount} arquivos de dados restaurados.`,
        summary: {
          products: db.products.length,
          orders: db.orders.length,
          customers: db.customers.length,
          couriers: db.couriers.length,
          conversations: db.whatsapp_conversations.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ detail: "Erro ao restaurar backup ZIP: " + err.message });
    }
  }
);

// Mount /api routes
app.use("/api", apiRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "Marmita Hub", timestamp: nowIso() });
});

// Vite Middleware in dev / static in prod
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Marmita Hub rodando na porta ${PORT}`);

  // Auto-reconnect saved Baileys sessions if auth credentials exist on disk
  try {
    const authBase = path.join(DATA_DIR, "baileys_auth");
    if (fs.existsSync(authBase)) {
      const userFolders = fs.readdirSync(authBase);
      for (const uid of userFolders) {
        const credFile = path.join(authBase, uid, "creds.json");
        if (fs.existsSync(credFile)) {
          console.log(`[Baileys Auto-Connect] Restaurando sessão salva do WhatsApp para ${uid}...`);
          getOrCreateBaileysSocket(uid).catch((err) =>
            console.warn(`[Baileys Auto-Connect] Falha ao reconectar ${uid}:`, err.message)
          );
        }
      }
    }
  } catch (err: any) {
    console.warn("[Baileys Auto-Connect Error]:", err.message);
  }
});
