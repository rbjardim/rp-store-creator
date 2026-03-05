import { categories } from "@/data/products";

type Props = {
  activeCategory: string;
  onSelectCategory: (id: string) => void;
};

const CategoryTabs = ({ activeCategory, onSelectCategory }: Props) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden scrollbar-none">
      <button
        onClick={() => onSelectCategory("all")}
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          activeCategory === "all"
            ? "bg-primary text-primary-foreground"
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
              ? "bg-primary text-primary-foreground"
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
