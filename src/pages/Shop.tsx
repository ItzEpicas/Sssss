import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Sword, Heart, Swords, Filter, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/shop/ProductCard';
import CartSheet from '@/components/shop/CartSheet';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

type DbShopItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_featured: boolean | null;
  categories: {
    name: string;
    slug: string;
  } | null;
  gamemodes: {
    slug: string;
  } | null;
};

const gamemodeIcons = {
  survival: Sword,
  lifesteal: Heart,
  boxpvp: Swords,
};

const Shop: React.FC = () => {
  const [searchParams] = useSearchParams();
  const fallbackGamemode = searchParams.get('gamemode') || 'survival';
  const fallbackCategory = searchParams.get('category') || 'all';
  const [selectedGamemode, setSelectedGamemode] = useState(fallbackGamemode);
  const [selectedCategory, setSelectedCategory] = useState(fallbackCategory);

  const { totalItems } = useCart();
  const { t, language } = useLanguage();

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['shop-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_items')
        .select(
          'id, name, description, price, image_url, is_featured, gamemode_id, category_id, gamemodes(slug), categories(name,slug)',
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbShopItem[];
    },
    staleTime: 1000 * 60,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories', 'public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });

  const { data: gamemodesData } = useQuery({
    queryKey: ['gamemodes', 'public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gamemodes')
        .select('id, name, slug, is_active')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((gm) => gm.is_active !== false);
    },
  });

  useEffect(() => {
    if (
      gamemodesData &&
      !gamemodesData.some((gm) => gm.slug === selectedGamemode) &&
      gamemodesData.length > 0
    ) {
      setSelectedGamemode(gamemodesData[0].slug);
    }
  }, [gamemodesData, selectedGamemode]);

  useEffect(() => {
    if (!categoriesData || selectedCategory === 'all') return;
    if (!categoriesData.some((category) => category.slug === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [categoriesData, selectedCategory]);

  const mappedItems = useMemo(() => {
    if (!itemsData) return [];
    return itemsData.map((item) => ({
      id: item.id,
      name: item.name,
      nameKa: item.name,
      description: item.description ?? '',
      descriptionKa: item.description ?? '',
      price: item.price,
      image: item.image_url ?? '',
      category: item.categories?.slug ?? 'misc',
      categoryName: item.categories?.name ?? undefined,
      gamemode: item.gamemodes?.slug ?? 'survival',
      popular: Boolean(item.is_featured),
    }));
  }, [itemsData]);

  const filteredItems = useMemo(() => {
    return mappedItems.filter((item) => {
      const matchesGamemode = item.gamemode === selectedGamemode;
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;
      return matchesGamemode && matchesCategory;
    });
  }, [mappedItems, selectedGamemode, selectedCategory]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 gradient-radial opacity-40" />
        <div className="container mx-auto px-4 relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="font-display font-bold text-4xl md:text-5xl mb-3">
                <span className="text-primary">{t('shop.title')}</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl">
                {t('shop.subtitle')}
              </p>
            </div>

            {/* Cart Button */}
            <CartSheet>
              <Button
                size="lg"
                className="relative bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {language === 'ka' ? 'კალათა' : 'Cart'}
                {totalItems > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground px-2 py-0.5 text-xs">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </CartSheet>
          </div>
        </div>
      </section>

      {/* Gamemode Tabs */}
      <section className="container mx-auto px-4 pb-8">
        <Tabs value={selectedGamemode} onValueChange={setSelectedGamemode}>
          <TabsList className="w-full md:w-auto flex flex-wrap bg-muted/50 p-1 gap-1">
            {gamemodesData?.map((gamemode) => {
              const Icon =
                gamemodeIcons[gamemode.slug as keyof typeof gamemodeIcons] ??
                Gamepad2;
              return (
                <TabsTrigger
                  key={gamemode.id}
                  value={gamemode.slug}
                  className="data-[state=active]:bg-card data-[state=active]:text-foreground gap-2"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{gamemode.name}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 mt-6">
            <Filter className="w-5 h-5 text-muted-foreground mr-2 self-center" />
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className={
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              }
            >
              {t('shop.category.all')}
            </Button>
            {categoriesData?.map((category) => (
              <Button
                key={category.id}
                variant={
                  selectedCategory === category.slug ? 'default' : 'outline'
                }
                size="sm"
                onClick={() => setSelectedCategory(category.slug)}
                className={
                  selectedCategory === category.slug
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50'
                }
              >
                {category.name}
              </Button>
            ))}
          </div>

          {/* Products Grid */}
          {gamemodesData?.map((gamemode) => {
            const Icon =
              gamemodeIcons[gamemode.slug as keyof typeof gamemodeIcons] ??
              Gamepad2;
            const itemsForTab =
              selectedGamemode === gamemode.slug ? filteredItems : [];
            return (
              <TabsContent
                key={gamemode.id}
                value={gamemode.slug}
                className="mt-8"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-xl text-foreground">
                      {gamemode.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {itemsForTab.length}{' '}
                      {language === 'ka' ? 'პროდუქტი' : 'products'}
                    </p>
                  </div>
                </div>

                {itemsLoading ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground text-lg">
                      Loading shop items...
                    </p>
                  </div>
                ) : itemsForTab.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground text-lg">
                      {language === 'ka'
                        ? 'პროდუქტები არ მოიძებნა'
                        : 'No products found'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {itemsForTab.map((item, index) => (
                      <div
                        key={item.id}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <ProductCard item={item} />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </section>

      <Footer />
    </div>
  );
};

export default Shop;
