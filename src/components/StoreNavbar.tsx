import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type StoreSettings = {
  store_name?: string;
  banner_text?: string;
  logo_url?: string;
};

const StoreNavbar = () => {
  const { itemCount, setIsOpen } = useCart();

  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["store-settings"],
    queryFn: async () => {
      return apiFetch<StoreSettings>("/settings");
    },
  });

  const storeName = settings?.store_name || "";
  const bannerText = settings?.banner_text || "";
  const logoUrl = settings?.logo_url || "";

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      {bannerText && (
        <div className="bg-accent py-2 text-center">
          <p className="text-sm font-semibold text-accent-foreground">{bannerText}</p>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={storeName}
              className="h-16 object-contain"
            />
          ) : (
            <>
              <img
                src="/logocl2.png"
                alt={storeName}
                className="h-16 object-contain"
              />
              <span className="font-display text-2xl tracking-wide text-foreground">
                {storeName}
              </span>
            </>
          )}
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground transition-all hover:opacity-90 active:scale-95"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Carrinho</span>
          {itemCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-highlight text-xs font-bold text-accent-foreground">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
};

export default StoreNavbar;