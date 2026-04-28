'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  FaHome, FaQrcode, FaSlidersH, FaChartBar,
  FaSpinner, FaTimes, FaPlus, FaCopy, FaDownload,
  FaSignOutAlt, FaImage, FaCheckCircle, FaChevronDown, FaChevronUp
} from 'react-icons/fa'
import QRCode from 'qrcode'
import type { Business, HighlightTag, MenuItem, ReviewSession } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'qr' | 'customize' | 'analytics'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home',      label: 'Home',      icon: <FaHome size={20} /> },
  { id: 'qr',        label: 'QR Code',   icon: <FaQrcode size={20} /> },
  { id: 'customize', label: 'Customize', icon: <FaSlidersH size={20} /> },
  { id: 'analytics', label: 'Analytics', icon: <FaChartBar size={20} /> },
]

const STOP_WORDS = new Set([
  'the','and','was','very','a','an','of','to','in','is','it','for','on','at','with',
  'my','we','i','our','this','that','had','have','were','are','but','so','their',
  'they','be','me','he','she','you','from','by','as','up','not','or','no','its',
])

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [sessions, setSessions] = useState<ReviewSession[]>([])

  const TAB_TITLES: Record<Tab, string> = {
    home:      'Dashboard',
    qr:        'QR Code',
    customize: 'Customize',
    analytics: 'Analytics',
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: biz } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!biz) { router.push('/onboarding'); return }
      setBusiness(biz as Business)

      const { data: sess } = await supabase
        .from('review_sessions')
        .select('*')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false })

      setSessions((sess ?? []) as ReviewSession[])
      setIsLoading(false)
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const refreshSessions = async () => {
    if (!business) return
    const { data } = await supabase
      .from('review_sessions')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
    setSessions((data ?? []) as ReviewSession[])
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <FaSpinner className="animate-spin text-[#1B4D3E]" size={40} />
      </div>
    )
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'RC'

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-sans flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white shadow-xl flex flex-col relative">

        {/* ── Top Bar ── */}
        <div className="bg-[#1B4D3E] text-white px-5 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <div>
              <p className="text-xs text-white/60 leading-none">ReviewCraft</p>
              <p className="font-semibold leading-tight">{TAB_TITLES[activeTab]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D4A843] flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
            <button onClick={handleSignOut} className="text-white/70 hover:text-white transition-colors">
              <FaSignOutAlt size={18} />
            </button>
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto pb-24">
          {activeTab === 'home'      && business && <HomeTab      business={business} sessions={sessions} onRefresh={refreshSessions} supabase={supabase} />}
          {activeTab === 'qr'        && business && <QRTab        business={business} />}
          {activeTab === 'customize' && business && <CustomizeTab business={business} supabase={supabase} />}
          {activeTab === 'analytics' && business && <AnalyticsTab sessions={sessions} />}
        </div>

        {/* ── Bottom Tab Bar ── */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-gray-100 z-40">
          <div className="flex">
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                    active ? 'text-[#1B4D3E]' : 'text-gray-400'
                  }`}
                >
                  {tab.icon}
                  <span className="text-[10px] font-medium">{tab.label}</span>
                  {active && <span className="w-1 h-1 rounded-full bg-[#1B4D3E]" />}
                </button>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ business, sessions, onRefresh, supabase }: { business: Business; sessions: ReviewSession[]; onRefresh: () => void; supabase: any }) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const thisMonth  = sessions.filter(s => new Date(s.created_at) >= startOfMonth)
  const withRating = sessions.filter(s => s.overall_rating != null)
  const avgRating  = withRating.length
    ? (withRating.reduce((sum, s) => sum + (s.overall_rating ?? 0), 0) / withRating.length).toFixed(1)
    : '—'
  const completed  = sessions.filter(s => s.status === 'copied' || s.status === 'generated').length
  const completionRate = sessions.length ? Math.round((completed / sessions.length) * 100) : 0
  const postedCount = sessions.filter(s => s.status === 'copied').length

  const metrics = [
    { label: 'Reviews This Month', value: thisMonth.length.toString(),  color: 'bg-green-50 text-green-700'  },
    { label: 'Average Rating',      value: avgRating === '—' ? '—' : `${avgRating} ★`, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Completion Rate',     value: `${completionRate}%`,          color: 'bg-blue-50 text-blue-700'   },
    { label: 'Posted on Google',    value: postedCount.toString(),        color: 'bg-purple-50 text-purple-700'},
  ]

  const recent = sessions.slice(0, 3)
  const feedbackSessions = sessions.filter(s => s.status === 'private_feedback')

  const handleResolve = async (id: string) => {
    await supabase.from('review_sessions').update({ status: 'resolved' }).eq('id', id)
    onRefresh()
  }

  return (
    <div className="p-5 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{business.name}</h2>
        <p className="text-sm text-gray-400">{business.area}, {business.city}</p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(m => (
          <div key={m.label} className={`rounded-2xl p-4 ${m.color}`}>
            <p className="text-2xl font-bold">{m.value}</p>
            <p className="text-xs font-medium mt-1 opacity-80">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Recent reviews */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Recent Reviews</h3>
          <button onClick={onRefresh} className="text-xs text-[#1B4D3E] font-medium">Refresh</button>
        </div>

        {recent.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 text-sm">No reviews yet. Share your QR code to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map(session => (
              <div key={session.id} className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={s <= (session.overall_rating ?? 0) ? 'text-[#D4A843]' : 'text-gray-200'}>★</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(session.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {session.generated_review && (
                  <p className="text-sm text-gray-600 line-clamp-2">{session.generated_review}</p>
                )}
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                  session.status === 'copied'    ? 'bg-green-100 text-green-700' :
                  session.status === 'generated' ? 'bg-blue-100 text-blue-700'  :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {session.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Private Feedback */}
      {feedbackSessions.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">⚠️ Private Feedback</h3>
          <div className="space-y-3">
            {feedbackSessions.map(session => (
              <div key={session.id} className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={s <= (session.overall_rating ?? 0) ? 'text-[#D4A843]' : 'text-gray-200'}>★</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(session.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {session.private_feedback && (
                  <p className="text-sm text-gray-700">{session.private_feedback}</p>
                )}
                {session.customer_contact && (
                  <p className="text-xs text-gray-500">📞 {session.customer_contact}</p>
                )}
                <button
                  onClick={() => handleResolve(session.id)}
                  className="text-xs font-medium text-[#1B4D3E] bg-white border border-[#1B4D3E]/20 px-3 py-1.5 rounded-lg hover:bg-[#1B4D3E]/5 transition-colors"
                >
                  Mark as Resolved
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── QR CODE TAB ──────────────────────────────────────────────────────────────
function QRTab({ business }: { business: Business }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/review/${business.id}`

  useEffect(() => {
    QRCode.toDataURL(reviewUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#1B4D3E', light: '#FFFFFF' },
    }).then(setQrDataUrl)
  }, [reviewUrl])

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(reviewUrl)
      } else {
        const ta = document.createElement('textarea')
        ta.value = reviewUrl
        ta.style.position = 'fixed'; ta.style.left = '-9999px'
        document.body.appendChild(ta); ta.select(); document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleDownload = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `${business.name.replace(/\s+/g, '-').toLowerCase()}-qr.png`
    a.click()
  }

  return (
    <div className="p-5 space-y-6">

      {/* Table tent preview */}
      <div className="bg-white border-2 border-[#1B4D3E]/20 rounded-3xl p-6 flex flex-col items-center shadow-sm">
        <div className="w-12 h-12 bg-[#1B4D3E]/10 rounded-full flex items-center justify-center mb-3">
          <span className="text-2xl">🌿</span>
        </div>
        <p className="text-xs font-bold text-[#1B4D3E] uppercase tracking-widest mb-1">Enjoyed your visit?</p>
        <h3 className="text-lg font-bold text-gray-800 text-center mb-4">{business.name}</h3>

        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-xl" />
        ) : (
          <div className="w-48 h-48 rounded-xl bg-gray-100 flex items-center justify-center">
            <FaSpinner className="animate-spin text-gray-400" size={24} />
          </div>
        )}

        <p className="text-sm text-gray-500 mt-4 text-center">Scan to share your experience</p>
        <p className="text-[10px] text-gray-400 mt-2 font-medium">Powered by ReviewCraft</p>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          onClick={handleCopy}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-base transition-colors min-h-[44px] ${
            copied ? 'bg-green-600 text-white' : 'bg-[#1B4D3E] text-white'
          }`}
        >
          <FaCopy size={16} />
          {copied ? 'Link Copied!' : 'Copy Review Link'}
        </button>

        <button
          onClick={handleDownload}
          disabled={!qrDataUrl}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-base border-2 border-[#1B4D3E] text-[#1B4D3E] min-h-[44px] disabled:opacity-50"
        >
          <FaDownload size={16} />
          Download QR Code
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs text-gray-500 font-medium mb-1">Review URL</p>
        <p className="text-xs text-gray-700 break-all">{reviewUrl}</p>
      </div>
    </div>
  )
}

// ─── CUSTOMIZE TAB ────────────────────────────────────────────────────────────
function CustomizeTab({ business, supabase }: { business: Business; supabase: ReturnType<typeof createClient> }) {
  const [tags, setTags] = useState<HighlightTag[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [welcomeMsg, setWelcomeMsg] = useState(business.welcome_message ?? '')
  const [newTag, setNewTag] = useState('')
  const [newItem, setNewItem] = useState('')
  const [savingMsg, setSavingMsg] = useState(false)
  const [msgSaved, setMsgSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // New fields
  const [placeId, setPlaceId] = useState(business.google_place_id ?? '')
  const [savingPlaceId, setSavingPlaceId] = useState(false)
  const [placeIdSaved, setPlaceIdSaved] = useState(false)
  const [showPlaceIdHelp, setShowPlaceIdHelp] = useState(false)

  const [description, setDescription] = useState(business.description ?? '')
  const [savingDesc, setSavingDesc] = useState(false)
  const [descSaved, setDescSaved] = useState(false)

  const [logoPreview, setLogoPreview] = useState(business.logo_url ?? '')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const [tagsRes, itemsRes] = await Promise.all([
        supabase.from('highlight_tags').select('*').eq('business_id', business.id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('business_id', business.id).order('sort_order'),
      ])
      setTags((tagsRes.data ?? []) as HighlightTag[])
      setItems((itemsRes.data ?? []) as MenuItem[])
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const addTag = async () => {
    const label = newTag.trim()
    if (!label || tags.some(t => t.label === label)) return
    const { data } = await supabase.from('highlight_tags').insert({
      business_id: business.id,
      category: business.category ?? 'General',
      label,
      sort_order: tags.length,
    }).select().single()
    if (data) setTags(prev => [...prev, data as HighlightTag])
    setNewTag('')
  }

  const removeTag = async (id: string) => {
    await supabase.from('highlight_tags').delete().eq('id', id)
    setTags(prev => prev.filter(t => t.id !== id))
  }

  const addItem = async () => {
    const name = newItem.trim()
    if (!name || items.some(i => i.name === name)) return
    const { data } = await supabase.from('menu_items').insert({
      business_id: business.id,
      name,
      sort_order: items.length,
    }).select().single()
    if (data) setItems(prev => [...prev, data as MenuItem])
    setNewItem('')
  }

  const removeItem = async (id: string) => {
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const saveWelcomeMsg = async () => {
    setSavingMsg(true)
    await supabase.from('businesses').update({ welcome_message: welcomeMsg }).eq('id', business.id)
    setSavingMsg(false); setMsgSaved(true); setTimeout(() => setMsgSaved(false), 2000)
  }

  const savePlaceId = async () => {
    setSavingPlaceId(true)
    await supabase.from('businesses').update({ google_place_id: placeId }).eq('id', business.id)
    setSavingPlaceId(false); setPlaceIdSaved(true); setTimeout(() => setPlaceIdSaved(false), 2000)
  }

  const saveDescription = async () => {
    setSavingDesc(true)
    await supabase.from('businesses').update({ description }).eq('id', business.id)
    setSavingDesc(false); setDescSaved(true); setTimeout(() => setDescSaved(false), 2000)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${business.user_id}-${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file)
      
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)
      
      await supabase.from('businesses').update({ logo_url: publicUrl }).eq('id', business.id)
      setLogoPreview(publicUrl)
    }
    setUploadingLogo(false)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <FaSpinner className="animate-spin text-[#1B4D3E]" size={28} />
    </div>
  )

  return (
    <div className="p-5 space-y-8">

      {/* Google Reviews Connection */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative">
        <h3 className="font-semibold text-gray-800 mb-1">Google Reviews Connection</h3>
        <div className="text-sm text-gray-500 mb-4 flex items-center justify-between">
          <span>Current Status:</span>
          {business.google_place_id ? (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <FaCheckCircle /> Connected
            </span>
          ) : (
            <span className="text-gray-400">Not connected</span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Google Review Link</label>
            <input
              value={placeId}
              onChange={e => setPlaceId(e.target.value)}
              placeholder="Paste your full Google review link here"
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50"
            />
          </div>

          <button
            onClick={savePlaceId}
            disabled={savingPlaceId}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
              placeIdSaved ? 'bg-green-600 text-white' : 'bg-[#1B4D3E] text-white'
            }`}
          >
            {savingPlaceId ? 'Saving...' : placeIdSaved ? '✓ Connected!' : 'Save Connection'}
          </button>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowPlaceIdHelp(!showPlaceIdHelp)}
              className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between text-sm font-medium text-gray-700"
            >
              How to find your review link
              {showPlaceIdHelp ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
            </button>
            {showPlaceIdHelp && (
              <div className="p-4 bg-white text-sm text-gray-600 space-y-2 border-t border-gray-100">
                <p>How to find it: Open Google Maps → Search your business → Click your listing → Click 'Ask for reviews' → Copy the link</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Logo Upload */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Business Logo</h3>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full border border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0 relative">
            {uploadingLogo && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                <FaSpinner className="animate-spin text-[#1B4D3E]" size={20} />
              </div>
            )}
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <FaImage className="text-gray-300 text-3xl" />
            )}
          </div>
          <div className="flex-1">
            <label className="block w-full cursor-pointer">
              <span className="sr-only">Choose logo</span>
              <input
                type="file"
                accept="image/png, image/jpeg, image/svg+xml"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1B4D3E]/10 file:text-[#1B4D3E] hover:file:bg-[#1B4D3E]/20 transition-colors cursor-pointer disabled:opacity-50"
              />
            </label>
            <p className="text-xs text-gray-400 mt-2">Recommended: Square image, transparent background</p>
          </div>
        </div>
      </section>

      <hr className="border-gray-100" />

      {/* Business Description */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Business Description</h3>
        <p className="text-xs text-gray-500 mb-2">Used by our AI to generate more relevant and personalized reviews.</p>
        <div className="relative">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="E.g. 'Authentic Gujarati thali restaurant serving home-style food since 2015'"
            className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 resize-none"
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-400">
            {description.length}/200
          </div>
        </div>
        <button
          onClick={saveDescription}
          disabled={savingDesc}
          className={`mt-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
            descSaved ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {savingDesc ? 'Saving...' : descSaved ? '✓ Saved!' : 'Save Description'}
        </button>
      </section>

      <hr className="border-gray-100" />

      {/* Welcome message */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Welcome Message</h3>
        <textarea
          value={welcomeMsg}
          onChange={e => setWelcomeMsg(e.target.value)}
          rows={3}
          placeholder="Thanks for visiting! Share your experience in 60 seconds."
          className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 resize-none"
        />
        <button
          onClick={saveWelcomeMsg}
          disabled={savingMsg}
          className={`mt-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
            msgSaved ? 'bg-green-600 text-white' : 'bg-[#1B4D3E] text-white'
          }`}
        >
          {savingMsg ? 'Saving...' : msgSaved ? '✓ Saved!' : 'Save Welcome Message'}
        </button>
      </section>

      <hr className="border-gray-100" />

      {/* Highlight tags */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Highlight Tags</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map(tag => (
            <span key={tag.id} className="inline-flex items-center gap-1.5 bg-[#1B4D3E]/10 text-[#1B4D3E] px-3 py-1.5 rounded-full text-sm font-medium">
              {tag.label}
              <button onClick={() => removeTag(tag.id)} className="text-[#1B4D3E]/60 hover:text-[#1B4D3E]">
                <FaTimes size={10} />
              </button>
            </span>
          ))}
          {tags.length === 0 && <p className="text-sm text-gray-400">No tags yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Add a highlight tag..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
          />
          <button onClick={addTag} className="bg-[#1B4D3E] text-white px-4 rounded-xl min-h-[44px] min-w-[48px] flex items-center justify-center">
            <FaPlus size={14} />
          </button>
        </div>
      </section>

      <hr className="border-gray-100" />

      {/* Menu items */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">
          {['Restaurant','Cafe'].includes(business.category ?? '') ? 'Menu Items' : 'Services'}
        </h3>
        <div className="space-y-2 mb-4">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-sm text-gray-700">{item.name}</span>
              <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                <FaTimes size={13} />
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-400">No items yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
            placeholder="Add an item..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
          />
          <button onClick={addItem} className="bg-[#1B4D3E] text-white px-4 rounded-xl min-h-[44px] min-w-[48px] flex items-center justify-center">
            <FaPlus size={14} />
          </button>
        </div>
      </section>

    </div>
  )
}

// ─── ANALYTICS TAB ────────────────────────────────────────────────────────────
function AnalyticsTab({ sessions }: { sessions: ReviewSession[] }) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30)

  const cutoff = new Date(Date.now() - period * 24 * 60 * 60 * 1000)
  const filtered = sessions.filter(s => new Date(s.created_at) >= cutoff)

  // Rating breakdown
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  filtered.forEach(s => { if (s.overall_rating) ratingCounts[s.overall_rating]++ })
  const maxRatingCount = Math.max(...Object.values(ratingCounts), 1)

  // Keyword frequency
  const wordFreq: Record<string, number> = {}
  filtered.forEach(s => {
    if (!s.generated_review) return
    s.generated_review.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
      .forEach(w => { wordFreq[w] = (wordFreq[w] ?? 0) + 1 })
  })
  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
  const maxWordCount = topWords[0]?.[1] ?? 1

  const hasData = filtered.length >= 2

  return (
    <div className="p-5 space-y-6">

      {/* Period filter */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {([7, 30, 90] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${
              period === p ? 'bg-white text-[#1B4D3E] shadow-sm' : 'text-gray-500'
            }`}
          >
            {p}d
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500">{filtered.length} review{filtered.length !== 1 ? 's' : ''} in this period</p>

      {!hasData ? (
        <div className="bg-gray-50 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500 text-sm">Collect more reviews to see analytics.</p>
        </div>
      ) : (
        <>
          {/* Rating breakdown */}
          <section>
            <h3 className="font-semibold text-gray-800 mb-4">Rating Breakdown</h3>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map(star => {
                const count = ratingCounts[star]
                const pct = filtered.length ? Math.round((count / filtered.length) * 100) : 0
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-6 text-right">{star}★</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-[#D4A843] rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxRatingCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Top keywords */}
          {topWords.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-800 mb-4">Top Keywords</h3>
              <div className="space-y-3">
                {topWords.map(([word, count]) => (
                  <div key={word} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24 truncate capitalize">{word}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-[#1B4D3E] rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxWordCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

    </div>
  )
}
