import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, CheckCircle2, Wallet, Hash, Copy } from "lucide-react";
import { SiMeta } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const applicationFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
  facebookLink: z.string().url("Must be a valid Facebook profile URL"),
  duration: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]),
  sellerType: z.enum(["personal_facebook_id", "facebook_business_page"]),
  paymentMethod: z.enum(["bkash", "nagad"]),
  senderNumber: z.string().min(1, "Sender number is required"),
});

type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

const personalPricing: Record<string, string> = {
  "1": "২০০ টাকা", "2": "৩৮০ টাকা", "3": "৫৫০ টাকা", "4": "৭০০ টাকা",
  "5": "৮৫০ টাকা", "6": "১০০০ টাকা", "7": "১১০০ টাকা", "8": "১২০০ টাকা",
  "9": "১৩০০ টাকা", "10": "১৪০০ টাকা", "11": "১৫০০ টাকা", "12": "১৬০০ টাকা",
};

const businessPricing: Record<string, string> = {
  "1": "৩০০ টাকা", "2": "৫৫০ টাকা", "3": "৮০০ টাকা", "4": "১০০০ টাকা",
  "5": "১২০০ টাকা", "6": "১৪০০ টাকা", "7": "১৬০০ টাকা", "8": "১৮০০ টাকা",
  "9": "২০০০ টাকা", "10": "২২০০ টাকা", "11": "২৪০০ টাকা", "12": "২৬০০ টাকা",
};

const monthLabels: Record<string, string> = {
  "1": "১ মাস", "2": "২ মাস", "3": "৩ মাস", "4": "৪ মাস",
  "5": "৫ মাস", "6": "৬ মাস", "7": "৭ মাস", "8": "৮ মাস",
  "9": "৯ মাস", "10": "১০ মাস", "11": "১১ মাস", "12": "১২ মাস",
};

const dashboardPackages = ["1", "6", "9", "12"];

export default function SellerApplication() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      facebookLink: "",
      duration: "1",
      sellerType: "personal_facebook_id",
      paymentMethod: "bkash",
      senderNumber: "",
    },
  });

  const sellerType = form.watch("sellerType");
  const currentPricing = sellerType === "facebook_business_page" ? businessPricing : personalPricing;

  const submitMutation = useMutation({
    mutationFn: async (data: ApplicationFormValues) => {
      const res = await apiRequest("POST", "/api/applications", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Application submitted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ApplicationFormValues) => {
    submitMutation.mutate(data);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-5">
            <div className="mx-auto rounded-full bg-emerald-500/15 p-4 w-fit">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold" data-testid="text-success-title">ধন্যবাদ।</h2>
            <div className="space-y-3 text-muted-foreground" data-testid="text-success-message">
              <p>আপনার আবেদন সফলভাবে গ্রহণ করা হয়েছে।</p>
              <p>আমাদের টিম আপনার পেমেন্ট যাচাই করে খুব শীঘ্রই আপনার সেলার কোড একটিভ করে দেবে।</p>
              <p>অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।</p>
              <p className="font-medium text-foreground">ধন্যবাদ।</p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/apply"}
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Card data-testid="card-payment-info">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold" data-testid="text-payment-title">পেমেন্ট পদ্ধতি</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">বিকাশ</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary" data-testid="text-bkash-number">01827259372</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText("01827259372");
                      toast({ title: "নাম্বার কপি হয়েছে" });
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">নগদ</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary" data-testid="text-nagad-number">01972002118</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText("01972002118");
                      toast({ title: "নাম্বার কপি হয়েছে" });
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">শুধুমাত্র সেন্ড মানি করুন</p>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-center">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400" data-testid="text-payment-instruction">
                অনুগ্রহ করে প্রথমে নিচ থেকে সাবস্ক্রিপশন প্যাকেজ নির্বাচন করুন, তারপর উপরের নাম্বারে Send Money করুন।
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pricing">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold" data-testid="text-pricing-title">সাবস্ক্রিপশন প্যাকেজ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {dashboardPackages.map((key) => (
                <div
                  key={key}
                  className="rounded-lg border p-3 text-center"
                  data-testid={`pricing-${monthLabels[key]}`}
                >
                  <div className="text-sm font-medium text-muted-foreground">{monthLabels[key]}</div>
                  <div className="text-lg font-bold mt-1">{currentPricing[key]}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold" data-testid="text-apply-title">সেলার আবেদন</CardTitle>
            <CardDescription>
              আমাদের ফেসবুক গ্রুপে সেলার হতে নিচের ফর্মটি পূরণ করুন।
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>নাম</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="আপনার পূর্ণ নাম লিখুন" className="pl-9" {...field} data-testid="input-apply-name" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>মোবাইল নাম্বার</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="আপনার মোবাইল নাম্বার লিখুন" className="pl-9" {...field} data-testid="input-apply-phone" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="facebookLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>সাবস্ক্রিপশন নেওয়ার ফেসবুক আইডি / পেজের লিংক</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <SiMeta className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="https://facebook.com/yourprofile" className="pl-9" {...field} data-testid="input-apply-facebook" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sellerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>সেলার ধরন নির্বাচন করুন</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-apply-seller-type">
                            <SelectValue placeholder="সেলার ধরন নির্বাচন করুন" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="personal_facebook_id">পার্সোনাল ফেসবুক আইডি</SelectItem>
                          <SelectItem value="facebook_business_page">ফেসবুক বিজনেস পেজ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>মেয়াদ সিলেক্ট করুন</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-apply-duration">
                            <SelectValue placeholder="আপনার পছন্দের মেয়াদ নির্বাচন করুন" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.keys(monthLabels).map((key) => (
                            <SelectItem key={key} value={key}>{monthLabels[key]} - {currentPricing[key]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>পেমেন্টের মাধ্যম নির্বাচন করুন</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-apply-payment-method">
                            <SelectValue placeholder="পেমেন্ট মাধ্যম নির্বাচন করুন" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bkash">বিকাশ</SelectItem>
                          <SelectItem value="nagad">নগদ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="senderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>যে নাম্বার থেকে টাকা পাঠানো হয়েছে</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="যে নাম্বার থেকে টাকা পাঠিয়েছেন সেই নাম্বার লিখুন" className="pl-9" {...field} data-testid="input-apply-sender-number" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-application"
                >
                  {submitMutation.isPending ? "জমা হচ্ছে..." : "আবেদন জমা দিন"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
