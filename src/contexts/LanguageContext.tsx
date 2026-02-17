import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'ka' | 'en';

interface Translations {
  [key: string]: {
    ka: string;
    en: string;
  };
}

export const translations: Translations = {
  // Navigation
  'nav.home': { ka: 'მთავარი', en: 'Home' },
  'nav.shop': { ka: 'მაღაზია', en: 'Shop' },
  'nav.server': { ka: 'სერვერი', en: 'Server' },
  'nav.staffApplication': { ka: 'სტაფში განაცხადი', en: 'Staff Application' },
  'nav.admin': { ka: 'ადმინ პანელი', en: 'Admin' },
  'nav.profile': { ka: 'პროფილი', en: 'Profile' },
  'nav.login': { ka: 'შესვლა', en: 'Login' },
  'nav.register': { ka: 'რეგისტრაცია', en: 'Register' },
  
  // Hero
  'hero.title': { ka: 'RageMC', en: 'RageMC' },
  'hero.subtitle': { ka: 'საქართველოს #1 Minecraft სერვერი', en: "Georgia's #1 Minecraft Server" },
  'hero.description': { ka: 'შემოგვიერთდი და გახდი საუკეთესო ქომუნითის ნაწილი!', en: 'Join us and become part of the best community!' },
  'hero.play': { ka: 'თამაშის დაწყება', en: 'Start Playing' },
  'hero.discord': { ka: 'Discord-ზე შესვლა', en: 'Join Discord' },
  'hero.online': { ka: 'ონლაინ', en: 'Online' },
  'hero.offline': { ka: 'ოფლაინ', en: 'Offline' },
  'hero.players': { ka: 'მოთამაშე', en: 'Players' },
  'hero.copied': { ka: 'დაკოპირდა!', en: 'Copied!' },
  'hero.clickToCopy': { ka: 'დააკოპირე IP', en: 'Click to copy IP' },
  
  // Features
  'features.title': { ka: 'რატომ RageMC?', en: 'Why RageMC?' },
  'features.gamemodes': { ka: 'რეჟიმები', en: 'Game Modes' },
  'features.gamemodes.desc': { ka: 'Survival, Lifesteal, BoxPVP და სხვა', en: 'Survival, Lifesteal, BoxPVP and more' },
  'features.community': { ka: 'ქომუნითი', en: 'Community' },
  'features.community.desc': { ka: 'აქტიური ქართული ქომუნითი', en: 'Active Georgian community' },
  'features.support': { ka: 'მხარდაჭერა', en: 'Support' },
  'features.support.desc': { ka: '24/7 მხარდაჭერა Discord-ზე', en: '24/7 Support on Discord' },
  'features.events': { ka: 'ივენთები', en: 'Events' },
  'features.events.desc': { ka: 'ყოველკვირეული ტურნირები და პრიზები', en: 'Weekly tournaments and prizes' },
  
  // Shop
  'shop.title': { ka: 'მაღაზია', en: 'Shop' },
  'shop.subtitle': { ka: 'გაძლიერდი სერვერზე', en: 'Power up on the server' },
  'shop.viewAll': { ka: 'ყველას ნახვა', en: 'View All' },
  'shop.currency': { ka: '₾', en: '₾' },
  'shop.buy': { ka: 'ყიდვა', en: 'Buy' },
  'shop.category.all': { ka: 'ყველა', en: 'All' },
  'shop.category.ranks': { ka: 'რანკები', en: 'Ranks' },
  'shop.category.currency': { ka: 'ვალუტა', en: 'Currency' },
  'shop.category.kits': { ka: 'კიტები', en: 'Kits' },
  'shop.category.keys': { ka: 'გასაღებები', en: 'Keys' },
  'shop.category.misc': { ka: 'სხვა', en: 'Misc' },
  
  // Gamemodes
  'gamemode.survival': { ka: 'სურვაივალი', en: 'Survival' },
  'gamemode.lifesteal': { ka: 'ლაიფსტილი', en: 'Lifesteal' },
  'gamemode.boxpvp': { ka: 'BoxPVP', en: 'BoxPVP' },
  
  // Footer
  'footer.rights': { ka: 'ყველა უფლება დაცულია', en: 'All rights reserved' },
  'footer.privacy': { ka: 'კონფიდენციალურობა', en: 'Privacy' },
  'footer.terms': { ka: 'პირობები', en: 'Terms' },
  'footer.contact': { ka: 'კონტაქტი', en: 'Contact' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ka');

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) return key;
    return translation[language] || translation['en'] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
