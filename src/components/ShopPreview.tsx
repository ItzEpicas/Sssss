import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Coins, Crown, KeyRound, Package, Sparkles, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type CategoryWithCount = Category & { itemCount: number };

const ShopPreview: React.FC = () => {
  const { t } = useLanguage();

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['shop-preview', 'categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, description')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    staleTime: 1000 * 60,
  });

  const { data: activeItemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['shop-preview', 'shop-items', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_items')
        .select('id, category_id')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as { id: string; category_id: string | null }[];
    },
    staleTime: 1000 * 60,
  });

  const categoriesWithCounts = useMemo<CategoryWithCount[]>(() => {
    const categories = categoriesData ?? [];
    const items = activeItemsData ?? [];

    const countsByCategoryId = new Map<string, number>();
    for (const item of items) {
      if (!item.category_id) continue;
      countsByCategoryId.set(
        item.category_id,
        (countsByCategoryId.get(item.category_id) ?? 0) + 1,
      );
    }

    return categories.map((category) => ({
      ...category,
      itemCount: countsByCategoryId.get(category.id) ?? 0,
    }));
  }, [categoriesData, activeItemsData]);

  const categoriesToRender: (CategoryWithCount | null)[] =
    categoriesLoading || itemsLoading ? Array.from({ length: 3 }, () => null) : categoriesWithCounts;

  const categoryCardStyles = {
    ranks: { icon: Crown, color: 'from-yellow-500 to-amber-600' },
    currency: { icon: Coins, color: 'from-green-500 to-emerald-600' },
    kits: { icon: Package, color: 'from-blue-500 to-cyan-600' },
    keys: { icon: KeyRound, color: 'from-purple-500 to-violet-600' },
    misc: { icon: Sparkles, color: 'from-slate-500 to-zinc-600' },
  } as const;

  return (
    <section className="py-24 relative">
      {/* Background accent */}
      <div className="absolute inset-0 gradient-radial opacity-30" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
          <div>
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-2">
              <span className="text-primary">{t('shop.title')}</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              {t('shop.subtitle')}
            </p>
          </div>
          <Link to="/shop">
            <Button variant="outline" className="group border-primary/50 text-primary hover:bg-primary/10">
              {t('shop.viewAll')}
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categoriesToRender.map(
            (category, index) => {
              if (!category) {
                return (
                  <div
                    key={`category-skeleton-${index}`}
                    className="relative overflow-hidden rounded-2xl glass-card animate-pulse"
                  >
                    <div className="p-6 h-64 flex flex-col justify-end">
                      <div className="w-12 h-12 rounded-xl bg-secondary/60 mb-4" />
                      <div className="h-7 w-40 bg-secondary/60 rounded mb-3" />
                      <div className="h-4 w-24 bg-secondary/60 rounded" />
                    </div>
                  </div>
                );
              }

              const style =
                categoryCardStyles[category.slug as keyof typeof categoryCardStyles] ??
                { icon: Tags, color: 'from-primary to-emerald-500' };
              const Icon = style.icon;

              return (
                <Link
                  key={category.id}
                  to={`/shop?category=${encodeURIComponent(category.slug)}`}
                  className="group relative overflow-hidden rounded-2xl glass-card hover:box-glow transition-all duration-500 animate-slide-up"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  <div className="absolute inset-0">
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.color} opacity-15`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
                  </div>

                  <div className="relative p-6 h-64 flex flex-col justify-end">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>

                    <h3 className="font-display font-bold text-2xl text-foreground mb-2 group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>

                    <p className="text-muted-foreground">
                      {category.itemCount} items
                    </p>

                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </Link>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
};

export default ShopPreview;
