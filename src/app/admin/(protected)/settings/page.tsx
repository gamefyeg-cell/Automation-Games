import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "./settings-form";
import { StoreConnectionCard } from "./store-connection-card";

export default async function AdminSettingsPage() {
  const supabase = createAdminClient();
  const { data: settings } = await supabase.from("pricing_settings").select("*").single();

  const storeUrl = process.env.GAMEFY_STORE_URL || "https://gamefy-two.vercel.app";
  const hasApiKey = Boolean(process.env.GAMEFY_STORE_API_KEY);

  return (
    <div>
      <PageHeader
        title="Pricing Settings"
        description="Business rules the pricing engine reads, plus live Gamefy storefront integrations."
      />

      {settings && <SettingsForm settings={settings} />}

      <StoreConnectionCard storeUrl={storeUrl} hasApiKey={hasApiKey} />
    </div>
  );
}
