import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import heroBg from '@/assets/hero-bg.jpg';
import StartPlayingOverlay from '@/components/StartPlayingOverlay';
import ServerStatusPill from '@/components/ServerStatusPill';

const DISCORD_INVITE_URL = 'https://discord.gg/XfAK8GHDRY';

const Hero: React.FC = () => {
  const { t } = useLanguage();
  const [startOpen, setStartOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Hero Background Image */}
      <div className="absolute inset-0">
        <img 
          src={heroBg} 
          alt="RageMC Server" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50" />
      </div>
      
      {/* Animated particles/grid effect */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(14, 165, 233, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(14, 165, 233, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Mini server status */}
          <div
            id="server-status"
            className="flex justify-center mb-6 animate-fade-in"
            style={{ animationDelay: '0.05s' }}
          >
            <ServerStatusPill />
          </div>

          {/* Main Title */}
          <h1 
            className="font-display font-black text-6xl md:text-8xl lg:text-9xl mb-4 text-glow animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            <span className="text-foreground">Rage</span>
            <span className="text-primary">MC</span>
          </h1>

          {/* Subtitle */}
          <p 
            className="font-display text-xl md:text-2xl text-primary mb-4 animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            {t('hero.subtitle')}
          </p>

          {/* Description */}
          <p 
            className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8 animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            {t('hero.description')}
          </p>

          {/* CTA Buttons */}
          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
            style={{ animationDelay: '0.5s' }}
          >
            <Button 
              size="lg" 
              onClick={() => setStartOpen(true)}
              className="group w-full sm:w-auto gap-2 gradient-primary text-primary-foreground font-display font-extrabold text-lg px-8 py-6 box-glow animate-pulse-glow transition-all duration-300 hover:opacity-95 hover:scale-[1.05] hover:shadow-[0_18px_45px_rgba(56,189,248,0.30)] active:scale-[1.02]"
            >
              <Gamepad2 className="h-5 w-5" />
              {t('hero.play')}
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto font-display font-bold text-lg px-8 py-6 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-all"
            >
              <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                {t('hero.discord')}
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

      {startOpen && <StartPlayingOverlay onClose={() => setStartOpen(false)} />}
    </section>
  );
};

export default Hero;
