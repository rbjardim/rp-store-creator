import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { Settings, Save } from "lucide-react";

const AdminSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<any>("/settings"),
  });

  const [bannerText, setBannerText] = useState("");

  useEffect(() => {
    if (settings) {
      setBannerText(settings.banner_text || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify({
          banner_text: bannerText,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              <Settings className="h-6 w-6 text-red-500" />
              Configurações da Loja
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Apenas o texto do banner pode ser alterado.
            </p>
          </div>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>

      <div className="card-gradient rounded-lg border border-border p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-400">Nome da Loja</label>
            <input
              type="text"
              value={settings?.store_name || ""}
              disabled
              className="cursor-not-allowed rounded-md border border-border bg-zinc-800 px-3 py-2 text-zinc-400 opacity-80"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-400">URL da Logo</label>
            <input
              type="text"
              value={settings?.logo_url || ""}
              disabled
              className="cursor-not-allowed rounded-md border border-border bg-zinc-800 px-3 py-2 text-zinc-400 opacity-80"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm text-zinc-400">Texto do Banner</label>
            <textarea
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              rows={4}
              placeholder="Digite o texto do banner"
              className="rounded-md border border-border bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {isLoading && (
          <p className="mt-4 text-sm text-zinc-400">Carregando configurações...</p>
        )}

        {saveMutation.isSuccess && (
          <p className="mt-4 text-sm text-emerald-400">
            Configuração salva com sucesso.
          </p>
        )}

        {saveMutation.isError && (
          <p className="mt-4 text-sm text-red-400">
            Erro ao salvar configurações.
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;