import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminEntry } from "@/components/admin-entry";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Upload, Layers } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [
    { title: "Admin — The Ripple Effect" },
    { name: "description", content: "Protected administration for Ripple broker symbols and ETF references." },
    { property: "og:title", content: "Admin — The Ripple Effect" },
    { property: "og:description", content: "Account-protected broker and fund administration." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminEntry><SiteShell>
    <h1 className="text-2xl font-semibold mb-5">Admin</h1>
    <div className="flex flex-wrap gap-3">
      <Button asChild variant="outline"><Link to="/admin/broker-symbols"><Upload />Broker symbol mapping</Link></Button>
      <Button asChild variant="outline"><Link to="/admin/etfs"><Layers />ETF universe</Link></Button>
    </div>
  </SiteShell></AdminEntry>,
});