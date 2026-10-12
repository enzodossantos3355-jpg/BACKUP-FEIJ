import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import path from "path";
import fs from "fs";

/**
 * Conexão do WhatsApp via Baileys com exibição de QR Code no terminal.
 * Salva a sessão autenticada em './whatsapp_auth' para não precisar escanear novamente.
 */
async function startWhatsAppBot() {
  const authFolder = path.join(process.cwd(), "whatsapp_auth");

  // Garante que a pasta de autenticação existe
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  // Carrega ou inicializa as credenciais da sessão
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1015901307],
    isLatest: true
  }));

  console.log("====================================================");
  console.log(`🚀 Iniciando WhatsApp Baileys (v${version.join(".")})`);
  console.log("====================================================");

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // Geramos manualmente com qrcode-terminal
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  // Salva credenciais sempre que forem atualizadas
  sock.ev.on("creds.update", saveCreds);

  // Monitora alterações de status da conexão
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // 1. Exibe o QR Code no terminal se gerado
    if (qr) {
      console.log("\n====================================================");
      console.log("📱 ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:");
      console.log("👉 WhatsApp > ⋮ (ou Configurações) > Aparelhos Conectados > Conectar um aparelho");
      console.log("====================================================\n");

      qrcode.generate(qr, { small: true });

      console.log("\n⏳ Aguardando leitura do QR Code pelo celular...");
    }

    // 2. Conexão aberta com sucesso
    if (connection === "open") {
      const jid = sock.user?.id || "";
      const phone = jid.split(":")[0];
      const name = sock.user?.name || "Marmitaria";

      console.log("\n====================================================");
      console.log("✅ WHATSAPP CONECTADO COM SUCESSO!");
      console.log(`📱 Número: +${phone}`);
      console.log(`👤 Nome: ${name}`);
      console.log("🤖 Robô pronto para receber e processar mensagens!");
      console.log("====================================================\n");
    }

    // 3. Conexão fechada
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log("\n⚠️ Conexão encerrada. Código de status:", statusCode);

      if (shouldReconnect) {
        console.log("🔄 Reconectando ao WhatsApp em 3 segundos...");
        setTimeout(() => {
          startWhatsAppBot();
        }, 3000);
      } else {
        console.log("❌ Sessão encerrada no celular (Logout). Removendo credenciais antigas...");
        try {
          fs.rmSync(authFolder, { recursive: true, force: true });
        } catch (_) {}
        console.log("💡 Reinicie o script para gerar um novo QR Code.");
      }
    }
  });

  // Monitora mensagens recebidas
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      // Ignora mensagens enviadas pelo próprio robô
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid || "";
      const senderNumber = remoteJid.split("@")[0];
      const pushName = msg.pushName || "Cliente";

      // Extrai o texto da mensagem
      const messageText =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        "";

      if (!messageText.trim()) continue;

      console.log(`\n📩 [Nova Mensagem] ${pushName} (${senderNumber}): "${messageText}"`);

      // Exemplo de resposta automática simples
      // if (messageText.toLowerCase().includes("cardapio") || messageText.toLowerCase().includes("ola")) {
      //   await sock.sendMessage(remoteJid, { text: `Olá ${pushName}! Obrigado pelo contato com o Marmita Hub.` });
      // }
    }
  });

  return sock;
}

// Inicia o bot
startWhatsAppBot().catch((err) => {
  console.error("❌ Erro fatal ao iniciar o bot do WhatsApp:", err);
});
