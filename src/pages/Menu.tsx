import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataStore } from '@/stores/dataStore';
import { Product } from '@/types';
import { Plus, Minus, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import CheckoutDialog from '@/components/CheckoutDialog';

const Menu = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();
  const { cart, addToCart, removeFromCart, clearCart, getTotalItems, getTotalPrice } = useCart();

  useEffect(() => {
    const dataStore = DataStore.getInstance();
    setProducts(dataStore.getProducts());
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const handleCheckout = () => {
    if (!isLoggedIn) {
      toast({
        title: "Login required",
        description: "Please login to place an order.",
        variant: "destructive"
      });
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 text-foreground">Our Menu</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover our carefully crafted dishes made with the finest ingredients
        </p>
      </div>

      {/* Cart Summary for checkout */}
      {isLoggedIn && getTotalItems() > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg mb-8 max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">{getTotalItems()} items</span>
              <span className="mx-2">•</span>
              <span className="font-bold">${getTotalPrice(products).toFixed(2)}</span>
            </div>
            <Button
              onClick={handleCheckout}
              size="sm"
              className="ml-4"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Checkout
            </Button>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {categories.map(category => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            onClick={() => setSelectedCategory(category)}
            className="mb-2"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => (
          <Card key={product.id} className="overflow-hidden hover:shadow-warm transition-all duration-300">
            <div className="aspect-video bg-muted">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <Badge variant={product.available ? "default" : "secondary"}>
                  {product.available ? "Available" : "Unavailable"}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <p className="text-muted-foreground mb-4">{product.description}</p>
              
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-primary">
                  ${product.price.toFixed(2)}
                </span>
                
                {product.available && (
                  <div className="flex items-center space-x-2">
                    {cart[product.id] > 0 && (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => removeFromCart(product.id)}
                          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold w-8 text-center bg-primary text-primary-foreground rounded px-2 py-1">
                          {cart[product.id]}
                        </span>
                      </>
                    )}
                    <Button
                      size="icon"
                      onClick={() => addToCart(product.id)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No items found in this category.</p>
        </div>
      )}

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        cart={cart}
        products={products}
        onOrderComplete={clearCart}
      />
    </div>
  );
};

export default Menu;