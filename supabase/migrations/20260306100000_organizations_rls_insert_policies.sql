-- Allow authenticated users to create an organization (for first-time tenant provisioning on sign-in).
-- Without this, provisionTenantAction() fails with "new row violates row-level security policy for table organizations".
CREATE POLICY "Allow authenticated to create organization"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to add themselves as organization members (so they can join the org they just created).
CREATE POLICY "Allow authenticated to insert own membership"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
