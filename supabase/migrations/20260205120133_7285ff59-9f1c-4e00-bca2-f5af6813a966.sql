-- Fix the overly permissive INSERT policy for orders 
-- Allow authenticated users to create orders for themselves, or unauthenticated for guest checkout
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Users can create orders" ON public.orders 
FOR INSERT 
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Fix order items - must be linked to an order being created
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Users can create order items for their orders" ON public.order_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.user_id IS NULL OR orders.user_id = auth.uid())
  )
);