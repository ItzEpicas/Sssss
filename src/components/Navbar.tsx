import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ShoppingCart, User, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import CartSheet from '@/components/shop/CartSheet';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { totalItems } = useCart();
  const { user, isAdmin } = useAuth();

  const toggleLanguage = () => {
    setLanguage(language === 'ka' ? 'en' : 'ka');
  };
  const userNavTarget = user ? '/profile' : '/auth';
  const userNavLabel = user ? t('nav.profile') : t('nav.login');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/30">
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="container mx-auto px-4 relative z-50">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center box-glow">
              <img
                src="/favicon.png"
                alt="RageMC"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="hidden sm:inline font-display font-bold text-xl text-foreground">
              Rage<span className="text-primary">MC</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              to="/" 
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {t('nav.home')}
            </Link>
            <Link 
              to="/shop" 
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {t('nav.shop')}
            </Link>
            <Link 
              to="/server" 
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {t('nav.server')}
            </Link>
            <Link 
              to="/staffapplication" 
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {t('nav.staffApplication')}
            </Link>
            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {t('nav.admin')}
              </Link>
            )}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={toggleLanguage}
              type="button"
              className="text-muted-foreground hover:text-primary"
              aria-label="Toggle language"
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium">{language.toUpperCase()}</span>
            </Button>
            
            <CartSheet>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </CartSheet>
            
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary"
            >
              <Link to={userNavTarget} aria-label={userNavLabel}>
                <User className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="md:hidden flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              type="button"
              className="text-muted-foreground hover:text-primary"
              aria-label="Toggle language"
            >
              <Globe className="h-5 w-5" />
            </Button>

            <CartSheet>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-primary"
                aria-label={language === 'ka' ? 'კალათა' : 'Cart'}
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </CartSheet>

            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary"
            >
              <Link to={userNavTarget} aria-label={userNavLabel}>
                <User className="h-5 w-5" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen((prev) => !prev)}
              type="button"
              className="text-muted-foreground hover:text-primary"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/30 animate-fade-in relative z-50 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-4">
              <Link 
                to="/" 
                className="text-foreground hover:text-primary transition-colors font-medium px-2 py-2"
                onClick={() => setIsOpen(false)}
              >
                {t('nav.home')}
              </Link>
              <Link 
                to="/shop" 
                className="text-foreground hover:text-primary transition-colors font-medium px-2 py-2"
                onClick={() => setIsOpen(false)}
              >
                {t('nav.shop')}
              </Link>
              <Link 
                to="/server" 
                className="text-foreground hover:text-primary transition-colors font-medium px-2 py-2"
                onClick={() => setIsOpen(false)}
              >
                {t('nav.server')}
              </Link>
              <Link 
                to="/staffapplication" 
                className="text-foreground hover:text-primary transition-colors font-medium px-2 py-2"
                onClick={() => setIsOpen(false)}
              >
                {t('nav.staffApplication')}
              </Link>
              {isAdmin && (
                <Link 
                  to="/admin" 
                  className="text-foreground hover:text-primary transition-colors font-medium px-2 py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {t('nav.admin')}
                </Link>
              )}
              
              <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={toggleLanguage}
                  type="button"
                  className="flex-1"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  {language === 'ka' ? 'English' : 'ქართული'}
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="flex-1 justify-center text-muted-foreground hover:text-primary"
                >
                  <Link to={userNavTarget} aria-label={userNavLabel}>
                    <User className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
