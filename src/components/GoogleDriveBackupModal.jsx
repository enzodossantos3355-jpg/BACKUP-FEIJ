import { useState, useEffect } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  HardDrive,
  CloudUpload,
  CloudDownload,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Download,
  FolderSync,
  Database,
  RefreshCw,
} from "lucide-react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// Firebase Applet config
import firebaseConfig from "../../firebase-applet-config.json";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export default function GoogleDriveBackupModal({ open, onOpenChange, trigger }) {
  const [googleToken, setGoogleToken] = useState(() => localStorage.getItem("marmita_gdrive_token") || null);
  const [googleUser, setGoogleUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("marmita_gdrive_user") || "null");
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [folderId, setFolderId] = useState(null);

  // Auto Backup Schedule
  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem("marmita_auto_backup_enabled") === "true");
  const [autoTime, setAutoTime] = useState(() => localStorage.getItem("marmita_auto_backup_time") || "23:00");

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      provider.addScope("https://www.googleapis.com/auth/drive");

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error("Não foi possível obter a chave de acesso do Google.");
      }

      const token = credential.accessToken;
      const user = {
        name: result.user.displayName,
        email: result.user.email,
        photo: result.user.photoURL,
      };

      setGoogleToken(token);
      setGoogleUser(user);
      localStorage.setItem("marmita_gdrive_token", token);
      localStorage.setItem("marmita_gdrive_user", JSON.stringify(user));

      toast.success(`Google Drive conectado com sucesso como ${user.email}!`);
      await fetchDriveFiles(token);
    } catch (err) {
      console.error("Erro no login do Google:", err);
      toast.error(err.message || "Erro ao conectar com Google Drive");
    } finally {
      setLoading(false);
    }
  };

  const getOrCreateBackupFolder = async (token) => {
    try {
      // 1. Search for MarmitaHub_Backups folder
      const query = encodeURIComponent("name='MarmitaHub_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json();

      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }

      // 2. Create if not found
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "MarmitaHub_Backups",
          mimeType: "application/vnd.google-apps.folder",
        }),
      });
      const createData = await createRes.json();
      return createData.id;
    } catch (err) {
      console.error("Erro ao buscar/criar pasta no Drive:", err);
      return null;
    }
  };

  const fetchDriveFiles = async (token = googleToken) => {
    if (!token) return;
    setLoading(true);
    try {
      const fId = await getOrCreateBackupFolder(token);
      setFolderId(fId);

      if (!fId) return;

      const query = encodeURIComponent(`'${fId}' in parents and trashed=false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,size,mimeType)&orderBy=createdTime desc`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err) {
      console.warn("Aviso ao buscar arquivos do Google Drive:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken && open) {
      fetchDriveFiles(googleToken);
    }
  }, [googleToken, open]);

  // Handle Manual Drive Backup
  const handleBackupToDrive = async () => {
    if (!googleToken) {
      toast.error("Conecte sua conta do Google Drive primeiro.");
      return;
    }
    setBackingUp(true);
    try {
      const fId = folderId || (await getOrCreateBackupFolder(googleToken));
      if (!fId) throw new Error("Não foi possível acessar a pasta do Google Drive.");

      // 1. Export ZIP from backend
      const res = await api.get("/backup/export-zip", { responseType: "blob" });
      const blob = res.data;

      // 2. Upload to Google Drive multipart
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const metadata = {
        name: `MarmitaHub_Backup_${timestamp}.zip`,
        parents: [fId],
      };

      const formData = new FormData();
      formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      formData.append("file", blob);

      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleToken}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Erro no upload do arquivo para o Google Drive.");
      }

      toast.success("✅ Backup ZIP criado e salvo no seu Google Drive com sucesso!");
      localStorage.setItem("marmita_last_backup_date", new Date().toLocaleDateString());
      await fetchDriveFiles(googleToken);
    } catch (err) {
      toast.error(err.message || "Erro ao fazer backup para o Google Drive");
    } finally {
      setBackingUp(false);
    }
  };

  // Download ZIP locally
  const handleDownloadLocal = async () => {
    setBackingUp(true);
    try {
      const res = await api.get("/backup/export-zip", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      link.href = url;
      link.setAttribute("download", `MarmitaHub_Backup_${timestamp}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Backup baixado para o seu computador!");
    } catch (err) {
      toast.error("Erro ao baixar arquivo de backup.");
    } finally {
      setBackingUp(false);
    }
  };

  // Restore from Drive file
  const handleRestoreFromDrive = async (fileId, fileName) => {
    if (!window.confirm(`Tem certeza que deseja restaurar o backup "${fileName}"? Isso irá atualizar o banco de dados do sistema com os dados do arquivo.`)) {
      return;
    }
    setRestoring(true);
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      const blob = await res.blob();

      const formData = new FormData();
      formData.append("file", blob, fileName);

      const restoreRes = await api.post("/backup/restore-zip", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(restoreRes.data.message || "Restauração concluída com sucesso!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error("Erro ao restaurar backup do Google Drive.");
    } finally {
      setRestoring(false);
    }
  };

  // Restore from local file upload
  const handleRestoreLocalFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`Tem certeza que deseja restaurar o backup do arquivo "${file.name}"?`)) {
      return;
    }

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/backup/restore-zip", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(res.data.message || "Restauração concluída com sucesso!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erro ao restaurar arquivo local");
    } finally {
      setRestoring(false);
    }
  };

  // Toggle Auto Backup Settings
  const handleToggleAuto = (val) => {
    setAutoBackup(val);
    localStorage.setItem("marmita_auto_backup_enabled", String(val));
    toast.success(val ? "Backup automático diário ativado!" : "Backup automático desativado.");
  };

  const handleTimeChange = (val) => {
    setAutoTime(val);
    localStorage.setItem("marmita_auto_backup_time", val);
    toast.success(`Horário do backup automático ajustado para ${val}`);
  };

  const handleDisconnect = () => {
    setGoogleToken(null);
    setGoogleUser(null);
    setDriveFiles([]);
    localStorage.removeItem("marmita_gdrive_token");
    localStorage.removeItem("marmita_gdrive_user");
    toast.success("Conta do Google Drive desconectada.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-semibold flex items-center gap-2 text-stone-900">
            <HardDrive className="text-[#C5533B] w-6 h-6" />
            Backup & Restauração no Google Drive
          </DialogTitle>
          <p className="text-xs text-stone-500">
            Guarde cópias seguras em arquivo ZIP de todos os pedidos, cardápios, clientes e configurações.
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Account Status Card */}
          <Card className="border-stone-200 bg-stone-50/70">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center shadow-xs">
                  {googleUser?.photo ? (
                    <img src={googleUser.photo} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Database className="w-5 h-5 text-[#C5533B]" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                    {googleUser ? googleUser.name : "Google Drive"}
                    {googleToken ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        Conectado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-stone-100 text-stone-500 text-[10px]">
                        Não Conectado
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-stone-500">
                    {googleUser ? googleUser.email : "Conecte sua conta para sincronizar backups na nuvem."}
                  </div>
                </div>
              </div>

              {googleToken ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => fetchDriveFiles()} disabled={loading}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-rose-600 hover:text-rose-700">
                    Desconectar
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={handleGoogleLogin} disabled={loading} className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
                  {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FolderSync className="w-4 h-4 mr-1.5" />}
                  Conectar Google Drive
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={handleBackupToDrive}
              disabled={backingUp || !googleToken}
              className="h-auto py-3 px-4 bg-[#C5533B] hover:bg-[#A6432E] text-white flex flex-col items-start justify-center gap-0.5 shadow-sm"
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                Criar Backup ZIP no Google Drive
              </div>
              <div className="text-[11px] text-white/80 font-normal">
                Exporta banco de dados e envia para a pasta MarmitaHub_Backups
              </div>
            </Button>

            <Button
              onClick={handleDownloadLocal}
              disabled={backingUp}
              variant="outline"
              className="h-auto py-3 px-4 border-stone-300 hover:bg-stone-50 text-stone-800 flex flex-col items-start justify-center gap-0.5"
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Download className="w-4 h-4 text-stone-600" />
                Baixar Backup ZIP no PC
              </div>
              <div className="text-[11px] text-stone-500 font-normal">
                Download direto para o seu computador
              </div>
            </Button>
          </div>

          {/* Auto Backup Config */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C5533B]" />
                <div>
                  <div className="text-xs font-semibold text-stone-900">Backup Automático Diário</div>
                  <div className="text-[11px] text-stone-500">
                    Sincroniza automaticamente um backup novo no Google Drive todo dia.
                  </div>
                </div>
              </div>
              <Switch checked={autoBackup} onCheckedChange={handleToggleAuto} />
            </div>

            {autoBackup && (
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                <Label className="text-xs text-stone-700">Horário preferencial da execução diária:</Label>
                <Select value={autoTime} onValueChange={handleTimeChange}>
                  <SelectTrigger className="w-28 h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12:00">12:00 (Meio-dia)</SelectItem>
                    <SelectItem value="18:00">18:00 (Fim da tarde)</SelectItem>
                    <SelectItem value="22:00">22:00 (Noite)</SelectItem>
                    <SelectItem value="23:00">23:00 (Fechamento)</SelectItem>
                    <SelectItem value="00:00">00:00 (Meia-noite)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Drive Files List / Restore Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                <CloudDownload className="w-4 h-4 text-[#C5533B]" />
                Backups Salvos no Google Drive ({driveFiles.length})
              </h3>
              <label className="cursor-pointer text-xs font-medium text-[#C5533B] hover:underline flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                Restaurar arquivo do PC
                <input type="file" accept=".zip" onChange={handleRestoreLocalFile} className="hidden" />
              </label>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#C5533B]" />
                Carregando arquivos do Google Drive...
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <div className="text-xs font-medium text-stone-600">Nenhum backup encontrado na nuvem</div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  {googleToken ? "Clique em 'Criar Backup ZIP' para fazer a primeira cópia." : "Conecte sua conta do Google para visualizar os arquivos."}
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {driveFiles.map((f) => {
                  const dateStr = new Date(f.createdTime).toLocaleString("pt-BR");
                  const sizeMb = f.size ? (Number(f.size) / 1024).toFixed(1) + " KB" : "";
                  return (
                    <div
                      key={f.id}
                      className="p-3 bg-white border border-stone-200 rounded-xl flex items-center justify-between shadow-2xs hover:border-stone-300 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold text-stone-900">{f.name}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          Criado em: {dateStr} {sizeMb ? `• ${sizeMb}` : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restoring}
                        onClick={() => handleRestoreFromDrive(f.id, f.name)}
                        className="text-xs h-8 text-stone-700 hover:text-stone-900"
                      >
                        {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1 text-[#C5533B]" />}
                        Restaurar
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
