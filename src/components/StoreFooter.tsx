import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StoreFooter = () => {
  const { data: settings } = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_settings").select("*");
      if (error) throw error;
      return Object.fromEntries(data.map((s) => [s.key, s.value]));
    },
  });

  const storeName = settings?.store_name || "Campo Limpo Roleplay";
  const logoUrl = settings?.logo_url || "";

  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 rounded" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-accent font-display text-sm text-accent-foreground">CL</div>
          )}
          <span className="font-display text-xl tracking-wide text-foreground">{storeName}</span>
        </div>
        <p className="text-sm text-muted-foreground">© 2026 {storeName}. Todos os direitos reservados.</p>
        <p className="mt-1 text-xs text-muted-foreground">Este site não é afiliado à Rockstar Games ou Take-Two Interactive.</p>
      </div>
    </footer>
  );
};

export default StoreFooter;
