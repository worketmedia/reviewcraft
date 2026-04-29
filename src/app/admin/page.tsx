'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  FaChartPie, FaBuilding, FaComments, FaPlusCircle, FaCog,
  FaBars, FaTimes, FaSignOutAlt, FaSpinner, FaSearch,
  FaCheckCircle, FaTimesCircle, FaExternalLinkAlt, FaCopy,
  FaStar, FaChevronRight
} from 'react-icons/fa'
import QRCode from 'qrcode'
import type { Business, ReviewSession, HighlightTag, MenuItem } from '@/types'

type Tab = 'overview' | 'businesses' | 'reviews' | 'create' | 'settings'

const SIDEBAR_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <FaChartPie size={18} /> },
  { id: 'businesses', label: 'Businesses', icon: <FaBuilding size={18} /> },
  { id: 'reviews', label: 'Reviews', icon: <FaComments size={18} /> },
  { id: 'create', label: 'Create Business', icon: <FaPlusCircle size={18} /> },
  { id: 'settings', label: 'Settings', icon: <FaCog size={18} /> },
]

interface BizWithStats extends Business {
  reviewCount: number
  avgRating: number
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [sessions, setSessions] = useState<ReviewSession[]>([])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!adminRow) { router.push('/dashboard'); return }

      setUser(user)

      const [bizRes, sessRes] = await Promise.all([
        supabase.from('businesses').select('*').order('created_at', { ascending: false }),
        supabase.from('review_sessions').select('*').order('created_at', { ascending: false }),
      ])

      setBusinesses((bizRes.data ?? []) as Business[])
      setSessions((sessRes.data ?? []) as ReviewSession[])
      setLoading(false)
    }
    init()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <FaSpinner className="animate-spin text-[#1B4D3E]" size={40} />
      </div>
    )
  }

  const selectTab = (tab: Tab) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static z-50 top-0 left-0 h-full w-[250px] bg-[#1A1A1A] text-white flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <span className="font-bold text-lg">Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/60 hover:text-white">
            <FaTimes size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => selectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-[#1B4D3E] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs text-white/40 truncate">{user?.email}</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-600">
              <FaBars size={20} />
            </button>
            <h1 className="text-lg font-bold text-gray-800">ReviewCraft Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">{user?.email}</span>
            <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors">
              <FaSignOutAlt size={16} /> Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {activeTab === 'overview' && <OverviewTab businesses={businesses} sessions={sessions} />}
          {activeTab === 'businesses' && <BusinessesTab businesses={businesses} sessions={sessions} supabase={supabase} />}
          {activeTab === 'reviews' && <ReviewsTab businesses={businesses} sessions={sessions} supabase={supabase} />}
          {activeTab === 'create' && <div className="text-gray-500 text-center py-20">Create Business — coming soon</div>}
          {activeTab === 'settings' && <div className="text-gray-500 text-center py-20">Settings — coming soon</div>}
        </main>
      </div>
    </div>
  )
}

/* ── OVERVIEW TAB ─────────────────────────────────────────────── */

