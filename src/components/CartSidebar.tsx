import { X, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const CartSidebar = () => {
  const { items, removeItem, updateQuantity, total, itemCount, isOpen, setIsOpen, clearCart } = useCart();

  const formatPrice = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="font-display text-xl text-foreground">Carrinho ({itemCount})</h2>
          <button onClick={() => setIsOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
            <p>Carrinho vazio</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-md border border-border bg-background p-3">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{formatPrice(item.price)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="rounded bg-secondary p-1 text-foreground hover:bg-accent">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm text-foreground">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="rounded bg-secondary p-1 text-foreground hover:bg-accent">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-4">
              <div className="mb-3 flex justify-between text-foreground">
                <span className="font-semibold">Total:</span>
                <span className="font-display text-xl">{formatPrice(total)}</span>
              </div>
              <button className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90">
                Finalizar Compra
              </button>
              <button onClick={clearCart} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Limpar carrinho
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CartSidebar;
