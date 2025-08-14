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