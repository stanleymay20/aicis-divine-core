import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
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
            <CardTitle className="text-3xl font-orbitron">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground">
                AICIS ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains
                how we collect, use, disclose, and safeguard your information when you use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Information We Collect</h2>
              <h3 className="text-xl font-semibold mb-2">Personal Information</h3>
              <p className="text-muted-foreground mb-2">We collect information that you provide directly to us:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Name and contact information (email, phone)</li>
                <li>Account credentials</li>
                <li>Organization details</li>
                <li>Billing and payment information</li>
                <li>Communications with us</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Automatically Collected Information</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Usage data (pages viewed, features used, time spent)</li>
                <li>Device information (browser type, IP address, operating system)</li>
                <li>Log data (access times, error logs)</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-2">We use collected information for:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Providing, maintaining, and improving our services</li>
                <li>Processing transactions and sending related information</li>
                <li>Sending administrative information, updates, and security alerts</li>
                <li>Responding to your comments, questions, and customer service requests</li>
                <li>Monitoring and analyzing trends, usage, and activities</li>
                <li>Detecting, preventing, and addressing technical issues and security threats</li>
                <li>Training and improving our AI models (with your consent)</li>
                <li>Complying with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. AI & Machine Learning</h2>
              <p className="text-muted-foreground">
                AICIS uses artificial intelligence and machine learning technologies. We want to be transparent about how
                your data may be used:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Aggregated, anonymized data may be used to train and improve our AI models</li>
                <li>You can opt out of having your data used for AI training purposes</li>
                <li>All AI decisions are logged and auditable</li>
                <li>You have the right to request human review of AI decisions affecting you</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Data Sharing & Disclosure</h2>
              <p className="text-muted-foreground mb-2">We may share your information:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>With your consent:</strong> We may share your information with your explicit consent</li>
                <li><strong>Service providers:</strong> Third-party vendors who perform services on our behalf</li>
                <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business transfers:</strong> In connection with a merger, sale, or acquisition</li>
                <li><strong>Aggregated data:</strong> Anonymized data that cannot identify you personally</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Your Data Rights (GDPR & CCPA)</h2>
              <p className="text-muted-foreground mb-2">You have the right to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
                <li><strong>Erasure:</strong> Request deletion of your personal data ("right to be forgotten")</li>
                <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
                <li><strong>Restriction:</strong> Request restriction of processing under certain conditions</li>
                <li><strong>Objection:</strong> Object to processing of your data</li>
                <li><strong>Withdraw consent:</strong> Withdraw consent at any time (without affecting prior processing)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                To exercise these rights, please contact privacy@aicis.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your data:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Encryption in transit and at rest</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and authentication requirements</li>
                <li>Employee training on data protection</li>
                <li>Incident response and breach notification procedures</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your information for as long as necessary to provide our services and comply with legal
                obligations. When data is no longer needed, we securely delete or anonymize it.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. International Data Transfers</h2>
              <p className="text-muted-foreground">
                Your data may be transferred to and processed in countries other than your own. We ensure appropriate
                safeguards are in place for such transfers in accordance with applicable data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Children's Privacy</h2>
              <p className="text-muted-foreground">
                AICIS is not intended for children under 16 years of age. We do not knowingly collect personal
                information from children. If you become aware that a child has provided us with personal data,
                please contact us.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of significant changes via
                email or through a prominent notice on our platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">12. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy, please contact us at:
              </p>
              <p className="text-muted-foreground mt-2">
                Email: privacy@aicis.com<br />
                Data Protection Officer: dpo@aicis.com
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;
