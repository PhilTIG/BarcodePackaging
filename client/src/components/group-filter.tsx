import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GroupFilterProps {
  availableGroups: string[];
  selectedGroups: string[];
  onSelectionChange: (groups: string[]) => void;
  placeholder?: string;
}

export function GroupFilter({
  availableGroups,
  selectedGroups,
  onSelectionChange,
  placeholder = "Filter by group..."
}: GroupFilterProps) {
  const [open, setOpen] = useState(false);

  // Don't render if no groups available
  if (!availableGroups || availableGroups.length === 0) {
    return null;
  }

  // Sort groups alphabetically
  const sortedGroups = [...availableGroups].sort((a, b) => a.localeCompare(b));

  const handleSelect = (group: string) => {
    if (selectedGroups.includes(group)) {
      // Remove from selection
      onSelectionChange(selectedGroups.filter(g => g !== group));
    } else {
      // Add to selection
      onSelectionChange([...selectedGroups, group]);
    }
  };

  const handleRemove = (group: string) => {
    onSelectionChange(selectedGroups.filter(g => g !== group));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[240px] justify-between"
            data-testid="group-filter-trigger"
          >
            {selectedGroups.length === 0
              ? placeholder
              : `${selectedGroups.length} group${selectedGroups.length > 1 ? 's' : ''} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0">
          <Command>
            <CommandInput placeholder="Search groups..." />
            <CommandEmpty>No groups found.</CommandEmpty>
            <CommandGroup>
              {sortedGroups.map((group) => (
                <CommandItem
                  key={group}
                  value={group}
                  onSelect={() => handleSelect(group)}
                  data-testid={`group-option-${group}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedGroups.includes(group) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {group}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected groups display */}
      {selectedGroups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedGroups.map((group) => (
            <Badge
              key={group}
              variant="secondary"
              className="text-xs"
              data-testid={`selected-group-${group}`}
            >
              {group}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(group);
                }}
                className="ml-1 hover:bg-gray-600 rounded-full p-0.5"
                data-testid={`remove-group-${group}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-6 px-2 text-xs"
            data-testid="clear-groups"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}