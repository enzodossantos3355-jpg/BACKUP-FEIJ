import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api from "@/lib/api";
import { Microphone, Sparkle, StopCircle, ArrowClockwise } from "@phosphor-icons/react";

export default function VoiceOrderDialog({ open, onOpenChange, onFilled }) {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";

      recognition.onresult = (event) => {
        let current = "";
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript + " ";
        }
        setTranscript(current.trim());
      };

      recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      toast.info("Reconhecimento de voz não suportado neste navegador. Digite abaixo.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Falha ao iniciar reconhecimento:", err);
      }
    }
  };

  const handleProcess = async () => {
    if (!transcript.trim()) {
      toast.error("Fale ou digite o pedido antes de processar");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/ai/parse-order", { text: transcript });
      toast.success("Pedido interpretado com sucesso!");
      onFilled(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Falha ao interpretar pedido por voz");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-900">
            <Microphone size={22} weight="fill" className="text-[#C5533B]" />
            Lançamento por Modo Voz / Ditado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-stone-500">
            Clique no microfone e dite o pedido completo (ex: &quot;2 marmitas de frango para João, Rua das Flores 123, pagamento no Pix&quot;).
          </p>

          <div className="flex justify-center py-2">
            <Button
              type="button"
              onClick={toggleListen}
              className={`rounded-full h-16 w-16 p-0 shadow-md transition-all ${
                isListening
                  ? "bg-red-600 hover:bg-red-700 animate-pulse text-white"
                  : "bg-[#C5533B] hover:bg-[#A6432E] text-white"
              }`}
            >
              {isListening ? (
                <StopCircle size={32} weight="fill" />
              ) : (
                <Microphone size={32} weight="fill" />
              )}
            </Button>
          </div>

          <div className="text-center text-xs font-medium text-stone-600">
            {isListening ? "Ouvindo... Fale agora" : "Clique para falar ou digite abaixo"}
          </div>

          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="O que você falar aparecerá aqui, ou você pode editar diretamente..."
            rows={4}
            className="text-sm"
          />
        </div>

        <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTranscript("")}
            className="text-stone-500 hover:text-stone-700"
          >
            <ArrowClockwise size={16} className="mr-1" />
            Limpar
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={loading || !transcript.trim()}
              onClick={handleProcess}
              className="bg-[#C5533B] hover:bg-[#A6432E] text-white"
            >
              <Sparkle size={16} weight="fill" className="mr-1" />
              {loading ? "Interpretando..." : "Preencher Pedido"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
