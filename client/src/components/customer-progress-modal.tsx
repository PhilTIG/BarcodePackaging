import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users, Package, Search, Filter, ToggleLeft, ToggleRight, Hash, ArrowUpDown } from 'lucide-react';
import { CustomerProductDetailsModal } from './customer-product-details-modal';

interface CustomerProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobName?: string;
}

interface CustomerProgress {
  customerName: string;
  groupName: string | null;
  totalItems: number;
  scannedItems: number;
  completionPercentage: number;
  status: 'Unassigned' | 'Box' | 'Completed' | 'Transferred' | 'Archived';
  boxNumber?: number;
}

interface CustomerProgressData {
  customers: CustomerProgress[];
  summary: {
    totalCustomers: number;
    completedCustomers: number;
    completionPercentage: number;
  };
}

export function CustomerProgressModal({ isOpen, onClose, jobId, jobName }: CustomerProgressModalProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProgress | null>(null);
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGroupView, setIsGroupView] = useState(false);
  const [statusFilters, setStatusFilters] = useState({
    Active: true,
    Completed: true,
    Archived: true
  });
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'box'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const { data: progressData, isLoading, error } = useQuery({
    queryKey: ['/api/jobs', jobId, 'customer-progress'],
    enabled: isOpen && !!jobId,
    refetchInterval: 30000, // Refresh every 30 seconds when open
  });

  const { customers = [], summary } = (progressData as CustomerProgressData) || { customers: [], summary: { totalCustomers: 0, completedCustomers: 0, completionPercentage: 0 } };

  // Filter, search, and sort customers
  const filteredCustomers = useMemo(() => {
    let result = customers.filter(customer => {
      // Search filter
      const matchesSearch = customer.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const statusCategory = 
        customer.status === 'Unassigned' || customer.status === 'Box' ? 'Active' :
        customer.status === 'Completed' ? 'Completed' :
        'Archived'; // Transferred and Archived
      
      const matchesStatus = statusFilters[statusCategory as keyof typeof statusFilters];
      
      return matchesSearch && matchesStatus;
    });

    // Sort customers
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'progress':
          comparison = a.completionPercentage - b.completionPercentage;
          break;
        case 'box':
          // Handle null box numbers - put them at the end
          if (a.boxNumber == null && b.boxNumber == null) return 0;
          if (a.boxNumber == null) return 1;
          if (b.boxNumber == null) return -1;
          comparison = a.boxNumber - b.boxNumber;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [customers, searchTerm, statusFilters, sortBy, sortOrder]);

  // Group customers by groupName for group view
  const groupedCustomers = useMemo(() => {
    if (!isGroupView) return null;
    
    const groups: { [key: string]: CustomerProgress[] } = {};
    filteredCustomers.forEach(customer => {
      const groupKey = customer.groupName || 'No Group';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(customer);
    });
    
    return groups;
  }, [filteredCustomers, isGroupView]);

  const handleItemsClick = (customer: CustomerProgress) => {
    setSelectedCustomer(customer);
    setIsProductDetailsOpen(true);
  };

  const toggleStatusFilter = (status: keyof typeof statusFilters) => {
    setStatusFilters(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Completed': return 'default';
      case 'Box': return 'secondary';
      case 'Unassigned': return 'outline';
      case 'Transferred': return 'secondary';
      case 'Archived': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-green-600 dark:text-green-400';
      case 'Box': return 'text-blue-600 dark:text-blue-400';
      case 'Unassigned': return 'text-gray-600 dark:text-gray-400';
      case 'Transferred': return 'text-purple-600 dark:text-purple-400';
      case 'Archived': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const renderCustomerRow = (customer: CustomerProgress, index: number) => (
    <Card key={`${customer.customerName}-${customer.boxNumber || 'unassigned'}`} className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {customer.customerName}
            </h4>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                {customer.totalItems} total items
              </span>
              {customer.groupName && (
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Group: {customer.groupName}
                </span>
              )}
              {customer.boxNumber && (
                <span className="flex items-center gap-1">
                  <Hash className="w-4 h-4" />
                  Box: {customer.boxNumber}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant={getStatusBadgeVariant(customer.status)}
              className={getStatusColor(customer.status)}
            >
              {customer.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleItemsClick(customer)}
              className="flex items-center gap-1"
              data-testid={`customer-progress-items-${index}`}
            >
              <Package className="w-4 h-4" />
              {customer.totalItems} items
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span className="font-medium">
              {customer.scannedItems}/{customer.totalItems} ({customer.completionPercentage}%)
            </span>
          </div>
          <Progress 
            value={customer.completionPercentage} 
            className="h-2" 
            data-testid={`customer-progress-bar-${index}`}
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" data-testid="customer-progress-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer Progress - {jobName || 'Unassigned Job'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">
                    Customer Progress Overview
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Track completion status across all customers
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-lg px-3 py-1">
                {summary.completedCustomers}/{summary.totalCustomers} ({summary.completionPercentage}%)
              </Badge>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="customer-search-input"
                  />
                </div>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                    setSortBy(newSortBy);
                    setSortOrder(newSortOrder);
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  data-testid="sort-dropdown"
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="progress-asc">Progress (Low-High)</option>
                  <option value="progress-desc">Progress (High-Low)</option>
                  <option value="box-asc">Box (Low-High)</option>
                  <option value="box-desc">Box (High-Low)</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsGroupView(!isGroupView)}
                  className="flex items-center gap-2"
                  data-testid="group-view-toggle"
                >
                  {isGroupView ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  Group View
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status Filters:</span>
                {Object.entries(statusFilters).map(([status, enabled]) => (
                  <Button
                    key={status}
                    variant={enabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleStatusFilter(status as keyof typeof statusFilters)}
                    className="text-xs"
                    data-testid={`filter-${status.toLowerCase()}`}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading customer progress...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-8 text-red-600 dark:text-red-400">
                Failed to load customer progress. Please try again.
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredCustomers.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No customers found matching your filters.</p>
              </div>
            )}

            {/* Customer List */}
            {!isLoading && !error && filteredCustomers.length > 0 && (
              <div className="space-y-4">
                {!isGroupView ? (
                  // Individual List View
                  <div className="space-y-3">
                    {filteredCustomers.map((customer, index) => renderCustomerRow(customer, index))}
                  </div>
                ) : (
                  // Group View
                  <div className="space-y-6">
                    {Object.entries(groupedCustomers || {}).map(([groupName, groupCustomers]) => (
                      <div key={groupName} className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                          <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                            {groupName}
                          </h3>
                          <Badge variant="outline" className="ml-2">
                            {groupCustomers.length} customers
                          </Badge>
                        </div>
                        <div className="space-y-3 ml-4">
                          {groupCustomers.map((customer, index) => renderCustomerRow(customer, index))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Product Details Modal */}
      {selectedCustomer && (
        <CustomerProductDetailsModal
          isOpen={isProductDetailsOpen}
          onClose={() => {
            setIsProductDetailsOpen(false);
            setSelectedCustomer(null);
          }}
          jobId={jobId}
          customerName={selectedCustomer.customerName}
          totalItems={selectedCustomer.totalItems}
          productCount={selectedCustomer.totalItems} // Using totalItems as productCount for now
          groupName={selectedCustomer.groupName}
        />
      )}
    </>
  );
}