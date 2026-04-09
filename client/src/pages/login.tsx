import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { LogIn, KeyRound, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const recoverySchema = z.object({
  recoveryPhrase: z.string().min(1, "Recovery phrase is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginValues = z.infer<typeof loginSchema>;
type RecoveryValues = z.infer<typeof recoverySchema>;

export default function Login() {
  const { toast } = useToast();
  const [showRecovery, setShowRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const recoveryForm = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { recoveryPhrase: "", newPassword: "", confirmPassword: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginValues) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: "Login successful" });
    },
    onError: (error: Error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
  });

  const recoveryMutation = useMutation({
    mutationFn: async (data: RecoveryValues) => {
      const res = await apiRequest("POST", "/api/auth/recover", {
        recoveryPhrase: data.recoveryPhrase,
        newPassword: data.newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset successful", description: "You can now log in with your new password." });
      setShowRecovery(false);
      recoveryForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Recovery failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-3">
              {showRecovery ? (
                <KeyRound className="h-6 w-6 text-primary" />
              ) : (
                <LogIn className="h-6 w-6 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-xl" data-testid="text-login-title">
            {showRecovery ? "Account Recovery" : "Sign In"}
          </CardTitle>
          <CardDescription>
            {showRecovery
              ? "Enter your recovery phrase to reset your password"
              : "Enter your credentials to access the dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showRecovery ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your username" {...field} data-testid="input-login-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            {...field}
                            data-testid="input-login-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login-submit">
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowRecovery(true)}
                    className="text-sm text-muted-foreground hover:underline"
                    data-testid="link-forgot-access"
                  >
                    Forgot access?
                  </button>
                </div>
              </form>
            </Form>
          ) : (
            <form onSubmit={recoveryForm.handleSubmit((data) => recoveryMutation.mutate(data))} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="recoveryPhrase" className="text-sm font-medium leading-none">Recovery Phrase</label>
                <Input
                  id="recoveryPhrase"
                  placeholder="Enter your recovery phrase"
                  {...recoveryForm.register("recoveryPhrase")}
                  data-testid="input-recovery-phrase"
                />
                {recoveryForm.formState.errors.recoveryPhrase && (
                  <p className="text-sm font-medium text-destructive">{recoveryForm.formState.errors.recoveryPhrase.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium leading-none">New Password</label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    {...recoveryForm.register("newPassword")}
                    data-testid="input-recovery-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    data-testid="button-toggle-new-password"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {recoveryForm.formState.errors.newPassword && (
                  <p className="text-sm font-medium text-destructive">{recoveryForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium leading-none">Confirm Password</label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  {...recoveryForm.register("confirmPassword")}
                  data-testid="input-recovery-confirm-password"
                />
                {recoveryForm.formState.errors.confirmPassword && (
                  <p className="text-sm font-medium text-destructive">{recoveryForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={recoveryMutation.isPending} data-testid="button-recovery-submit">
                {recoveryMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowRecovery(false)}
                  className="text-sm text-muted-foreground hover:underline"
                  data-testid="link-back-to-login"
                >
                  Back to login
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
