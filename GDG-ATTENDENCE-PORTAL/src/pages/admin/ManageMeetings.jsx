import { useState, useEffect, useCallback, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import api from '../../config/api'
import './ManageMeetings.css'

const TYPES = ['offline', 'online']

const ManageMeetings = () => {
  // ── Data state ────────────────────────────────────
  const [meetings, setMeetings] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── Filters ───────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortField, setSortField] = useState('dateTime')
  const [sortOrder, setSortOrder] = useState('desc')

  // ── Modals ────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // null = create, object = edit
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [qrModal, setQrModal] = useState(null) // meeting with QR to show

  // ── Form state ────────────────────────────────────
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'offline',
    dateTime: '',
    duration: 60,
    location: '',
    meetingLink: '',
    geofencingEnabled: false,
    geofenceLat: 0,
    geofenceLng: 0,
    geofenceRadius: 200,
    participation: 'anyone',
    selectedParticipants: [],
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Participant picker state ──────────────────────
  const [participantSearch, setParticipantSearch] = useState('')
  const [availableUsers, setAvailableUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const participantSearchTimeout = useRef(null)

  // ── Map refs ──────────────────────────────────────
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const circleLayerAdded = useRef(false)

  // ── Action state ──────────────────────────────────
  const [deletingId, setDeletingId] = useState(null)
  const [generatingQR, setGeneratingQR] = useState(null)
  const [generatingLink, setGeneratingLink] = useState(null)
  const [togglingActive, setTogglingActive] = useState(null)
  const [toast, setToast] = useState(null)
  const [copiedLinkId, setCopiedLinkId] = useState(null)

  // ── QR auto-refresh ───────────────────────────────
  const [qrCountdown, setQrCountdown] = useState(20)
  const [qrAutoRefresh, setQrAutoRefresh] = useState(true)
  const [qrResetKey, setQrResetKey] = useState(0)
  const [togglingPause, setTogglingPause] = useState(false)
  const qrIntervalRef = useRef(null)
  const qrRefreshingRef = useRef(false)

  const searchTimeoutRef = useRef(null)

  // ── Fetch users for participant picker ────────────
  const fetchAvailableUsers = useCallback(async (search = '') => {
    try {
      setUsersLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '50')
      params.set('role', 'member')
      if (search.trim()) params.set('search', search.trim())
      const data = await api.get(`/users?${params.toString()}`)
      if (data.success) {
        // Also fetch PR users
        const params2 = new URLSearchParams()
        params2.set('limit', '50')
        params2.set('role', 'pr')
        if (search.trim()) params2.set('search', search.trim())
        const data2 = await api.get(`/users?${params2.toString()}`)
        const allUsers = [...(data.data || []), ...(data2.success ? data2.data : [])]
        setAvailableUsers(allUsers)
      }
    } catch (err) {
      console.error('Failed to fetch users for picker:', err)
    } finally {
      setUsersLoading(false)
    }
  }, [])

  // Debounced search for participant picker
  useEffect(() => {
    if (form.participation !== 'selected' || !showForm) return
    if (participantSearchTimeout.current) clearTimeout(participantSearchTimeout.current)
    participantSearchTimeout.current = setTimeout(() => {
      fetchAvailableUsers(participantSearch)
    }, 300)
    return () => {
      if (participantSearchTimeout.current) clearTimeout(participantSearchTimeout.current)
    }
  }, [participantSearch, form.participation, showForm, fetchAvailableUsers])

  // Fetch users when participation mode switches to "selected"
  useEffect(() => {
    if (form.participation === 'selected' && showForm) {
      fetchAvailableUsers('')
    }
  }, [form.participation, showForm, fetchAvailableUsers])

  const toggleParticipant = (user) => {
    setForm((prev) => {
      const exists = prev.selectedParticipants.some((p) => p._id === user._id)
      return {
        ...prev,
        selectedParticipants: exists
          ? prev.selectedParticipants.filter((p) => p._id !== user._id)
          : [...prev.selectedParticipants, user],
      }
    })
  }

  const removeParticipant = (userId) => {
    setForm((prev) => ({
      ...prev,
      selectedParticipants: prev.selectedParticipants.filter((p) => p._id !== userId),
    }))
  }

  // ── Fetch Meetings ────────────────────────────────
  const fetchMeetings = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams()
      params.set('page', page)
      params.set('limit', '15')
      params.set('sort', sortField)
      params.set('order', sortOrder)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)

      const data = await api.get(`/meetings?${params.toString()}`)

      if (data.success) {
        setMeetings(data.data)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err)
      setError(err.message || 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, typeFilter, statusFilter, sortField, sortOrder])

  useEffect(() => {
    fetchMeetings(1)
  }, [fetchMeetings])

  // Debounced search
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {}, 300)
  }

  // ── Map initialisation & cleanup ──────────────────
  useEffect(() => {
    if (!showForm || !form.geofencingEnabled) {
      // Destroy map when modal closes or geofencing is turned off
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
        circleLayerAdded.current = false
      }
      return
    }

    // Wait for the container to mount
    const timer = setTimeout(() => {
      const container = mapContainerRef.current
      if (!container || mapInstanceRef.current) return

      const initialCenter = form.geofenceLat && form.geofenceLng
        ? [form.geofenceLng, form.geofenceLat]
        : [80.4625, 17.7231] // Vishnu University default

      const map = new maplibregl.Map({
        container,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'vector',
              tiles: ['https://maps.osm.n5n.live/planettiles/{z}/{x}/{y}.mvt'],
              maxzoom: 14,
            },
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: { 'background-color': '#f0f0f0' },
            },
            {
              id: 'water',
              type: 'fill',
              source: 'osm-tiles',
              'source-layer': 'water',
              paint: { 'fill-color': '#aad3df' },
            },
            {
              id: 'landuse',
              type: 'fill',
              source: 'osm-tiles',
              'source-layer': 'landuse',
              paint: { 'fill-color': '#e0e8d8', 'fill-opacity': 0.5 },
            },
            {
              id: 'park',
              type: 'fill',
              source: 'osm-tiles',
              'source-layer': 'park',
              paint: { 'fill-color': '#c8facc', 'fill-opacity': 0.5 },
            },
            {
              id: 'landcover',
              type: 'fill',
              source: 'osm-tiles',
              'source-layer': 'landcover',
              paint: { 'fill-color': '#e0e8d8', 'fill-opacity': 0.3 },
            },
            {
              id: 'transportation',
              type: 'line',
              source: 'osm-tiles',
              'source-layer': 'transportation',
              paint: { 'line-color': '#ffffff', 'line-width': 1.5 },
            },
            {
              id: 'transportation-name',
              type: 'symbol',
              source: 'osm-tiles',
              'source-layer': 'transportation_name',
              layout: {
                'text-field': '{name}',
                'text-font': ['Open Sans Regular'],
                'text-size': 10,
                'symbol-placement': 'line',
              },
              paint: { 'text-color': '#555', 'text-halo-color': '#fff', 'text-halo-width': 1 },
            },
            {
              id: 'building',
              type: 'fill',
              source: 'osm-tiles',
              'source-layer': 'building',
              paint: { 'fill-color': '#d9d0c9', 'fill-opacity': 0.6 },
            },
            {
              id: 'place',
              type: 'symbol',
              source: 'osm-tiles',
              'source-layer': 'place',
              layout: {
                'text-field': '{name}',
                'text-font': ['Open Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 14, 16],
              },
              paint: { 'text-color': '#333', 'text-halo-color': '#fff', 'text-halo-width': 1.2 },
            },
            {
              id: 'poi',
              type: 'symbol',
              source: 'osm-tiles',
              'source-layer': 'poi',
              minzoom: 13,
              layout: {
                'text-field': '{name}',
                'text-font': ['Open Sans Regular'],
                'text-size': 10,
                'text-offset': [0, 0.6],
                'text-anchor': 'top',
              },
              paint: { 'text-color': '#666', 'text-halo-color': '#fff', 'text-halo-width': 1 },
            },
          ],
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        },
        center: initialCenter,
        zoom: form.geofenceLat && form.geofenceLng ? 16 : 15,
        attributionControl: false,
      })

      map.addControl(new maplibregl.NavigationControl(), 'top-right')

      mapInstanceRef.current = map

      // Helper: create / update the geofence circle
      const updateCircle = (lng, lat, radiusMetres) => {
        const points = 64
        const geoJSON = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              Array.from({ length: points + 1 }, (_, i) => {
                const angle = (i / points) * 2 * Math.PI
                const dx = (radiusMetres / 111320) * Math.cos(angle) / Math.cos((lat * Math.PI) / 180)
                const dy = (radiusMetres / 110540) * Math.sin(angle)
                return [lng + dx, lat + dy]
              }),
            ],
          },
        }

        if (circleLayerAdded.current) {
          map.getSource('geofence-circle')?.setData(geoJSON)
        } else {
          map.addSource('geofence-circle', { type: 'geojson', data: geoJSON })
          map.addLayer({
            id: 'geofence-fill',
            type: 'fill',
            source: 'geofence-circle',
            paint: { 'fill-color': '#4285f4', 'fill-opacity': 0.15 },
          })
          map.addLayer({
            id: 'geofence-border',
            type: 'line',
            source: 'geofence-circle',
            paint: { 'line-color': '#4285f4', 'line-width': 2.5, 'line-dasharray': [2, 2] },
          })
          circleLayerAdded.current = true
        }
      }

      map.on('load', () => {
        // If existing marker (editing), place it
        if (form.geofenceLat && form.geofenceLng) {
          const marker = new maplibregl.Marker({ color: '#ea4335' })
            .setLngLat([form.geofenceLng, form.geofenceLat])
            .addTo(map)
          markerRef.current = marker
          updateCircle(form.geofenceLng, form.geofenceLat, form.geofenceRadius)
        }

        // Click to set location
        map.on('click', (e) => {
          const { lng, lat } = e.lngLat

          if (markerRef.current) {
            markerRef.current.setLngLat([lng, lat])
          } else {
            const marker = new maplibregl.Marker({ color: '#ea4335' })
              .setLngLat([lng, lat])
              .addTo(map)
            markerRef.current = marker
          }

          setForm((prev) => ({
            ...prev,
            geofenceLat: parseFloat(lat.toFixed(6)),
            geofenceLng: parseFloat(lng.toFixed(6)),
          }))

          updateCircle(lng, lat, form.geofenceRadius)
        })
      })

      // Expose updateCircle so the radius slider can call it
      mapInstanceRef.current._updateCircle = updateCircle
    }, 80)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, form.geofencingEnabled])

  // Update circle when radius changes via slider
  useEffect(() => {
    if (
      mapInstanceRef.current?._updateCircle &&
      form.geofenceLat &&
      form.geofenceLng &&
      circleLayerAdded.current
    ) {
      mapInstanceRef.current._updateCircle(form.geofenceLng, form.geofenceLat, form.geofenceRadius)
    }
  }, [form.geofenceRadius, form.geofenceLat, form.geofenceLng])

  // ── QR auto-refresh timer ─────────────────────────
  // The server background service regenerates QR codes every 20 s.
  // GET /meetings/:id/qr-status returns the current QR + how many
  // seconds remain until the NEXT server-side refresh.
  //
  // Flow:
  //   1. Modal opens → fetch qr-status → get QR + secondsRemaining (e.g. 14)
  //   2. Count down 14 → 13 → … → 0
  //   3. Wait 1.5 s (so the server finishes regenerating)
  //   4. Fetch qr-status again → get NEW QR + secondsRemaining (~18-19)
  //   5. Repeat from step 2
  useEffect(() => {
    if (qrIntervalRef.current) {
      clearInterval(qrIntervalRef.current)
      qrIntervalRef.current = null
    }

    if (!qrModal || !qrAutoRefresh) {
      setQrCountdown(20)
      return
    }

    let cancelled = false
    let tickTimer = null
    let delayTimer = null

    // Fetch QR + real secondsRemaining from server, then start ticking
    const fetchAndStartCountdown = async () => {
      if (cancelled) return
      try {
        qrRefreshingRef.current = true
        const data = await api.get(`/meetings/${qrModal._id}/qr-status`)
        if (cancelled) return

        if (data.success) {
          const { qrCode, qrData, secondsRemaining, qrPaused } = data.data

          if (qrCode) {
            setQrModal((curr) => (curr ? { ...curr, qrCode } : null))
            setMeetings((prev) =>
              prev.map((m) =>
                m._id === qrModal._id ? { ...m, qrCode, qrData } : m
              )
            )
          }

          // Sync local auto-refresh toggle with server paused state
          if (qrPaused) {
            setQrAutoRefresh(false)
            return // Don't start the countdown — it's paused on the server
          }

          // Start counting down from the server-provided value
          startTick(secondsRemaining ?? 20)
        }
      } catch (err) {
        console.error('QR status poll failed:', err)
        // Retry after 3 s on network error
        if (!cancelled) delayTimer = setTimeout(fetchAndStartCountdown, 3000)
      } finally {
        qrRefreshingRef.current = false
      }
    }

    const startTick = (startValue) => {
      if (cancelled) return
      if (tickTimer) clearInterval(tickTimer)

      let remaining = Math.max(0, Math.round(startValue))
      setQrCountdown(remaining)

      tickTimer = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          clearInterval(tickTimer)
          tickTimer = null
          setQrCountdown(0)
          // Wait 1.5 s for the server refresh to complete, then re-fetch
          delayTimer = setTimeout(fetchAndStartCountdown, 1500)
        } else {
          setQrCountdown(remaining)
        }
      }, 1000)

      qrIntervalRef.current = tickTimer
    }

    // Kick off on mount
    fetchAndStartCountdown()

    return () => {
      cancelled = true
      if (tickTimer) clearInterval(tickTimer)
      if (delayTimer) clearTimeout(delayTimer)
      if (qrIntervalRef.current) {
        clearInterval(qrIntervalRef.current)
        qrIntervalRef.current = null
      }
    }
  }, [qrModal?._id, qrAutoRefresh, qrResetKey])

  // Reset auto-refresh when opening modal
  const openQrModal = (meeting) => {
    setQrAutoRefresh(true)
    setQrCountdown(20)
    setQrModal(meeting)
  }

  // ── Toast helper ──────────────────────────────────
  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Open create / edit form ───────────────────────
  const openCreateForm = () => {
    setEditing(null)
    setForm({
      title: '',
      description: '',
      type: 'offline',
      dateTime: '',
      duration: 60,
      location: '',
      meetingLink: '',
      geofencingEnabled: false,
      geofenceLat: 0,
      geofenceLng: 0,
      geofenceRadius: 200,
      participation: 'anyone',
      selectedParticipants: [],
    })
    setParticipantSearch('')
    setFormError('')
    setShowForm(true)
  }

  const openEditForm = (meeting) => {
    setEditing(meeting)
    const dt = new Date(meeting.dateTime)
    // Format for datetime-local input
    const localDT = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)

    setForm({
      title: meeting.title,
      description: meeting.description || '',
      type: meeting.type,
      dateTime: localDT,
      duration: meeting.duration || 60,
      location: meeting.location || '',
      meetingLink: meeting.meetingLink || '',
      geofencingEnabled: meeting.geofencing?.enabled || false,
      geofenceLat: meeting.geofencing?.center?.lat || 0,
      geofenceLng: meeting.geofencing?.center?.lng || 0,
      geofenceRadius: meeting.geofencing?.radius || 200,
      participation: meeting.participation || 'anyone',
      selectedParticipants: meeting.participants || [],
    })
    setParticipantSearch('')
    setFormError('')
    setShowForm(true)
  }

  // ── Form submit ───────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!form.title.trim()) {
      setFormError('Meeting title is required.')
      return
    }
    if (!form.dateTime) {
      setFormError('Date and time is required.')
      return
    }

    try {
      setSaving(true)

      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        dateTime: new Date(form.dateTime).toISOString(),
        duration: parseInt(form.duration, 10) || 60,
        location: form.location.trim(),
        meetingLink: form.meetingLink.trim(),
        participation: form.participation,
        participants: form.participation === 'selected'
          ? form.selectedParticipants.map((p) => p._id)
          : [],
        geofencing: {
          enabled: form.geofencingEnabled,
          center: { lat: form.geofenceLat, lng: form.geofenceLng },
          radius: form.geofenceRadius,
        },
      }

      let data
      if (editing) {
        data = await api.patch(`/meetings/${editing._id}`, body)
        if (data.success) {
          setMeetings((prev) =>
            prev.map((m) => (m._id === editing._id ? data.data : m))
          )
          showToast('success', 'Meeting updated successfully')
        }
      } else {
        data = await api.post('/meetings', body)
        if (data.success) {
          // Refresh list
          fetchMeetings(1)
          showToast('success', 'Meeting created successfully')
        }
      }

      setShowForm(false)
    } catch (err) {
      console.error('Save meeting failed:', err)
      setFormError(err.data?.message || err.message || 'Failed to save meeting')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete Meeting ────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return

    try {
      setDeletingId(confirmDelete._id)
      const data = await api.delete(`/meetings/${confirmDelete._id}`)

      if (data.success) {
        setMeetings((prev) => prev.filter((m) => m._id !== confirmDelete._id))
        setPagination((prev) => ({ ...prev, total: prev.total - 1 }))
        showToast('success', `"${confirmDelete.title}" deleted`)
      }
    } catch (err) {
      console.error('Delete failed:', err)
      showToast('error', err.data?.message || 'Failed to delete meeting')
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  // ── Generate QR ───────────────────────────────────
  const handleGenerateQR = async (meeting) => {
    try {
      setGeneratingQR(meeting._id)
      const data = await api.post(`/meetings/${meeting._id}/generate-qr`)

      if (data.success) {
        // Update meeting in list
        setMeetings((prev) =>
          prev.map((m) =>
            m._id === meeting._id
              ? { ...m, qrCode: data.data.qrCode, qrData: data.data.qrData }
              : m
          )
        )
        setQrModal((curr) =>
          curr ? { ...curr, qrCode: data.data.qrCode } : null
        )
        // If modal isn't open yet (first generate from table), open it
        if (!qrModal) {
          openQrModal({ ...meeting, qrCode: data.data.qrCode })
        }
        setQrResetKey((k) => k + 1) // Force timer effect to restart
        showToast('success', 'QR code generated')
      }
    } catch (err) {
      console.error('QR generation failed:', err)
      showToast('error', err.data?.message || 'Failed to generate QR code')
    } finally {
      setGeneratingQR(null)
    }
  }

  // ── Generate Attendance Link (online meetings) ────
  const handleGenerateAttendanceLink = async (meeting) => {
    try {
      setGeneratingLink(meeting._id)
      const data = await api.post(`/meetings/${meeting._id}/generate-attendance-link`)

      if (data.success) {
        setMeetings((prev) =>
          prev.map((m) =>
            m._id === meeting._id
              ? { ...m, attendanceToken: data.data.attendanceToken }
              : m
          )
        )
        showToast('success', 'Attendance link generated')
      }
    } catch (err) {
      console.error('Attendance link generation failed:', err)
      showToast('error', err.data?.message || 'Failed to generate attendance link')
    } finally {
      setGeneratingLink(null)
    }
  }

  // ── Copy attendance link ──────────────────────────
  const getAttendanceUrl = (token) => {
    const base = window.location.origin
    return `${base}/attend/${token}`
  }

  const copyAttendanceLink = async (meeting) => {
    if (!meeting.attendanceToken) return
    const url = getAttendanceUrl(meeting.attendanceToken)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLinkId(meeting._id)
      showToast('success', 'Attendance link copied to clipboard')
      setTimeout(() => setCopiedLinkId(null), 2000)
    } catch {
      showToast('error', 'Failed to copy link')
    }
  }

  // ── Toggle Active ─────────────────────────────────
  const handleToggleActive = async (meeting) => {
    try {
      setTogglingActive(meeting._id)
      const data = await api.patch(`/meetings/${meeting._id}/toggle-active`)

      if (data.success) {
        setMeetings((prev) =>
          prev.map((m) => (m._id === meeting._id ? data.data : m))
        )
        showToast('success', data.message)
      }
    } catch (err) {
      console.error('Toggle active failed:', err)
      showToast('error', err.data?.message || 'Failed to toggle status')
    } finally {
      setTogglingActive(null)
    }
  }

  // ── Sort ──────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // ── Helpers ───────────────────────────────────────
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getMeetingStatus = (meeting) => {
    const now = new Date()
    const meetingTime = new Date(meeting.dateTime)
    const endTime = new Date(meetingTime.getTime() + (meeting.duration || 60) * 60000)
    if (now < meetingTime) return 'upcoming'
    if (now >= meetingTime && now < endTime) return 'active'
    return 'past'
  }

  // Stats
  const stats = meetings.reduce(
    (acc, m) => {
      const s = getMeetingStatus(m)
      acc[s] = (acc[s] || 0) + 1
      if (m.type === 'online') acc.online++
      else acc.offline++
      return acc
    },
    { active: 0, upcoming: 0, past: 0, online: 0, offline: 0 }
  )

  // ── Download QR ───────────────────────────────────
  const downloadQR = (meeting) => {
    if (!meeting.qrCode) return
    const link = document.createElement('a')
    link.download = `QR-${meeting.title.replace(/\s+/g, '-')}.png`
    link.href = meeting.qrCode
    link.click()
  }

  return (
    <div className="mt-page">
      {/* ── Page Header ─────────────────────────── */}
      <header className="mt-header">
        <div className="mt-header-top">
          <span className="material-symbols-outlined mt-header-icon">event</span>
          <div>
            <h1 className="mt-title">Meetings</h1>
            <p className="mt-subtitle">
              Create and manage meetings, generate QR codes, and control event access.
            </p>
          </div>
          <button className="mt-btn mt-btn-primary" onClick={openCreateForm}>
            <span className="material-symbols-outlined">add</span>
            Create Meeting
          </button>
        </div>

        {/* Stats chips */}
        <div className="mt-stats">
          <div className="mt-stat-chip">
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="mt-stat-value">{pagination.total}</span>
            <span className="mt-stat-label">Total</span>
          </div>
          <div className="mt-stat-chip mt-stat-active">
            <span className="material-symbols-outlined">radio_button_checked</span>
            <span className="mt-stat-value">{stats.active}</span>
            <span className="mt-stat-label">Active</span>
          </div>
          <div className="mt-stat-chip mt-stat-upcoming">
            <span className="material-symbols-outlined">schedule</span>
            <span className="mt-stat-value">{stats.upcoming}</span>
            <span className="mt-stat-label">Upcoming</span>
          </div>
          <div className="mt-stat-chip mt-stat-past">
            <span className="material-symbols-outlined">history</span>
            <span className="mt-stat-value">{stats.past}</span>
            <span className="mt-stat-label">Past</span>
          </div>
        </div>
      </header>

      {/* ── Toolbar ─────────────────────────────── */}
      <div className="mt-toolbar">
        <div className="mt-search-box">
          <span className="material-symbols-outlined mt-search-icon">search</span>
          <input
            type="text"
            placeholder="Search meetings…"
            value={searchQuery}
            onChange={handleSearchChange}
            className="mt-search-input"
          />
          {searchQuery && (
            <button className="mt-search-clear" onClick={() => setSearchQuery('')}>
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div className="mt-filters">
          <div className="mt-filter-chips">
            <button
              className={`mt-chip ${statusFilter === '' ? 'mt-chip-active' : ''}`}
              onClick={() => setStatusFilter('')}
            >
              All
            </button>
            <button
              className={`mt-chip mt-chip-active-status ${statusFilter === 'active' ? 'mt-chip-active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'active' ? '' : 'active')}
            >
              Active
            </button>
            <button
              className={`mt-chip mt-chip-upcoming ${statusFilter === 'upcoming' ? 'mt-chip-active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'upcoming' ? '' : 'upcoming')}
            >
              Upcoming
            </button>
            <button
              className={`mt-chip mt-chip-past ${statusFilter === 'past' ? 'mt-chip-active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'past' ? '' : 'past')}
            >
              Past
            </button>
          </div>

          <div className="mt-filter-chips">
            {TYPES.map((t) => (
              <button
                key={t}
                className={`mt-chip mt-chip-type ${typeFilter === t ? 'mt-chip-active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {t === 'online' ? 'videocam' : 'location_on'}
                </span>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <button
            className="mt-icon-btn"
            onClick={() => fetchMeetings(pagination.page)}
            disabled={loading}
            title="Refresh"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      {/* ── Error State ─────────────────────────── */}
      {error && (
        <div className="mt-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button onClick={() => fetchMeetings(1)} className="mt-error-retry">Retry</button>
        </div>
      )}

      {/* ── Meetings Table ──────────────────────── */}
      <div className="mt-card">
        <table className="mt-table">
          <thead>
            <tr>
              <th className="mt-th-title mt-sortable" onClick={() => handleSort('title')}>
                Meeting
                <span className="material-symbols-outlined mt-sort-icon">
                  {sortField === 'title' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'swap_vert'}
                </span>
              </th>
              <th className="mt-th-type">Type</th>
              <th className="mt-th-datetime mt-sortable" onClick={() => handleSort('dateTime')}>
                Date &amp; Time
                <span className="material-symbols-outlined mt-sort-icon">
                  {sortField === 'dateTime' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'swap_vert'}
                </span>
              </th>
              <th className="mt-th-duration">Duration</th>
              <th className="mt-th-status">Status</th>
              <th className="mt-th-qr">Attendance</th>
              <th className="mt-th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {loading && meetings.length === 0 ? (
              <tr>
                <td colSpan="7" className="mt-state-cell">
                  <div className="mt-loading-dots">
                    <span /><span /><span /><span />
                  </div>
                  <p>Loading meetings…</p>
                </td>
              </tr>
            ) : meetings.length === 0 ? (
              <tr>
                <td colSpan="7" className="mt-state-cell">
                  <span className="material-symbols-outlined mt-empty-icon">event_busy</span>
                  <p className="mt-empty-title">No meetings found</p>
                  <p className="mt-empty-sub">
                    {searchQuery
                      ? 'Try adjusting your search or filters.'
                      : 'Create your first meeting to get started.'}
                  </p>
                  {!searchQuery && (
                    <button className="mt-btn mt-btn-primary mt-btn-sm" onClick={openCreateForm}>
                      <span className="material-symbols-outlined">add</span>
                      Create Meeting
                    </button>
                  )}
                  {searchQuery && (
                    <button className="mt-text-btn" onClick={() => setSearchQuery('')}>
                      <span className="material-symbols-outlined">backspace</span>
                      Clear search
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              meetings.map((meeting) => {
                const status = getMeetingStatus(meeting)
                return (
                  <tr key={meeting._id} className={meeting.isActive ? 'mt-row-active' : ''}>
                    {/* Title + Description */}
                    <td className="mt-cell-title">
                      <div className="mt-meeting-info">
                        <span className={`mt-meeting-dot mt-dot-${status}`} />
                        <div>
                          <span className="mt-meeting-name">{meeting.title}</span>
                          {meeting.description && (
                            <span className="mt-meeting-desc">
                              {meeting.description.length > 60
                                ? meeting.description.slice(0, 60) + '…'
                                : meeting.description}
                            </span>
                          )}
                          {meeting.location && (
                            <span className="mt-meeting-location">
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                {meeting.type === 'online' ? 'videocam' : 'location_on'}
                              </span>
                              {meeting.location}
                              {meeting.geofencing?.enabled && (
                                <span className="mt-geofence-badge" title={`Geofenced: ${meeting.geofencing.radius}m radius`}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>fence</span>
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="mt-cell-type">
                      <span className={`mt-type-pill mt-type-${meeting.type}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                          {meeting.type === 'online' ? 'videocam' : 'groups'}
                        </span>
                        {meeting.type === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </td>

                    {/* Date & Time */}
                    <td className="mt-cell-datetime">
                      <span className="mt-date">{formatDate(meeting.dateTime)}</span>
                      <span className="mt-time">{formatTime(meeting.dateTime)}</span>
                    </td>

                    {/* Duration */}
                    <td className="mt-cell-duration">
                      {meeting.duration ? `${meeting.duration} min` : '—'}
                    </td>

                    {/* Status */}
                    <td className="mt-cell-status">
                      <span className={`mt-status-pill mt-status-${status}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>

                    {/* Attendance (QR for offline, Link for online) */}
                    <td className="mt-cell-qr">
                      {meeting.type === 'online' ? (
                        /* Online: show attendance link */
                        meeting.attendanceToken ? (
                          <button
                            className={`mt-link-copy-btn ${copiedLinkId === meeting._id ? 'mt-link-copied' : ''}`}
                            onClick={() => copyAttendanceLink(meeting)}
                            title="Copy attendance link"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              {copiedLinkId === meeting._id ? 'check' : 'link'}
                            </span>
                            {copiedLinkId === meeting._id ? 'Copied' : 'Copy Link'}
                          </button>
                        ) : (
                          <button
                            className="mt-icon-btn mt-qr-gen-btn"
                            onClick={() => handleGenerateAttendanceLink(meeting)}
                            disabled={generatingLink === meeting._id}
                            title="Generate Attendance Link"
                          >
                            {generatingLink === meeting._id ? (
                              <span className="mt-spinner" />
                            ) : (
                              <span className="material-symbols-outlined">add_link</span>
                            )}
                          </button>
                        )
                      ) : (
                        /* Offline: show QR */
                        meeting.qrCode ? (
                          <button
                            className="mt-qr-thumb"
                            onClick={() => openQrModal(meeting)}
                            title="View QR Code"
                          >
                            <img src={meeting.qrCode} alt="QR" />
                          </button>
                        ) : (
                          <button
                            className="mt-icon-btn mt-qr-gen-btn"
                            onClick={() => handleGenerateQR(meeting)}
                            disabled={generatingQR === meeting._id}
                            title="Generate QR"
                          >
                            {generatingQR === meeting._id ? (
                              <span className="mt-spinner" />
                            ) : (
                              <span className="material-symbols-outlined">qr_code</span>
                            )}
                          </button>
                        )
                      )}
                    </td>

                    {/* Actions */}
                    <td className="mt-cell-actions">
                      <div className="mt-action-group">
                        <button
                          className={`mt-icon-btn mt-toggle-btn ${meeting.isActive ? 'mt-toggle-on' : ''}`}
                          onClick={() => handleToggleActive(meeting)}
                          disabled={togglingActive === meeting._id}
                          title={meeting.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <span className="material-symbols-outlined">
                            {meeting.isActive ? 'toggle_on' : 'toggle_off'}
                          </span>
                        </button>
                        <button
                          className="mt-icon-btn"
                          onClick={() => openEditForm(meeting)}
                          title="Edit"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          className="mt-icon-btn mt-delete-btn"
                          onClick={() => setConfirmDelete(meeting)}
                          disabled={deletingId === meeting._id}
                          title="Delete"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div className="mt-pagination">
          <button
            className="mt-page-btn"
            onClick={() => fetchMeetings(pagination.page - 1)}
            disabled={!pagination.hasPrev || loading}
          >
            <span className="material-symbols-outlined">chevron_left</span>
            Previous
          </button>
          <div className="mt-page-info">
            <span className="mt-page-current">{pagination.page}</span>
            <span className="mt-page-sep">/</span>
            <span>{pagination.totalPages}</span>
          </div>
          <button
            className="mt-page-btn"
            onClick={() => fetchMeetings(pagination.page + 1)}
            disabled={!pagination.hasNext || loading}
          >
            Next
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────── */}
      {showForm && (
        <div className="mt-modal-overlay" onClick={() => setShowForm(false)}>
          <div className={`mt-modal mt-modal-form${form.geofencingEnabled ? ' mt-modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="mt-modal-header">
              <h3 className="mt-modal-title">
                <span className="material-symbols-outlined">
                  {editing ? 'edit_calendar' : 'add_circle'}
                </span>
                {editing ? 'Edit Meeting' : 'Create Meeting'}
              </h3>
              <button className="mt-icon-btn" onClick={() => setShowForm(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-form">
              {formError && (
                <div className="mt-form-error">
                  <span className="material-symbols-outlined">error</span>
                  {formError}
                </div>
              )}

              <div className="mt-field">
                <label className="mt-label">Title *</label>
                <input
                  type="text"
                  className="mt-input"
                  placeholder="e.g. GDG Monthly Meetup"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="mt-field">
                <label className="mt-label">Description</label>
                <textarea
                  className="mt-input mt-textarea"
                  placeholder="Optional meeting details…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="mt-field-row">
                <div className="mt-field">
                  <label className="mt-label">Type *</label>
                  <div className="mt-type-toggle">
                    <button
                      type="button"
                      className={`mt-type-option ${form.type === 'offline' ? 'mt-type-selected' : ''}`}
                      onClick={() => setForm({ ...form, type: 'offline' })}
                    >
                      <span className="material-symbols-outlined">groups</span>
                      Offline
                    </button>
                    <button
                      type="button"
                      className={`mt-type-option ${form.type === 'online' ? 'mt-type-selected' : ''}`}
                      onClick={() => setForm({ ...form, type: 'online' })}
                    >
                      <span className="material-symbols-outlined">videocam</span>
                      Online
                    </button>
                  </div>
                </div>

                <div className="mt-field">
                  <label className="mt-label">Duration (minutes)</label>
                  <input
                    type="number"
                    className="mt-input"
                    min="5"
                    max="720"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-field">
                <label className="mt-label">Date &amp; Time *</label>
                <input
                  type="datetime-local"
                  className="mt-input"
                  value={form.dateTime}
                  onChange={(e) => setForm({ ...form, dateTime: e.target.value })}
                />
              </div>

              <div className="mt-field">
                <label className="mt-label">
                  {form.type === 'online' ? 'Meeting Link' : 'Location'}
                </label>
                {form.type === 'online' ? (
                  <input
                    type="url"
                    className="mt-input"
                    placeholder="https://meet.google.com/abc-defg-hij"
                    value={form.meetingLink}
                    onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
                  />
                ) : (
                  <input
                    type="text"
                    className="mt-input"
                    placeholder="e.g. Seminar Hall, Block A"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                )}
              </div>

              {/* ── Participation Section ──────────────── */}
              <div className="mt-participation-section">
                <div className="mt-field">
                  <label className="mt-label">Who can participate? *</label>
                  <div className="mt-type-toggle">
                    <button
                      type="button"
                      className={`mt-type-option ${form.participation === 'anyone' ? 'mt-type-selected' : ''}`}
                      onClick={() => setForm({ ...form, participation: 'anyone', selectedParticipants: [] })}
                    >
                      <span className="material-symbols-outlined">public</span>
                      Anyone
                    </button>
                    <button
                      type="button"
                      className={`mt-type-option ${form.participation === 'selected' ? 'mt-type-selected' : ''}`}
                      onClick={() => setForm({ ...form, participation: 'selected' })}
                    >
                      <span className="material-symbols-outlined">person_search</span>
                      Selected
                    </button>
                  </div>
                </div>

                {form.participation === 'selected' && (
                  <div className="mt-participants-picker">
                    {/* Selected chips */}
                    {form.selectedParticipants.length > 0 && (
                      <div className="mt-selected-chips">
                        {form.selectedParticipants.map((p) => (
                          <span key={p._id} className="mt-participant-chip">
                            {p.photoURL ? (
                              <img src={p.photoURL} alt="" className="mt-chip-avatar" />
                            ) : (
                              <span className="mt-chip-avatar-placeholder">
                                {(p.name || '?')[0].toUpperCase()}
                              </span>
                            )}
                            <span className="mt-chip-name">{p.name || p.email}</span>
                            <button
                              type="button"
                              className="mt-chip-remove"
                              onClick={() => removeParticipant(p._id)}
                            >
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Search input */}
                    <div className="mt-participant-search-wrap">
                      <span className="material-symbols-outlined mt-participant-search-icon">search</span>
                      <input
                        type="text"
                        className="mt-input mt-participant-search"
                        placeholder="Search members by name or email…"
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                      />
                    </div>

                    {/* User list */}
                    <div className="mt-participant-list">
                      {usersLoading ? (
                        <div className="mt-participant-loading">
                          <span className="mt-spinner" /> Loading…
                        </div>
                      ) : availableUsers.length === 0 ? (
                        <div className="mt-participant-empty">
                          No members found{participantSearch ? ` for "${participantSearch}"` : ''}
                        </div>
                      ) : (
                        availableUsers.map((user) => {
                          const isSelected = form.selectedParticipants.some((p) => p._id === user._id)
                          return (
                            <div
                              key={user._id}
                              className={`mt-participant-row ${isSelected ? 'mt-participant-selected' : ''}`}
                              onClick={() => toggleParticipant(user)}
                            >
                              <div className="mt-participant-checkbox">
                                <span className="material-symbols-outlined">
                                  {isSelected ? 'check_box' : 'check_box_outline_blank'}
                                </span>
                              </div>
                              {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="mt-participant-avatar" />
                              ) : (
                                <div className="mt-participant-avatar-placeholder">
                                  {(user.name || '?')[0].toUpperCase()}
                                </div>
                              )}
                              <div className="mt-participant-info">
                                <span className="mt-participant-name">{user.name}</span>
                                <span className="mt-participant-email">{user.email}</span>
                              </div>
                              <span className={`mt-participant-role mt-role-${user.role}`}>
                                {user.role}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div className="mt-participant-count">
                      {form.selectedParticipants.length} member{form.selectedParticipants.length !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                )}
              </div>

              {/* ── Geofencing Section ──────────────── */}
              {form.type === 'offline' && (
                <div className="mt-geofence-section">
                  <div className="mt-geofence-toggle-row">
                    <div className="mt-geofence-label-wrap">
                      <span className="material-symbols-outlined mt-geofence-icon">
                        fence
                      </span>
                      <div>
                        <span className="mt-geofence-label-title">Geofencing</span>
                        <span className="mt-geofence-label-sub">
                          Restrict attendance to a geographic area
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`mt-icon-btn mt-toggle-btn ${form.geofencingEnabled ? 'mt-toggle-on' : ''}`}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          geofencingEnabled: !prev.geofencingEnabled,
                        }))
                      }
                    >
                      <span className="material-symbols-outlined">
                        {form.geofencingEnabled ? 'toggle_on' : 'toggle_off'}
                      </span>
                    </button>
                  </div>

                  {form.geofencingEnabled && (
                    <div className="mt-geofence-body">
                      <p className="mt-geofence-hint">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          touch_app
                        </span>
                        Click on the map to set the meeting location
                      </p>

                      <div className="mt-map-container" ref={mapContainerRef} />

                      {form.geofenceLat !== 0 && form.geofenceLng !== 0 && (
                        <div className="mt-geofence-coords">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ea4335' }}>
                            location_on
                          </span>
                          <span>
                            {form.geofenceLat.toFixed(6)}, {form.geofenceLng.toFixed(6)}
                          </span>
                        </div>
                      )}

                      <div className="mt-radius-control">
                        <label className="mt-label">
                          Radius: <strong>{form.geofenceRadius}m</strong>
                        </label>
                        <div className="mt-radius-slider-row">
                          <span className="mt-radius-min">10m</span>
                          <input
                            type="range"
                            className="mt-radius-slider"
                            min="10"
                            max="2000"
                            step="10"
                            value={form.geofenceRadius}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                geofenceRadius: parseInt(e.target.value, 10),
                              }))
                            }
                          />
                          <span className="mt-radius-max">2km</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-form-actions">
                <button type="button" className="mt-btn mt-btn-ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="mt-btn mt-btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="mt-spinner mt-spinner-white" />
                      {editing ? 'Updating…' : 'Creating…'}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">
                        {editing ? 'save' : 'add'}
                      </span>
                      {editing ? 'Update Meeting' : 'Create Meeting'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────── */}
      {confirmDelete && (
        <div className="mt-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="mt-modal mt-modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="mt-modal-icon-wrap">
              <span className="material-symbols-outlined mt-modal-icon">warning</span>
            </div>
            <h3 className="mt-modal-title-center">Delete meeting?</h3>
            <p className="mt-modal-text">
              <strong>{confirmDelete.title}</strong> will be permanently deleted along
              with its QR code. This cannot be undone.
            </p>
            <div className="mt-modal-actions">
              <button className="mt-btn mt-btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="mt-btn mt-btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deletingId === confirmDelete._id}
              >
                {deletingId === confirmDelete._id ? (
                  <>
                    <span className="mt-spinner mt-spinner-white" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">delete</span>
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Code / Attendance Link Modal ─────── */}
      {qrModal && (
        <div className="mt-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="mt-modal mt-modal-qr" onClick={(e) => e.stopPropagation()}>
            <div className="mt-modal-header">
              <h3 className="mt-modal-title">
                <span className="material-symbols-outlined">
                  {qrModal.type === 'online' ? 'link' : 'qr_code_2'}
                </span>
                {qrModal.type === 'online' ? 'Attendance Link' : 'QR Code'}
              </h3>
              <button className="mt-icon-btn" onClick={() => setQrModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-qr-content">
              <div className="mt-qr-meeting-info">
                <h4>{qrModal.title}</h4>
                <p>{formatDate(qrModal.dateTime)} at {formatTime(qrModal.dateTime)}</p>
                <span className={`mt-type-pill mt-type-${qrModal.type}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {qrModal.type === 'online' ? 'videocam' : 'groups'}
                  </span>
                  {qrModal.type === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>

              {qrModal.type === 'online' ? (
                /* ── Online: Attendance Link section ── */
                <div className="mt-attendance-link-section">
                  {qrModal.attendanceToken ? (
                    <>
                      <div className="mt-link-display">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#1a73e8' }}>link</span>
                        <span className="mt-link-url">{getAttendanceUrl(qrModal.attendanceToken)}</span>
                      </div>
                      <div className="mt-qr-actions">
                        <button
                          className="mt-btn mt-btn-primary"
                          onClick={() => copyAttendanceLink(qrModal)}
                        >
                          <span className="material-symbols-outlined">
                            {copiedLinkId === qrModal._id ? 'check' : 'content_copy'}
                          </span>
                          {copiedLinkId === qrModal._id ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button
                          className="mt-btn mt-btn-ghost"
                          onClick={() => handleGenerateAttendanceLink(qrModal)}
                          disabled={generatingLink === qrModal._id}
                        >
                          {generatingLink === qrModal._id ? (
                            <span className="mt-spinner" />
                          ) : (
                            <span className="material-symbols-outlined">refresh</span>
                          )}
                          Regenerate Link
                        </button>
                      </div>
                      <p className="mt-link-hint">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span>
                        Share this link with members. When they open it and click "Join Meeting", their attendance is automatically marked.
                      </p>
                    </>
                  ) : (
                    <div className="mt-no-link">
                      <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#dadce0' }}>add_link</span>
                      <p>No attendance link generated yet.</p>
                      <button
                        className="mt-btn mt-btn-primary"
                        onClick={() => handleGenerateAttendanceLink(qrModal)}
                        disabled={generatingLink === qrModal._id}
                      >
                        {generatingLink === qrModal._id ? (
                          <span className="mt-spinner mt-spinner-white" />
                        ) : (
                          <span className="material-symbols-outlined">add_link</span>
                        )}
                        Generate Attendance Link
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Offline: QR code section ── */
                <>
                  {qrModal.qrCode && (
                    <div className="mt-qr-live-wrap">
                      <div className="mt-qr-image-wrap">
                        <img
                          src={qrModal.qrCode}
                          alt="QR Code"
                          className={`mt-qr-image ${qrRefreshingRef.current ? 'mt-qr-refreshing' : ''}`}
                        />
                      </div>

                      {/* Countdown ring */}
                      <div className="mt-qr-countdown">
                        <svg className="mt-countdown-ring" viewBox="0 0 48 48">
                          <circle
                            className="mt-countdown-track"
                            cx="24" cy="24" r="20"
                            fill="none" strokeWidth="3"
                          />
                          <circle
                            className="mt-countdown-progress"
                            cx="24" cy="24" r="20"
                            fill="none" strokeWidth="3"
                            strokeLinecap="round"
                            style={{
                              strokeDasharray: `${2 * Math.PI * 20}`,
                              strokeDashoffset: `${2 * Math.PI * 20 * (1 - qrCountdown / 20)}`,
                              transition: 'stroke-dashoffset 0.95s linear',
                            }}
                          />
                        </svg>
                        <span className="mt-countdown-number">{qrCountdown}</span>
                      </div>

                      <div className="mt-qr-refresh-info">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                          autorenew
                        </span>
                        <span>{qrAutoRefresh ? 'Auto-refreshes every 20s' : 'Auto-refresh paused'}</span>
                        <button
                          className="mt-auto-refresh-toggle"
                          disabled={togglingPause}
                          onClick={async () => {
                            try {
                              setTogglingPause(true)
                              const data = await api.patch(`/meetings/${qrModal._id}/qr-pause`)
                              if (data.success) {
                                const nowPaused = data.data.qrPaused
                                setQrAutoRefresh(!nowPaused)
                                if (!nowPaused) {
                                  // Resuming — restart the timer cycle
                                  setQrResetKey((k) => k + 1)
                                }
                                showToast('success', data.message)
                              }
                            } catch (err) {
                              console.error('Toggle QR pause failed:', err)
                              showToast('error', 'Failed to toggle auto-refresh')
                            } finally {
                              setTogglingPause(false)
                            }
                          }}
                          title={qrAutoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            {qrAutoRefresh ? 'pause_circle' : 'play_circle'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-qr-actions">
                    <button className="mt-btn mt-btn-primary" onClick={() => downloadQR(qrModal)}>
                      <span className="material-symbols-outlined">download</span>
                      Download QR
                    </button>
                    <button
                      className="mt-btn mt-btn-ghost"
                      onClick={() => handleGenerateQR(qrModal)}
                      disabled={generatingQR === qrModal._id}
                    >
                      {generatingQR === qrModal._id ? (
                        <span className="mt-spinner" />
                      ) : (
                        <span className="material-symbols-outlined">refresh</span>
                      )}
                      Regenerate Now
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────── */}
      {toast && (
        <div className={`mt-toast mt-toast-${toast.type}`}>
          <span className="material-symbols-outlined">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.message}</span>
          <button className="mt-toast-close" onClick={() => setToast(null)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default ManageMeetings
