import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  activeCategory: string;
  onSelectCategory: (id: string) => void;
};

const CategoryTabs = ({ activeCategory, onSelectCategory }: Props) => {
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden scrollbar-none">
      <button
        onClick={() => onSelectCategory("all")}
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          activeCategory === "all" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
        }`}
      >
        Todos
      </button>
      {categories?.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            activeCategory === cat.id ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
};

export default CategoryTabs;
