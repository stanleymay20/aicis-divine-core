import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface PilotRecordFormProps {
  entry: any;
  onClose: () => void;
}

const PilotRecordForm = ({ entry, onClose }: PilotRecordFormProps) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pilot_partner: entry.pilot_partner || "",
    pilot_action_taken: entry.pilot_action_taken || "",
    pilot_outcome: entry.pilot_outcome || "",
    measured_outcome: entry.measured_outcome || "",
    measured_impact_score: entry.measured_impact_score?.toString() || "",
    evidence_type: entry.evidence_type || "hypothetical",
  });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("decision_outcome_log")
      .update({
        pilot_partner: form.pilot_partner || null,
        pilot_action_taken: form.pilot_action_taken || null,
        pilot_outcome: form.pilot_outcome || null,
        measured_outcome: form.measured_outcome || null,
        measured_impact_score: form.measured_impact_score ? parseFloat(form.measured_impact_score) : null,
        evidence_type: form.evidence_type as any,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to save pilot record");
    } else {
      toast.success("Pilot record saved");
      queryClient.invalidateQueries({ queryKey: ["decision-outcome-log"] });
      onClose();
    }
  };

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-accent-foreground" />
            Record Pilot Action — {entry.signal_title}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Evidence Type</label>
            <Select value={form.evidence_type} onValueChange={(v) => setForm({ ...form, evidence_type: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hypothetical">Hypothetical</SelectItem>
                <SelectItem value="pilot">Pilot (Action Recorded)</SelectItem>
                <SelectItem value="measured">Measured (Outcome Verified)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Pilot Partner</label>
            <Input
              className="h-8 text-xs"
              placeholder="e.g. Ghana Ministry of Agriculture"
              value={form.pilot_partner}
              onChange={(e) => setForm({ ...form, pilot_partner: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Action Taken</label>
          <Textarea
            className="text-xs min-h-[60px]"
            placeholder="Describe the actual decision or action taken based on this signal..."
            value={form.pilot_action_taken}
            onChange={(e) => setForm({ ...form, pilot_action_taken: e.target.value })}
          />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Outcome / Result</label>
          <Textarea
            className="text-xs min-h-[60px]"
            placeholder="What happened after the action was taken?"
            value={form.pilot_outcome}
            onChange={(e) => setForm({ ...form, pilot_outcome: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Measured Outcome</label>
            <Textarea
              className="text-xs min-h-[60px]"
              placeholder="Quantified impact: e.g. 'Saved 14 days response time, $2.3M avoided cost'"
              value={form.measured_outcome}
              onChange={(e) => setForm({ ...form, measured_outcome: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Impact Score (0–100)</label>
            <Input
              className="h-8 text-xs"
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 72"
              value={form.measured_impact_score}
              onChange={(e) => setForm({ ...form, measured_impact_score: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
            <Save className="h-3 w-3 mr-1" />
            {saving ? "Saving..." : "Save Pilot Record"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PilotRecordForm;
