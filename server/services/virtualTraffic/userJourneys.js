const USER_JOURNEYS = [
  {
    name: 'Quick Buyer',
    description: 'User who knows what they want and purchases quickly',
    weight: 30,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 3000, max: 8000 } },
      { action: 'navigate', target: '/menu', duration: { min: 5000, max: 10000 } },
      { action: 'add_to_cart', duration: { min: 3000, max: 5000 } },
      { action: 'add_to_cart', duration: { min: 3000, max: 5000 }, probability: 0.7 },
      { action: 'checkout', duration: { min: 10000, max: 20000 } }
    ]
  },
  {
    name: 'Browser',
    description: 'User who browses extensively before leaving',
    weight: 40,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 5000, max: 10000 } },
      { action: 'navigate', target: '/menu', duration: { min: 8000, max: 15000 } },
      { action: 'browse', duration: { min: 15000, max: 45000 } },
      { action: 'view_details', duration: { min: 8000, max: 15000 } },
      { action: 'navigate', target: '/reservations', duration: { min: 5000, max: 10000 } },
      { action: 'browse', duration: { min: 10000, max: 20000 } },
      { action: 'navigate', target: '/', duration: { min: 3000, max: 5000 } }
    ]
  },
  {
    name: 'Researcher',
    description: 'User who researches thoroughly before making a decision',
    weight: 20,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 3000, max: 5000 } },
      { action: 'navigate', target: '/menu', duration: { min: 5000, max: 10000 } },
      { action: 'view_details', duration: { min: 10000, max: 20000 } },
      { action: 'view_details', duration: { min: 10000, max: 20000 } },
      { action: 'view_details', duration: { min: 10000, max: 20000 } },
      { action: 'add_to_cart', probability: 0.5, duration: { min: 3000, max: 5000 } },
      { action: 'navigate', target: '/reservations', duration: { min: 5000, max: 10000 } },
      { action: 'navigate', target: '/menu', duration: { min: 3000, max: 5000 } },
      { action: 'add_to_cart', probability: 0.5, duration: { min: 3000, max: 5000 } },
      { action: 'checkout', probability: 0.3, duration: { min: 15000, max: 25000 } }
    ]
  },
  {
    name: 'Reservation Maker',
    description: 'User focused on making a reservation',
    weight: 10,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 3000, max: 5000 } },
      { action: 'navigate', target: '/reservations', duration: { min: 3000, max: 5000 } },
      { action: 'make_reservation', duration: { min: 15000, max: 30000 } },
      { action: 'navigate', target: '/menu', duration: { min: 5000, max: 8000 } },
      { action: 'browse', duration: { min: 10000, max: 20000 } }
    ]
  },
  {
    name: 'Indecisive Shopper',
    description: 'User who adds and removes items multiple times',
    weight: 15,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 5000, max: 8000 } },
      { action: 'navigate', target: '/menu', duration: { min: 5000, max: 10000 } },
      { action: 'add_to_cart', duration: { min: 3000, max: 5000 } },
      { action: 'add_to_cart', duration: { min: 3000, max: 5000 } },
      { action: 'browse', duration: { min: 10000, max: 15000 } },
      { action: 'remove_from_cart', duration: { min: 2000, max: 3000 } },
      { action: 'add_to_cart', duration: { min: 3000, max: 5000 } },
      { action: 'view_details', duration: { min: 8000, max: 15000 } },
      { action: 'checkout', probability: 0.4, duration: { min: 15000, max: 25000 } }
    ]
  },
  {
    name: 'Complete Journey',
    description: 'User who completes a full purchase journey with reservation',
    weight: 10,
    steps: [
      { action: 'navigate', target: '/', duration: { min: 5000, max: 8000 } },
      { action: 'navigate', target: '/menu', duration: { min: 5000, max: 8000 } },
      { action: 'browse', duration: { min: 10000, max: 15000 } },
      { action: 'add_to_cart', duration: { min: 3000, max: 5000 } },
      { action: 'add_to_cart', duration: { min: 3000, max: 5000 } },
      { action: 'navigate', target: '/reservations', duration: { min: 3000, max: 5000 } },
      { action: 'make_reservation', probability: 0.8, duration: { min: 15000, max: 25000 } },
      { action: 'checkout', duration: { min: 15000, max: 25000 } }
    ]
  }
];

// Helper function to select a journey based on weights
function selectWeightedJourney(journeys) {
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
function getThinkTime(step) {
  if (!step.duration) {
    return 3000; // Default 3 seconds
  }
  
  const { min, max } = step.duration;
  const baseTime = Math.floor(Math.random() * (max - min + 1)) + min;
  
  // Add 10-30% extra think time to simulate reading/decision making
  const thinkMultiplier = 1 + (0.1 + Math.random() * 0.2);
  return Math.floor(baseTime * thinkMultiplier);
}

// Helper to decide if optional step should execute
function shouldExecuteStep(step) {
  if (step.probability === undefined) {
    return true;
  }
  return Math.random() < step.probability;
}

export {
  USER_JOURNEYS,
  selectWeightedJourney,
  getThinkTime,
  shouldExecuteStep
};