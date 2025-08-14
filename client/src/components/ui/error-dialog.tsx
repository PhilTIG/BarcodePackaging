import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, X } from "lucide-react";

interface ErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  errors: string[];
}

export function ErrorDialog({ isOpen, onClose, title, errors }: ErrorDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="error-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            Detailed error information to help resolve the issue
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-96 w-full">
          <div className="space-y-3">
            {errors.map((error, index) => (
              <div
                key={index}
                className="p-3 bg-destructive/10 border border-destructive/20 rounded-md"
                data-testid={`error-item-${index}`}
              >
                <p className="text-sm text-destructive font-medium">
                  Error {index + 1}:
                </p>
                <p className="text-sm text-gray-700 mt-1">{error}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="flex justify-end pt-4">
          <Button
            onClick={onClose}
            variant="outline"
            data-testid="button-close-error-dialog"
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}