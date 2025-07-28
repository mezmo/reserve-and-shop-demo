import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, ShoppingBag, Star, Clock, MapPin, Phone } from 'lucide-react';
import restaurantHero from '@/assets/restaurant-hero.jpg';

const Home = () => {
  const features = [
    {
      icon: ShoppingBag,
      title: 'Browse Menu',
      description: 'Explore our delicious selection of freshly prepared dishes',
      link: '/menu'
    },
    {
      icon: Calendar,
      title: 'Make Reservation',
      description: 'Book your table for an unforgettable dining experience',
      link: '/reservations'
    },
    {
      icon: Star,
      title: 'Quality Cuisine',
      description: 'Fresh ingredients and exceptional flavors in every dish'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[70vh] overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${restaurantHero})` }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
        
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-2xl text-white">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Welcome to
              <span className="block text-primary-glow">Bella Vista</span>
            </h1>
            <p className="text-xl mb-8 text-white/90">
              Experience culinary excellence in a warm, inviting atmosphere. 
              Fresh ingredients, exceptional service, unforgettable moments.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/menu">
                <Button size="lg" className="text-lg px-8">
                  View Menu
                </Button>
              </Link>
              <Link to="/reservations">
                <Button size="lg" variant="outline" className="text-lg px-8 bg-white/10 border-white/30 text-white hover:bg-white hover:text-primary">
                  Make Reservation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">What We Offer</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover the perfect blend of exceptional cuisine, warm hospitality, and memorable experiences
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="text-center hover:shadow-warm transition-all duration-300 border-border/50">
                  <CardContent className="p-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-warm rounded-full mb-6">
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground mb-6">{feature.description}</p>
                    {feature.link && (
                      <Link to={feature.link}>
                        <Button variant="outline" className="mt-4">
                          Learn More
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-foreground">Visit Us Today</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="text-muted-foreground">123 Culinary Street, Gourmet District</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="text-muted-foreground">+1 (555) 123-4567</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="text-muted-foreground">Open daily 11:00 AM - 10:00 PM</span>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <Link to="/reservations">
                <Button size="lg" className="text-lg px-12 py-6">
                  Book Your Table Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;