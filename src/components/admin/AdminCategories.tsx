import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";

const AdminCategories = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("categories").update({ name, slug, sort_order: sortOrder }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ name, slug, sort_order: sortOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      resetForm();
      toast({ title: "Sucesso", description: editId ? "Categoria atualizada" : "Categoria criada" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoria removida" });
    },
  });

  const resetForm = () => {
    setEditId(null);
    setName("");
    setSlug("");
    setSortOrder(0);
  };

  const startEdit = (cat: any) => {
    setEditId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setSortOrder(cat.sort_order);
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <div>
      <h2 className="mb-4 font-display text-xl text-foreground">Gerenciar Categorias</h2>

      {/* Form */}
      <div className="mb-6 card-gradient rounded-lg border border-border p-4">
        <h3 className="mb-3 text-sm font-bold text-foreground">{editId ? "Editar Categoria" : "Nova Categoria"}</h3>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => { setName(e.target.value); if (!editId) setSlug(generateSlug(e.target.value)); }}
            className="flex-1 min-w-[200px] rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            placeholder="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-48 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="number"
            placeholder="Ordem"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-24 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name || !slug}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {editId ? "Salvar" : "Criar"}
          </button>
          {editId && (
            <button onClick={resetForm} className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent">
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {categories?.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
              <div>
                <span className="font-semibold text-foreground">{cat.name}</span>
                <span className="ml-3 text-xs text-muted-foreground">/{cat.slug}</span>
                <span className="ml-3 text-xs text-muted-foreground">Ordem: {cat.sort_order}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(cat)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => deleteMutation.mutate(cat.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
