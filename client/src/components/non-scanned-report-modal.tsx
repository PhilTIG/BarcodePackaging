import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, Hash, Users, Download, Grid3X3, List, SortAsc, SortDesc } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from 'xlsx';

interface NonScannedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobName?: string;
}

interface NonScannedItem {
  boxNumber: number;
  productName: string;
  customerName: string;
  groupName: string | null;
  quantityRequired: number; // Remaining quantity to scan
  quantityTotal: number; // Original total quantity
  barCode: string;
}

interface NonScannedReportData {
  items: NonScannedItem[];
  summary: {
    totalUnscannedItems: number;
    totalBoxesWithUnscanned: number;
    totalProductTypes: number;
  };
}

export function NonScannedReportModal({ isOpen, onClose, jobId, jobName }: NonScannedReportModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isGroupView, setIsGroupView] = useState(false);
  const [sortBy, setSortBy] = useState<'box' | 'product' | 'customer' | 'quantity'>('box');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['/api/jobs', jobId, 'non-scanned-report'],
    enabled: isOpen && !!jobId,
    refetchInterval: 30000, // Refresh every 30 seconds when open
  });

  const { items = [], summary } = (reportData as NonScannedReportData) || { 
    items: [], 
    summary: { totalUnscannedItems: 0, totalBoxesWithUnscanned: 0, totalProductTypes: 0 } 
  };

  // Filter, search, and sort items
  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      // Search filter across multiple fields
      const searchLower = searchTerm.toLowerCase();
      return (
        item.productName.toLowerCase().includes(searchLower) ||
        item.customerName.toLowerCase().includes(searchLower) ||
        item.barCode.toLowerCase().includes(searchLower) ||
        (item.groupName && item.groupName.toLowerCase().includes(searchLower)) ||
        item.boxNumber.toString().includes(searchLower)
      );
    });

    // Sort items
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'box':
          // Ensure numeric comparison for box numbers
          comparison = Number(a.boxNumber) - Number(b.boxNumber);
          break;
        case 'product':
          comparison = a.productName.localeCompare(b.productName);
          break;
        case 'customer':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'quantity':
          comparison = a.quantityRequired - b.quantityRequired;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [items, searchTerm, sortBy, sortOrder]);

  // Group items by box number if group view is enabled
  const groupedItems = useMemo(() => {
    if (!isGroupView) return null;
    
    const groups: { [key: string]: NonScannedItem[] } = {};
    filteredItems.forEach(item => {
      const groupKey = `Box ${item.boxNumber}`;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    
    return groups;
  }, [filteredItems, isGroupView]);

  const handleExcelExport = () => {
    if (filteredItems.length === 0) return;

    const exportData = filteredItems.map(item => ({
      'Box Number': item.boxNumber,
      'Product Name': item.productName,
      'Customer Name': item.customerName,
      'Group': item.groupName || 'No Group',
      'Quantity Required (Remaining)': item.quantityRequired,
      'Quantity Total': item.quantityTotal,
      'Barcode': item.barCode
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Non Scanned Items');
    
    // Add summary sheet
    const summaryData = [
      { Metric: 'Total Unscanned Items', Value: summary.totalUnscannedItems },
      { Metric: 'Total Boxes with Unscanned Items', Value: summary.totalBoxesWithUnscanned },
      { Metric: 'Total Product Types', Value: summary.totalProductTypes },
      { Metric: 'Export Date', Value: new Date().toLocaleString() }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const filename = `Non_Scanned_Report_${jobName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Job'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const renderItemRow = (item: NonScannedItem, index: number) => (
    <Card key={`${item.boxNumber}-${item.barCode}`} className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {item.productName}
            </h4>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <Hash className="w-4 h-4" />
                Box: {item.boxNumber}
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                Customer: {item.customerName}
              </span>
              {item.groupName && (
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Group: {item.groupName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {item.quantityRequired} needed
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                of {item.quantityTotal} total
              </div>
            </div>
            <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800">
              Unscanned
            </Badge>
          </div>
        </div>
        
        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Scanned Progress</span>
            <span className="text-gray-900 dark:text-gray-100">
              {item.quantityTotal - item.quantityRequired} / {item.quantityTotal}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-orange-500 h-2 rounded-full" 
              style={{ 
                width: `${((item.quantityTotal - item.quantityRequired) / item.quantityTotal) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Non Scanned Report</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-red-600 dark:text-red-400">Failed to load non-scanned items data</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Non Scanned Report</DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {jobName && `Job: ${jobName}`}
              </p>
            </div>
            <Button
              onClick={handleExcelExport}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-2"
              data-testid="export-excel-button"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading non-scanned items...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {summary.totalUnscannedItems}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Items to Scan
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {summary.totalBoxesWithUnscanned}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Boxes Affected
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {summary.totalProductTypes}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Product Types
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Search and Controls */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by product, customer, barcode, or box..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="box">Sort by Box</SelectItem>
                    <SelectItem value="product">Sort by Product</SelectItem>
                    <SelectItem value="customer">Sort by Customer</SelectItem>
                    <SelectItem value="quantity">Sort by Quantity</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-1"
                  data-testid="sort-order-button"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="group-view"
                    checked={isGroupView}
                    onCheckedChange={setIsGroupView}
                    data-testid="group-view-toggle"
                  />
                  <Label htmlFor="group-view" className="flex items-center gap-1">
                    {isGroupView ? <Grid3X3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
                    Group by Box
                  </Label>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {items.length === 0 ? "All items have been scanned!" : "No items match your search"}
                    </p>
                  </div>
                ) : (
                  <>
                    {!isGroupView ? (
                      <div className="space-y-3">
                        {filteredItems.map((item, index) => renderItemRow(item, index))}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {groupedItems && Object.entries(groupedItems).map(([groupName, groupItems]) => (
                          <div key={groupName}>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="secondary" className="text-sm">
                                {groupName}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {groupItems.length} products
                              </Badge>
                            </div>
                            <div className="space-y-3 ml-4">
                              {groupItems.map((item, index) => renderItemRow(item, index))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}