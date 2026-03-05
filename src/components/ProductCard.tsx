import { ShoppingCart } from "lucide-react";
import type { Product } from "@/data/products";

type Props = {
  product: Product;
};

const ProductCard = ({ product }: Props) => {
  const formatPrice = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="group card-gradient overflow-hidden rounded-lg border border-border transition-all hover:border-primary/40 hover:shadow-lg">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {product.tag && (
          <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            {product.tag}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2">
          {product.name}
        </h3>

        <div className="mt-3 flex items-baseline gap-2">
          {product.oldPrice && (
            <span className="text-xs text-old-price line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
          {product.discount && (
            <span className="text-xs font-bold text-discount">
              ↘ {product.discount}% OFF
            </span>
          )}
        </div>

        <p className="mt-1 font-display text-2xl text-foreground">
          {formatPrice(product.price)}
        </p>
        <p className="text-xs text-muted-foreground">À vista no Pix</p>

        <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]">
          <ShoppingCart className="h-4 w-4" />
          Comprar agora
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
