import { useEffect, useState, useRef } from "react";
import api, { BRL, formatApiErrorDetail } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, PencilSimple, Trash, Package, UploadSimple, X, Sparkle, Tag, Robot,
} from "@phosphor-icons/react";
import AuthImage from "@/components/AuthImage";

const FALLBACK_IMAGES = [
  "https://images.pexels.com/photos/30635705/pexels-photo-30635705.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/30635717/pexels-photo-30635717.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.unsplash.com/photo-1626379907504-327b925f4b79?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwzfHxicmF6aWxpYW4lMjBoZWFsdGh5JTIwZm9vZCUyMG1lYWwlMjBwcmVwfGVufDB8fHx8MTc4MDIzNjUxMnww&ixlib=rb-4.1.0&q=85",
];

const empty = {
  name: "",
  description: "",
  price: "",
  category: "Marmita",
  image_url: "",
  active: true,
  has_sizes: false,
  sizes: { P: "", M: "", G: "" },
  synonyms: "",
  manage_stock: false,
  stock_quantity: 0,
  additionals: [],
};

export default function Produtos() {
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef(null);

  const generateDescription = async () => {
    if (!form.name?.trim()) {
      toast.error("Preencha o nome do produto primeiro");
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/product-description", {
        name: form.name,
        category: form.category,
      });
      setForm((f) => ({ ...f, description: data.description }));
      toast.success("Descrição gerada com IA");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro na IA");
    } finally {
      setAiLoading(false);
    }
  };

  const load = async () => {
    try {
      const { data } = await api.get("/products");
      setProducts(data || []);
    } catch (err) {
      console.warn("Aviso ao carregar produtos:", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price || ""),
      category: p.category || "Marmita",
      image_url: p.image_url || "",
      active: p.active !== undefined ? p.active : true,
      has_sizes: Boolean(p.has_sizes),
      sizes: {
        P: p.sizes?.P !== undefined ? String(p.sizes.P) : "",
        M: p.sizes?.M !== undefined ? String(p.sizes.M) : "",
        G: p.sizes?.G !== undefined ? String(p.sizes.G) : "",
      },
      synonyms: p.synonyms || "",
      manage_stock: Boolean(p.manage_stock),
      stock_quantity: p.stock_quantity !== undefined ? p.stock_quantity : 0,
      additionals: p.additionals || [],
    });
    setOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 5MB)");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, image_url: data.url }));
      toast.success("Imagem enviada");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Erro no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addAdditional = () => {
    setForm({ ...form, additionals: [...(form.additionals || []), { name: "", price: 0 }] });
  };
  const updateAdditional = (idx, field, value) => {
    setForm({
      ...form,
      additionals: form.additionals.map((a, i) =>
        i === idx ? { ...a, [field]: field === "price" ? parseFloat(value) || 0 : value } : a
      ),
    });
  };
  const removeAdditional = (idx) => {
    setForm({ ...form, additionals: form.additionals.filter((_, i) => i !== idx) });
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.has_sizes && !form.price) {
      toast.error("Preço é obrigatório");
      return;
    }
    if (form.has_sizes && (!form.sizes.P && !form.sizes.M && !form.sizes.G)) {
      toast.error("Preencha ao menos um tamanho (P, M ou G)");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        price: form.has_sizes
          ? parseFloat(form.sizes.M || form.sizes.P || form.sizes.G || 0)
          : parseFloat(form.price || 0),
        has_sizes: form.has_sizes,
        sizes: form.has_sizes
          ? {
              P: parseFloat(form.sizes.P || 0),
              M: parseFloat(form.sizes.M || 0),
              G: parseFloat(form.sizes.G || 0),
            }
          : undefined,
        synonyms: form.synonyms.trim(),
        additionals: (form.additionals || []).filter((a) => a.name?.trim()),
      };

      if (editing) {
        await api.put(`/products/${editing.product_id}`, payload);
        toast.success("Produto atualizado");
      } else {
        await api.post("/products", payload);
        toast.success("Produto criado");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleProductActive = async (p, e) => {
    e.stopPropagation();
    try {
      const newActive = !p.active;
      await api.put(`/products/${p.product_id}`, { active: newActive });
      setProducts((prev) =>
        prev.map((item) => (item.product_id === p.product_id ? { ...item, active: newActive } : item))
      );
      toast.success(newActive ? `"${p.name}" ativado` : `"${p.name}" pausado (esgotado)`);
    } catch {
      toast.error("Erro ao alterar disponibilidade");
    }
  };

  const remove = async (p) => {
    try {
      await api.delete(`/products/${p.product_id}`);
      toast.success("Produto excluído");
      await load();
    } catch (e) {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <div className="space-y-8" data-testid="produtos-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Catálogo</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 mt-1">Produtos</h1>
          <p className="text-sm text-stone-500 mt-1">
            Marmitas com variação P/M/G ou preço fixo, apelidos para a IA e controle rápido de disponibilidade.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-product-btn" onClick={openCreate} className="bg-[#C5533B] hover:bg-[#A6432E] text-white rounded-lg shadow-sm">
              <Plus size={18} weight="bold" className="mr-1.5" />
              Novo produto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Image upload */}
              <div>
                <Label>Foto do produto</Label>
                <div className="mt-1 flex items-start gap-3">
                  <div className="h-24 w-24 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0 relative">
                    {form.image_url ? (
                      <>
                        <AuthImage src={form.image_url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, image_url: "" })}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-stone-900/70 text-white flex items-center justify-center hover:bg-stone-900"
                          data-testid="remove-image-btn"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-stone-400">
                        <Package size={28} weight="duotone" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileUpload}
                      className="hidden"
                      data-testid="product-image-input-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full justify-center"
                      data-testid="upload-image-btn"
                    >
                      <UploadSimple size={16} className="mr-2" />
                      {uploading ? "Enviando..." : "Enviar foto"}
                    </Button>
                    <p className="text-xs text-stone-500">JPG, PNG ou WEBP — até 5MB</p>
                  </div>
                </div>
              </div>

              <div>
                <Label>Nome</Label>
                <Input data-testid="product-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Ex: Marmita Comercial de Bife" />
              </div>

              <div>
                <Label>Categoria</Label>
                <Input data-testid="product-category-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" placeholder="Marmita, Bebida, Sobremesa..." />
              </div>

              {/* Sizes P, M, G or Fixed Price */}
              <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-stone-900 font-medium">Variação por Tamanho (P, M, G)</Label>
                    <p className="text-xs text-stone-500">Ative para marmitas com tamanhos diferentes ou deixe desligado para valor fixo</p>
                  </div>
                  <Switch
                    checked={form.has_sizes}
                    onCheckedChange={(val) => setForm({ ...form, has_sizes: val })}
                    data-testid="product-has-sizes-switch"
                  />
                </div>

                {form.has_sizes ? (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200">
                    <div>
                      <Label className="text-xs font-semibold text-stone-700">Tamanho P (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 18.00"
                        value={form.sizes.P}
                        onChange={(e) =>
                          setForm({ ...form, sizes: { ...form.sizes, P: e.target.value } })
                        }
                        className="mt-1 bg-white"
                        data-testid="product-size-p-input"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-stone-700">Tamanho M (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 22.00"
                        value={form.sizes.M}
                        onChange={(e) =>
                          setForm({ ...form, sizes: { ...form.sizes, M: e.target.value } })
                        }
                        className="mt-1 bg-white"
                        data-testid="product-size-m-input"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-stone-700">Tamanho G (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 26.00"
                        value={form.sizes.G}
                        onChange={(e) =>
                          setForm({ ...form, sizes: { ...form.sizes, G: e.target.value } })
                        }
                        className="mt-1 bg-white"
                        data-testid="product-size-g-input"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label>Preço Fixo (R$)</Label>
                    <Input
                      data-testid="product-price-input"
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="mt-1 bg-white"
                      placeholder="0,00"
                    />
                  </div>
                )}
              </div>

              {/* Apelidos / Sinônimos para a IA */}
              <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 space-y-1.5">
                <div className="flex items-center gap-1.5 text-stone-900 font-medium">
                  <Robot size={16} className="text-[#C5533B]" weight="duotone" />
                  <Label>Apelidos / Sinônimos para a IA (WhatsApp)</Label>
                </div>
                <Input
                  placeholder="Ex: bife, feijuca, comercial, franguinho, acebolado"
                  value={form.synonyms}
                  onChange={(e) => setForm({ ...form, synonyms: e.target.value })}
                  className="bg-white"
                  data-testid="product-synonyms-input"
                />
                <p className="text-[11px] text-stone-500">
                  Palavras separadas por vírgula que os clientes costumam usar no WhatsApp. Ajuda a IA do Gemini a identificar o prato com precisão.
                </p>
              </div>

              {/* Optional Stock Management */}
              <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-stone-900 font-medium">Controle de Estoque (Opcional)</Label>
                    <p className="text-xs text-stone-500">
                      Diminui automaticamente com pedidos realizados e pausa o prato se zerar
                    </p>
                  </div>
                  <Switch
                    checked={form.manage_stock}
                    onCheckedChange={(val) => setForm({ ...form, manage_stock: val })}
                    data-testid="product-manage-stock-switch"
                  />
                </div>

                {form.manage_stock && (
                  <div className="pt-2 border-t border-stone-200">
                    <Label className="text-xs font-semibold text-stone-700">Quantidade Disponível em Estoque (un)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.stock_quantity}
                      onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) || 0 })}
                      className="mt-1 bg-white"
                      placeholder="Ex: 30"
                      data-testid="product-stock-quantity-input"
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Descrição</Label>
                  <button
                    type="button"
                    onClick={generateDescription}
                    disabled={aiLoading}
                    data-testid="ai-generate-description-btn"
                    className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-[#C5533B] to-[#D99A45] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    <Sparkle size={12} weight="fill" />
                    {aiLoading ? "Gerando..." : "Gerar com IA"}
                  </button>
                </div>
                <Textarea data-testid="product-description-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ingredientes, porção, etc." />
              </div>

              {/* Additionals */}
              <div className="border-t border-stone-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-stone-800">Adicionais</Label>
                    <p className="text-xs text-stone-500">Opções extras com preço (ex: ovo frito, bacon, queijo)</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addAdditional} data-testid="add-additional-btn">
                    <Plus size={14} className="mr-1" /> Adicional
                  </Button>
                </div>
                {form.additionals?.length > 0 && (
                  <ul className="space-y-2">
                    {form.additionals.map((a, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Input
                          placeholder="Nome (ex: Bacon)"
                          value={a.name}
                          onChange={(e) => updateAdditional(idx, "name", e.target.value)}
                          data-testid={`additional-name-${idx}`}
                          className="flex-1"
                        />
                        <Input
                          placeholder="R$"
                          type="number"
                          step="0.01"
                          value={a.price}
                          onChange={(e) => updateAdditional(idx, "price", e.target.value)}
                          data-testid={`additional-price-${idx}`}
                          className="w-24"
                        />
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeAdditional(idx)} className="h-9 w-9 text-[#B94B4B]">
                          <Trash size={16} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-stone-200 pt-4">
                <Label htmlFor="active-switch">Disponível para venda</Label>
                <Switch id="active-switch" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button data-testid="save-product-btn" onClick={save} disabled={saving} className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card className="border-stone-200 shadow-sm">
          <CardContent className="p-12 text-center">
            <Package size={40} weight="duotone" className="mx-auto text-stone-400 mb-3" />
            <h3 className="font-display text-lg font-medium text-stone-700">Nenhum produto cadastrado</h3>
            <p className="text-sm text-stone-500 mb-4">Adicione marmitas, bebidas e acompanhamentos.</p>
            <Button onClick={openCreate} className="bg-[#C5533B] hover:bg-[#A6432E] text-white">
              <Plus size={18} weight="bold" className="mr-1.5" />
              Criar primeiro produto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products.map((p, i) => (
            <Card key={p.product_id} data-testid={`product-card-${p.product_id}`} className="border-stone-200 shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
              <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
                <AuthImage
                  src={p.image_url}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  fallback={FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                />
                {!p.active ? (
                  <div className="absolute top-2 right-2 text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-[#B94B4B] text-white font-semibold shadow-sm">
                    Pausado / Esgotado
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-600/90 text-white font-semibold shadow-sm">
                    Disponível
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">{p.category}</div>
                  {/* Quick toggle switch for pausing/activating dish */}
                  <div className="flex items-center gap-1.5" title="Pausar produto esgotado">
                    <span className="text-[10px] text-stone-500 font-medium">Disponível</span>
                    <Switch
                      checked={p.active}
                      onCheckedChange={(checked) => toggleProductActive(p, { stopPropagation: () => {} })}
                      className="scale-75 origin-right"
                      data-testid={`toggle-product-${p.product_id}`}
                    />
                  </div>
                </div>

                <h3 className="font-display font-semibold text-stone-900 truncate">{p.name}</h3>
                {p.description && <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">{p.description}</p>}

                {/* Synonyms badge */}
                {p.synonyms && (
                  <div className="flex items-center gap-1 text-[11px] text-stone-500 bg-stone-100 rounded px-1.5 py-0.5 truncate">
                    <Robot size={12} className="text-[#C5533B] shrink-0" />
                    <span className="truncate">IA: {p.synonyms}</span>
                  </div>
                )}

                {/* Stock badge if managed */}
                {p.manage_stock && (
                  <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium bg-stone-50 border border-stone-200 rounded px-2 py-0.5 w-fit">
                    <Package size={13} className="text-[#C5533B]" />
                    <span>Estoque: <strong>{p.stock_quantity || 0}</strong> un</span>
                  </div>
                )}

                {/* Price or Sizes */}
                <div className="pt-2 border-t border-stone-100 flex items-end justify-between">
                  <div>
                    {p.has_sizes && p.sizes ? (
                      <div className="space-y-0.5">
                        <div className="text-[10px] uppercase font-semibold text-stone-400">Tamanhos:</div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#C5533B]">
                          {p.sizes.P > 0 && <span>P: {BRL.format(p.sizes.P)}</span>}
                          {p.sizes.M > 0 && <span>M: {BRL.format(p.sizes.M)}</span>}
                          {p.sizes.G > 0 && <span>G: {BRL.format(p.sizes.G)}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="font-display text-xl font-semibold text-[#C5533B]">{BRL.format(p.price)}</div>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button data-testid={`edit-product-${p.product_id}`} size="icon" variant="ghost" onClick={() => openEdit(p)} className="h-8 w-8 hover:bg-stone-100">
                      <PencilSimple size={16} />
                    </Button>
                    <Button data-testid={`delete-product-${p.product_id}`} size="icon" variant="ghost" onClick={() => remove(p)} className="h-8 w-8 text-[#B94B4B] hover:bg-[#FCEDED]">
                      <Trash size={16} />
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
