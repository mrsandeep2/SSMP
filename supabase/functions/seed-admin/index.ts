//seed-admin//index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if admin already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const adminExists = existingUsers?.users?.find(
      (u: any) => u.email === "sandeep.049630@tmu.ac.in"
    );

    if (adminExists) {
      // Make sure they have admin role
      const { data: roleCheck } = await supabaseAdmin
        .from("user_roles")
        .select("*")
        .eq("user_id", adminExists.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleCheck) {
        // Delete existing role and add admin
        await supabaseAdmin.from("user_roles").delete().eq("user_id", adminExists.id);
        await supabaseAdmin.from("user_roles").insert({ user_id: adminExists.id, role: "admin" });
      }

      return new Response(
        JSON.stringify({ message: "Admin already exists", userId: adminExists.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: "sandeep.049630@tmu.ac.in",
      password: "Sandeep12345.@",
      email_confirm: true,
      user_metadata: { name: "Admin", role: "admin" },
    });

    if (createError) throw createError;

    // Ensure admin role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUser.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "admin" });

    return new Response(
      JSON.stringify({ message: "Admin created successfully", userId: newUser.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
