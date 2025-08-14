import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, CalendarIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { OrdersFilter } from '@/hooks/useOrders';

interface OrderFiltersProps {
  filters: OrdersFilter;
  onFiltersChange: (filters: OrdersFilter) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'payment_pending', label: 'Payment Pending', color: 'bg-orange-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-green-500' },
  { value: 'payment_failed', label: 'Payment Failed', color: 'bg-red-500' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'preparing', label: 'Preparing', color: 'bg-blue-500' },
  { value: 'ready', label: 'Ready', color: 'bg-green-500' },
  { value: 'completed', label: 'Completed', color: 'bg-gray-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
];

const typeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'delivery', label: 'Delivery' },
];

const dateRangeOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const OrderFilters = ({ filters, onFiltersChange, onRefresh, isLoading }: OrderFiltersProps) => {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const updateFilter = (key: keyof OrdersFilter, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearCustomDates = () => {
    onFiltersChange({
      ...filters,
      customDateFrom: undefined,
      customDateTo: undefined,
      dateRange: 'all'
    });
  };

  const hasActiveFilters = 
    filters.status !== 'all' || 
    filters.type !== 'all' || 
    filters.dateRange !== 'all' || 
    filters.searchTerm !== '' ||
    filters.customDateFrom ||
    filters.customDateTo;

  return (
    <div className="space-y-4 mb-6">
      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by order ID, customer name, email, or phone..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={isLoading}
          className="sm:w-auto w-full"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Status Filter Badges */}
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => (
          <Badge
            key={option.value}
            variant={filters.status === option.value ? "default" : "outline"}
            className={cn(
              "cursor-pointer transition-all hover:scale-105",
              filters.status === option.value && option.color && `${option.color} text-white`
            )}
            onClick={() => updateFilter('status', option.value)}
          >
            {option.label}
          </Badge>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Order Type */}
        <Select value={filters.type} onValueChange={(value) => updateFilter('type', value)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Order Type" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Select value={filters.dateRange} onValueChange={(value) => updateFilter('dateRange', value)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            {dateRangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom Date From */}
        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[180px] justify-start text-left font-normal",
                !filters.customDateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.customDateFrom ? format(filters.customDateFrom, "MMM dd, yyyy") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.customDateFrom}
              onSelect={(date) => {
                updateFilter('customDateFrom', date);
                setDateFromOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Custom Date To */}
        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[180px] justify-start text-left font-normal",
                !filters.customDateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.customDateTo ? format(filters.customDateTo, "MMM dd, yyyy") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.customDateTo}
              onSelect={(date) => {
                updateFilter('customDateTo', date);
                setDateToOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Clear Custom Dates */}
        {(filters.customDateFrom || filters.customDateTo) && (
          <Button
            variant="ghost"
            onClick={clearCustomDates}
            className="w-full sm:w-auto"
          >
            Clear Dates
          </Button>
        )}
      </div>

      {/* Active Filters Indicator */}
      {hasActiveFilters && (
        <div className="text-sm text-muted-foreground">
          Active filters applied - use badges and dropdowns above to modify or clear filters
        </div>
      )}
    </div>
  );
};

export default OrderFilters;