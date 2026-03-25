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
  price: number;
  old_price: number;
  discount: number;
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

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const data = await apiFetch<any[]>("/products");

      return data
        .map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price ?? 0),
          old_price: Number(item.old_price ?? 0),
          discount: Number(item.discount ?? 0),
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
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category_id === activeCategory);
  }, [products, activeCategory]);

  const activeCategoryName =
    activeCategory === "all"
      ? "Todos os Produtos"
      : categories.find((c) => c.id === activeCategory)?.name ?? "Produtos";

  return (
    <div className="min-h-screen bg-background">
      <StoreNavbar />
      <HeroSection />
      <CartSidebar />

      <div id="store" className="mx-auto max-w-7xl px-4 py-8">
        <CategoryTabs activeCategory={activeCategory} onSelectCategory={setActiveCategory} />

        <div className="mt-4 flex gap-8">
          <CategorySidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} />

          <div className="flex-1">
            <h2 className="mb-4 font-display text-2xl tracking-wide text-foreground">
              {activeCategoryName}
            </h2>

            {filteredProducts.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhum produto encontrado nesta categoria.
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