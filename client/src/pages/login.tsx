import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { loginSchema, type Login } from "@shared/schema";
import { Settings, Package } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, user, isLoading } = useAuth();

  // Redirect authenticated users
  useEffect(() => {
    if (user && !isLoading) {
      switch (user.role) {
        case "manager":
          setLocation("/manager");
          break;
        case "supervisor":
          setLocation("/supervisor");
          break;
        case "worker":
          setLocation("/scanner");
          break;
        default:
          setLocation("/");
      }
    }
  }, [user, isLoading, setLocation]);

  const form = useForm<Login>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      staffId: "",
      pin: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: Login) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.name}!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Login) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="text-center">
          <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="text-primary-600 text-2xl" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Warehouse Scanner
          </CardTitle>
          <p className="text-gray-600">
            Efficient barcode scanning for order sorting
          </p>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="staffId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your staff ID"
                        data-testid="input-staff-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIN</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter your PIN"
                        data-testid="input-pin"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />



              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "Logging in..." : "Login"}
              </Button>
            </form>
          </Form>

          
        </CardContent>
      </Card>
    </div>
  );
}
