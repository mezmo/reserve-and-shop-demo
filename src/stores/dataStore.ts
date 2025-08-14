import { AppData, Product, Reservation, Order } from '@/types';
import PerformanceLogger from '@/lib/performanceLogger';

// API base URL - use server port
const API_BASE = window.location.origin.replace(':8080', ':3001');

// Add connection check function
async function checkServerConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`, { 
      method: 'GET',
      timeout: 5000 
    } as any);
    return response.ok;
  } catch (error) {
    console.warn('⚠️ Server health check failed:', error);
    return false;
  }
}

export class DataStore {
  private static instance: DataStore;
  private data: AppData | null = null;
  private performanceLogger: PerformanceLogger;

  private constructor() {
    this.performanceLogger = PerformanceLogger.getInstance();
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  // Load data from server instead of localStorage
  private async loadData(): Promise<AppData> {
    try {
      console.log('📡 Checking server connection...');
      const serverOnline = await checkServerConnection();
      
      if (!serverOnline) {
        throw new Error('Server is not responding (health check failed)');
      }
      
      console.log('📡 Attempting to load data from:', `${API_BASE}/api/data`);
      
      const response = await fetch(`${API_BASE}/api/data`);
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📡 Response data:', result);
      
      if (result.success) {
        this.data = result.data;
        console.log('✅ Data loaded successfully from server');
        return result.data;
      } else {
        throw new Error('Server response indicated failure');
      }
    } catch (error) {
      console.error('❌ Error loading data from server:', error);
      console.log('🔄 Using fallback data instead');
      console.log('💡 To fix this issue:');
      console.log('   1. Make sure the server is running: npm run server');
      console.log('   2. Check if port 3001 is accessible');
      console.log('   3. Verify server logs for startup errors');
      
      // Return default data structure as fallback
      const fallbackData: AppData = {
        products: [
          {
            id: '1',
            name: 'Margherita Pizza',
            description: 'Fresh tomato sauce, mozzarella, and basil',
            price: 18.99,
            category: 'Pizza',
            image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&h=300&fit=crop&crop=center',
            available: true
          },
          {
            id: '2',
            name: 'Caesar Salad',
            description: 'Crisp romaine lettuce with parmesan and croutons',
            price: 14.99,
            category: 'Salads',
            image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&crop=center',
            available: true
          },
          {
            id: '3',
            name: 'Grilled Salmon',
            description: 'Atlantic salmon with lemon herb seasoning',
            price: 28.99,
            category: 'Main Course',
            image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop&crop=center',
            available: true
          },
          {
            id: '4',
            name: 'Chocolate Brownie',
            description: 'Warm chocolate brownie with vanilla ice cream',
            price: 8.99,
            category: 'Desserts',
            image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&h=300&fit=crop&crop=center',
            available: true
          }
        ],
        reservations: [],
        orders: [],
        settings: {
          restaurantName: 'Bella Vista Restaurant',
          contactEmail: 'info@bellavista.com',
          contactPhone: '+1 (555) 123-4567'
        }
      };
      this.data = fallbackData;
      return fallbackData;
    }
  }

  // Ensure data is loaded
  private async ensureDataLoaded(): Promise<AppData> {
    if (!this.data) {
      await this.loadData();
    }
    return this.data!;
  }

  // Products
  async getProducts(): Promise<Product[]> {
    try {
      const response = await fetch(`${API_BASE}/api/products`);
      const products = await response.json();
      return products;
    } catch (error) {
      console.error('Error fetching products:', error);
      const data = await this.ensureDataLoaded();
      return data.products;
    }
  }

  async addProduct(product: Product): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local cache
      if (this.data) {
        this.data.products.push(product);
      }
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  async updateProduct(product: Product): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local cache
      if (this.data) {
        const index = this.data.products.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.data.products[index] = product;
        }
      }
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local cache
      if (this.data) {
        this.data.products = this.data.products.filter(p => p.id !== productId);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Reservations
  async getReservations(): Promise<Reservation[]> {
    try {
      const response = await fetch(`${API_BASE}/api/reservations`);
      const reservations = await response.json();
      return reservations;
    } catch (error) {
      console.error('Error fetching reservations:', error);
      const data = await this.ensureDataLoaded();
      return data.reservations;
    }
  }

  async addReservation(reservation: Reservation): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Log the operation
      this.performanceLogger.logDataOperation(
        'CREATE',
        'reservation',
        reservation.id,
        reservation,
        Date.now() - startTime
      );
      
      // Update local cache
      if (this.data) {
        this.data.reservations.push(reservation);
      }
    } catch (error) {
      console.error('Error adding reservation:', error);
      throw error;
    }
  }

  async updateReservation(reservation: Reservation): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/reservations/${reservation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local cache
      if (this.data) {
        const index = this.data.reservations.findIndex(r => r.id === reservation.id);
        if (index !== -1) {
          this.data.reservations[index] = reservation;
        }
      }
    } catch (error) {
      console.error('Error updating reservation:', error);
      throw error;
    }
  }

  async deleteReservation(reservationId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/reservations/${reservationId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local cache
      if (this.data) {
        this.data.reservations = this.data.reservations.filter(r => r.id !== reservationId);
      }
    } catch (error) {
      console.error('Error deleting reservation:', error);
      throw error;
    }
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    try {
      const response = await fetch(`${API_BASE}/api/orders`);
      const orders = await response.json();
      return orders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      const data = await this.ensureDataLoaded();
      return data.orders;
    }
  }

  async addOrder(order: Order): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Log the operation
      this.performanceLogger.logDataOperation(
        'CREATE',
        'order',
        order.id,
        order,
        Date.now() - startTime
      );
      
      // Update local cache
      if (this.data) {
        this.data.orders.push(order);
      }
    } catch (error) {
      console.error('Error adding order:', error);
      throw error;
    }
  }

  async updateOrder(order: Order): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local cache
      if (this.data) {
        const index = this.data.orders.findIndex(o => o.id === order.id);
        if (index !== -1) {
          this.data.orders[index] = order;
        }
      }
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  async deleteOrder(orderId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local cache
      if (this.data) {
        this.data.orders = this.data.orders.filter(o => o.id !== orderId);
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  // Data management
  async exportData(): Promise<string> {
    const data = await this.ensureDataLoaded();
    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData: string): Promise<boolean> {
    try {
      // Note: Import functionality would require server endpoint
      // For now, we'll just validate the JSON
      const imported = JSON.parse(jsonData);
      console.warn('Import functionality not implemented in server-side version');
      return false;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  async resetData(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/data/reset`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Clear local cache to force reload
      this.data = null;
      
      console.log('Data reset to defaults successfully');
    } catch (error) {
      console.error('Error resetting data:', error);
      throw error;
    }
  }

  async resetProducts(): Promise<void> {
    // This would require a server endpoint for partial reset
    // For now, use full reset
    await this.resetData();
  }

  async refreshProductImages(): Promise<void> {
    // This functionality would need server-side implementation
    // For now, reload products from server
    try {
      await this.getProducts();
    } catch (error) {
      console.error('Error refreshing product images:', error);
    }
  }

  async refreshFromDefaults(): Promise<void> {
    // Reset data on server side
    await this.resetData();
  }

  async getAllData(): Promise<AppData> {
    return await this.ensureDataLoaded();
  }

  // Settings methods
  async getSettings(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE}/api/settings`);
      const settings = await response.json();
      return settings;
    } catch (error) {
      console.error('Error fetching settings:', error);
      const data = await this.ensureDataLoaded();
      return data.settings;
    }
  }

  async updateSettings(settings: any): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Update local cache
      if (this.data) {
        this.data.settings = { ...this.data.settings, ...settings };
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }
}