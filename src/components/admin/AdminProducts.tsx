import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Pencil, Trash2, Plus, Upload } from "lucide-react";

const AdminProducts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    price: "",
    old_price: "",
    discount: "",
    tag: "",
    category_id: "",
    active: true,
    sort_order: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `products/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let image_url: string | undefined;
      if (imageFile) {
        image_url = await uploadImage(imageFile);
      }

      const payload: any = {
        name: form.name,
        price: parseFloat(form.price),
        old_price: form.old_price ? parseFloat(form.old_price) : null,
        discount: form.discount ? parseInt(form.discount) : null,
        tag: form.tag || null,
        category_id: form.category_id || null,
        active: form.active,
        sort_order: form.sort_order,
      };
      if (image_url) payload.image_url = image_url;

      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      resetForm();
      toast({ title: "Sucesso", description: editId ? "Produto atualizado" : "Produto criado" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto removido" });
    },
  });

  const resetForm = () => {
    setEditId(null);
    setShowForm(false);
    setImageFile(null);
    setForm({ name: "", price: "", old_price: "", discount: "", tag: "", category_id: "", active: true, sort_order: 0 });
  };

  const startEdit = (p: any) => {
    setEditId(p.id);
    setShowForm(true);
    setForm({
      name: p.name,
      price: String(p.price),
      old_price: p.old_price ? String(p.old_price) : "",
      discount: p.discount ? String(p.discount) : "",
      tag: p.tag || "",
      category_id: p.category_id || "",
      active: p.active,
      sort_order: p.sort_order,
    });
  };

  const formatPrice = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground">Gerenciar Produtos</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 card-gradient rounded-lg border border-border p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">{editId ? "Editar Produto" : "Novo Produto"}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nome *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Preço (R$) *</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Preço Antigo (R$)</label>
              <input type="number" step="0.01" value={form.old_price} onChange={(e) => setForm({ ...form, old_price: e.target.value })}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Desconto (%)</label>
              <input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tag</label>
              <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="🔥 NOVO"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Categoria</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                <option value="">Sem categoria</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Ordem</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Imagem</label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-secondary px-3 py-2 text-sm text-muted-foreground hover:border-primary">
                <Upload className="h-4 w-4" />
                {imageFile ? imageFile.name : "Escolher imagem"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded" />
                Ativo
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.price}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {editId ? "Salvar" : "Criar"}
            </button>
            <button onClick={resetForm} className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {products?.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-md border border-border bg-card px-4 py-3">
              {p.image_url && (
                <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground truncate">{p.name}</span>
                  {!p.active && <span className="text-xs text-muted-foreground">(inativo)</span>}
                  {p.tag && <span className="text-xs text-highlight">{p.tag}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatPrice(p.price)}</span>
                  {p.categories && <span>• {(p.categories as any).name}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(p)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => deleteMutation.mutate(p.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {products?.length === 0 && <p className="text-muted-foreground">Nenhum produto cadastrado.</p>}
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
