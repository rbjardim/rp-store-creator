import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Pencil, Trash2, Plus, FolderOpen } from "lucide-react";

const AdminCategories = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      return apiFetch<any[]>("/categories");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("token");

      const url = editId
        ? `${API_URL}/categories/${editId}`
        : `${API_URL}/categories`;

      const method = editId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          slug,
          sort_order: sortOrder,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao salvar categoria.");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      resetForm();
      setShowForm(false);

      toast({
        title: "Sucesso",
        description: editId ? "Categoria atualizada" : "Categoria criada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/categories/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao excluir categoria.");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoria removida" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir",
        variant: "destructive",
      });
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
    setShowForm(true);
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <div className="space-y-6">
      {/* HEADER BONITO */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              <FolderOpen className="h-6 w-6 text-red-500" />
              Gerenciar Categorias
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Cadastre, edite e organize as categorias.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <Plus className="h-4 w-4" />
            Nova Categoria
          </button>
        </div>
      </div>

      {/* FORM */}
      {showForm && (
        <div className="card-gradient rounded-lg border border-border p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">
            {editId ? "Editar Categoria" : "Nova Categoria"}
          </h3>

          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Nome"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editId) setSlug(generateSlug(e.target.value));
              }}
              className="flex-1 min-w-[200px] bg-gray-700 text-white border border-border rounded-md px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <input
              type="text"
              placeholder="Slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="min-w-[180px] bg-gray-700 text-white border border-border rounded-md px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-24 bg-gray-700 text-white border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <button
              onClick={() => saveMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 border border-border bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              <Plus size={16} />
              {editId ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {isLoading ? (
        <p>Carregando...</p>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{cat.name}</span>
                <span className="text-sm text-muted-foreground">
                  Slug: {cat.slug} • Ordem: {cat.sort_order}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(cat)}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent transition"
                >
                  <Pencil size={16} />
                  Editar
                </button>

                <button
                  onClick={() => deleteMutation.mutate(cat.id)}
                  className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition"
                >
                  <Trash2 size={16} />
                  Excluir
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