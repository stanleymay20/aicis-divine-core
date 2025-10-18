import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    console.log("Executing queued objective tasks...");

    // Get all queued tasks
    const { data: tasks, error: fetchError } = await supabase
      .from("objective_tasks")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    console.log("Found", tasks?.length ?? 0, "queued tasks");

    let successCount = 0;
    let errorCount = 0;

    // Execute each task
    for (const task of tasks ?? []) {
      try {
        console.log(`Executing task ${task.id}: ${task.function_name}`);

        // Update status to running
        await supabase
          .from("objective_tasks")
          .update({ status: "running", updated_at: new Date().toISOString() })
          .eq("id", task.id);

        // Invoke the edge function
        const { data: functionData, error: functionError } = await supabase.functions.invoke(
          task.function_name,
          { body: task.parameters || {} }
        );

        if (functionError) throw functionError;

        // Update to done
        await supabase
          .from("objective_tasks")
          .update({
            status: "done",
            output_summary: JSON.stringify(functionData).substring(0, 1000),
            updated_at: new Date().toISOString()
          })
          .eq("id", task.id);

        // Log success
        await supabase.from("ai_learning_log").insert({
          source_table: "objective_tasks",
          record_id: task.id,
          insight: `Task ${task.function_name} succeeded for ${task.division}`,
          success: true
        });

        successCount++;
        console.log(`Task ${task.id} completed successfully`);
      } catch (e) {
        errorCount++;
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.error(`Task ${task.id} failed:`, errorMessage);

        // Update to error
        await supabase
          .from("objective_tasks")
          .update({
            status: "error",
            output_summary: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq("id", task.id);

        // Log failure
        await supabase.from("ai_learning_log").insert({
          source_table: "objective_tasks",
          record_id: task.id,
          insight: `Task ${task.function_name} failed: ${errorMessage}`,
          success: false
        });
      }
    }

    // Update objective statuses
    const { data: pendingObjectives } = await supabase
      .from("objectives")
      .select("id")
      .eq("status", "pending");

    for (const obj of pendingObjectives ?? []) {
      const { data: objTasks } = await supabase
        .from("objective_tasks")
        .select("status")
        .eq("objective_id", obj.id);

      const allDone = objTasks?.every(t => t.status === "done" || t.status === "error" || t.status === "skipped");
      const anyError = objTasks?.some(t => t.status === "error");

      if (allDone) {
        await supabase
          .from("objectives")
          .update({
            status: anyError ? "failed" : "completed",
            completed_at: new Date().toISOString()
          })
          .eq("id", obj.id);
      } else if (objTasks?.some(t => t.status === "running" || t.status === "done")) {
        await supabase
          .from("objectives")
          .update({ status: "executing", started_at: new Date().toISOString() })
          .eq("id", obj.id);
      }
    }

    // Log execution summary
    await supabase.from("system_logs").insert({
      division: "system",
      action: "execute_objectives",
      user_id: user.id,
      log_level: "info",
      result: `Executed ${tasks?.length ?? 0} tasks: ${successCount} succeeded, ${errorCount} failed`,
      metadata: { total: tasks?.length ?? 0, success: successCount, errors: errorCount }
    });

    await supabase.from("compliance_audit").insert({
      action_type: "autonomous_execution",
      division: "system",
      user_id: user.id,
      action_description: "Executed queued objective tasks",
      compliance_status: "compliant",
      data_accessed: { tasks_executed: tasks?.length ?? 0, success_count: successCount }
    });

    console.log("Execution complete:", successCount, "success,", errorCount, "errors");

    return new Response(
      JSON.stringify({
        ok: true,
        count: tasks?.length ?? 0,
        success: successCount,
        errors: errorCount,
        message: `Executed ${tasks?.length ?? 0} tasks: ${successCount} succeeded, ${errorCount} failed`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("execute-objectives error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
