export interface JourneyStep {
  action: 'navigate' | 'browse' | 'add_to_cart' | 'remove_from_cart' | 'checkout' | 'view_details' | 'make_reservation';
  target?: string; // route or product ID
  duration?: { min: number; max: number }; // simulate think time in ms
  probability?: number; // chance of executing this step (0-1)
  data?: any; // Additional data for the action
}

export interface UserJourney {
  name: string;
  description: string;
  weight: number; // probability weight for selection
  steps: JourneyStep[];
}

export const USER_JOURNEYS: UserJourney[] = [
  {
    name: 'Quick Buyer',
    description: 'User who knows what they want and purchases quickly',
    weight: 30,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 1000, max: 3000 } },
      { action: 'navigate', target: '/menu', duration: { min: 2000, max: 4000 } },
      { action: 'add_to_cart', duration: { min: 500, max: 1500 } },
      { action: 'add_to_cart', duration: { min: 500, max: 1500 }, probability: 0.7 },
      { action: 'checkout', duration: { min: 3000, max: 6000 } }
    ]
  },
  {
    name: 'Browser',
    description: 'User who browses extensively before leaving',
    weight: 40,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 2000, max: 5000 } },
      { action: 'navigate', target: '/menu', duration: { min: 3000, max: 8000 } },
      { action: 'browse', duration: { min: 5000, max: 15000 } },
      { action: 'view_details', duration: { min: 2000, max: 4000 } },
      { action: 'navigate', target: '/reservations', duration: { min: 2000, max: 4000 } },
      { action: 'browse', duration: { min: 3000, max: 6000 } },
      { action: 'navigate', target: '/', duration: { min: 1000, max: 2000 } }
    ]
  },
  {
    name: 'Researcher',
    description: 'User who researches thoroughly before making a decision',
    weight: 20,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 1000, max: 2000 } },
      { action: 'navigate', target: '/menu', duration: { min: 2000, max: 4000 } },
      { action: 'view_details', duration: { min: 3000, max: 6000 } },
      { action: 'view_details', duration: { min: 3000, max: 6000 } },
      { action: 'view_details', duration: { min: 3000, max: 6000 } },
      { action: 'add_to_cart', probability: 0.5, duration: { min: 1000, max: 2000 } },
      { action: 'navigate', target: '/reservations', duration: { min: 2000, max: 4000 } },
      { action: 'navigate', target: '/menu', duration: { min: 1000, max: 2000 } },
      { action: 'add_to_cart', probability: 0.5, duration: { min: 1000, max: 2000 } },
      { action: 'checkout', probability: 0.3, duration: { min: 4000, max: 8000 } }
    ]
  },
  {
    name: 'Reservation Maker',
    description: 'User focused on making a reservation',
    weight: 10,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 1000, max: 2000 } },
      { action: 'navigate', target: '/reservations', duration: { min: 1000, max: 2000 } },
      { action: 'make_reservation', duration: { min: 5000, max: 10000 } },
      { action: 'navigate', target: '/menu', duration: { min: 2000, max: 3000 } },
      { action: 'browse', duration: { min: 3000, max: 6000 } }
    ]
  },
  {
    name: 'Indecisive Shopper',
    description: 'User who adds and removes items multiple times',
    weight: 15,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 2000, max: 3000 } },
      { action: 'navigate', target: '/menu', duration: { min: 2000, max: 4000 } },
      { action: 'add_to_cart', duration: { min: 1000, max: 2000 } },
      { action: 'add_to_cart', duration: { min: 1000, max: 2000 } },
      { action: 'browse', duration: { min: 3000, max: 5000 } },
      { action: 'remove_from_cart', duration: { min: 500, max: 1000 } },
      { action: 'add_to_cart', duration: { min: 1000, max: 2000 } },
      { action: 'view_details', duration: { min: 2000, max: 4000 } },
      { action: 'checkout', probability: 0.4, duration: { min: 4000, max: 8000 } }
    ]
  },
  {
    name: 'Complete Journey',
    description: 'User who completes a full purchase journey with reservation',
    weight: 10,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 2000, max: 3000 } },
      { action: 'navigate', target: '/menu', duration: { min: 2000, max: 3000 } },
      { action: 'browse', duration: { min: 3000, max: 5000 } },
      { action: 'add_to_cart', duration: { min: 1000, max: 2000 } },
      { action: 'add_to_cart', duration: { min: 1000, max: 2000 } },
      { action: 'navigate', target: '/reservations', duration: { min: 1000, max: 2000 } },
      { action: 'make_reservation', probability: 0.8, duration: { min: 4000, max: 8000 } },
      { action: 'checkout', duration: { min: 4000, max: 8000 } }
    ]
  }
];

// Helper function to select a journey based on weights
export function selectWeightedJourney(journeys: UserJourney[]): UserJourney {
  const totalWeight = journeys.reduce((sum, journey) => sum + journey.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const journey of journeys) {
    random -= journey.weight;
    if (random <= 0) {
      return journey;
    }
  }
  
  return journeys[0]; // Fallback
}

// Helper to generate realistic think time
export function getThinkTime(step: JourneyStep): number {
  if (!step.duration) {
    return 1000; // Default 1 second
  }
  
  const { min, max } = step.duration;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to decide if optional step should execute
export function shouldExecuteStep(step: JourneyStep): boolean {
  if (step.probability === undefined) {
    return true;
  }
  return Math.random() < step.probability;
}