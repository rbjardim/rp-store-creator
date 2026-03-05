import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  activeCategory: string;
  onSelectCategory: (id: string) => void;
};

const CategorySidebar = ({ activeCategory, onSelectCategory }: Props) => {
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <aside className="hidden w-52 shrink-0 lg:block">
      <h3 className="mb-3 font-display text-lg tracking-wide text-muted-foreground">Categorias</h3>
      <ul className="space-y-1">
        <li>
          <button
            onClick={() => onSelectCategory("all")}
            className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
              activeCategory === "all" ? "bg-accent text-accent-foreground" : "text-secondary-foreground hover:bg-secondary"
            }`}
          >
            Todos
          </button>
        </li>
        {categories?.map((cat) => (
          <li key={cat.id}>
            <button
              onClick={() => onSelectCategory(cat.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeCategory === cat.id ? "bg-accent text-accent-foreground" : "text-secondary-foreground hover:bg-secondary"
              }`}
            >
              {cat.name}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default CategorySidebar;
