import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Order } from '@/types';
import { Clock, User, Phone, Mail, MapPin, Package, Eye, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: Order;
  onStatusUpdate: (orderId: string, newStatus: Order['status']) => Promise<void>;
  onViewDetails: (order: Order) => void;
  isUpdating?: boolean;
}

const statusConfig = {
  payment_pending: { label: 'Payment Pending', color: 'bg-orange-500 hover:bg-orange-600', textColor: 'text-orange-800', bgColor: 'bg-orange-50' },
  confirmed: { label: 'Confirmed', color: 'bg-green-500 hover:bg-green-600', textColor: 'text-green-800', bgColor: 'bg-green-50' },
  payment_failed: { label: 'Payment Failed', color: 'bg-red-500 hover:bg-red-600', textColor: 'text-red-800', bgColor: 'bg-red-50' },
  pending: { label: 'Pending', color: 'bg-yellow-500 hover:bg-yellow-600', textColor: 'text-yellow-800', bgColor: 'bg-yellow-50' },
  preparing: { label: 'Preparing', color: 'bg-blue-500 hover:bg-blue-600', textColor: 'text-blue-800', bgColor: 'bg-blue-50' },
  ready: { label: 'Ready', color: 'bg-green-500 hover:bg-green-600', textColor: 'text-green-800', bgColor: 'bg-green-50' },
  completed: { label: 'Completed', color: 'bg-gray-500 hover:bg-gray-600', textColor: 'text-gray-800', bgColor: 'bg-gray-50' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500 hover:bg-red-600', textColor: 'text-red-800', bgColor: 'bg-red-50' },
};

const statusOptions = [
  { value: 'payment_pending', label: 'Payment Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'pending', label: 'Pending' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const OrderCard = ({ order, onStatusUpdate, onViewDetails, isUpdating }: OrderCardProps) => {
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  
  // Safety checks
  if (!order || !order.id) {
    return null;
  }
  
  // Fallback config for unknown status values
  const config = statusConfig[order.status] || statusConfig.pending;
  const timeAgo = order.createdAt ? formatDistanceToNow(new Date(order.createdAt), { addSuffix: true }) : 'Unknown time';
  
  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (newStatus === order.status) return;
    
    setIsStatusUpdating(true);
    try {
      await onStatusUpdate(order.id, newStatus);
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const getTotalItems = () => {
    return order.items?.reduce((total, item) => total + item.quantity, 0) || 0;
  };

  return (
    <Card className={cn(
      "hover:shadow-lg transition-all duration-300 border-l-4",
      config.color.replace('bg-', 'border-l-').replace(' hover:bg-yellow-600', '').replace(' hover:bg-blue-600', '').replace(' hover:bg-green-600', '').replace(' hover:bg-gray-600', '').replace(' hover:bg-red-600', '')
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-lg">#{order.id}</h3>
              <Badge className={cn(config.color, "text-white")}>
                {config.label}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {order.type || 'takeout'}
              </Badge>
            </div>
            <div className="flex items-center text-sm text-muted-foreground space-x-4">
              <span className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {timeAgo}
              </span>
              <span className="flex items-center">
                <Package className="h-3 w-3 mr-1" />
                {getTotalItems()} items
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              ${(order.totalAmount || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{order.customerName || 'Unknown Customer'}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{order.customerEmail || 'No email'}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{order.customerPhone || 'No phone'}</span>
          </div>
          {order.type === 'delivery' && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Delivery Order</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Notes: </span>
            <span className="text-foreground">{order.notes}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onViewDetails(order)}
            className="flex-1 sm:flex-none"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          
          <div className="flex-1">
            <Select
              value={order.status}
              onValueChange={handleStatusUpdate}
              disabled={isStatusUpdating || isUpdating}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  {(isStatusUpdating || isUpdating) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    disabled={option.value === order.status}
                  >
                    <span className="flex items-center">
                      <div 
                        className={cn(
                          "w-2 h-2 rounded-full mr-2",
                          statusConfig[option.value as Order['status']].color.split(' ')[0]
                        )} 
                      />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderCard;