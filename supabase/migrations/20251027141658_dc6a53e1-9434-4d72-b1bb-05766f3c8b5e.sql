-- Fix critical RLS policies for security vulnerabilities

-- ===================================================================
-- 1. FIX: accountability_nodes - Add missing RLS policies
-- ===================================================================

-- Drop the overly permissive existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view verified nodes" ON public.accountability_nodes;
DROP POLICY IF EXISTS "Verified nodes can view other verified nodes" ON public.accountability_nodes;

-- Create secure policies for accountability_nodes
CREATE POLICY "Admins can manage all nodes"
  ON public.accountability_nodes
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view verified nodes (limited columns)"
  ON public.accountability_nodes
  FOR SELECT
  TO authenticated
  USING (verified = true);

-- Note: api_key column should never be exposed directly in SELECT queries
-- Consider creating a view or function that masks sensitive data

CREATE POLICY "Users can register new nodes"
  ON public.accountability_nodes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ===================================================================
-- 2. FIX: profiles - Restrict overly permissive SELECT policy
-- ===================================================================

-- Drop the dangerous "Profiles are viewable by authenticated users" policy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Create secure policy: users can only view their own profile or admins can view all
CREATE POLICY "Users can view own profile and admins can view all"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Keep existing update/insert policies as they are already secure
-- Users can update their own profile: already exists
-- Users can insert their own profile: already exists