function OverviewTab({ businesses, sessions }: { businesses: Business[]; sessions: ReviewSession[] }) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonth = sessions.filter(s => new Date(s.created_at) >= startOfMonth)
  const withRating = sessions.filter(s => s.overall_rating != null)
  const avgRating = withRating.length
    ? (withRating.reduce((sum, s) => sum + (s.overall_rating ?? 0), 0) / withRating.length).toFixed(1)
    : '—'
  const completed = sessions.filter(s => s.status === 'copied' || s.status === 'generated').length
  const completionRate = sessions.length ? Math.round((completed / sessions.length) * 100) : 0

  const stats = [
    { label: 'Total Businesses', value: businesses.length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Total Reviews', value: sessions.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Reviews This Month', value: thisMonth.length, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { label: 'Average Rating', value: avgRating === '—' ? '—' : `${avgRating} ★`, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: 'Completion Rate', value: `${completionRate}%`, color: 'bg-pink-50 text-pink-700 border-pink-200' },
  ]

  // Business review counts
  const bizReviewCounts: Record<string, { name: string; count: number }> = {}
  businesses.forEach(b => { bizReviewCounts[b.id] = { name: b.name, count: 0 } })
  sessions.forEach(s => { if (bizReviewCounts[s.business_id]) bizReviewCounts[s.business_id].count++ })
  const topBiz = Object.values(bizReviewCounts).sort((a, b) => b.count - a.count).slice(0, 5)

  const recentSessions = sessions.slice(0, 10)
  const bizMap = Object.fromEntries(businesses.map(b => [b.id, b.name]))

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-800">Overview</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl border p-5 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-1 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Reviews */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Recent Reviews</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Business</th>
                  <th className="px-5 py-3">Rating</th>
                  <th className="px-5 py-3 hidden md:table-cell">Review</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}>
                    <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{bizMap[s.business_id] ?? '—'}</td>
                    <td className="px-5 py-3 text-[#D4A843] whitespace-nowrap">{'★'.repeat(s.overall_rating ?? 0)}{'☆'.repeat(5 - (s.overall_rating ?? 0))}</td>
                    <td className="px-5 py-3 text-gray-600 hidden md:table-cell max-w-xs truncate">{s.generated_review ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.status === 'copied' ? 'bg-green-100 text-green-700' :
                        s.status === 'generated' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell whitespace-nowrap">{new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
                {recentSessions.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">No reviews yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Businesses */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Top Performing</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {topBiz.map((b, i) => (
              <div key={b.name} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-[#D4A843] text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800">{b.name}</span>
                </div>
                <span className="text-sm text-gray-500">{b.count} reviews</span>
              </div>
            ))}
            {topBiz.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No data</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── BUSINESSES TAB ───────────────────────────────────────────── */

function BusinessesTab({ businesses, sessions, supabase }: { businesses: Business[]; sessions: ReviewSession[]; supabase: any }) {
  const [search, setSearch] = useState('')
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null)
  const [panelTags, setPanelTags] = useState<HighlightTag[]>([])
  const [panelItems, setPanelItems] = useState<MenuItem[]>([])
  const [panelQr, setPanelQr] = useState('')

  // Compute stats per business
  const bizStats: Record<string, { count: number; avg: number }> = {}
  businesses.forEach(b => { bizStats[b.id] = { count: 0, avg: 0 } })
  sessions.forEach(s => {
    if (!bizStats[s.business_id]) return
    bizStats[s.business_id].count++
  })
  sessions.forEach(s => {
    if (!bizStats[s.business_id] || !s.overall_rating) return
  })
  // Compute avg
  businesses.forEach(b => {
    const bSess = sessions.filter(s => s.business_id === b.id && s.overall_rating != null)
    bizStats[b.id] = {
      count: sessions.filter(s => s.business_id === b.id).length,
      avg: bSess.length ? bSess.reduce((sum, s) => sum + (s.overall_rating ?? 0), 0) / bSess.length : 0,
    }
  })

  const filtered = businesses.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))

  const openPanel = async (biz: Business) => {
    setSelectedBiz(biz)
    const [tagsRes, itemsRes] = await Promise.all([
      supabase.from('highlight_tags').select('*').eq('business_id', biz.id).order('sort_order'),
      supabase.from('menu_items').select('*').eq('business_id', biz.id).order('sort_order'),
    ])
    setPanelTags((tagsRes.data ?? []) as HighlightTag[])
    setPanelItems((itemsRes.data ?? []) as MenuItem[])

    const url = `${window.location.origin}/review/${biz.id}`
    const qr = await QRCode.toDataURL(url, { width: 200, margin: 2, color: { dark: '#1B4D3E', light: '#FFFFFF' } })
    setPanelQr(qr)
  }

  const closePanel = () => { setSelectedBiz(null); setPanelTags([]); setPanelItems([]); setPanelQr('') }

  const deleteBiz = async (id: string) => {
    if (!confirm('Delete this business and all its data?')) return
    await supabase.from('review_sessions').delete().eq('business_id', id)
    await supabase.from('highlight_tags').delete().eq('business_id', id)
    await supabase.from('menu_items').delete().eq('business_id', id)
    await supabase.from('businesses').delete().eq('id', id)
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Businesses</h2>
        <div className="relative w-full sm:w-72">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Business Name</th>
                <th className="px-5 py-3 hidden md:table-cell">Category</th>
                <th className="px-5 py-3 hidden lg:table-cell">City / Area</th>
                <th className="px-5 py-3">Reviews</th>
                <th className="px-5 py-3 hidden sm:table-cell">Avg Rating</th>
                <th className="px-5 py-3 hidden lg:table-cell">Google Link</th>
                <th className="px-5 py-3 hidden md:table-cell">Created</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => {
                const st = bizStats[b.id] ?? { count: 0, avg: 0 }
                return (
                  <tr
                    key={b.id}
                    className={`border-b border-gray-50 cursor-pointer ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/40 transition-colors`}
                    onClick={() => openPanel(b)}
                  >
                    <td className="px-5 py-3 font-medium text-gray-800">{b.name}</td>
                    <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{b.category ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">{b.city ?? ''}{b.area ? `, ${b.area}` : ''}</td>
                    <td className="px-5 py-3 text-gray-800 font-medium">{st.count}</td>
                    <td className="px-5 py-3 text-[#D4A843] hidden sm:table-cell">{st.avg ? `${st.avg.toFixed(1)} ★` : '—'}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      {b.google_place_id ? <FaCheckCircle className="text-green-500" /> : <FaTimesCircle className="text-gray-300" />}
                    </td>
                    <td className="px-5 py-3 text-gray-500 hidden md:table-cell whitespace-nowrap">{new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); openPanel(b) }} className="text-[#1B4D3E] hover:underline text-xs font-medium">View</button>
                        <button onClick={e => { e.stopPropagation(); deleteBiz(b.id) }} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No businesses found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over panel */}
      {selectedBiz && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closePanel} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-bold text-lg text-gray-800">{selectedBiz.name}</h3>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600"><FaTimes size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Info */}
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Category:</span> <span className="font-medium">{selectedBiz.category ?? '—'}</span></p>
                <p><span className="text-gray-500">Location:</span> <span className="font-medium">{selectedBiz.area}, {selectedBiz.city}</span></p>
                <p><span className="text-gray-500">Description:</span> <span className="font-medium">{selectedBiz.description ?? '—'}</span></p>
                <p><span className="text-gray-500">Google Link:</span> {selectedBiz.google_place_id ? <a href={selectedBiz.google_place_id} target="_blank" rel="noopener noreferrer" className="text-[#1B4D3E] underline inline-flex items-center gap-1">Open <FaExternalLinkAlt size={10} /></a> : <span className="text-gray-400">Not set</span>}</p>
                <p><span className="text-gray-500">Reviews:</span> <span className="font-medium">{bizStats[selectedBiz.id]?.count ?? 0}</span></p>
              </div>

              {/* Tags */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Highlight Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {panelTags.map(t => <span key={t.id} className="bg-[#1B4D3E]/10 text-[#1B4D3E] px-3 py-1 rounded-full text-xs font-medium">{t.label}</span>)}
                  {panelTags.length === 0 && <p className="text-sm text-gray-400">None</p>}
                </div>
              </div>

              {/* Bill Items */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Bill Items</h4>
                <div className="space-y-1">
                  {panelItems.map(m => <p key={m.id} className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">{m.name}</p>)}
                  {panelItems.length === 0 && <p className="text-sm text-gray-400">None</p>}
                </div>
              </div>

              {/* QR Code */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">QR Code</h4>
                {panelQr && <img src={panelQr} alt="QR" className="w-40 h-40 rounded-xl border" />}
              </div>

              {/* Review Link */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Review Link</h4>
                <div className="flex items-center gap-2">
                  <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/review/${selectedBiz.id}`} className="flex-1 border rounded-lg px-3 py-2 text-xs bg-gray-50" />
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/review/${selectedBiz.id}`)} className="text-[#1B4D3E] hover:text-[#153e31]"><FaCopy size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── REVIEWS TAB (Private Feedback) ───────────────────────────── */

function ReviewsTab({ businesses, sessions, supabase }: { businesses: Business[]; sessions: ReviewSession[]; supabase: any }) {
  const bizMap = Object.fromEntries(businesses.map(b => [b.id, b.name]))
  const feedbackSessions = sessions.filter(s => s.status === 'private_feedback')

  const handleResolve = async (id: string) => {
    await supabase.from('review_sessions').update({ status: 'resolved' }).eq('id', id)
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Private Feedback</h2>

      {feedbackSessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-500">No pending private feedback. All clear!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbackSessions.map(session => (
            <div key={session.id} className="bg-white border border-red-100 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-800">{bizMap[session.business_id] ?? 'Unknown'}</span>
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`text-sm ${s <= (session.overall_rating ?? 0) ? 'text-[#D4A843]' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(session.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {session.private_feedback && (
                <p className="text-sm text-gray-700 bg-red-50 rounded-lg p-3">{session.private_feedback}</p>
              )}
              {session.customer_contact && (
                <p className="text-xs text-gray-500">📞 Contact: {session.customer_contact}</p>
              )}
              <button
                onClick={() => handleResolve(session.id)}
                className="text-xs font-medium text-[#1B4D3E] bg-[#1B4D3E]/5 border border-[#1B4D3E]/20 px-4 py-2 rounded-lg hover:bg-[#1B4D3E]/10 transition-colors"
              >
                Mark as Resolved
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
