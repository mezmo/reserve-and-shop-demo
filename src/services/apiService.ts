import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import HttpClient, { HttpError } from '@/lib/httpClient';
import { Product, Reservation, Order, AppData } from '@/types';

const httpClient = HttpClient.getInstance();

// Query keys for React Query cache management
export const QUERY_KEYS = {
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  reservations: ['reservations'] as const,
  reservation: (id: string) => ['reservations', id] as const,
  settings: ['settings'] as const,
  health: ['health'] as const,
} as const;

// Products API
export const useProducts = () => {
  return useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: async () => {
      const response = await httpClient.get<Product[]>('/products');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx), but retry on server errors (5xx)
      if (error instanceof Error && 'status' in error) {
        const httpError = error as HttpError;
        return httpError.status >= 500 && failureCount < 3;
      }
      return failureCount < 3;
    },
  });
};

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.product(id),
    queryFn: async () => {
      const response = await httpClient.get<Product>(`/products/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (product: Omit<Product, 'id'>) => {
      const response = await httpClient.post<Product>('/products', product);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (product: Product) => {
      const response = await httpClient.put<Product>(`/products/${product.id}`, product);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
      queryClient.setQueryData(QUERY_KEYS.product(data.id), data);
    },
  });
};

// Orders API
export const useOrders = () => {
  return useQuery({
    queryKey: QUERY_KEYS.orders,
    queryFn: async () => {
      const response = await httpClient.get<Order[]>('/orders');
      return response.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute - orders change more frequently
    retry: (failureCount, error) => {
      if (error instanceof Error && 'status' in error) {
        const httpError = error as HttpError;
        return httpError.status >= 500 && failureCount < 3;
      }
      return failureCount < 3;
    },
  });
};

export const useOrder = (id: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.order(id),
    queryFn: async () => {
      const response = await httpClient.get<Order>(`/orders/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (order: Omit<Order, 'id' | 'createdAt' | 'status'>) => {
      const response = await httpClient.post<Order>('/orders', order);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (order: Order) => {
      const response = await httpClient.put<Order>(`/orders/${order.id}`, order);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
      queryClient.setQueryData(QUERY_KEYS.order(data.id), data);
    },
  });
};

// Reservations API
export const useReservations = () => {
  return useQuery({
    queryKey: QUERY_KEYS.reservations,
    queryFn: async () => {
      const response = await httpClient.get<Reservation[]>('/reservations');
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error) => {
      if (error instanceof Error && 'status' in error) {
        const httpError = error as HttpError;
        return httpError.status >= 500 && failureCount < 3;
      }
      return failureCount < 3;
    },
  });
};

export const useReservation = (id: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.reservation(id),
    queryFn: async () => {
      const response = await httpClient.get<Reservation>(`/reservations/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
};

export const useCreateReservation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reservation: Omit<Reservation, 'id' | 'createdAt' | 'status'>) => {
      const response = await httpClient.post<Reservation>('/reservations', reservation);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reservations });
    },
  });
};

export const useUpdateReservation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reservation: Reservation) => {
      const response = await httpClient.put<Reservation>(`/reservations/${reservation.id}`, reservation);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reservations });
      queryClient.setQueryData(QUERY_KEYS.reservation(data.id), data);
    },
  });
};

// Settings API
export const useSettings = () => {
  return useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: async () => {
      const response = await httpClient.get('/settings');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - settings don't change often
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: any) => {
      const response = await httpClient.put('/settings', settings);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.settings, data);
    },
  });
};

// Health check
export const useHealthCheck = () => {
  return useQuery({
    queryKey: QUERY_KEYS.health,
    queryFn: async () => {
      const response = await httpClient.get('/health');
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: false, // Don't retry health checks - we want to know immediately if it fails
  });
};

// Testing utilities for HTTP error logging
export const useTestError = () => {
  return useMutation({
    mutationFn: async ({ statusCode, delay = 0 }: { statusCode: number; delay?: number }) => {
      const response = await httpClient.testError(statusCode, delay);
      return response.data;
    },
  });
};

export const useTestRandomError = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await httpClient.testRandomError();
      return response.data;
    },
  });
};

export const useTestTimeout = () => {
  return useMutation({
    mutationFn: async (timeout: number = 5000) => {
      const response = await httpClient.testTimeout(timeout);
      return response.data;
    },
  });
};

export const useTestPerformance = () => {
  return useMutation({
    mutationFn: async (delay?: number) => {
      const response = await httpClient.testPerformance(delay);
      return response.data;
    },
  });
};