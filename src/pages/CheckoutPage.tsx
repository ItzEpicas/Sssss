import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import DiscordOrderInstructionsDialog from "@/components/shop/DiscordOrderInstructionsDialog";

type CheckoutFormValues = {
  minecraftUsername: string;
  discordUsername: string;
  notes: string;
};

const formatCurrency = (value: number) => `${value.toFixed(2)} GEL`;

const CheckoutPage: React.FC = () => {
  const { items, totalPrice, clearCart } = useCart();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNotice, setOrderNotice] = useState<{
    orderId: string;
    discordUrl: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    defaultValues: {
      minecraftUsername: "",
      discordUsername: "",
      notes: "",
    },
  });

  const cartSummary = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        lineTotal: item.price * item.quantity,
      })),
    [items],
  );

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const onSubmit = async (values: CheckoutFormValues) => {
    if (items.length === 0) {
      toast({
        title: "Add something to your cart",
        description: "The cart is empty right now.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const processingToast = toast({
      title: "Processing your order",
      description: "Hold tight while we create everything.",
    });

    try {
      const payload = {
        minecraftUsername: values.minecraftUsername.trim(),
        discordUsername: values.discordUsername.trim(),
        notes: values.notes.trim() || null,
        cart: items.map((item) => ({
          productId: item.id,
          qty: item.quantity,
        })),
      };

      const { data, error } = await supabase.functions.invoke("create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (error) {
        const errorWithContext = error as unknown as { context?: Response };
        const context = errorWithContext?.context;
        let serverMessage: string | null = null;

        if (context) {
          try {
            const responseBody = (await context.json()) as unknown;
            if (
              responseBody &&
              typeof responseBody === "object" &&
              "error" in responseBody &&
              typeof (responseBody as { error: unknown }).error === "string"
            ) {
              serverMessage = (responseBody as { error: string }).error;
            }
          } catch {
            // Ignore JSON parsing errors and fall back to the default error message.
          }
        }

        if (serverMessage) {
          throw new Error(serverMessage);
        }

        throw error;
      }

      if (!data || typeof data !== "object" || !("redirectUrl" in data)) {
        throw new Error("Unexpected response from checkout service");
      }

      if (!("orderId" in data) || typeof (data as { orderId?: unknown }).orderId !== "string") {
        throw new Error("Missing order ID from checkout service");
      }

      clearCart();
      setOrderNotice({
        orderId: (data as { orderId: string }).orderId,
        discordUrl: (data as { redirectUrl: string }).redirectUrl,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast({
        title: "Checkout failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      processingToast.dismiss();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-6 lg:flex-row">
          <section className="flex-1 glass-card border-border/40 p-6 lg:p-8 shadow-xl">
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">
                RageMC
              </p>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Checkout
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your Minecraft and Discord usernames so the team can deliver your rank.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="minecraftUsername">Minecraft Username</Label>
                <Input
                  id="minecraftUsername"
                  placeholder="Steve123"
                  className="bg-surface-elevated"
                  {...register("minecraftUsername", {
                    required: "Minecraft username is required",
                    validate: (value) =>
                      value.trim().length > 0 || "Enter your Minecraft username",
                  })}
                />
                {errors.minecraftUsername && (
                  <p className="text-xs text-destructive">
                    {errors.minecraftUsername.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordUsername">Discord Username</Label>
                <Input
                  id="discordUsername"
                  placeholder="ragemc#1234"
                  className="bg-surface-elevated"
                  {...register("discordUsername", {
                    required: "Discord username is required",
                    validate: (value) =>
                      value.trim().length > 0 || "Enter your Discord username",
                  })}
                />
                {errors.discordUsername && (
                  <p className="text-xs text-destructive">
                    {errors.discordUsername.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Any extra info for the admin team"
                  className="bg-surface-elevated"
                  {...register("notes", {
                    setValueAs: (value) =>
                      typeof value === "string" ? value.trim() : value,
                  })}
                />
              </div>

              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2"
                disabled={isSubmitting || items.length === 0}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                გადახდა / შეკვეთის დასრულება
              </Button>
            </form>
          </section>

          <section className="lg:w-[320px] glass-card border-border/40 p-6 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                Cart Summary
              </p>
              <p className="text-2xl font-semibold">
                {formatCurrency(totalPrice)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </p>
            </div>

            <div className="space-y-4">
              {cartSummary.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Your cart is empty.{" "}
                  <Link to="/shop" className="text-primary underline">
                    Browse ranks
                  </Link>
                </div>
              ) : (
                cartSummary.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-border/30 pb-3 last:border-none"
                  >
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity} · {formatCurrency(item.price)}
                      </p>
                    </div>
                    <span className="font-medium text-primary">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {cartSummary.length > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-border/30">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-lg font-semibold">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            )}
          </section>
        </div>
      </main>

      {orderNotice && (
        <DiscordOrderInstructionsDialog
          open={Boolean(orderNotice)}
          onOpenChange={(open) => {
            if (!open) setOrderNotice(null);
          }}
          orderId={orderNotice.orderId}
          discordUrl={orderNotice.discordUrl}
        />
      )}

      <Footer />
    </div>
  );
};

export default CheckoutPage;
