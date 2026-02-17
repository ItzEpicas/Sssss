import React from 'react';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

interface CartSheetProps {
  children: React.ReactNode;
}

const CartSheet: React.FC<CartSheetProps> = ({ children }) => {
  const { items, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const handleCheckout = () => {
    navigate('/checkout');
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border">
        <SheetHeader>
          <SheetTitle className="font-display text-foreground flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            {language === 'ka' ? 'კალათა' : 'Cart'}
            {totalItems > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalItems}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {language === 'ka'
              ? 'ნახეთ კალათის შიგთავსი და გადადით გადახდაზე.'
              : 'Review the items in your cart and proceed to checkout.'}
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
            <ShoppingBag className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">
              {language === 'ka' ? 'კალათა ცარიელია' : 'Your cart is empty'}
            </p>
            <p className="text-sm mt-2">
              {language === 'ka' ? 'დაამატე პროდუქტები მაღაზიიდან' : 'Add items from the shop'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 -mx-6 px-6 py-4">
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-3 rounded-lg bg-background/50 border border-border/50"
                  >
                    {/* Image */}
                    <img
                      src={item.image}
                      alt={language === 'ka' ? item.nameKa : item.name}
                      className="w-20 h-20 object-cover rounded-md"
                    />

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">
                        {language === 'ka' ? item.nameKa : item.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {t('shop.currency')}{item.price.toFixed(2)}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="mt-auto pt-4 space-y-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {language === 'ka' ? 'ჯამი:' : 'Total:'}
                </span>
                <span className="font-display font-bold text-2xl text-primary">
                  {t('shop.currency')}{totalPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={clearCart}
                >
                  {language === 'ka' ? 'გასუფთავება' : 'Clear'}
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={handleCheckout}
                >
                  {language === 'ka' ? 'გადახდა' : 'Checkout'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartSheet;
