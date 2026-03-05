import product1 from "@/assets/product-1.jpg";
import product2 from "@/assets/product-2.jpg";
import product3 from "@/assets/product-3.jpg";
import product4 from "@/assets/product-4.jpg";
import product5 from "@/assets/product-5.jpg";
import product6 from "@/assets/product-6.jpg";

export type Product = {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  image: string;
  category: string;
  tag?: string;
};

export type Category = {
  id: string;
  name: string;
  icon?: string;
};

export const categories: Category[] = [
  { id: "exclusivo", name: "Exclusivo do Mês" },
  { id: "blindados", name: "Blindados" },
  { id: "luxo", name: "Luxo" },
  { id: "cordoes", name: "Cordões" },
  { id: "combos", name: "Combos" },
  { id: "gemas", name: "Gemas" },
  { id: "vips", name: "Doações VIPs" },
  { id: "ilegal", name: "Ilegal" },
  { id: "exclusivos", name: "Exclusivos" },
  { id: "condominios", name: "Condomínios" },
  { id: "extras", name: "Extras" },
];

export const products: Product[] = [
  {
    id: "1",
    name: "🔥 G-WAGON BLINDADA (EXCLUSIVO)",
    price: 49.90,
    oldPrice: 69.90,
    discount: 29,
    image: product1,
    category: "exclusivo",
    tag: "🔥 NOVO",
  },
  {
    id: "2",
    name: "🔥 FERRARI SF90 (EXCLUSIVO)",
    price: 59.90,
    oldPrice: 79.90,
    discount: 25,
    image: product2,
    category: "exclusivo",
    tag: "🔥 NOVO",
  },
  {
    id: "3",
    name: "LAMBO HURACAN",
    price: 44.90,
    oldPrice: 54.90,
    discount: 18,
    image: product3,
    category: "luxo",
  },
  {
    id: "4",
    name: "CORDÃO DIAMANTE PREMIUM",
    price: 29.90,
    image: product4,
    category: "cordoes",
  },
  {
    id: "5",
    name: "MANSÃO ALPHAVILLE",
    price: 89.90,
    oldPrice: 119.90,
    discount: 25,
    image: product5,
    category: "condominios",
  },
  {
    id: "6",
    name: "VIP PREMIUM 30 DIAS",
    price: 34.90,
    image: product6,
    category: "vips",
    tag: "⭐ POPULAR",
  },
  {
    id: "7",
    name: "BLINDADO HILUX TÁTICA",
    price: 39.90,
    oldPrice: 49.90,
    discount: 20,
    image: product1,
    category: "blindados",
  },
  {
    id: "8",
    name: "COMBO INÍCIO DE CIDADE",
    price: 79.90,
    oldPrice: 129.90,
    discount: 38,
    image: product2,
    category: "combos",
    tag: "🔥 MELHOR CUSTO",
  },
];
