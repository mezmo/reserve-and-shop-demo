import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DataStore } from '@/stores/dataStore';
import { Order, OrderItem, Product } from '@/types';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: { [key: string]: number };
  products: Product[];
  onOrderComplete: () => void;
}

const CheckoutDialog = ({ open, onOpenChange, cart, products, onOrderComplete }: CheckoutDialogProps) => {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'dine-in' | 'takeout' | 'delivery'>('dine-in');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const calculateTotal = () => {
    return Object.entries(cart).reduce((total, [productId, qty]) => {
      const product = products.find(p => p.id === productId);
      return total + (product?.price || 0) * qty;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataStore = DataStore.getInstance();
      
      // Create order items
      const orderItems: OrderItem[] = Object.entries(cart).map(([productId, quantity]) => {
        const product = products.find(p => p.id === productId);
        return {
          productId,
          quantity,
          price: product?.price || 0
        };
      });

      // Create order
      const order: Order = {
        id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customerName,
        customerEmail,
        customerPhone,
        items: orderItems,
        totalAmount: calculateTotal(),
        status: 'pending',
        type: orderType,
        createdAt: new Date().toISOString(),
        notes: notes || undefined
      };

      // Save order
      dataStore.addOrder(order);

      toast({
        title: "Order placed successfully!",
        description: `Your order #${order.id} has been submitted. We'll prepare it shortly.`,
      });

      // Reset form
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setOrderType('dine-in');
      setNotes('');
      
      onOrderComplete();
      onOpenChange(false);
      
    } catch (error) {
      toast({
        title: "Order failed",
        description: "There was an error placing your order. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = calculateTotal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Order</DialogTitle>
          <DialogDescription>
            Please provide your details to complete the order.
          </DialogDescription>
        </DialogHeader>

        {/* Order Summary */}
        <div className="bg-muted/50 p-4 rounded-lg mb-4">
          <h3 className="font-semibold mb-2">Order Summary</h3>
          <div className="space-y-1 text-sm">
            {Object.entries(cart).map(([productId, qty]) => {
              const product = products.find(p => p.id === productId);
              return (
                <div key={productId} className="flex justify-between">
                  <span>{product?.name} × {qty}</span>
                  <span>${((product?.price || 0) * qty).toFixed(2)}</span>
                </div>
              );
            })}
            <div className="border-t pt-1 flex justify-between font-semibold">
              <span>Total ({totalItems} items)</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Full Name *</Label>
            <Input
              id="customerName"
              type="text"
              placeholder="Enter your full name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="customerEmail">Email *</Label>
            <Input
              id="customerEmail"
              type="email"
              placeholder="Enter your email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Phone Number *</Label>
            <Input
              id="customerPhone"
              type="tel"
              placeholder="Enter your phone number"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orderType">Order Type *</Label>
            <Select value={orderType} onValueChange={(value: any) => setOrderType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select order type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dine-in">Dine In</SelectItem>
                <SelectItem value="takeout">Takeout</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Special Instructions (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special requests or instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Placing Order..." : `Place Order ($${totalPrice.toFixed(2)})`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;