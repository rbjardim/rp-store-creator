import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type StoreSettings = {
  store_name?: string;
  logo_url?: string;
};

const StoreFooter = () => {
  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["store-settings"],
    queryFn: async () => {
      return apiFetch<StoreSettings>("/settings");
    },
  });

  const storeName = settings?.store_name || "Campo Limpo Roleplay";
  const logoUrl = settings?.logo_url || "";

  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <div className="flex items-center justify-center mb-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={storeName}
              className="h-16 object-contain"
            />
          ) : (
            <img
              src="/logocl.png"
              alt={storeName}
              className="h-16 object-contain"
            />
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          © {storeName}. Todos os direitos reservados. - 1.0.0.0126
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Este site não é afiliado à Rockstar Games ou Take-Two Interactive.
        </p>
      </div>
    </footer>
  );
};

export default StoreFooter;