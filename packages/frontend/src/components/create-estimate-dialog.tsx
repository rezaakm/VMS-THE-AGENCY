import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertContractSchema, type InsertContract, type Vendor, type CostSheetItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface EnrichedItem extends CostSheetItem {
  costSheet?: {
    jobNumber: string;
    client: string;
    event: string;
  };
}

interface CreateEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: EnrichedItem[];
  onSuccess?: () => void;
}

export function CreateEstimateDialog({
  open,
  onOpenChange,
  selectedItems,
  onSuccess,
}: CreateEstimateDialogProps) {
  const { toast } = useToast();

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: open,
  });

  // Calculate total from selected items
  const totalValue = selectedItems.reduce((sum, item) => {
    const price = item.totalSellingPrice ? parseFloat(item.totalSellingPrice.toString()) : 0;
    return sum + price;
  }, 0);

  // Format selected items for terms field
  const formatItemsForTerms = () => {
    const itemList = selectedItems
      .map((item, index) => {
        const price = item.totalSellingPrice || "-";
        const vendor = item.vendor || "TBD";
        return `${index + 1}. ${item.description}\n   Vendor: ${vendor}\n   Price: ${price}${item.days ? `\n   Days: ${item.days}` : ""}`;
      })
      .join("\n\n");

    return `ESTIMATE LINE ITEMS\n\n${itemList}\n\nTOTAL ESTIMATE: ${totalValue.toFixed(2)}`;
  };

  const form = useForm<InsertContract>({
    resolver: zodResolver(insertContractSchema),
    defaultValues: {
      vendorId: "",
      name: "",
      value: totalValue.toFixed(2),
      startDate: "",
      endDate: "",
      status: "pending",
      terms: formatItemsForTerms(),
      renewalStatus: "manual",
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: InsertContract) => {
      return apiRequest("/api/contracts", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Estimate Created",
        description: `Contract created with ${selectedItems.length} items totaling ${totalValue.toFixed(2)}`,
      });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create estimate",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertContract) => {
    // Filter out "none" value for vendorId
    const submitData = {
      ...data,
      vendorId: data.vendorId === "none" ? "" : data.vendorId
    };
    createContractMutation.mutate(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Estimate from Selected Items
          </DialogTitle>
          <DialogDescription>
            Creating contract with {selectedItems.length} items
          </DialogDescription>
        </DialogHeader>

        {/* Selected Items Summary */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Selected Items
            </h3>
            <div className="text-sm text-muted-foreground">
              {selectedItems.length} items
            </div>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedItems.map((item, index) => (
              <div
                key={item.id}
                className="flex justify-between items-start text-sm p-2 bg-background rounded"
              >
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.vendor || "No vendor"} • {item.costSheet?.jobNumber ? `Job #${item.costSheet.jobNumber}` : "No job"}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="font-semibold">{item.totalSellingPrice || "-"}</p>
                  {item.days && (
                    <p className="text-xs text-muted-foreground">{item.days} days</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <span className="font-semibold">Estimated Total:</span>
            <span className="text-lg font-bold text-primary">{totalValue.toFixed(2)}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Estimate Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Event Production Estimate - Client Name"
                        {...field}
                        data-testid="input-estimate-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Primary Vendor (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-estimate-vendor">
                          <SelectValue placeholder="Select primary vendor or leave blank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No primary vendor</SelectItem>
                        {vendors?.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Value *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        data-testid="input-estimate-value"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-estimate-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-estimate-start-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-estimate-end-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Terms & Line Items</FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none font-mono text-xs"
                        rows={8}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-estimate-terms"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-estimate"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createContractMutation.isPending}
                data-testid="button-submit-estimate"
              >
                {createContractMutation.isPending ? "Creating..." : "Create Estimate"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
