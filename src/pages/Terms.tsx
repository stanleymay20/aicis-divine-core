import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-orbitron">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using the AICIS (Autonomous Intelligent Cybernetic Intervention System) platform,
                you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Use License</h2>
              <p className="text-muted-foreground mb-2">
                Permission is granted to temporarily access AICIS for personal or commercial use. This is the grant
                of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose without proper licensing</li>
                <li>Attempt to decompile or reverse engineer any software contained in AICIS</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
                <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. AI Decision-Making</h2>
              <p className="text-muted-foreground">
                AICIS employs artificial intelligence systems for automated decision-making. Users acknowledge that:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>AI decisions are probabilistic and may not always be perfect</li>
                <li>Human oversight and review mechanisms are in place</li>
                <li>Users have the right to appeal AI decisions through ethics review processes</li>
                <li>All AI decisions are logged and auditable for transparency</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Data Processing & Privacy</h2>
              <p className="text-muted-foreground">
                Your use of AICIS is also governed by our Privacy Policy. We process data in accordance with:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>GDPR (General Data Protection Regulation)</li>
                <li>CCPA (California Consumer Privacy Act)</li>
                <li>Other applicable data protection laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Service Availability</h2>
              <p className="text-muted-foreground">
                We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance
                will be communicated in advance. We are not liable for service interruptions caused by factors
                beyond our reasonable control.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Billing & Payments</h2>
              <p className="text-muted-foreground">
                Subscription fees are billed in advance on a monthly or annual basis. You authorize us to charge
                your payment method on file. Failure to pay may result in service suspension or termination.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, features, and functionality of AICIS are owned by the company and are protected
                by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                In no event shall AICIS or its suppliers be liable for any damages (including, without limitation,
                damages for loss of data or profit, or due to business interruption) arising out of the use or
                inability to use AICIS.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. Governing Law</h2>
              <p className="text-muted-foreground">
                These terms shall be governed by and construed in accordance with the laws of the jurisdiction
                in which our company is registered, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Contact Information</h2>
              <p className="text-muted-foreground">
                Questions about the Terms of Service should be sent to us at legal@aicis.com
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;
