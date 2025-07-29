import { AppData, Product, Reservation, Order } from '@/types';
import PerformanceLogger from '@/lib/performanceLogger';

const defaultData: AppData = {
  products: [
    {
      id: '1',
      name: 'Margherita Pizza',
      description: 'Fresh tomato sauce, mozzarella, and basil',
      price: 18.99,
      category: 'Pizza',
      image: '/placeholder.svg',
      available: true
    },
    {
      id: '2',
      name: 'Caesar Salad',
      description: 'Crisp romaine lettuce with parmesan and croutons',
      price: 14.99,
      category: 'Salads',
      image: '/placeholder.svg',
      available: true
    },
    {
      id: '3',
      name: 'Grilled Salmon',
      description: 'Atlantic salmon with lemon herb seasoning',
      price: 28.99,
      category: 'Main Course',
      image: '/placeholder.svg',
      available: true
    },
    {
      id: '4',
      name: 'Chocolate Brownie',
      description: 'Warm chocolate brownie with vanilla ice cream',
      price: 8.99,
      category: 'Desserts',
      image: '/placeholder.svg',
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

export class DataStore {
  private static instance: DataStore;
  private data: AppData;
  private performanceLogger: PerformanceLogger;

  private constructor() {
    this.performanceLogger = PerformanceLogger.getInstance();
    this.data = this.loadData();
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private loadData(): AppData {
    try {
      const stored = localStorage.getItem('restaurant-app-data');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultData, ...parsed };
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
    return defaultData;
  }

  private saveData(): void {
    const startTime = Date.now();
    try {
      localStorage.setItem('restaurant-app-data', JSON.stringify(this.data));
      this.performanceLogger.logDataOperation(
        'UPDATE',
        'settings',
        'app-data',
        this.data,
        Date.now() - startTime
      );
    } catch (error) {
      console.error('Error saving data to localStorage:', error);
    }
  }

  // Products
  getProducts(): Product[] {
    return this.data.products;
  }

  addProduct(product: Product): void {
    this.data.products.push(product);
    this.saveData();
  }

  updateProduct(product: Product): void {
    const index = this.data.products.findIndex(p => p.id === product.id);
    if (index !== -1) {
      this.data.products[index] = product;
      this.saveData();
    }
  }

  // Reservations
  getReservations(): Reservation[] {
    return this.data.reservations;
  }

  addReservation(reservation: Reservation): void {
    const startTime = Date.now();
    this.data.reservations.push(reservation);
    this.performanceLogger.logDataOperation(
      'CREATE',
      'reservation',
      reservation.id,
      reservation,
      Date.now() - startTime
    );
    this.saveData();
  }

  updateReservation(reservation: Reservation): void {
    const index = this.data.reservations.findIndex(r => r.id === reservation.id);
    if (index !== -1) {
      this.data.reservations[index] = reservation;
      this.saveData();
    }
  }

  // Orders
  getOrders(): Order[] {
    return this.data.orders;
  }

  addOrder(order: Order): void {
    const startTime = Date.now();
    this.data.orders.push(order);
    this.performanceLogger.logDataOperation(
      'CREATE',
      'order',
      order.id,
      order,
      Date.now() - startTime
    );
    this.saveData();
  }

  updateOrder(order: Order): void {
    const index = this.data.orders.findIndex(o => o.id === order.id);
    if (index !== -1) {
      this.data.orders[index] = order;
      this.saveData();
    }
  }

  // Data management
  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importData(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData);
      this.data = { ...defaultData, ...imported };
      this.saveData();
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  resetData(): void {
    this.data = { ...defaultData };
    this.saveData();
  }

  getAllData(): AppData {
    return this.data;
  }
}