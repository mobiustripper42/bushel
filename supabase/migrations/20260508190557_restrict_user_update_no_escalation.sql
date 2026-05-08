-- Phase 1.3: prevent authenticated users from self-escalating is_admin.
-- The original user_update_own policy allowed unrestricted column updates,
-- which meant any authenticated user could flip their own is_admin to true.
-- This was deferred from Phase 1.2 and is resolved here.
--
-- New check: is_admin must remain unchanged (current value must equal new value).
-- Profile fields (display_name, etc.) are still freely updatable by the owner.

drop policy if exists "user_update_own" on public.users;

create policy "user_update_own" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select is_admin from public.users where id = auth.uid())
  );
