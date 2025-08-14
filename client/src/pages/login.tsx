import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Package, Settings } from "lucide-react";
import { loginSchema, type Login } from "@shared/schema";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, user, isLoading } = useAuth();

  const form = useForm<Login>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      staffId: "",
      pin: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: Login) => {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (!result.success) {
        throw new Error(result.message || "Login failed");
      }

      return result;
    },
    onSuccess: (data) => {
      login(data.token, data.user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.name}!`,
      });

      // Redirect based on role
      switch (data.user.role) {
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
          setLocation("/manager");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Login) => {
    loginMutation.mutate(data);
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && user) {
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
          setLocation("/manager");
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Package className="h-12 w-12 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Warehouse Scanner
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="staffId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your staff ID"
                          autoComplete="username"
                          {...field}
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
                          type="password"
                          placeholder="Enter your PIN"
                          autoComplete="current-password"
                          {...field}
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
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Settings Button */}
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/settings")}
            data-testid="button-settings"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
}