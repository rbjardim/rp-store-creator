import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import StoreNavbar from "@/components/StoreNavbar";
import HeroSection from "@/components/HeroSection";
import CategorySidebar from "@/components/CategorySidebar";
import CategoryTabs from "@/components/CategoryTabs";
import ProductCard from "@/components/ProductCard";
import StoreFooter from "@/components/StoreFooter";
import CartSidebar from "@/components/CartSidebar";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  old_price: number | null;
  discount: number | null;
  image_url: string;
  category_id?: string | null;
  tag: string;
  active: number;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("default");

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const data = await apiFetch<any[]>("/products");

      return data
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? null,
          price: Number(item.price ?? 0),
          old_price:
            item.old_price !== null &&
            item.old_price !== undefined &&
            item.old_price !== ""
              ? Number(item.old_price)
              : null,
          discount:
            item.discount !== null &&
            item.discount !== undefined &&
            item.discount !== ""
              ? Number(item.discount)
              : null,
          image_url: item.image_url ?? "",
          category_id: item.category_id ?? null,
          tag: item.tag ?? "",
          active: Number(item.active ?? 0),
        }))
        .filter((item) => item.active === 1);
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      return apiFetch<Category[]>("/categories");
    },
  });

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (activeCategory !== "all") {
      result = result.filter((p) => p.category_id === activeCategory);
    }

    if (minPrice !== "") {
      result = result.filter((p) => p.price >= Number(minPrice));
    }

    if (maxPrice !== "") {
      result = result.filter((p) => p.price <= Number(maxPrice));
    }

    if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "discount") {
      result.sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
    } else if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }

    return result;
  }, [products, activeCategory, minPrice, maxPrice, sortBy]);

  const activeCategoryName =
    activeCategory === "all"
      ? "Todos os Produtos"
      : categories.find((c) => c.id === activeCategory)?.name ?? "Produtos";

  const clearFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setSortBy("default");
  };

  return (
    <div className="min-h-screen bg-background">
      <StoreNavbar />
      <HeroSection />
      <CartSidebar />

      <div id="store" className="mx-auto max-w-7xl px-4 py-8">
        <CategoryTabs
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        <div className="mt-4 flex gap-8">
          <CategorySidebar
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />

          <div className="flex-1">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <h2 className="font-display text-2xl tracking-wide text-foreground">
                {activeCategoryName}
              </h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Preço mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Ex: 50"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Preço máximo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Ex: 500"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Ordenar por
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
                  >
                    <option value="default">Padrão</option>
                    <option value="price-asc">Menor preço</option>
                    <option value="price-desc">Maior preço</option>
                    <option value="discount">Maior desconto</option>
                    <option value="name">Nome A-Z</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-transparent">
                    Limpar
                  </label>
                  <button
                    onClick={clearFilters}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhum produto encontrado com os filtros selecionados.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <StoreFooter />
    </div>
  );
};

export default Index;