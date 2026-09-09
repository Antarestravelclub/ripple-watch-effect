create policy "Users can read their own roles"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can manage user roles"
on public.user_roles
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "No direct authenticated access to broker orders"
on public.broker_orders
for all
to authenticated
using (false)
with check (false);

create policy "No direct authenticated access to bridge heartbeats"
on public.broker_bridge_heartbeats
for all
to authenticated
using (false)
with check (false);

revoke execute on function public.has_role(uuid, public.app_role) from anon;
