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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DataStore } from '@/stores/dataStore';
import { Order, OrderItem, Product } from '@/types';
import PerformanceLogger from '@/lib/performanceLogger';
import { 
  formatCardNumber, 
  formatExpiryDate, 
  formatCVV, 
  validateCardNumber, 
  validateExpiryDate, 
  validateCVV,
  getCardType,
  TEST_CARDS
} from '@/lib/cardValidation';
import { CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: { [key: string]: number };
  products: Product[];
  onOrderComplete: () => void;
}

const CheckoutDialog = ({ open, onOpenChange, cart, products, onOrderComplete }: CheckoutDialogProps) => {
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'takeout' | 'delivery'>('takeout');
  const [notes, setNotes] = useState('');
  
  // Payment info
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  
  const { toast } = useToast();

  const calculateTotal = () => {
    return Object.entries(cart).reduce((total, [productId, qty]) => {
      const product = products.find(p => p.id === productId);
      return total + (product?.price || 0) * qty;
    }, 0);
  };

  const validateStep1 = () => {
    return customerName.trim() !== '' && 
           customerEmail.trim() !== '' && 
           customerPhone.trim() !== '';
  };

  const validateStep2 = () => {
    return validateCardNumber(cardNumber) &&
           validateExpiryDate(expiryDate) &&
           validateCVV(cvv) &&
           cardHolderName.trim() !== '';
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setOrderType('takeout');
    setNotes('');
    setCardNumber('');
    setExpiryDate('');
    setCvv('');
    setCardHolderName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep === 1) {
      handleNext();
      return;
    }
    
    if (!validateStep2()) {
      toast({
        title: "Invalid payment information",
        description: "Please check your payment details and try again.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    const performanceLogger = PerformanceLogger.getInstance();
    const startTime = Date.now();

    try {
      // Create order ID for tracking
      const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Log payment initiation with sensitive data (for demo redaction)
      performanceLogger.logPaymentAttempt(
        {
          cardNumber,
          expiryDate,
          cvv,
          cardHolderName
        },
        {
          name: customerName,
          email: customerEmail,
          phone: customerPhone
        },
        {
          orderId,
          amount: calculateTotal(),
          currency: 'USD',
          orderType
        },
        'initiated'
      );

      // Log payment processing start
      performanceLogger.logPaymentAttempt(
        {
          cardNumber,
          expiryDate,
          cvv,
          cardHolderName
        },
        {
          name: customerName,
          email: customerEmail,
          phone: customerPhone
        },
        {
          orderId,
          amount: calculateTotal(),
          currency: 'USD',
          orderType
        },
        'processing'
      );

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
        id: orderId,
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

      // Log successful payment
      const endTime = Date.now();
      performanceLogger.logPaymentAttempt(
        {
          cardNumber,
          expiryDate,
          cvv,
          cardHolderName
        },
        {
          name: customerName,
          email: customerEmail,
          phone: customerPhone
        },
        {
          orderId,
          amount: calculateTotal(),
          currency: 'USD',
          orderType
        },
        'success',
        endTime - startTime
      );

      toast({
        title: "Payment successful!",
        description: `Your order #${order.id} has been placed and payment processed.`,
      });

      resetForm();
      onOrderComplete();
      onOpenChange(false);
      
    } catch (error) {
      // Log failed payment
      const endTime = Date.now();
      performanceLogger.logPaymentAttempt(
        {
          cardNumber,
          expiryDate,
          cvv,
          cardHolderName
        },
        {
          name: customerName,
          email: customerEmail,
          phone: customerPhone
        },
        {
          orderId: orderId || 'unknown',
          amount: calculateTotal(),
          currency: 'USD',
          orderType
        },
        'failed',
        endTime - startTime
      );

      toast({
        title: "Payment failed",
        description: "There was an error processing your payment. Please try again.",
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
          <DialogTitle>
            {currentStep === 1 ? 'Order Details' : 'Payment Information'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 1 
              ? 'Please provide your details to complete the order.'
              : 'Enter your payment information to complete the purchase.'
            }
          </DialogDescription>
          
          {/* Step indicator */}
          <div className="flex items-center space-x-2 mt-4">
            <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                1
              </div>
              <span className="text-sm">Details</span>
            </div>
            <div className="flex-1 h-px bg-border"></div>
            <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                2
              </div>
              <span className="text-sm">Payment</span>
            </div>
          </div>
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
          {currentStep === 1 && (
            <>
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
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-700 font-medium mb-2">Demo Payment - Use Test Cards:</p>
                <div className="space-y-1 text-xs text-blue-600">
                  <div>Visa: {TEST_CARDS.visa}</div>
                  <div>Mastercard: {TEST_CARDS.mastercard}</div>
                  <div>Any future expiry date and 3-4 digit CVV</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardHolderName">Card Holder Name *</Label>
                <Input
                  id="cardHolderName"
                  type="text"
                  placeholder="Enter card holder name"
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number *</Label>
                <div className="relative">
                  <Input
                    id="cardNumber"
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    className={validateCardNumber(cardNumber) || cardNumber === '' ? '' : 'border-red-500'}
                    required
                  />
                  {cardNumber && (
                    <Badge 
                      variant={validateCardNumber(cardNumber) ? "default" : "destructive"}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs"
                    >
                      {validateCardNumber(cardNumber) ? getCardType(cardNumber) : 'Invalid'}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date *</Label>
                  <Input
                    id="expiryDate"
                    type="text"
                    placeholder="MM/YY"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                    className={validateExpiryDate(expiryDate) || expiryDate === '' ? '' : 'border-red-500'}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV *</Label>
                  <Input
                    id="cvv"
                    type="text"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(formatCVV(e.target.value))}
                    className={validateCVV(cvv) || cvv === '' ? '' : 'border-red-500'}
                    required
                  />
                </div>
              </div>
            </>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={currentStep === 1 ? () => onOpenChange(false) : handleBack}
              className="flex-1"
            >
              {currentStep === 1 ? (
                'Cancel'
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </>
              )}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || (currentStep === 1 ? !validateStep1() : !validateStep2())}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                currentStep === 1 ? "Proceeding..." : "Processing Payment..."
              ) : currentStep === 1 ? (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay ${totalPrice.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;