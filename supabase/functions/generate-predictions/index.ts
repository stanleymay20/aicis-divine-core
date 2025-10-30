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

    console.log('Generating predictive intelligence...');

    const divisions = ['health', 'food', 'energy', 'governance', 'finance', 'security'];
    const predictions = [];

    for (const division of divisions) {
      // Fetch recent historical data
      let historicalData = [];
      
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
      }

      if (historicalData.length === 0) continue;

      // Group by country/region
      const byCountry = historicalData.reduce((acc: any, item: any) => {
        const country = item.region || item.country || 'Unknown';
        if (!acc[country]) acc[country] = [];
        acc[country].push(item);
        return acc;
      }, {});

      // Generate predictions for each country
      for (const [country, data] of Object.entries(byCountry)) {
        if ((data as any[]).length < 3) continue;

        // Call AI for forecast
        const prompt = `Analyze this ${division} data for ${country} and provide a 90-day forecast.

Historical Data (most recent):
${JSON.stringify((data as any[]).slice(0, 10), null, 2)}

Provide:
1. A brief summary of the forecast
2. Predicted trend (increasing/stable/decreasing)
3. Risk level (low/medium/high/critical)
4. Confidence score (0-1)
5. Key factors driving the prediction
6. A 90-day timeline with predicted values

Return as JSON with: summary, trend, risk_level, confidence, key_factors, timeline[]`;

        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'You are a predictive analytics AI. Provide forecasts in valid JSON format only.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.3
            })
          });

          if (!aiResponse.ok) continue;

          const aiResult = await aiResponse.json();
          const forecastText = aiResult.choices[0]?.message?.content || '{}';
          
          let forecast;
          try {
            forecast = JSON.parse(forecastText);
          } catch {
            // Try to extract JSON from markdown code blocks
            const match = forecastText.match(/```json\n([\s\S]*?)\n```/);
            if (match) {
              forecast = JSON.parse(match[1]);
            } else {
              forecast = { summary: 'Unable to generate forecast', confidence: 0.5 };
            }
          }

          predictions.push({
            division,
            country,
            forecast,
            confidence: forecast.confidence || 0.7,
            volatility_index: forecast.volatility || 0.15
          });
        } catch (err) {
          console.error(`Error generating prediction for ${country} ${division}:`, err);
        }
      }
    }

    // Insert predictions
    let inserted = 0;
    for (const pred of predictions) {
      const { error } = await supabase.from('predictions').insert(pred);
      if (!error) inserted++;
    }

    console.log(`Generated ${inserted} predictions`);

    await supabase.from('system_logs').insert({
      division: 'intelligence',
      action: 'generate_predictions',
      result: 'success',
      log_level: 'info',
      metadata: { predictions_generated: inserted }
    });

    return new Response(
      JSON.stringify({ success: true, predictions_generated: inserted }),
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
