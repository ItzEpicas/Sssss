import React from 'react';
import { ShoppingCart, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShopItem, useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

interface ProductCardProps {
  item: ShopItem;
}

const ProductCard: React.FC<ProductCardProps> = ({ item }) => {
  const { addToCart } = useCart();
  const { language, t } = useLanguage();

  const categoryKey = `shop.category.${item.category}`;
  const translatedCategory = t(categoryKey);
  const categoryLabel =
    item.categoryName ??
    (translatedCategory === categoryKey ? item.category : translatedCategory);

  const handleAddToCart = () => {
    addToCart(item);
    toast({
      title: language === 'ka' ? 'დაემატა კალათაში!' : 'Added to cart!',
      description: language === 'ka' ? item.nameKa : item.name,
    });
  };

  return (
    <div className="group relative glass-card rounded-xl overflow-hidden hover:box-glow transition-all duration-300">
      {/* Popular Badge */}
      {item.popular && (
        <Badge className="absolute top-3 left-3 z-10 bg-primary/90 text-primary-foreground">
          <Star className="w-3 h-3 mr-1 fill-current" />
          {language === 'ka' ? 'პოპულარული' : 'Popular'}
        </Badge>
      )}

      {/* Image */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={item.image}
          alt={language === 'ka' ? item.nameKa : item.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Category Badge */}
        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
          {categoryLabel}
        </Badge>

        {/* Name */}
        <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {language === 'ka' ? item.nameKa : item.name}
        </h3>

        {/* Description */}
        <p className="text-muted-foreground text-sm line-clamp-2">
          {language === 'ka' ? item.descriptionKa : item.description}
        </p>

        {/* Price & Add to Cart */}
        <div className="flex items-center justify-between pt-2">
          <span className="font-display font-bold text-xl text-primary">
            {t('shop.currency')}{item.price.toFixed(2)}
          </span>
          <Button
            size="sm"
            onClick={handleAddToCart}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <ShoppingCart className="w-4 h-4 mr-1" />
            {t('shop.buy')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
