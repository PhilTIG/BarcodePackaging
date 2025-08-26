import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Download, 
  Search, 
  Package, 
  Users, 
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useUserPreferences } from '@/hooks/use-user-preferences';

interface GroupCustomer {
  customerName: string;
  barCode: string;
  productName: string;
  requiredQty: number;
  scannedQty: number;
  boxNumber: number;
}

interface GroupSummary {
  groupName: string;
  totalCustomers: number;
  totalItems: number;
  totalQty: number;
  totalScanned: number;
  completionRate: number;
}

export function GroupViewPage() {
  const { jobId, groupName } = useParams<{ jobId: string; groupName: string }>();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { preferences } = useUserPreferences();

  // Fetch group customers
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/groups/${groupName}/customers`],
    enabled: !!jobId && !!groupName
  });

  // Fetch all job groups for navigation
  const { data: allGroupsData } = useQuery({
    queryKey: [`/api/jobs/${jobId}/groups`],
    enabled: !!jobId
  });

  // Fetch job details for context
  const { data: jobData } = useQuery({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId
  });

  if (!jobId || !groupName) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Invalid Group View
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Job ID or Group Name is missing.
          </p>
        </div>
      </div>
    );
  }

  const customers: GroupCustomer[] = (customersData as any)?.customers || [];
  const allGroups: string[] = (allGroupsData as any)?.groups || [];
  const job = (jobData as any)?.job;

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.barCode.includes(searchTerm)
  );

  // Group customers by CustomerName
  const customerGroups = filteredCustomers.reduce((acc: Record<string, GroupCustomer[]>, customer) => {
    const key = customer.customerName;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(customer);
    return acc;
  }, {});

  // Calculate group summary
  const groupSummary: GroupSummary = {
    groupName,
    totalCustomers: Object.keys(customerGroups).length,
    totalItems: customers.length,
    totalQty: customers.reduce((sum, c) => sum + c.requiredQty, 0),
    totalScanned: customers.reduce((sum, c) => sum + (c.scannedQty || 0), 0),
    completionRate: 0
  };
  
  if (groupSummary.totalQty > 0) {
    groupSummary.completionRate = Math.round((groupSummary.totalScanned / groupSummary.totalQty) * 100);
  }

  // Handle Excel export
  const handleExcelExport = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/groups/${encodeURIComponent(groupName)}/export`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export group data');
      }

      const data = await response.json();
      
      // Create and trigger download
      const blob = new Blob([JSON.stringify(data.exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${groupName}_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Group "${groupName}" data has been exported successfully.`
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export group data. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBackToJob = () => {
    navigate(`/manager/jobs/${jobId}`);
  };

  const handleGroupChange = (newGroupName: string) => {
    navigate(`/group/${jobId}/${encodeURIComponent(newGroupName)}`);
  };

  if (customersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-pulse" />
              <p className="text-gray-600 dark:text-gray-400">Loading group data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleBackToJob}
              className="flex items-center gap-2"
              data-testid="back-to-job-button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Job
            </Button>
            
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Group: {groupName}
              </h1>
              {job && (
                <p className="text-gray-600 dark:text-gray-400">
                  Job: {job.name || jobId}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Group Navigation */}
            {allGroups.length > 1 && (
              <select
                value={groupName}
                onChange={(e) => handleGroupChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="group-selector"
              >
                {allGroups.map(group => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            )}

            <Button
              onClick={handleExcelExport}
              className="flex items-center gap-2"
              data-testid="export-button"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Group Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Group Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {groupSummary.totalCustomers}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Customers</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {groupSummary.totalItems}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Items</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {groupSummary.totalScanned}/{groupSummary.totalQty}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Scanned</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {groupSummary.completionRate}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Complete</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Overall Progress</span>
                <span>{groupSummary.completionRate}%</span>
              </div>
              <Progress value={groupSummary.completionRate} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search customers, products, or barcodes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setSearchTerm('')}
              >
                <Filter className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customer List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview" data-testid="overview-tab">
              Overview ({Object.keys(customerGroups).length})
            </TabsTrigger>
            <TabsTrigger value="detailed" data-testid="detailed-tab">
              Detailed View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {Object.keys(customerGroups).length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No customers found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {searchTerm 
                        ? 'No customers match your search criteria.' 
                        : 'This group has no customers assigned yet.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {Object.entries(customerGroups).map(([customerName, items]) => {
                  const customerQty = items.reduce((sum, item) => sum + item.requiredQty, 0);
                  const customerScanned = items.reduce((sum, item) => sum + (item.scannedQty || 0), 0);
                  const customerProgress = customerQty > 0 ? Math.round((customerScanned / customerQty) * 100) : 0;
                  const isComplete = customerProgress === 100;
                  
                  return (
                    <Card 
                      key={customerName} 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedCustomer === customerName ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedCustomer(
                        selectedCustomer === customerName ? null : customerName
                      )}
                      data-testid={`customer-card-${customerName}`}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isComplete ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : customerScanned > 0 ? (
                              <AlertTriangle className="h-5 w-5 text-orange-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="truncate">{customerName}</span>
                          </div>
                          
                          <Badge 
                            variant={isComplete ? 'default' : 'secondary'}
                            className={isComplete ? 'bg-green-100 text-green-800' : ''}
                          >
                            {customerProgress}%
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span>Items: {items.length}</span>
                            <span>Qty: {customerScanned}/{customerQty}</span>
                          </div>
                          
                          <Progress value={customerProgress} className="h-2" />
                          
                          {selectedCustomer === customerName && (
                            <div className="mt-4 space-y-2 border-t pt-3">
                              <h4 className="font-medium text-sm">Products:</h4>
                              {items.map((item, index) => (
                                <div 
                                  key={`${item.barCode}-${index}`}
                                  className="flex justify-between text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded"
                                >
                                  <div>
                                    <div className="font-medium">{item.productName}</div>
                                    <div className="text-gray-500">{item.barCode}</div>
                                  </div>
                                  <div className="text-right">
                                    <div>Box {item.boxNumber}</div>
                                    <div>{item.scannedQty}/{item.requiredQty}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Item View</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No items to display.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Customer</th>
                          <th className="text-left p-2">Product</th>
                          <th className="text-left p-2">Barcode</th>
                          <th className="text-center p-2">Box</th>
                          <th className="text-center p-2">Qty</th>
                          <th className="text-center p-2">Scanned</th>
                          <th className="text-center p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((item, index) => {
                          const isComplete = item.scannedQty >= item.requiredQty;
                          return (
                            <tr 
                              key={`${item.barCode}-${index}`} 
                              className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <td className="p-2">{item.customerName}</td>
                              <td className="p-2">{item.productName}</td>
                              <td className="p-2 font-mono text-sm">{item.barCode}</td>
                              <td className="p-2 text-center">{item.boxNumber}</td>
                              <td className="p-2 text-center">{item.requiredQty}</td>
                              <td className="p-2 text-center">{item.scannedQty || 0}</td>
                              <td className="p-2 text-center">
                                {isComplete ? (
                                  <Badge className="bg-green-100 text-green-800">Complete</Badge>
                                ) : item.scannedQty > 0 ? (
                                  <Badge className="bg-orange-100 text-orange-800">Partial</Badge>
                                ) : (
                                  <Badge variant="secondary">Pending</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}