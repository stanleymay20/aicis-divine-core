import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Building, CreditCard, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 99,
    features: ["Basic Analytics", "10 AI Divisions", "Email Support", "1 User"],
  },
  {
    key: "pro",
    name: "Professional",
    price: 499,
    features: ["Advanced Analytics", "50 AI Divisions", "Priority Support", "10 Users", "API Access"],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 2499,
    features: ["All Features", "Unlimited Divisions", "24/7 Dedicated Support", "Unlimited Users", "White Label", "Federation", "Custom Integrations"],
  },
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Step 2: Organization
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");

  // Step 3: Plan
  const [selectedPlan, setSelectedPlan] = useState("pro");

  // Step 4: Terms
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = async () => {
    if (step === 1) {
      if (!fullName || !email || !password) {
        toast({
          title: "Validation Error",
          description: "Please fill in all fields",
          variant: "destructive",
        });
        return;
      }
      if (password.length < 8) {
        toast({
          title: "Validation Error",
          description: "Password must be at least 8 characters",
          variant: "destructive",
        });
        return;
      }
    }

    if (step === 2) {
      if (!orgName) {
        toast({
          title: "Validation Error",
          description: "Please enter your organization name",
          variant: "destructive",
        });
        return;
      }
    }

    if (step === 4) {
      if (!acceptTerms || !acceptPrivacy) {
        toast({
          title: "Validation Error",
          description: "Please accept the terms and privacy policy",
          variant: "destructive",
        });
        return;
      }
      await completeOnboarding();
      return;
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const completeOnboarding = async () => {
    setLoading(true);

    try {
      // 1. Create account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;

      // 2. Create organization
      const { data: orgData, error: orgError } = await supabase.functions.invoke("create-organization", {
        body: {
          name: orgName,
          industry,
          plan_key: selectedPlan,
        },
      });

      if (orgError) throw orgError;

      // 3. Log acceptance of terms
      await supabase.from("compliance_audit").insert({
        user_id: authData.user?.id,
        action_type: "terms_accepted",
        action_description: "User accepted Terms of Service and Privacy Policy during onboarding",
        compliance_status: "compliant",
        data_accessed: {
          terms_version: "1.0",
          privacy_version: "1.0",
          accepted_at: new Date().toISOString(),
        },
      });

      toast({
        title: "Welcome to AICIS!",
        description: "Your account has been created successfully. Redirecting to dashboard...",
      });

      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: "Onboarding Failed",
        description: error.message || "An error occurred during onboarding",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,hsl(189_40%_20%_/_0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(189_40%_20%_/_0.1)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[128px] pointer-events-none" />

      <Card className="w-full max-w-2xl bg-card/50 backdrop-blur-sm border-primary/20 relative z-10">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl font-orbitron">AICIS Onboarding</CardTitle>
                <CardDescription>Step {step} of {totalSteps}</CardDescription>
              </div>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Account Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-2">Create Your Account</h2>
                <p className="text-muted-foreground">Let's get started with your basic information</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Stanley Osei-Wusu"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password (min 8 characters)</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                />
              </div>
            </div>
          )}

          {/* Step 2: Organization */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Building className="h-12 w-12 text-primary mx-auto mb-2" />
                <h2 className="text-xl font-semibold mb-2">Organization Setup</h2>
                <p className="text-muted-foreground">Tell us about your organization</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Corporation"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry (Optional)</Label>
                <Input
                  id="industry"
                  placeholder="Healthcare, Finance, Education, etc."
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 3: Plan Selection */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <CreditCard className="h-12 w-12 text-primary mx-auto mb-2" />
                <h2 className="text-xl font-semibold mb-2">Choose Your Plan</h2>
                <p className="text-muted-foreground">Select the plan that fits your needs</p>
              </div>

              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                <div className="space-y-3">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.key}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPlan === plan.key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedPlan(plan.key)}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={plan.key} id={plan.key} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <Label htmlFor={plan.key} className="text-lg font-semibold cursor-pointer">
                              {plan.name}
                            </Label>
                            <span className="text-xl font-bold">${plan.price}/mo</span>
                          </div>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-success" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 4: Terms & Conditions */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <CheckCircle className="h-12 w-12 text-primary mx-auto mb-2" />
                <h2 className="text-xl font-semibold mb-2">Terms & Agreements</h2>
                <p className="text-muted-foreground">Review and accept our terms to continue</p>
              </div>

              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="terms" className="cursor-pointer font-medium">
                      I accept the Terms of Service
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      By using AICIS, you agree to our terms of service governing the use of our platform.{" "}
                      <a href="/terms" target="_blank" className="text-primary hover:underline">
                        Read terms
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="privacy"
                    checked={acceptPrivacy}
                    onCheckedChange={(checked) => setAcceptPrivacy(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="privacy" className="cursor-pointer font-medium">
                      I accept the Privacy Policy
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      We respect your privacy and are committed to protecting your data.{" "}
                      <a href="/privacy" target="_blank" className="text-primary hover:underline">
                        Read policy
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm">
                <p className="font-medium mb-2">What happens next?</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✓ Your account will be created instantly</li>
                  <li>✓ Your organization will be set up with the {PLANS.find(p => p.key === selectedPlan)?.name} plan</li>
                  <li>✓ You'll receive a welcome email with getting started guides</li>
                  <li>✓ You can start using AICIS immediately</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={loading}
              className={`${step === 1 ? "w-full" : "ml-auto"}`}
            >
              {loading ? (
                "Processing..."
              ) : step === totalSteps ? (
                <>
                  Complete Setup
                  <CheckCircle className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-center text-sm text-muted-foreground pt-4 border-t">
            Already have an account?{" "}
            <a href="/auth" className="text-primary hover:underline">
              Sign in here
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
