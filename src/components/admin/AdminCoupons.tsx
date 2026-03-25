import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, TicketPercent, Trash2, Pencil, X } from "lucide-react";
import { useState } from "react";

type Coupon = {
  id: string;
  code: string;
  discount_percent: number;
  active: boolean;
  created_at?: string;
};

type CouponForm = {
  code: string;
  discount_percent: string;
  active: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  discount_percent: "",
  active: true,
};

const AdminCoupons = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    "";

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

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

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => authFetch(`${API_URL}/coupons`),
  });

  const resetForm = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (coupon: Coupon) => {
    setEditId(coupon.id);
    setForm({
      code: coupon.code,
      discount_percent: String(coupon.discount_percent),
      active: coupon.active,
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.code.trim()) {
        throw new Error("Informe o código do cupom.");
      }

      if (!form.discount_percent || Number(form.discount_percent) <= 0) {
        throw new Error("Informe um desconto válido.");
      }

      const payload = {
        code: form.code.trim().toUpperCase(),
        discount_percent: Number(form.discount_percent),
        active: form.active,
      };

      const url = editId
        ? `${API_URL}/coupons/${editId}`
        : `${API_URL}/coupons`;

      const method = editId ? "PUT" : "POST";

      return authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({
        title: "Sucesso",
        description: editId ? "Cupom atualizado com sucesso." : "Cupom criado com sucesso.",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Não foi possível salvar o cupom.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return authFetch(`${API_URL}/coupons/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({
        title: "Cupom removido",
        description: "O cupom foi excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error?.message || "Não foi possível excluir o cupom.",
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
              <TicketPercent className="h-6 w-6 text-red-500" />
              Gerenciar Cupons
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Crie cupons de Desconto.
            </p>
          </div>

          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <Plus className="h-4 w-4" />
            Novo Cupom
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                {editId ? "Editar Cupom" : "Cadastrar Cupom"}
              </h3>
              <p className="text-sm text-zinc-400">
                Preencha as informações do cupom abaixo.
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Código do cupom *
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Ex: BEMVINDO10"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Desconto (%) *
              </label>
              <input
                type="number"
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                placeholder="Ex: 10"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              />
            </div>

            <div className="flex items-center pt-2">
              <label className="inline-flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-white/10 bg-zinc-950 text-red-600"
                />
                Cupom ativo
              </label>
            </div>
          </div>

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
                : "Criar cupom"}
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
          <h3 className="text-lg font-bold text-white">Lista de cupons</h3>
          <span className="text-sm text-zinc-400">{coupons.length} cupom(ns)</span>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-zinc-950 p-6 text-sm text-zinc-400">
            Carregando cupons...
          </div>
        ) : coupons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950 p-8 text-center">
            <TicketPercent className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
            <p className="text-sm text-zinc-400">Nenhum cupom cadastrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="rounded-2xl border border-white/10 bg-zinc-950 p-4 transition hover:border-red-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-white">{coupon.code}</h4>
                    <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                      <span>{coupon.discount_percent}% OFF</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] ${
                          coupon.active
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {coupon.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditForm(coupon)}
                      className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-zinc-300 transition hover:border-blue-500/40 hover:bg-zinc-800 hover:text-white"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => deleteMutation.mutate(coupon.id)}
                      className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-zinc-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

export default AdminCoupons;