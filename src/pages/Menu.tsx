import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataStore } from '@/stores/dataStore';
import { Product } from '@/types';
import { ShoppingCart, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Menu = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const { toast } = useToast();

  useEffect(() => {
    const dataStore = DataStore.getInstance();
    setProducts(dataStore.getProducts());
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const addToCart = (productId: string) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
    toast({
      title: "Added to cart",
      description: "Item has been added to your cart."
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId] > 1) {
        newCart[productId]--;
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const getTotalPrice = () => {
    return Object.entries(cart).reduce((total, [productId, qty]) => {
      const product = products.find(p => p.id === productId);
      return total + (product?.price || 0) * qty;
    }, 0);
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

      {/* Cart Summary */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground p-4 rounded-lg shadow-warm z-40">
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-5 w-5" />
            <div className="text-sm">
              <div>{getTotalItems()} items</div>
              <div className="font-semibold">${getTotalPrice().toFixed(2)}</div>
            </div>
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
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold w-8 text-center">
                          {cart[product.id]}
                        </span>
                      </>
                    )}
                    <Button
                      size="icon"
                      onClick={() => addToCart(product.id)}
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
    </div>
  );
};

export default Menu;