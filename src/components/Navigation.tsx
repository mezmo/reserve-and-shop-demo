import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Utensils, ShoppingBag, Calendar, Settings, LogIn, LogOut, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import LoginDialog from './LoginDialog';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const location = useLocation();
  const { isLoggedIn, login, logout } = useAuth();
  const { getTotalItems } = useCart();

  const navItems = [
    { path: '/', label: 'Home', icon: Utensils },
    { path: '/menu', label: 'Menu', icon: ShoppingBag },
    { path: '/reservations', label: 'Reservations', icon: Calendar },
    { path: '/config', label: 'Config', icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Utensils className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Bella Vista</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive(item.path) ? "default" : "ghost"}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
            
            {/* Cart Button */}
            {isLoggedIn && getTotalItems() > 0 && (
              <Link to="/menu">
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 relative"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Cart</span>
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getTotalItems()}
                  </span>
                </Button>
              </Link>
            )}
            
            {/* Login/Logout Button */}
            {isLoggedIn ? (
              <Button
                variant="ghost"
                onClick={logout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setLoginOpen(true)}
                className="flex items-center space-x-2"
              >
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                  >
                    <Button
                      variant={isActive(item.path) ? "default" : "ghost"}
                      className="w-full justify-start space-x-2"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
              
              {/* Mobile Cart Button */}
              {isLoggedIn && getTotalItems() > 0 && (
                <Link
                  to="/menu"
                  onClick={() => setIsOpen(false)}
                >
                  <Button
                    variant="ghost"
                    className="w-full justify-start space-x-2 relative"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span>Cart ({getTotalItems()})</span>
                  </Button>
                </Link>
              )}
              
              {/* Mobile Login/Logout Button */}
              {isLoggedIn ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="w-full justify-start space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLoginOpen(true);
                    setIsOpen(false);
                  }}
                  className="w-full justify-start space-x-2"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      
      <LoginDialog 
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onLogin={login}
      />
    </nav>
  );
};

export default Navigation;