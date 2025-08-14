import React, { useState, useContext, createContext, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCartTracking } from '@/hooks/useServerTracking';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartContextType {
  cart: { [key: string]: number };
  addToCart: (product: Product) => void;
  removeFromCart: (product: Product) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: (products: any[]) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [cartProducts, setCartProducts] = useState<{ [key: string]: Product }>({});
  const { toast } = useToast();
  const { trackAddToCart, trackRemoveFromCart } = useCartTracking();

  const addToCart = (product: Product) => {
    const startTime = performance.now();
    const quantityBefore = cart[product.id] || 0;
    const quantityAfter = quantityBefore + 1;
    
    setCart(prev => ({
      ...prev,
      [product.id]: quantityAfter
    }));
    
    // Store product details for accurate cart total calculations
    setCartProducts(prev => ({
      ...prev,
      [product.id]: product
    }));
    
    // Calculate new cart total using stored product information
    const newCartProducts = { ...cartProducts, [product.id]: product };
    const newCart = { ...cart, [product.id]: quantityAfter };
    const cartTotal = Object.entries(newCart).reduce((total, [id, qty]) => {
      const prod = newCartProducts[id];
      return total + (prod ? prod.price * qty : 0);
    }, 0);
    
    // Log cart action with server-side tracking (matches virtual user logging)
    trackAddToCart(product.id, product.name, 1, product.price, cartTotal);
    
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`
    });
  };

  const removeFromCart = (product: Product) => {
    const startTime = performance.now();
    const quantityBefore = cart[product.id] || 0;
    
    if (quantityBefore === 0) return; // Nothing to remove
    
    const quantityAfter = quantityBefore > 1 ? quantityBefore - 1 : 0;
    
    let newCart = { ...cart };
    if (newCart[product.id] > 1) {
      newCart[product.id]--;
    } else {
      delete newCart[product.id];
    }
    
    setCart(newCart);
    
    // Clean up product data if item completely removed
    if (quantityAfter === 0) {
      setCartProducts(prev => {
        const updated = { ...prev };
        delete updated[product.id];
        return updated;
      });
    }
    
    // Calculate new cart total using stored product information
    const cartTotal = Object.entries(newCart).reduce((total, [id, qty]) => {
      const prod = cartProducts[id];
      return total + (prod ? prod.price * qty : 0);
    }, 0);
    
    // Log cart removal with server-side tracking (matches virtual user logging)
    trackRemoveFromCart(product.id, product.name, 1, product.price, cartTotal);
  };

  const clearCart = () => {
    setCart({});
    setCartProducts({});
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const getTotalPrice = (products: any[]) => {
    // Use stored cart products for accurate pricing, fallback to provided products
    return Object.entries(cart).reduce((total, [productId, qty]) => {
      const cartProduct = cartProducts[productId];
      if (cartProduct) {
        return total + cartProduct.price * qty;
      }
      
      // Fallback to provided products array
      const product = products.find(p => p.id === productId);
      return total + (product?.price || 0) * qty;
    }, 0);
  };

  const contextValue: CartContextType = {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    getTotalItems,
    getTotalPrice
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};