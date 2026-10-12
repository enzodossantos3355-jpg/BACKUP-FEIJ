import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/api";

const WhatsAppChatContext = createContext({
  conversations: [],
  activePhone: null,
  activeConversation: null,
  setActivePhone: () => {},
  config: null,
  baileysSession: null,
  refresh: () => {},
  sendMessage: async () => {},
  toggleAi: async () => {},
  takeOver: async () => {},
  handoverToAi: async () => {},
  connectBaileys: async () => {},
  disconnectBaileys: async () => {},
  generatePairingCode: async () => {},
  saveConfig: async () => {},
  verifyPixReceipt: async () => {},
  unreadCount: 0,
});

export const useWhatsAppChat = () => useContext(WhatsAppChatContext);

export function WhatsAppChatProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [activePhone, setActivePhone] = useState(null);
  const [config, setConfig] = useState(null);
  const [baileysSession, setBaileysSession] = useState(null);
  const activePhoneRef = useRef(activePhone);

  useEffect(() => {
    activePhoneRef.current = activePhone;
  }, [activePhone]);

  const loadData = useCallback(async () => {
    try {
      const [convRes, cfgRes, bRes] = await Promise.all([
        api.get("/whatsapp/conversations"),
        api.get("/whatsapp/config"),
        api.get("/whatsapp/baileys/status"),
      ]);
      const list = convRes.data || [];
      setConversations(list);
      setConfig(cfgRes.data || null);
      const bSession = bRes.data || null;
      setBaileysSession(bSession);

      if (bSession?.phone) {
        try {
          localStorage.setItem("marmita_linked_phone", bSession.phone);
          localStorage.setItem("marmita_last_phone", bSession.phone);
        } catch (_) {}
      } else if (bSession?.last_linked_phone) {
        try {
          localStorage.setItem("marmita_last_phone", bSession.last_linked_phone);
        } catch (_) {}
      }

      // Auto-select first conversation if none selected yet and list has items
      if (!activePhoneRef.current && list.length > 0) {
        setActivePhone(list[0].phone);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Keep active conversation object synced with latest state
  const activeConversation = conversations.find((c) => c.phone === activePhone) || null;

  const sendMessage = async (phone, text) => {
    const cleanText = String(text).trim();
    if (!cleanText) return;

    // Optimistic message update so the attendant immediately sees the message in the UI
    const tempMsg = {
      id: "temp_" + Date.now(),
      sender: "attendant",
      text: cleanText,
      created_at: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.phone === phone) {
          return {
            ...c,
            last_message_at: tempMsg.created_at,
            messages: [...(c.messages || []), tempMsg],
          };
        }
        return c;
      })
    );

    try {
      const { data } = await api.post("/whatsapp/send", { phone, text: cleanText });
      await loadData();
      return data;
    } catch (err) {
      await loadData();
      throw err;
    }
  };

  const toggleAi = async (phone, paused) => {
    const targetPhone = phone || activePhone;
    if (!targetPhone) return;
    await api.patch(`/whatsapp/conversations/${targetPhone}/ai-pause`, { paused });
    await loadData();
  };

  const takeOver = async (phone) => {
    return toggleAi(phone || activePhone, true);
  };

  const handoverToAi = async (phone) => {
    return toggleAi(phone || activePhone, false);
  };

  const connectBaileys = async (phone) => {
    const payload = phone && phone.trim() ? { phone: phone.trim() } : {};
    const { data } = await api.post("/whatsapp/baileys/connect", payload);
    setBaileysSession(data);
    if (data?.phone) {
      try {
        localStorage.setItem("marmita_linked_phone", data.phone);
        localStorage.setItem("marmita_last_phone", data.phone);
      } catch (_) {}
    }
    return data;
  };

  const disconnectBaileys = async () => {
    const { data } = await api.post("/whatsapp/baileys/disconnect");
    setBaileysSession(data);
    try {
      localStorage.removeItem("marmita_linked_phone");
    } catch (_) {}
    return data;
  };

  const generatePairingCode = async (phone) => {
    const { data } = await api.post("/whatsapp/baileys/pairing-code", { phone });
    setBaileysSession(data.session);
    return data;
  };

  const saveConfig = async (payload) => {
    const { data } = await api.post("/whatsapp/config", payload);
    setConfig(data);
    return data;
  };

  const verifyPixReceipt = async (phone, text, image_url) => {
    const { data } = await api.post("/whatsapp/verify-pix-receipt", {
      phone: phone || activePhone,
      text,
      image_url,
    });
    await loadData();
    return data;
  };

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <WhatsAppChatContext.Provider
      value={{
        conversations,
        activePhone,
        activeConversation,
        setActivePhone,
        config,
        baileysSession,
        refresh: loadData,
        sendMessage,
        toggleAi,
        takeOver,
        handoverToAi,
        connectBaileys,
        disconnectBaileys,
        generatePairingCode,
        saveConfig,
        verifyPixReceipt,
        unreadCount,
      }}
    >
      {children}
    </WhatsAppChatContext.Provider>
  );
}
