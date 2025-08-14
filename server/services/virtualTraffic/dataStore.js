// Simple data store to get products for virtual users
// This mirrors the client-side DataStore but server-side

class DataStore {
  constructor() {
    // Use the same products as the main server
    this.products = [
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
    ];
  }

  static getInstance() {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  getProducts() {
    return this.products;
  }
}

export {
  DataStore
};