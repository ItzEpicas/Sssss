import React from 'react';
import { Gamepad2, Users, HeadphonesIcon, Trophy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Features: React.FC = () => {
  const { t } = useLanguage();

  const features = [
    {
      icon: Gamepad2,
      titleKey: 'features.gamemodes',
      descKey: 'features.gamemodes.desc',
    },
    {
      icon: Users,
      titleKey: 'features.community',
      descKey: 'features.community.desc',
    },
    {
      icon: HeadphonesIcon,
      titleKey: 'features.support',
      descKey: 'features.support.desc',
    },
    {
      icon: Trophy,
      titleKey: 'features.events',
      descKey: 'features.events.desc',
    },
  ];

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <h2 className="font-display font-bold text-3xl md:text-4xl text-center mb-16">
          <span className="text-foreground">{t('features.title').split(' ')[0]} </span>
          <span className="text-primary">{t('features.title').split(' ').slice(1).join(' ')}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.titleKey}
              className="group glass-card rounded-2xl p-6 hover:box-glow-subtle transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="font-display font-bold text-xl text-foreground mb-2">
                {t(feature.titleKey)}
              </h3>
              <p className="text-muted-foreground">
                {t(feature.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
