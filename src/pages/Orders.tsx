import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrders } from '@/hooks/useOrders';
import { useComponentPerformance } from '@/hooks/usePerformance';
import { Order } from '@/types';
import { 
  FileText, 
  Clock, 
  Package, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import OrderFilters from '@/components/OrderFilters';
import OrderCard from '@/components/OrderCard';
import OrderDetails from '@/components/OrderDetails';

const Orders = () => {
  // Track component performance
  useComponentPerformance('Orders');
  
  const {
    orders,
    products,
    stats,
    loading,
    updating,
    filters,
    setFilters,
    updateOrderStatus,
    getOrderWithProducts,
    refresh
  } = useOrders();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setSelectedOrder(null);
    setDetailsOpen(false);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: Order['status']) => {
    await updateOrderStatus(orderId, newStatus);
    // If the details modal is open for this order, close it after update
    if (selectedOrder?.id === orderId) {
      handleCloseDetails();
    }
  };

  const statsCards = [
    {
      title: 'Total Orders',
      value: stats.total,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Payment Pending',
      value: stats.payment_pending,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Confirmed',
      value: stats.confirmed,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Payment Failed',
      value: stats.payment_failed,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Preparing',
      value: stats.preparing,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Ready',
      value: stats.ready,
      icon: AlertCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-foreground">Orders Management</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Track and manage all customer orders with detailed information and status updates
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-md ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-6 w-8" /> : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <OrderFilters
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refresh}
        isLoading={loading}
      />

      {/* Orders List */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders found</h3>
            <p className="text-muted-foreground">
              {filters.status !== 'all' || filters.type !== 'all' || filters.searchTerm || filters.dateRange !== 'all'
                ? 'No orders match your current filters. Try adjusting your search criteria.'
                : 'No orders have been placed yet. Orders will appear here once customers start placing them.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Results Summary */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {orders.length} of {stats.total} orders
            </p>
            {orders.length !== stats.total && (
              <Badge variant="outline" className="text-xs">
                Filtered Results
              </Badge>
            )}
          </div>

          {/* Orders Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                onViewDetails={handleViewDetails}
                isUpdating={updating}
              />
            ))}
          </div>
        </>
      )}

      {/* Order Details Modal */}
      <OrderDetails
        order={selectedOrder}
        products={products}
        isOpen={detailsOpen}
        onClose={handleCloseDetails}
        onStatusUpdate={handleStatusUpdate}
        isUpdating={updating}
      />
    </div>
  );
};

export default Orders;