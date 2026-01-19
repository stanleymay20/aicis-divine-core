import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    console.log('Generating predictive intelligence across all divisions...');

    const divisions = ['health', 'food', 'energy', 'governance', 'finance', 'security'];
    const predictions: any[] = [];

    for (const division of divisions) {
      console.log(`Processing division: ${division}`);
      let historicalData: any[] = [];
      
      switch (division) {
        case 'health':
          const { data: healthData } = await supabase
            .from('health_data')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50);
          historicalData = healthData || [];
          break;
        case 'food':
          const { data: foodData } = await supabase
            .from('food_security')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50);
          historicalData = foodData || [];
          break;
        case 'energy':
          const { data: energyData } = await supabase
            .from('energy_grid')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50);
          historicalData = energyData || [];
          break;
        case 'governance':
          const { data: govData } = await supabase
            .from('governance_global')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          historicalData = govData || [];
          break;
        case 'finance':
          const { data: finData } = await supabase
            .from('finance_data')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(100);
          historicalData = finData || [];
          break;
        case 'security':
          const { data: secData } = await supabase
            .from('security_incidents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          historicalData = secData || [];
          break;
      }

      console.log(`${division}: found ${historicalData.length} records`);

      if (historicalData.length === 0) continue;

      // Group by country/region
      const byCountry = historicalData.reduce((acc: any, item: any) => {
        const country = item.country || item.region || item.iso_code || 'Global';
        if (!acc[country]) acc[country] = [];
        acc[country].push(item);
        return acc;
      }, {});

      // Generate predictions for each country (lowered threshold to 1)
      for (const [country, data] of Object.entries(byCountry)) {
        const dataArray = data as any[];
        if (dataArray.length < 1) continue;

        // Generate AI-powered forecast
        const prompt = `Analyze this ${division} data for ${country} and provide a 90-day forecast.

Historical Data:
${JSON.stringify(dataArray.slice(0, 5), null, 2)}

Provide a JSON response with these exact fields:
{
  "summary": "Brief 1-2 sentence forecast summary",
  "trend": "increasing" | "stable" | "decreasing",
  "risk_level": "low" | "medium" | "high" | "critical",
  "confidence": 0.0-1.0,
  "key_factors": ["factor1", "factor2"],
  "timeline": [
    {"date": "2026-01-20", "value": 100, "event": "optional note"},
    {"date": "2026-02-20", "value": 105},
    {"date": "2026-03-20", "value": 110}
  ]
}

Return ONLY the JSON object, no markdown.`;

        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: 'You are AICIS predictive analytics AI. Provide forecasts in valid JSON format only. No markdown.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.3
            })
          });

          if (!aiResponse.ok) {
            console.error(`AI response not ok for ${country} ${division}: ${aiResponse.status}`);
            continue;
          }

          const aiResult = await aiResponse.json();
          const forecastText = aiResult.choices?.[0]?.message?.content || '{}';
          
          let forecast;
          try {
            // Try direct parse
            forecast = JSON.parse(forecastText);
          } catch {
            // Try to extract JSON from markdown code blocks
            const match = forecastText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
              try {
                forecast = JSON.parse(match[1]);
              } catch {
                forecast = { summary: `Forecast pending for ${country}`, confidence: 0.5, trend: 'stable', risk_level: 'medium' };
              }
            } else {
              forecast = { summary: `Forecast analysis for ${country}`, confidence: 0.5, trend: 'stable', risk_level: 'medium' };
            }
          }

          predictions.push({
            division,
            country,
            forecast,
            confidence: forecast.confidence || 0.7,
            volatility_index: forecast.risk_level === 'critical' ? 0.8 : 
                             forecast.risk_level === 'high' ? 0.6 : 
                             forecast.risk_level === 'medium' ? 0.4 : 0.2,
            predicted_at: new Date().toISOString()
          });

          console.log(`Generated prediction for ${country} in ${division}`);
        } catch (err) {
          console.error(`Error generating prediction for ${country} ${division}:`, err);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Insert predictions in batch
    console.log(`Inserting ${predictions.length} predictions...`);
    
    let inserted = 0;
    for (const pred of predictions) {
      const { error } = await supabase.from('predictions').insert({
        division: pred.division,
        country: pred.country,
        forecast: pred.forecast,
        confidence: pred.confidence,
        volatility_index: pred.volatility_index,
        predicted_at: pred.predicted_at
      });
      if (error) {
        console.error(`Insert error for ${pred.country}:`, error.message);
      } else {
        inserted++;
      }
    }

    console.log(`Successfully inserted ${inserted} of ${predictions.length} predictions`);

    await supabase.from('system_logs').insert({
      division: 'intelligence',
      action: 'generate_predictions',
      result: 'success',
      log_level: 'info',
      metadata: { 
        predictions_generated: inserted,
        divisions_processed: divisions.length,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        predictions_generated: inserted,
        total_processed: predictions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating predictions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
