import { useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { API_URL } from "@/lib/api";

type Props = {
  product: {
    id: string;
    name: string;
    description?: string | null;
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

  const base = API_URL.replace(/\/api$/, "");
  return `${base}${imageUrl}`;
};

const ProductCard = ({ product }: Props) => {
  const { addItem } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  const formatPrice = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const imageSrc = getImageUrl(product.image_url);

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: imageSrc,
    });
  };

  return (
    <>
      <div className="group card-gradient flex h-full flex-col overflow-hidden rounded-lg border border-border transition-all hover:border-accent/40 hover:shadow-lg">

        {/* IMAGEM CLICÁVEL */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative aspect-square shrink-0 overflow-hidden bg-secondary text-left"
        >
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
        </button>

        <div className="flex flex-1 flex-col p-4">

          {/* NOME TAMBÉM CLICÁVEL */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="text-left"
          >
            <h3 className="text-sm font-bold leading-tight text-foreground hover:text-accent">
              {product.name}
            </h3>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="mt-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clique para ver os detalhes
          </button>

          <div className="mt-auto pt-3">
            <div className="flex items-baseline gap-2">
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

            <p className="text-xs text-muted-foreground">
              À vista no Pix
            </p>

            <button
              type="button"
              onClick={handleAddToCart}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <ShoppingCart className="h-4 w-4" />
              Comprar agora
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE DETALHES */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid md:grid-cols-2">
              <div className="relative bg-secondary">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={product.name}
                    className="h-full min-h-[300px] w-full object-cover"
                  />
                ) : (
                  <div className="flex min-h-[300px] items-center justify-center">
                    <ShoppingCart className="h-16 w-16 opacity-20" />
                  </div>
                )}

                {product.tag && (
                  <span className="absolute left-3 top-3 rounded bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                    {product.tag}
                  </span>
                )}
              </div>

              <div className="flex flex-col p-6">
                <h2 className="font-display text-2xl text-foreground">
                  {product.name}
                </h2>

                <div className="mt-4 flex-1">
                  <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {product.description || "Sem descrição disponível."}
                  </p>
                </div>

                <div className="mt-6">
                  <div className="flex items-baseline gap-2">
                    {product.old_price && (
                      <span className="text-sm line-through text-old-price">
                        {formatPrice(product.old_price)}
                      </span>
                    )}

                    {product.discount && (
                      <span className="text-sm font-bold text-discount">
                        ↘ {product.discount}% OFF
                      </span>
                    )}
                  </div>

                  <p className="mt-1 font-display text-3xl text-foreground">
                    {formatPrice(product.price)}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    À vista no Pix
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      handleAddToCart();
                      setIsOpen(false);
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 text-sm font-semibold text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Comprar agora
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductCard;