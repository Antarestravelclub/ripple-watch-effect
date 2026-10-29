import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { getAdminAccess, unlockAdmin, lockAdmin } from "@/lib/admin-access.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/site-shell";

export function AdminEntry({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [pin, setPin] = useState("");
  const check = useServerFn(getAdminAccess);
  const unlock = useServerFn(unlockAdmin);
  const lock = useServerFn(lockAdmin);
  const qc = useQueryClient();
  const access = useQuery({ queryKey: ["admin-entry", user?.id], queryFn: () => check(), enabled: !!user, refetchInterval: 30_000 });
  const entry = useMutation({ mutationFn: () => unlock({ data: { pin } }), onSuccess: async () => {
    setPin("");
    await qc.invalidateQueries({ queryKey: ["admin-entry"] });
  }});
  const exit = useMutation({ mutationFn: () => lock(), onSuccess: async () => {
    qc.removeQueries({ queryKey: ["broker-symbols"] });
    qc.removeQueries({ queryKey: ["broker-symbol-uploads"] });
    await qc.invalidateQueries({ queryKey: ["admin-entry"] });
  }});
  if (access.data?.unlocked) return <>
    <div className="mx-auto max-w-7xl px-4 pt-3 flex justify-end">
      <Button variant="outline" size="sm" onClick={() => exit.mutate()} disabled={exit.isPending}><LockKeyhole />Lock admin</Button>
    </div>
    {children}
  </>;
  return <SiteShell><section className="max-w-sm space-y-4 py-8">
    <ShieldCheck className="size-8 text-primary" />
    <h1 className="text-2xl font-semibold">Admin access</h1>
    {loading || (user && access.isPending) ? <p className="text-muted-foreground">Checking access…</p>
      : !user ? <Button asChild><Link to="/auth">Sign in</Link></Button>
      : access.isError ? <p className="text-headwind">Could not check access. Please try again.</p>
      : !access.data?.admin ? <p className="text-muted-foreground">This account does not have administrator access.</p>
      : <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); entry.mutate(); }}>
        <label htmlFor="admin-pin" className="block text-sm">Four-digit entry code</label>
        <input id="admin-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); entry.reset(); }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-lg" />
        {entry.error && <p role="alert" className="text-sm text-headwind">{entry.error.message}</p>}
        <Button type="submit" disabled={pin.length !== 4 || entry.isPending}><LockKeyhole />{entry.isPending ? "Checking…" : "Enter admin"}</Button>
      </form>}
  </section></SiteShell>;
}