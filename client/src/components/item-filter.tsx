import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface ItemFilterProps {
  availableProducts: string[]; // List of all product names in the job
  selectedProducts: string[];
  onSelectionChange: (products: string[]) => void;
  placeholder?: string;
}

export function ItemFilter({ 
  availableProducts, 
  selectedProducts, 
  onSelectionChange, 
  placeholder = "Filter by product..." 
}: ItemFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Sort products alphabetically
  const sortedProducts = availableProducts.sort((a, b) => a.localeCompare(b));
  
  // Filter products based on search
  const filteredProducts = sortedProducts.filter(product =>
    product.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleProductSelect = (productName: string) => {
    if (selectedProducts.includes(productName)) {
      // Remove if already selected
      onSelectionChange(selectedProducts.filter(p => p !== productName));
    } else {
      // Add to selection
      onSelectionChange([...selectedProducts, productName]);
    }
  };

  const handleRemoveProduct = (productName: string) => {
    onSelectionChange(selectedProducts.filter(p => p !== productName));
  };

  const clearAllFilters = () => {
    onSelectionChange([]);
  };

  return (
    <div className="flex flex-col gap-2" data-testid="item-filter">
      {/* Filter Control */}
      <div className="flex items-center gap-2 justify-start">
        <div className="ml-8">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-64 justify-between"
                data-testid="button-filter-products"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    {selectedProducts.length > 0 
                      ? `${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} selected`
                      : placeholder
                    }
                  </span>
                </div>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
          <PopoverContent className="w-64 p-0" data-testid="filter-dropdown">
            <Command>
              <CommandInput 
                placeholder="Search products..." 
                value={searchValue}
                onValueChange={setSearchValue}
                data-testid="input-product-search"
              />
              <CommandEmpty>No products found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <CommandItem
                    key={product}
                    value={product}
                    onSelect={() => handleProductSelect(product)}
                    data-testid={`product-option-${product.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={cn(
                        "text-sm",
                        selectedProducts.includes(product) && "font-medium"
                      )}>
                        {product}
                      </span>
                      {selectedProducts.includes(product) && (
                        <div className="h-2 w-2 bg-blue-600 rounded-full" />
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
        </div>
        
        {selectedProducts.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-gray-600 hover:text-gray-800"
            data-testid="button-clear-all-filters"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Selected Products Display */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="selected-products">
          {selectedProducts.map((product) => (
            <Badge
              key={product}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
              data-testid={`selected-product-${product.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <span className="text-sm">{product}</span>
              <button
                onClick={() => handleRemoveProduct(product)}
                className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                data-testid={`button-remove-${product.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}