import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Save, Upload } from "lucide-react";

const AdminSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_settings").select("*");
      if (error) throw error;
      return Object.fromEntries(data.map((s) => [s.key, s.value]));
    },
  });

  const [form, setForm] = useState({
    store_name: "",
    banner_text: "",
    hero_title: "",
    hero_subtitle: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        store_name: settings.store_name || "",
        banner_text: settings.banner_text || "",
        hero_title: settings.hero_title || "",
        hero_subtitle: settings.hero_subtitle || "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upload logo if provided
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `logo/logo.${ext}`;
        await supabase.storage.from("store-assets").upload(path, logoFile, { upsert: true });
        const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
        await supabase.from("store_settings").update({ value: data.publicUrl }).eq("key", "logo_url");
      }

      // Update text settings
      for (const [key, value] of Object.entries(form)) {
        await supabase.from("store_settings").update({ value }).eq("key", key);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast({ title: "Configurações salvas!" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div>
      <h2 className="mb-4 font-display text-xl text-foreground">Configurações da Loja</h2>

      <div className="card-gradient rounded-lg border border-border p-6 space-y-4 max-w-2xl">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Nome da Loja</label>
          <input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Texto do Banner</label>
          <input value={form.banner_text} onChange={(e) => setForm({ ...form, banner_text: e.target.value })}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Título do Hero</label>
          <input value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Subtítulo do Hero</label>
          <input value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Logo</label>
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="Logo atual" className="mb-2 h-12 rounded" />
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-secondary px-3 py-2 text-sm text-muted-foreground hover:border-primary">
            <Upload className="h-4 w-4" />
            {logoFile ? logoFile.name : "Alterar logo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
        >
          <Save className="h-4 w-4" />
          Salvar Configurações
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;
