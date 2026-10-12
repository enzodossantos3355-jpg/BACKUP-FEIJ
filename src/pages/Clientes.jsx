import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users, Plus, PencilSimple, Trash, Phone, MapPin, Heart, ShoppingBag,
  MagnifyingGlass, WhatsappLogo,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

const emptyCustomer = {
  name: "",
  phone: "",
  address: "",
  neighborhood: "",
  notes: "",
};

export default function Clientes() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get("/customers");
      setCustomers(data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCustomer);
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || "",
      phone: c.phone || "",
      address: c.address || "",
      neighborhood: c.neighborhood || "",
      notes: c.notes || "",
    });
    setOpen(true);
  };

  const save = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/customers/${editing.customer_id}`, form);
        toast.success("Cliente atualizado com sucesso");
      } else {
        await api.post("/customers", form);
        toast.success("Cliente cadastrado com sucesso");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    try {
      await api.delete(`/customers/${c.customer_id}`);
      toast.success("Cliente excluído");
      await load();
    } catch {
      toast.error("Erro ao excluir cliente");
    }
  };

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.neighborhood || "").toLowerCase().includes(q) ||
      (c.address || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8" data-testid="clientes-page">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Base de Conhecimento</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1 flex items-center gap-2">
            <Users size={32} weight="duotone" className="text-[#C5533B]" />
            Cadastro de Clientes
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Histórico de pedidos, preferências e gostos utilizados pela IA no atendimento WhatsApp.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="new-customer-btn"
              onClick={openCreate}
              className="bg-[#C5533B] hover:bg-[#A6432E] text-white rounded-lg shadow-sm"
            >
              <Plus size={18} weight="bold" className="mr-1.5" />
              Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editing ? "Editar cliente" : "Novo cliente"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4 mt-2">
              <div>
                <Label>Nome Completo *</Label>
                <Input
                  required
                  placeholder="Ex: João da Silva"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1"
                  data-testid="customer-name-input"
                />
              </div>

              <div>
                <Label>Telefone / WhatsApp *</Label>
                <Input
                  required
                  placeholder="Ex: (11) 98765-4321"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1"
                  data-testid="customer-phone-input"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Formatado automaticamente com DDI e nono dígito para o WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Endereço</Label>
                  <Input
                    placeholder="Rua, número, compl."
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1"
                    data-testid="customer-address-input"
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    placeholder="Bairro"
                    value={form.neighborhood}
                    onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                    className="mt-1"
                    data-testid="customer-neighborhood-input"
                  />
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-1.5">
                  <Heart size={14} className="text-[#C5533B]" weight="fill" />
                  Gostos e Preferências (Base para a IA)
                </Label>
                <Textarea
                  placeholder="Ex: Não gosta de cebola, prefere feijão preto, carne bem passada, marmita bem servida..."
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1"
                  data-testid="customer-notes-input"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  A IA consulta essas observações para personalizar o atendimento no WhatsApp.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#C5533B] hover:bg-[#A6432E] text-white"
                  data-testid="save-customer-btn"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder="Buscar por nome, telefone ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
            data-testid="customer-search-input"
          />
        </div>
        <div className="text-xs text-stone-500 font-medium">
          {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="py-12 text-center text-stone-500">Carregando clientes...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-stone-200 shadow-sm">
          <CardContent className="p-12 text-center">
            <Users size={40} weight="duotone" className="mx-auto text-stone-400 mb-3" />
            <h3 className="font-display text-lg font-medium text-stone-700">Nenhum cliente encontrado</h3>
            <p className="text-sm text-stone-500 mb-4">
              Clientes são cadastrados automaticamente ao realizarem pedidos ou pelo botão acima.
            </p>
            <Button onClick={openCreate} className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
              <Plus size={18} weight="bold" className="mr-1.5" />
              Cadastrar primeiro cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card
              key={c.customer_id}
              data-testid={`customer-card-${c.customer_id}`}
              className="border-stone-200 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-stone-900 text-lg truncate">
                      {c.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-stone-600 mt-0.5">
                      <Phone size={13} className="text-stone-400" />
                      <span>{c.phone}</span>
                    </div>
                  </div>

                  {/* Order count badge */}
                  <Badge
                    variant="outline"
                    className="bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/20 shrink-0 font-medium text-xs flex items-center gap-1"
                    title="Contador de pedidos para base de conhecimento da IA"
                  >
                    <ShoppingBag size={12} weight="bold" />
                    {c.order_count || 0} pedido{(c.order_count || 0) !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Address */}
                {(c.address || c.neighborhood) && (
                  <div className="flex items-start gap-1.5 text-xs text-stone-600 pt-1">
                    <MapPin size={14} className="text-stone-400 shrink-0 mt-0.5" />
                    <span className="truncate">
                      {c.address}
                      {c.address && c.neighborhood ? " · " : ""}
                      {c.neighborhood}
                    </span>
                  </div>
                )}

                {/* AI Preferences / Notes */}
                {c.notes && (
                  <div className="bg-[#FDF6EA] border border-[#D99A45]/30 rounded-lg p-2.5 text-xs text-[#99621E]">
                    <div className="font-semibold flex items-center gap-1 mb-0.5">
                      <Heart size={12} weight="fill" className="text-[#C5533B]" />
                      Gosto & Preferências (IA):
                    </div>
                    <p className="line-clamp-2">{c.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/10"
                    onClick={() => {
                      navigate(`/whatsapp`);
                    }}
                  >
                    <WhatsappLogo size={14} weight="bold" className="mr-1" />
                    Ver no WhatsApp
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(c)}
                      className="h-8 w-8 hover:bg-stone-100"
                      data-testid={`edit-customer-${c.customer_id}`}
                    >
                      <PencilSimple size={15} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(c)}
                      className="h-8 w-8 text-[#B94B4B] hover:bg-[#FCEDED]"
                      data-testid={`delete-customer-${c.customer_id}`}
                    >
                      <Trash size={15} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
