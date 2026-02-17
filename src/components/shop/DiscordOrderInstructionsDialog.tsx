import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  Clock,
  Copy,
  ExternalLink,
  MessageCircle,
  ShoppingCart,
  ShieldAlert,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type DiscordOrderInstructionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  discordUrl: string;
};

export default function DiscordOrderInstructionsDialog({
  open,
  onOpenChange,
  orderId,
  discordUrl,
}: DiscordOrderInstructionsDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const steps = useMemo(
    () => [
      { icon: ClipboardCopy, text: 'დააკოპირე შეკვეთის ID' },
      { icon: MessageCircle, text: 'გადადი Discord-ზე' },
      { icon: ShoppingCart, text: 'დააჭირე „შეძენა“ ღილაკს Discord-ში' },
      { icon: Copy, text: 'ჩააგდე/ჩასვი შენი შეკვეთის ID' },
      { icon: Clock, text: 'დაელოდე ადმინისტრატორს' },
    ],
    [],
  );

  const handleCopy = useCallback(async () => {
    const showCopied = () => {
      setCopied(true);
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
      toast({ title: 'ID დაკოპირდა!', description: orderId });
    };

    try {
      await navigator.clipboard.writeText(orderId);
      showCopied();
      return;
    } catch {
      // fall back
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = orderId;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showCopied();
    } catch {
      // ignore
    }
  }, [orderId, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-xl overflow-hidden rounded-3xl border-white/10 bg-slate-950/65 p-0 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
        <div className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-rose-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

          <DialogHeader className="text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
              <ShieldAlert className="h-4 w-4 text-rose-200" />
              აუცილებელი წასაკითხი
            </div>
            <DialogTitle className="mt-3 font-display text-xl sm:text-2xl font-black tracking-tight text-foreground">
              შეკვეთა სრულდება Discord-ზე
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              გთხოვ, ჯერ დააკოპირო შეკვეთის ID, შემდეგ გადახვიდე Discord-ში და იქ გააგრძელო შეძენა.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold text-muted-foreground">შეკვეთის ID</div>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 truncate rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-foreground">
                {orderId}
              </div>
              <Button
                type="button"
                onClick={handleCopy}
                variant="outline"
                className="gap-2 border-white/10 bg-white/5 hover:bg-white/10"
                aria-label="შეკვეთის ID დაკოპირება"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'დაკოპირდა' : 'კოპირება'}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3">
            {steps.map((step) => (
              <div
                key={step.text}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/90">
                  <step.icon className="h-4 w-4" />
                </div>
                <div className="text-sm text-foreground/90 font-semibold">{step.text}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href={discordUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Discord-ზე გადასვლა"
              className={[
                'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-display font-extrabold',
                'gradient-primary text-primary-foreground box-glow',
                'hover:opacity-95 transition-all duration-300 hover:scale-[1.01] active:scale-[1.0]',
              ].join(' ')}
            >
              Discord-ზე გადასვლა
              <ExternalLink className="h-5 w-5" />
            </a>

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 gap-2 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 font-display font-extrabold"
              aria-label="დახურვა"
            >
              დახურვა
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

