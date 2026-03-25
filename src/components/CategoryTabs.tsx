import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type Props = {
  activeCategory: string;
  onSelectCategory: (id: string) => void;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at?: string;
};

const CategoryTabs = ({ activeCategory, onSelectCategory }: Props) => {
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      return apiFetch<Category[]>("/categories");
    },
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden scrollbar-none">
      <button
        onClick={() => onSelectCategory("all")}
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          activeCategory === "all"
            ? "bg-accent text-accent-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        Todos
      </button>

      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            activeCategory === cat.id
              ? "bg-accent text-accent-foreground"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
};

export default CategoryTabs;