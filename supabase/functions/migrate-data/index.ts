import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OLD_PROJECT_URL = "https://xwbyyzvtwcsehmprsbvg.supabase.co";
const TABLES = ["clientes", "prestadores", "equipamentos", "insumos"];

async function fetchFromOldProject(table: string, apiKey: string): Promise<any[]> {
  const url = `${OLD_PROJECT_URL}/functions/v1/api-export?table=${table}&limit=10000&format=json`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch ${table}: ${res.status} - ${text}`);
  }

  const json = await res.json();
  return json.data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const exportApiKey = Deno.env.get("EXPORT_API_KEY");
    if (!exportApiKey) {
      return new Response(
        JSON.stringify({ error: "EXPORT_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, { fetched: number; inserted: number; errors: string[] }> = {};

    for (const table of TABLES) {
      const tableResult = { fetched: 0, inserted: 0, errors: [] as string[] };

      try {
        console.log(`Fetching ${table} from old project...`);
        const data = await fetchFromOldProject(table, exportApiKey);
        tableResult.fetched = data.length;

        if (data.length === 0) {
          results[table] = tableResult;
          continue;
        }

        // Remove id and timestamps to let the new DB generate them
        const cleanedData = data.map((row: any) => {
          const { id, created_at, updated_at, ...rest } = row;
          return rest;
        });

        // Insert in batches of 50
        const batchSize = 50;
        for (let i = 0; i < cleanedData.length; i += batchSize) {
          const batch = cleanedData.slice(i, i + batchSize);
          const { error } = await supabase.from(table).upsert(batch, {
            onConflict: table === "clientes" ? "cnpj_cpf" : 
                        table === "prestadores" ? "email" : 
                        table === "insumos" ? "nome" :
                        "nome",
            ignoreDuplicates: true,
          });

          if (error) {
            console.error(`Error inserting ${table} batch:`, error);
            tableResult.errors.push(error.message);
            
            // Try individual inserts for failed batch
            for (const item of batch) {
              const { error: singleError } = await supabase.from(table).insert(item);
              if (!singleError) {
                tableResult.inserted++;
              }
            }
          } else {
            tableResult.inserted += batch.length;
          }
        }
      } catch (err) {
        tableResult.errors.push(err instanceof Error ? err.message : String(err));
      }

      results[table] = tableResult;
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
