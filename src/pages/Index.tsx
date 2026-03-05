import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StoreNavbar from "@/components/StoreNavbar";
import HeroSection from "@/components/HeroSection";
import CategorySidebar from "@/components/CategorySidebar";
import CategoryTabs from "@/components/CategoryTabs";
import ProductCard from "@/components/ProductCard";
import StoreFooter from "@/components/StoreFooter";
import CartSidebar from "@/components/CartSidebar";

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category_id === activeCategory);
  }, [products, activeCategory]);

  const activeCategoryName =
    activeCategory === "all"
      ? "Todos os Produtos"
      : categories?.find((c) => c.id === activeCategory)?.name ?? "Produtos";

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
            <h2 className="mb-4 font-display text-2xl tracking-wide text-foreground">{activeCategoryName}</h2>
            {filteredProducts.length === 0 ? (
              <p className="text-muted-foreground">Nenhum produto encontrado nesta categoria.</p>
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
