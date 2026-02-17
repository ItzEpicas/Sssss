import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, Package, Users, Ticket, TrendingUp, DollarSign } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [shopItems, orders, profiles, tickets] = await Promise.all([
        supabase.from('shop_items').select('id', { count: 'exact' }),
        supabase.from('orders').select('id, total_amount, status'),
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('tickets').select('id, status'),
      ]);

      const pendingOrders = orders.data?.filter(o => o.status === 'pending').length || 0;
      const openTickets = tickets.data?.filter(t => t.status === 'open').length || 0;
      const totalRevenue = orders.data?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

      return {
        shopItems: shopItems.count || 0,
        orders: orders.data?.length || 0,
        pendingOrders,
        users: profiles.count || 0,
        tickets: tickets.data?.length || 0,
        openTickets,
        totalRevenue
      };
    }
  });

  const statCards = [
    { 
      title: 'Total Products', 
      value: stats?.shopItems || 0, 
      icon: ShoppingBag, 
      color: 'text-blue-500' 
    },
    { 
      title: 'Total Orders', 
      value: stats?.orders || 0, 
      subtitle: `${stats?.pendingOrders || 0} pending`,
      icon: Package, 
      color: 'text-green-500' 
    },
    { 
      title: 'Total Users', 
      value: stats?.users || 0, 
      icon: Users, 
      color: 'text-purple-500' 
    },
    { 
      title: 'Support Tickets', 
      value: stats?.tickets || 0, 
      subtitle: `${stats?.openTickets || 0} open`,
      icon: Ticket, 
      color: 'text-orange-500' 
    },
    { 
      title: 'Revenue', 
      value: `₾${stats?.totalRevenue.toFixed(2) || '0.00'}`, 
      icon: DollarSign, 
      color: 'text-emerald-500' 
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to the RageMC Admin Panel</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.title} className="glass-card border-border/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Activity logs will appear here...
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Recent orders will appear here...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default Dashboard;
