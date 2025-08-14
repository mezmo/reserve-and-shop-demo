import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataStore } from '@/stores/dataStore';
import { Order, Product } from '@/types';
import { useToast } from '@/hooks/use-toast';

export interface OrdersFilter {
  status: string;
  type: string;
  dateRange: 'today' | 'week' | 'month' | 'all';
  searchTerm: string;
  customDateFrom?: Date;
  customDateTo?: Date;
}

export interface OrdersStats {
  total: number;
  payment_pending: number;
  confirmed: number;
  payment_failed: number;
  pending: number;
  preparing: number;
  ready: number;
  completed: number;
  cancelled: number;
}

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState<OrdersFilter>({
    status: 'all',
    type: 'all',
    dateRange: 'all',
    searchTerm: ''
  });
  const { toast } = useToast();

  // Load orders and products
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dataStore = DataStore.getInstance();
      const [ordersData, productsData] = await Promise.all([
        dataStore.getOrders(),
        dataStore.getProducts()
      ]);
      setOrders(ordersData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive"
      });
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update order status
  const updateOrderStatus = useCallback(async (orderId: string, newStatus: Order['status']) => {
    setUpdating(true);
    try {
      const dataStore = DataStore.getInstance();
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const updatedOrder = { ...order, status: newStatus };
      await dataStore.updateOrder(updatedOrder);
      
      setOrders(prev => prev.map(o => 
        o.id === orderId ? updatedOrder : o
      ));

      toast({
        title: "Success",
        description: `Order ${orderId} status updated to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  }, [orders, toast]);

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(order => order.status === filters.status);
    }

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(order => order.type === filters.type);
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        switch (filters.dateRange) {
          case 'today':
            return orderDate >= today;
          case 'week':
            return orderDate >= weekAgo;
          case 'month':
            return orderDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Custom date range filter
    if (filters.customDateFrom && filters.customDateTo) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= filters.customDateFrom! && orderDate <= filters.customDateTo!;
      });
    }

    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.id.toLowerCase().includes(searchLower) ||
        order.customerName.toLowerCase().includes(searchLower) ||
        order.customerEmail.toLowerCase().includes(searchLower) ||
        order.customerPhone.includes(filters.searchTerm)
      );
    }

    // Sort by creation date (newest first)
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, filters]);

  // Calculate statistics
  const stats = useMemo((): OrdersStats => {
    return {
      total: orders.length,
      payment_pending: orders.filter(o => o.status === 'payment_pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      payment_failed: orders.filter(o => o.status === 'payment_failed').length,
      pending: orders.filter(o => o.status === 'pending').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      completed: orders.filter(o => o.status === 'completed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
    };
  }, [orders]);

  // Get product details for an order
  const getOrderWithProducts = useCallback((order: Order) => {
    const itemsWithProducts = order.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        ...item,
        product
      };
    });
    return {
      ...order,
      itemsWithProducts
    };
  }, [products]);

  // Refresh data
  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    orders: filteredOrders,
    products,
    stats,
    loading,
    updating,
    filters,
    setFilters,
    updateOrderStatus,
    getOrderWithProducts,
    refresh
  };
};