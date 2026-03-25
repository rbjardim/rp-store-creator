import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { API_URL } from "@/lib/api";

type Props = {
  product: {
    id: string;
    name: string;
    price: number;
    old_price: number | null;
    discount: number | null;
    image_url: string | null;
    tag: string | null;
  };
};

const getImageUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return "";

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  return `${API_URL}${imageUrl}`;
};

const ProductCard = ({ product }: Props) => {
  const { addItem } = useCart();

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const imageSrc = getImageUrl(product.image_url);

  return (
    <div className="group card-gradient overflow-hidden rounded-lg border border-border transition-all hover:border-accent/40 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 opacity-20" />
          </div>
        )}
        {product.tag && (
          <span className="absolute left-2 top-2 rounded bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
            {product.tag}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
          {product.name}
        </h3>

        <div className="mt-3 flex items-baseline gap-2">
          {product.old_price && (
            <span className="text-xs line-through text-old-price">
              {formatPrice(product.old_price)}
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

        <button
          onClick={() =>
            addItem({
              id: product.id,
              name: product.name,
              price: product.price,
              image_url: imageSrc,
            })
          }
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <ShoppingCart className="h-4 w-4" />
          Comprar agora
        </button>
      </div>
    </div>
  );
};

export default ProductCard;