import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Order, Product } from '@/types';
import { Clock, User, Phone, Mail, MapPin, Package, Printer, Calendar } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface OrderDetailsProps {
  order: Order | null;
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: (orderId: string, newStatus: Order['status']) => Promise<void>;
  isUpdating?: boolean;
}

const statusConfig = {
  payment_pending: { label: 'Payment Pending', color: 'bg-orange-500', textColor: 'text-orange-800' },
  confirmed: { label: 'Confirmed', color: 'bg-green-500', textColor: 'text-green-800' },
  payment_failed: { label: 'Payment Failed', color: 'bg-red-500', textColor: 'text-red-800' },
  pending: { label: 'Pending', color: 'bg-yellow-500', textColor: 'text-yellow-800' },
  preparing: { label: 'Preparing', color: 'bg-blue-500', textColor: 'text-blue-800' },
  ready: { label: 'Ready', color: 'bg-green-500', textColor: 'text-green-800' },
  completed: { label: 'Completed', color: 'bg-gray-500', textColor: 'text-gray-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500', textColor: 'text-red-800' },
};

const OrderDetails = ({ order, products, isOpen, onClose, onStatusUpdate, isUpdating }: OrderDetailsProps) => {
  if (!order || !order.id) return null;

  // Fallback config for unknown status values
  const config = statusConfig[order.status] || statusConfig.pending;
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const timeAgo = order.createdAt ? formatDistanceToNow(orderDate, { addSuffix: true }) : 'Unknown time';

  const getProductById = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const getTotalItems = () => {
    return order.items?.reduce((total, item) => total + item.quantity, 0) || 0;
  };

  const handlePrintReceipt = () => {
    // Create a printable receipt
    const printContent = `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h1 style="text-align: center; margin-bottom: 20px;">Bella Vista Restaurant</h1>
        <div style="text-align: center; margin-bottom: 20px;">
          <strong>Order #${order.id}</strong><br>
          ${format(orderDate, 'PPP p')}
        </div>
        
        <div style="margin-bottom: 20px;">
          <strong>Customer:</strong><br>
          ${order.customerName}<br>
          ${order.customerEmail}<br>
          ${order.customerPhone}<br>
          <strong>Type:</strong> ${order.type.charAt(0).toUpperCase() + order.type.slice(1)}
        </div>

        <div style="border-top: 1px solid #ccc; padding-top: 10px; margin-bottom: 20px;">
          <strong>Items:</strong><br>
          ${order.items.map(item => {
            const product = getProductById(item.productId);
            return `${item.quantity}x ${product?.name || 'Unknown Product'} - $${(item.price * item.quantity).toFixed(2)}`;
          }).join('<br>')}
        </div>

        <div style="border-top: 1px solid #ccc; padding-top: 10px; font-size: 18px;">
          <strong>Total: $${order.totalAmount.toFixed(2)}</strong>
        </div>

        ${order.notes ? `
          <div style="margin-top: 20px;">
            <strong>Notes:</strong><br>
            ${order.notes}
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
          Thank you for your business!
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Order #${order.id} Receipt</title>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const canAdvanceStatus = () => {
    return order.status !== 'completed' && order.status !== 'cancelled';
  };

  const getNextStatus = (): Order['status'] | null => {
    switch (order.status) {
      case 'pending':
        return 'preparing';
      case 'preparing':
        return 'ready';
      case 'ready':
        return 'completed';
      default:
        return null;
    }
  };

  const handleAdvanceStatus = async () => {
    const nextStatus = getNextStatus();
    if (nextStatus) {
      await onStatusUpdate(order.id, nextStatus);
    }
  };

  const handleCancelOrder = async () => {
    if (order.status !== 'completed') {
      await onStatusUpdate(order.id, 'cancelled');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order #{order.id}</span>
            <Badge className={cn(config.color, "text-white")}>
              {config.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Order Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(orderDate, 'PPP p')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{timeAgo}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{getTotalItems()} items • {(order.type || 'takeout').charAt(0).toUpperCase() + (order.type || 'takeout').slice(1)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Customer Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{order.customerName || 'Unknown Customer'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{order.customerEmail || 'No email'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{order.customerPhone || 'No phone'}</span>
                </div>
                {order.type === 'delivery' && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-green-600 font-medium">Delivery Order</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Order Items */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Order Items</h3>
            <div className="space-y-3">
              {(order.items || []).map((item, index) => {
                const product = getProductById(item.productId);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      {product?.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12 rounded-md object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium">{product?.name || 'Unknown Product'}</div>
                        <div className="text-sm text-muted-foreground">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </div>
                      </div>
                    </div>
                    <div className="font-semibold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Order Total */}
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total Amount:</span>
            <span className="text-primary">${(order.totalAmount || 0).toFixed(2)}</span>
          </div>

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold">Special Notes</h3>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {order.notes}
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handlePrintReceipt}
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>

            {canAdvanceStatus() && (
              <Button
                onClick={handleAdvanceStatus}
                disabled={isUpdating}
                className="flex-1"
              >
                {isUpdating ? 'Updating...' : `Mark as ${getNextStatus()?.charAt(0).toUpperCase()}${getNextStatus()?.slice(1)}`}
              </Button>
            )}

            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <Button
                variant="destructive"
                onClick={handleCancelOrder}
                disabled={isUpdating}
                className="flex-1"
              >
                {isUpdating ? 'Updating...' : 'Cancel Order'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetails;