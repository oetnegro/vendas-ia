'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

export type WorkspaceSummary = {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
}

const SELECTED_WORKSPACE_KEY = 'vendasia:selected-workspace-id'

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setLoading(false)
      setWorkspaces([])
      setWorkspace(null)
      setError(userError?.message || 'Sessao nao encontrada.')
      return
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: true })

    if (membershipError) {
      setLoading(false)
      setError(membershipError.message)
      return
    }

    if (!memberships?.length) {
      setLoading(false)
      setWorkspaces([])
      setWorkspace(null)
      return
    }

    const workspaceIds = memberships.map((membership) => membership.workspace_id)
    const { data: workspaceRows, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .in('id', workspaceIds)
      .order('created_at', { ascending: true })

    if (workspaceError) {
      setLoading(false)
      setError(workspaceError.message)
      return
    }

    const rows = (workspaceRows || [])
      .map((row) => {
        const membership = memberships.find((item) => item.workspace_id === row.id)
        if (!membership) return null

        return {
          id: row.id,
          name: row.name,
          role: membership.role,
        }
      })
      .filter(Boolean) as WorkspaceSummary[]

    const selectedId =
      typeof window !== 'undefined' ? window.localStorage.getItem(SELECTED_WORKSPACE_KEY) : null
    const selected = rows.find((row) => row.id === selectedId) || rows[0] || null

    setWorkspaces(rows)
    setWorkspace(selected)
    setLoading(false)
  }, [])

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      const selected = workspaces.find((item) => item.id === workspaceId) || null
      if (!selected) return

      window.localStorage.setItem(SELECTED_WORKSPACE_KEY, workspaceId)
      setWorkspace(selected)
    },
    [workspaces],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [refresh])

  return {
    workspace,
    workspaces,
    loading,
    error,
    refresh,
    selectWorkspace,
  }
}
