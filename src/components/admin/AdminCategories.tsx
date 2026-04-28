import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  FolderOpen,
  Search,
  X,
  ArrowUpDown,
} from "lucide-react";

const AdminCategories = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("order-asc");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      return apiFetch<any[]>("/categories");
    },
  });

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let result = [...categories];

    if (term) {
      result = result.filter((cat) => {
        const catName = String(cat.name ?? "").toLowerCase();
        const catSlug = String(cat.slug ?? "").toLowerCase();
        const catOrder = String(cat.sort_order ?? "").toLowerCase();

        return (
          catName.includes(term) ||
          catSlug.includes(term) ||
          catOrder.includes(term)
        );
      });
    }

    if (sortBy === "order-asc") {
      result.sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    } else if (sortBy === "order-desc") {
      result.sort((a, b) => Number(b.sort_order ?? 0) - Number(a.sort_order ?? 0));
    } else if (sortBy === "name-asc") {
      result.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR"));
    } else if (sortBy === "name-desc") {
      result.sort((a, b) => String(b.name ?? "").localeCompare(String(a.name ?? ""), "pt-BR"));
    }

    return result;
  }, [categories, searchTerm, sortBy]);

  const clearFilters = () => {
    setSearchTerm("");
    setSortBy("order-asc");
  };

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

      {/* FILTROS */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <Search className="h-5 w-5 text-red-400" />
              Localizar categoria
            </h3>
            <p className="text-sm text-zinc-400">
              Pesquise por nome, slug ou ordem da categoria.
            </p>
          </div>

          <span className="text-sm text-zinc-400">
            {filteredCategories.length} de {categories.length} categoria(s)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o nome, slug ou ordem..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Ordenar por
            </label>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-red-500"
              >
                <option value="order-asc">Ordem crescente</option>
                <option value="order-desc">Ordem decrescente</option>
                <option value="name-asc">Nome A-Z</option>
                <option value="name-desc">Nome Z-A</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-transparent">
              Limpar
            </label>
            <button
              onClick={clearFilters}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {/* LISTA */}
      {isLoading ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950 p-6 text-sm text-zinc-400">
          Carregando categorias...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950 p-8 text-center">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
          <p className="text-sm text-zinc-400">
            Nenhuma categoria encontrada com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
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
