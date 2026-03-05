import { useState, useMemo } from "react";
import StoreNavbar from "@/components/StoreNavbar";
import HeroSection from "@/components/HeroSection";
import CategorySidebar from "@/components/CategorySidebar";
import CategoryTabs from "@/components/CategoryTabs";
import ProductCard from "@/components/ProductCard";
import StoreFooter from "@/components/StoreFooter";
import { products, categories } from "@/data/products";

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredProducts = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const activeCategoryName =
    activeCategory === "all"
      ? "Todos os Produtos"
      : categories.find((c) => c.id === activeCategory)?.name ?? "Produtos";

  return (
    <div className="min-h-screen bg-background">
      <StoreNavbar />
      <HeroSection />

      <div id="store" className="mx-auto max-w-7xl px-4 py-8">
        {/* Mobile tabs */}
        <CategoryTabs
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        <div className="mt-4 flex gap-8">
          {/* Sidebar */}
          <CategorySidebar
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />

          {/* Products */}
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
