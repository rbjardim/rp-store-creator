import { ShoppingCart, Search } from "lucide-react";
import { useState } from "react";

const StoreNavbar = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      {/* Top banner */}
      <div className="bg-primary py-2 text-center">
        <p className="text-sm font-semibold text-primary-foreground">
          Novos pacotes e recompensas exclusivas! Aproveite os descontos de inauguração 🎉
        </p>
      </div>

      {/* Main nav */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary font-display text-xl text-primary-foreground">
            CL
          </div>
          <span className="font-display text-2xl tracking-wide text-foreground">
            Campo Limpo Roleplay
          </span>
        </div>

        {/* Search */}
        <div className="hidden flex-1 max-w-md mx-8 md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Cart */}
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95">
          <ShoppingCart className="h-4 w-4" />
          <span>Carrinho</span>
        </button>
      </div>
    </nav>
  );
};

export default StoreNavbar;
