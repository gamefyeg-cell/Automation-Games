import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const supabase = createAdminClient();
  const { data: settings } = await supabase.from("pricing_settings").select("*").single();

  return (
    <div>
      <PageHeader
        title="Pricing Settings"
        description="Business rules the pricing engine reads. There is always exactly one row."
      />

      {settings && <SettingsForm settings={settings} />}
    </div>
  );
}
