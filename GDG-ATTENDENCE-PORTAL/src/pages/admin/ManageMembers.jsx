import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../config/api'
import './ManageMembers.css'

const ROLES = ['admin', 'pr', 'member']

const ManageMembers = () => {
  const { user } = useAuth()

  // Data state
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter/search state
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [sortField, setSortField] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')

  // Action state
  const [updatingRole, setUpdatingRole] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState(null)

  const searchTimeoutRef = useRef(null)

  // ── Fetch Users ──────────────────────────────────
  const fetchUsers = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams()
      params.set('page', page)
      params.set('limit', '15')
      params.set('sort', sortField)
      params.set('order', sortOrder)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (roleFilter) params.set('role', roleFilter)

      const data = await api.get(`/users?${params.toString()}`)

      if (data.success) {
        setUsers(data.data)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
      setError(err.message || 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, roleFilter, sortField, sortOrder])

  useEffect(() => {
    fetchUsers(1)
  }, [fetchUsers])

  // Debounced search
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {}, 300)
  }

  // ── Toast helper ──────────────────────────────────
  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Role Update ──────────────────────────────────
  const handleRoleChange = async (userId, newRole) => {
    try {
      setUpdatingRole(userId)
      const data = await api.patch('/auth/role', { userId, role: newRole })

      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
        )
        showToast('success', `Role updated to ${newRole}`)
      }
    } catch (err) {
      console.error('Role update failed:', err)
      showToast('error', err.data?.message || 'Failed to update role')
    } finally {
      setUpdatingRole(null)
    }
  }

  // ── Delete User ──────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return

    try {
      setDeletingUser(confirmDelete._id)
      const data = await api.delete(`/users/${confirmDelete._id}`)

      if (data.success) {
        setUsers((prev) => prev.filter((u) => u._id !== confirmDelete._id))
        setPagination((prev) => ({ ...prev, total: prev.total - 1 }))
        showToast('success', `${confirmDelete.email} removed`)
      }
    } catch (err) {
      console.error('Delete failed:', err)
      showToast('error', err.data?.message || 'Failed to delete member')
    } finally {
      setDeletingUser(null)
      setConfirmDelete(null)
    }
  }

  // ── Sort Handler ──────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // ── Helpers ──────────────────────────────────────
  const getInitials = (name, email) => {
    if (name && name.trim()) {
      return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    }
    return email ? email[0].toUpperCase() : '?'
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const isSelf = (u) => u.email === user?.email

  // Role stats
  const roleCounts = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1
      return acc
    },
    { admin: 0, pr: 0, member: 0 }
  )

  return (
    <div className="mm-page">
      {/* ── Page Header ─────────────────────────── */}
      <header className="mm-header">
        <div className="mm-header-top">
          <span className="material-symbols-outlined mm-header-icon">group</span>
          <div>
            <h1 className="mm-title">Members</h1>
            <p className="mm-subtitle">
              Manage your GDG chapter members, assign roles, and control access.
            </p>
          </div>
        </div>

        {/* Stats chips */}
        <div className="mm-stats">
          <div className="mm-stat-chip">
            <span className="material-symbols-outlined">people</span>
            <span className="mm-stat-value">{pagination.total}</span>
            <span className="mm-stat-label">Total</span>
          </div>
          <div className="mm-stat-chip mm-stat-admin">
            <span className="material-symbols-outlined">admin_panel_settings</span>
            <span className="mm-stat-value">{roleCounts.admin}</span>
            <span className="mm-stat-label">Admins</span>
          </div>
          <div className="mm-stat-chip mm-stat-pr">
            <span className="material-symbols-outlined">campaign</span>
            <span className="mm-stat-value">{roleCounts.pr}</span>
            <span className="mm-stat-label">PR Team</span>
          </div>
          <div className="mm-stat-chip mm-stat-member">
            <span className="material-symbols-outlined">person</span>
            <span className="mm-stat-value">{roleCounts.member}</span>
            <span className="mm-stat-label">Members</span>
          </div>
        </div>
      </header>

      {/* ── Toolbar: Search + Filters ───────────── */}
      <div className="mm-toolbar">
        <div className="mm-search-box">
          <span className="material-symbols-outlined mm-search-icon">search</span>
          <input
            type="text"
            placeholder="Search members…"
            value={searchQuery}
            onChange={handleSearchChange}
            className="mm-search-input"
          />
          {searchQuery && (
            <button className="mm-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div className="mm-filters">
          {/* Role filter chips */}
          <div className="mm-filter-chips">
            <button
              className={`mm-chip ${roleFilter === '' ? 'mm-chip-active' : ''}`}
              onClick={() => setRoleFilter('')}
            >
              All
            </button>
            {ROLES.map((r) => (
              <button
                key={r}
                className={`mm-chip mm-chip-${r} ${roleFilter === r ? 'mm-chip-active' : ''}`}
                onClick={() => setRoleFilter(roleFilter === r ? '' : r)}
              >
                {r === 'pr' ? 'PR' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          <button
            className="mm-icon-btn"
            onClick={() => fetchUsers(pagination.page)}
            disabled={loading}
            title="Refresh"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      {/* ── Error State ─────────────────────────── */}
      {error && (
        <div className="mm-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button onClick={() => fetchUsers(1)} className="mm-error-retry">Retry</button>
        </div>
      )}

      {/* ── Members Table ───────────────────────── */}
      <div className="mm-card">
        <table className="mm-table">
          <thead>
            <tr>
              <th className="mm-th-member">Member</th>
              <th className="mm-th-email mm-sortable" onClick={() => handleSort('email')}>
                Email
                <span className="material-symbols-outlined mm-sort-icon">
                  {sortField === 'email' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'swap_vert'}
                </span>
              </th>
              <th className="mm-th-role">Role</th>
              <th className="mm-th-joined mm-sortable" onClick={() => handleSort('createdAt')}>
                Joined
                <span className="material-symbols-outlined mm-sort-icon">
                  {sortField === 'createdAt' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'swap_vert'}
                </span>
              </th>
              <th className="mm-th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan="5" className="mm-state-cell">
                  <div className="mm-loading-dots">
                    <span /><span /><span /><span />
                  </div>
                  <p>Loading members…</p>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="5" className="mm-state-cell">
                  <span className="material-symbols-outlined mm-empty-icon">person_off</span>
                  <p className="mm-empty-title">No members found</p>
                  <p className="mm-empty-sub">
                    {searchQuery
                      ? 'Try adjusting your search or filter.'
                      : 'Members will appear here once they sign up.'}
                  </p>
                  {searchQuery && (
                    <button className="mm-text-btn" onClick={() => setSearchQuery('')}>
                      <span className="material-symbols-outlined">backspace</span>
                      Clear search
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              users.map((member) => (
                <tr key={member._id} className={isSelf(member) ? 'mm-row-self' : ''}>
                  {/* Avatar + Name */}
                  <td className="mm-cell-member">
                    <div className="mm-member-info">
                      {member.photoURL ? (
                        <img
                          src={member.photoURL}
                          alt={member.name}
                          className="mm-avatar"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`mm-avatar-placeholder mm-avatar-${member.role}`}>
                          {getInitials(member.name, member.email)}
                        </div>
                      )}
                      <div className="mm-member-text">
                        <span className="mm-member-name">
                          {member.name || '(No name)'}
                          {isSelf(member) && <span className="mm-badge-you">You</span>}
                        </span>
                        <span className="mm-member-email-mobile">{member.email}</span>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="mm-cell-email">{member.email}</td>

                  {/* Role selector */}
                  <td className="mm-cell-role">
                    {isSelf(member) ? (
                      <span className={`mm-role-pill mm-role-${member.role}`}>
                        {member.role === 'pr' ? 'PR' : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    ) : (
                      <div className="mm-role-select-wrapper">
                        <select
                          className={`mm-role-select mm-role-${member.role}`}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member._id, e.target.value)}
                          disabled={updatingRole === member._id}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r === 'pr' ? 'PR' : r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                        {updatingRole === member._id && (
                          <span className="mm-role-spinner" />
                        )}
                      </div>
                    )}
                  </td>

                  {/* Joined date */}
                  <td className="mm-cell-joined">{formatDate(member.createdAt)}</td>

                  {/* Actions */}
                  <td className="mm-cell-actions">
                    {!isSelf(member) && (
                      <button
                        className="mm-icon-btn mm-delete-btn"
                        onClick={() => setConfirmDelete(member)}
                        disabled={deletingUser === member._id}
                        title="Remove member"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div className="mm-pagination">
          <button
            className="mm-page-btn"
            onClick={() => fetchUsers(pagination.page - 1)}
            disabled={!pagination.hasPrev || loading}
          >
            <span className="material-symbols-outlined">chevron_left</span>
            Previous
          </button>
          <div className="mm-page-info">
            <span className="mm-page-current">{pagination.page}</span>
            <span className="mm-page-sep">/</span>
            <span>{pagination.totalPages}</span>
          </div>
          <button
            className="mm-page-btn"
            onClick={() => fetchUsers(pagination.page + 1)}
            disabled={!pagination.hasNext || loading}
          >
            Next
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────── */}
      {confirmDelete && (
        <div className="mm-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="mm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mm-modal-icon-wrap">
              <span className="material-symbols-outlined mm-modal-icon">warning</span>
            </div>
            <h3 className="mm-modal-title">Remove member?</h3>
            <p className="mm-modal-text">
              <strong>{confirmDelete.name || confirmDelete.email}</strong> will be permanently removed
              from your GDG chapter. This cannot be undone.
            </p>
            <div className="mm-modal-actions">
              <button className="mm-btn mm-btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="mm-btn mm-btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deletingUser === confirmDelete._id}
              >
                {deletingUser === confirmDelete._id ? (
                  <>
                    <span className="mm-role-spinner mm-spinner-white" />
                    Removing…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">delete</span>
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification ──────────────────── */}
      {toast && (
        <div className={`mm-toast mm-toast-${toast.type}`}>
          <span className="material-symbols-outlined">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.message}</span>
          <button className="mm-toast-close" onClick={() => setToast(null)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default ManageMembers
