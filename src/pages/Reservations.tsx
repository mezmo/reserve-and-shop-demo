import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DataStore } from '@/stores/dataStore';
import { Reservation } from '@/types';
import { CalendarIcon, Clock, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useComponentPerformance, usePerformance } from '@/hooks/usePerformance';

const Reservations = () => {
  // Track component performance
  useComponentPerformance('Reservations');
  const { trackDataFetch, trackUserInteraction } = usePerformance();
  
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    time: '',
    partySize: '',
    specialRequests: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    const endTracking = trackDataFetch('Load reservations');
    const dataStore = DataStore.getInstance();
    setReservations(dataStore.getReservations());
    endTracking();
  }, [trackDataFetch]);

  const timeSlots = [
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
  ];

  const partySizes = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !formData.customerName || !formData.customerEmail || 
        !formData.customerPhone || !formData.time || !formData.partySize) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const newReservation: Reservation = {
      id: Date.now().toString(),
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: formData.time,
      partySize: parseInt(formData.partySize),
      specialRequests: formData.specialRequests,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    const dataStore = DataStore.getInstance();
    dataStore.addReservation(newReservation);
    setReservations(dataStore.getReservations());
    
    // Reset form
    setFormData({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      time: '',
      partySize: '',
      specialRequests: ''
    });
    setSelectedDate(new Date());
    setShowForm(false);

    toast({
      title: "Reservation Confirmed!",
      description: `Your table for ${newReservation.partySize} on ${format(selectedDate, 'MMMM do, yyyy')} at ${newReservation.time} is confirmed.`
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const updateReservationStatus = (reservationId: string, newStatus: 'confirmed' | 'pending' | 'cancelled') => {
    const dataStore = DataStore.getInstance();
    const reservation = reservations.find(r => r.id === reservationId);
    if (reservation) {
      const updatedReservation = { ...reservation, status: newStatus };
      dataStore.updateReservation(updatedReservation);
      setReservations(dataStore.getReservations());
      toast({
        title: "Status Updated",
        description: `Reservation status changed to ${newStatus}.`
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-foreground">Reservations</h1>
        <p className="text-lg text-muted-foreground">Book your table or manage existing reservations</p>
      </div>

      <div className="max-w-4xl mx-auto">
        {!showForm ? (
          <div className="text-center mb-8">
            <Button size="lg" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              Make New Reservation
            </Button>
          </div>
        ) : (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>New Reservation</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerName">Name *</Label>
                    <Input
                      id="customerName"
                      value={formData.customerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerEmail">Email *</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerPhone">Phone *</Label>
                    <Input
                      id="customerPhone"
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label>Party Size *</Label>
                    <Select value={formData.partySize} onValueChange={(value) => setFormData(prev => ({ ...prev, partySize: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select party size" />
                      </SelectTrigger>
                      <SelectContent>
                        {partySizes.map(size => (
                          <SelectItem key={size} value={size.toString()}>
                            {size} {size === 1 ? 'person' : 'people'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Time *</Label>
                    <Select value={formData.time} onValueChange={(value) => setFormData(prev => ({ ...prev, time: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map(time => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="specialRequests">Special Requests</Label>
                  <Textarea
                    id="specialRequests"
                    value={formData.specialRequests}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialRequests: e.target.value }))}
                    placeholder="Any dietary restrictions, special occasions, or other requests..."
                  />
                </div>

                <div className="flex gap-4">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Confirm Reservation</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Existing Reservations */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Existing Reservations</h2>
          {reservations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No reservations found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reservations.map(reservation => (
                <Card key={reservation.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-lg">{reservation.customerName}</h3>
                          {getStatusIcon(reservation.status)}
                          <span className="text-sm capitalize text-muted-foreground">
                            {reservation.status}
                          </span>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <CalendarIcon className="h-4 w-4" />
                            <span>{format(new Date(reservation.date), 'MMM do, yyyy')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{reservation.time}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{reservation.partySize} people</span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm">
                          <p>Email: {reservation.customerEmail}</p>
                          <p>Phone: {reservation.customerPhone}</p>
                          {reservation.specialRequests && (
                            <p className="mt-1">
                              <span className="font-medium">Special requests:</span> {reservation.specialRequests}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2 mt-4 md:mt-0">
                        <Select
                          value={reservation.status}
                          onValueChange={(value: 'confirmed' | 'pending' | 'cancelled') => 
                            updateReservationStatus(reservation.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reservations;
