import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Package,
  Tag,
  DollarSign,
  ImageIcon,
  X,
  Save,
  Upload,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug?: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  old_price?: number | null;
  discount?: number | null;
  tag?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  image_url?: string | null;
  active?: boolean;
  sort_order?: number;
  description?: string | null;
};

type ProductForm = {
  name: string;
  price: string;
  old_price: string;
  discount: string;
  tag: string;
  category_id: string;
  active: boolean;
  sort_order: number;
  description: string;
  existingImageUrl: string;
};

const emptyForm: ProductForm = {
  name: "",
  price: "",
  old_price: "",
  discount: "",
  tag: "",
  category_id: "",
  active: true,
  sort_order: 0,
  description: "",
  existingImageUrl: "",
};

const getImageUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return "";

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  return `${API_URL}${imageUrl}`; // ✅ CORRETO
};

const AdminProducts = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const getToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  };

  const authFetch = async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
    const token = getToken();

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || "Erro na requisição.");
    }

    return data;
  };

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => apiFetch<Product[]>("/products"),
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiFetch<Category[]>("/categories"),
  });

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [String(c.id), c.name]));
  }, [categories]);

  const formatPrice = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "R$ 0,00";
    }

    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const resetForm = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(false);
    setSelectedFile(null);
    setPreviewUrl("");
  };

  const openCreateForm = () => {
    setEditId(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setPreviewUrl("");
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditId(product.id);

    setForm({
      name: product.name ?? "",
      price: product.price != null ? String(product.price) : "",
      old_price: product.old_price != null ? String(product.old_price) : "",
      discount: product.discount != null ? String(product.discount) : "",
      tag: product.tag ?? "",
      category_id: product.category_id != null ? String(product.category_id) : "",
      active: product.active ?? true,
      sort_order: product.sort_order ?? 0,
      description: product.description ?? "",
      existingImageUrl: product.image_url ?? "",
    });

    setSelectedFile(null);
    setPreviewUrl(product.image_url ?? "");
    setShowForm(true);
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);

    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(form.existingImageUrl || "");
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("Informe o nome do produto.");
      }

      if (!form.price || Number(form.price) <= 0) {
        throw new Error("Informe um preço válido.");
      }

      const body = new FormData();
      body.append("name", form.name.trim());
      body.append("price", String(Number(form.price)));
      body.append("old_price", form.old_price ? String(Number(form.old_price)) : "");
      body.append("discount", form.discount ? String(Number(form.discount)) : "");
      body.append("tag", form.tag.trim());
      body.append("category_id", form.category_id || "");
      body.append("active", String(form.active));
      body.append("sort_order", String(Number(form.sort_order) || 0));
      body.append("description", form.description.trim());

      // ajuda o backend a saber se deve manter a imagem atual ao editar
      body.append("keep_image", selectedFile ? "false" : "true");

      if (selectedFile) {
        body.append("image", selectedFile, selectedFile.name);
      }

      const url = editId ? `${API_URL}/products/${editId}` : `${API_URL}/products`;
      const method = editId ? "PUT" : "POST";

      return authFetch(url, {
        method,
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });

      toast({
        title: "Sucesso",
        description: editId
          ? "Produto atualizado com sucesso."
          : "Produto criado com sucesso.",
      });

      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Não foi possível salvar o produto.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return authFetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });

      toast({
        title: "Produto removido",
        description: "O produto foi excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error?.message || "Não foi possível excluir o produto.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              <Package className="h-6 w-6 text-red-500" />
              Gerenciar Produtos
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Cadastre, edite e organize os produtos.
            </p>
          </div>

          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                {editId ? "Editar Produto" : "Cadastrar Produto"}
              </h3>
              <p className="text-sm text-zinc-400">
                Preencha as informações do produto abaixo.
              </p>
            </div>

            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
            >
              <X className="h-4 w-4" />
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Nome do produto *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: VIP Ouro"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Preço atual *
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Preço antigo
              </label>
              <input
                type="number"
                step="0.01"
                value={form.old_price}
                onChange={(e) => setForm({ ...form, old_price: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Desconto (%)
              </label>
              <input
                type="number"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                placeholder="Ex: 20"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Tag
              </label>
              <div className="relative">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  placeholder="Ex: MAIS VENDIDO"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Categoria
              </label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Imagem do produto
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-zinc-950 px-4 py-4 text-sm text-zinc-300 transition hover:border-red-500/40">
                <Upload className="h-5 w-5 text-red-400" />
                <span>
                  {selectedFile
                    ? selectedFile.name
                    : form.existingImageUrl
                    ? "Imagem atual carregada. Clique para trocar."
                    : "Clique para anexar uma imagem"}
                </span>

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Ordem
              </label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: Number(e.target.value) || 0 })
                }
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              />
            </div>

            <div className="flex items-center pt-8">
              <label className="inline-flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-white/10 bg-zinc-950 text-red-600"
                />
                Produto ativo
              </label>
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Descrição
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Descrição do produto..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              />
            </div>
          </div>

          {previewUrl && (
            <div className="mt-5">
              <p className="mb-2 text-sm text-zinc-400">Pré-visualização da imagem</p>
              <img
                src={previewUrl.startsWith("blob:") ? previewUrl : getImageUrl(previewUrl)}
                alt="Prévia"
                className="h-32 w-32 rounded-xl border border-white/10 object-cover"
              />
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending
                ? "Salvando..."
                : editId
                ? "Salvar alterações"
                : "Criar produto"}
            </button>

            <button
              onClick={resetForm}
              className="rounded-xl border border-white/10 bg-zinc-800 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Lista de produtos</h3>
          <span className="text-sm text-zinc-400">{products.length} produto(s)</span>
        </div>

        {loadingProducts || loadingCategories ? (
          <div className="rounded-xl border border-white/10 bg-zinc-950 p-6 text-sm text-zinc-400">
            Carregando produtos...
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950 p-8 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
            <p className="text-sm text-zinc-400">Nenhum produto cadastrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="group rounded-2xl border border-white/10 bg-zinc-950 p-4 transition hover:border-red-500/40"
              >
                <div className="flex gap-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                    {product.image_url ? (
                      <img
                        src={getImageUrl(product.image_url)}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-600">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="truncate text-base font-bold text-white">
                          {product.name}
                        </h4>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <span>
                            {categoryMap.get(String(product.category_id || "")) ||
                              product.category_name ||
                              "Sem categoria"}
                          </span>

                          {!product.active && (
                            <span className="rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300">
                              Inativo
                            </span>
                          )}

                          {product.tag && (
                            <span className="rounded-full bg-red-600/15 px-2 py-1 text-[11px] font-medium text-red-400">
                              {product.tag}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditForm(product)}
                          className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-zinc-300 transition hover:border-blue-500/40 hover:bg-zinc-800 hover:text-white"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => deleteMutation.mutate(product.id)}
                          className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-zinc-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <div>
                        <p className="text-lg font-bold text-white">
                          {formatPrice(product.price)}
                        </p>
                        {product.old_price ? (
                          <p className="text-xs text-zinc-500 line-through">
                            {formatPrice(product.old_price)}
                          </p>
                        ) : null}
                      </div>

                      {product.discount ? (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                          -{product.discount}%
                        </span>
                      ) : null}
                    </div>

                    {product.description && (
                      <p className="mt-3 line-clamp-2 text-sm text-zinc-400">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProducts;