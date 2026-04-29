'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  FaHome, FaQrcode, FaSlidersH, FaChartBar,
  FaSpinner, FaTimes, FaPlus, FaCopy, FaDownload,
  FaSignOutAlt, FaImage, FaCheckCircle, FaChevronDown, FaChevronUp, FaWhatsapp
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
  const cardCanvasRef = useRef<HTMLCanvasElement>(null)
  const stickerCanvasRef = useRef<HTMLCanvasElement>(null)

  const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/review/${business.id}`

  useEffect(() => {
    QRCode.toDataURL(reviewUrl, {
      width: 1000,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
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

  const handleWhatsApp = () => {
    const text = `Hi! Please rate us on Google using this link: ${reviewUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const generateImage = (type: 'card' | 'sticker') => {
    const canvas = type === 'card' ? cardCanvasRef.current : stickerCanvasRef.current
    if (!canvas || !qrDataUrl) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    
    // Scale everything up
    const S = type === 'card' ? 2 : 2
    
    // Clear
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    const drawContent = async () => {
      // 1. Multicolored Google "G"
      ctx.save()
      const gSize = (type === 'card' ? 80 : 60) * S
      const gX = (width - gSize) / 2
      const gY = (type === 'card' ? 60 : 40) * S
      
      const scale = gSize / 48
      ctx.translate(gX, gY)
      ctx.scale(scale, scale)

      const pRed = new Path2D("M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z")
      const pBlue = new Path2D("M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z")
      const pYellow = new Path2D("M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z")
      const pGreen = new Path2D("M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z")

      ctx.fillStyle = "#EA4335"; ctx.fill(pRed)
      ctx.fillStyle = "#4285F4"; ctx.fill(pBlue)
      ctx.fillStyle = "#FBBC05"; ctx.fill(pYellow)
      ctx.fillStyle = "#34A853"; ctx.fill(pGreen)
      ctx.restore()

      // 2. Typography
      const textY = (type === 'card' ? 180 : 130) * S
      ctx.textAlign = 'center'
      
      ctx.fillStyle = '#70757a'
      ctx.font = `${(type === 'card' ? 24 : 18) * S}px sans-serif`
      ctx.fillText('review us', width / 2, textY)
      
      ctx.fillStyle = '#000000'
      ctx.font = `bold ${(type === 'card' ? 34 : 26) * S}px sans-serif`
      ctx.fillText('on Google', width / 2, textY + ((type === 'card' ? 40 : 30) * S))

      // 3. Stars
      const starY = textY + ((type === 'card' ? 85 : 65) * S)
      const starSize = (type === 'card' ? 32 : 24) * S
      const starGap = 6 * S
      const totalW = (starSize * 5) + (starGap * 4)
      let startX = (width - totalW) / 2
      
      ctx.fillStyle = '#FBBC05'
      for (let i = 0; i < 5; i++) {
        ctx.font = `${starSize}px sans-serif`
        ctx.fillText('★', startX + (starSize / 2), starY)
        startX += starSize + starGap
      }

      // 4. QR Code
      const qrImage = new Image()
      qrImage.src = qrDataUrl
      await new Promise(resolve => { qrImage.onload = resolve })
      const qrSize = (type === 'card' ? 320 : 220) * S
      const qrY = (type === 'card' ? 330 : 210) * S
      ctx.drawImage(qrImage, (width - qrSize) / 2, qrY, qrSize, qrSize)

      // 4b. Logo in QR center
      if (business.logo_url) {
        const logoImg = new Image()
        logoImg.crossOrigin = 'anonymous'
        logoImg.src = business.logo_url
        try {
          await new Promise((resolve, reject) => {
            logoImg.onload = resolve
            logoImg.onerror = reject
            setTimeout(reject, 3000)
          })
          const innerLogoSize = qrSize * 0.2
          const lx = (width - innerLogoSize) / 2
          const ly = qrY + (qrSize - innerLogoSize) / 2
          
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(lx - (2 * S), ly - (2 * S), innerLogoSize + (4 * S), innerLogoSize + (4 * S))
          ctx.drawImage(logoImg, lx, ly, innerLogoSize, innerLogoSize)
        } catch (e) {}
      }

      // 5. Business Name & Logo
      const bizY = (type === 'card' ? 700 : 455) * S
      ctx.fillStyle = '#000000'
      ctx.font = `bold ${(type === 'card' ? 22 : 16) * S}px sans-serif`
      
      if (business.logo_url) {
        const logoImg = new Image()
        logoImg.crossOrigin = 'anonymous'
        logoImg.src = business.logo_url
        try {
          await new Promise((resolve, reject) => {
            logoImg.onload = resolve
            logoImg.onerror = reject
            setTimeout(reject, 3000)
          })
          const logoSize = (type === 'card' ? 36 : 28) * S
          const textW = ctx.measureText(business.name).width
          const startX = (width - textW - logoSize - (10 * S)) / 2
          ctx.drawImage(logoImg, startX, bizY - (logoSize / 2) - (5 * S), logoSize, logoSize)
          ctx.textAlign = 'left'
          ctx.fillText(business.name, startX + logoSize + (10 * S), bizY)
        } catch (e) {
          ctx.textAlign = 'center'
          ctx.fillText(business.name, width / 2, bizY)
        }
      } else {
        ctx.textAlign = 'center'
        ctx.fillText(business.name, width / 2, bizY)
      }

      // 6. Location
      ctx.fillStyle = '#70757a'
      ctx.font = `${(type === 'card' ? 14 : 12) * S}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(`${business.area}, ${business.city}`, width / 2, bizY + ((type === 'card' ? 25 : 20) * S))

      // 7. Footer
      if (type === 'card') {
        ctx.fillStyle = '#000000'
        ctx.font = `${16 * S}px sans-serif`
        ctx.fillText('Scan with your phone camera 📱', width / 2, 780 * S)
        
        ctx.strokeStyle = '#F3F4F6'
        ctx.lineWidth = 1 * S
        ctx.beginPath()
        ctx.moveTo(100 * S, 830 * S)
        ctx.lineTo(width - (100 * S), 830 * S)
        ctx.stroke()
        
        ctx.fillStyle = '#9CA3AF'
        ctx.font = `bold ${10 * S}px sans-serif`
        ctx.fillText('POWERED BY REVIEWCRAFT', width / 2, 855 * S)
      } else {
        ctx.fillStyle = '#70757a'
        ctx.font = `${12 * S}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('Scan to rate ⭐', width / 2, bizY + (45 * S))
      }

      const link = document.createElement('a')
      link.download = `${business.name.replace(/\s+/g, '-').toLowerCase()}-${type}.png`
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
    }

    drawContent()
  }

  return (
    <div className="p-5 space-y-8">
      
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800 px-1">Live Preview</h3>
        
        {/* Card Preview Wrapper */}
        <div className="bg-gray-200 rounded-3xl p-8 flex justify-center overflow-hidden border border-gray-300">
          <div className="bg-white w-[280px] aspect-[2/3] rounded-2xl shadow-2xl flex flex-col items-center p-8 border border-gray-100 relative scale-110">
            {/* Template UI Mockup (Card) */}
            <div className="w-14 h-14 mb-4 flex items-center justify-center">
              <svg viewBox="0 0 48 48" className="w-full h-full">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            </div>
            <p className="text-gray-500 font-normal text-[10px] leading-tight">review us</p>
            <p className="text-black font-bold text-base leading-tight mb-3">on Google</p>
            
            <div className="flex gap-1 mb-5 text-[#FBBC05] text-sm">
              {[1,2,3,4,5].map(i => <span key={i}>★</span>)}
            </div>
            
            <div className="w-40 h-40 bg-white rounded-xl flex items-center justify-center border border-gray-100 mb-6 relative">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR" className="w-[140px] h-[140px]" />
              ) : (
                <FaSpinner className="animate-spin text-gray-300" />
              )}
              {business.logo_url && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white p-1 rounded-sm border border-gray-50">
                    <img src={business.logo_url} alt="Logo" className="w-7 h-7 object-contain" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-1">
              {business.logo_url && <img src={business.logo_url} className="w-5 h-5 rounded-full object-cover" alt="Logo" />}
              <p className="text-xs font-bold text-gray-900">{business.name}</p>
            </div>
            <p className="text-[9px] text-gray-400">{business.area}, {business.city}</p>
            
            <div className="mt-auto w-full pt-4 border-t border-gray-50 flex flex-col items-center">
              <p className="text-[9px] text-gray-900 font-medium">Scan with your phone camera 📱</p>
              <p className="text-[7px] text-gray-300 mt-2 tracking-widest font-bold">POWERED BY REVIEWCRAFT</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => generateImage('card')} className="bg-[#1B4D3E] text-white py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all">
            📥 Table Card
          </button>
          <button onClick={() => generateImage('sticker')} className="bg-white text-[#1B4D3E] border-2 border-[#1B4D3E] py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all">
            📥 Sticker
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleCopy}
          className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all shadow-sm ${
            copied ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800 border border-gray-200'
          }`}
        >
          <FaCopy size={16} />
          {copied ? 'Link Copied!' : '📋 Copy Review Link'}
        </button>

        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm bg-[#25D366] text-white shadow-sm active:scale-95 transition-all"
        >
          <FaWhatsapp size={18} />
          💬 Share via WhatsApp
        </button>
      </div>

      {/* Hidden Canvases for high-quality export */}
      <canvas ref={cardCanvasRef} width={1200} height={1800} className="hidden" />
      <canvas ref={stickerCanvasRef} width={1000} height={1000} className="hidden" />

      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your Unique Review Link</p>
          <FaCheckCircle className={business.google_place_id ? 'text-green-500' : 'text-gray-300'} size={12} />
        </div>
        <p className="text-xs text-gray-600 break-all font-medium leading-relaxed">{reviewUrl}</p>
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
  const [newItemFile, setNewItemFile] = useState<File | null>(null)
  const [newItemPreview, setNewItemPreview] = useState<string | null>(null)
  const [savingMsg, setSavingMsg] = useState(false)
  const [msgSaved, setMsgSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // SEO Keywords
  const [keywords, setKeywords] = useState<string[]>(business.keywords ?? [])
  const [newKeyword, setNewKeyword] = useState('')
  const [savingKeywords, setSavingKeywords] = useState(false)
  const [keywordsSaved, setKeywordsSaved] = useState(false)

  // Menu Card
  const [menuUrls, setMenuUrls] = useState<string[]>(business.menu_urls ?? [])
  const [uploadingMenu, setUploadingMenu] = useState(false)

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

  const handleItemImageUpload = async (itemId: string, file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${itemId}/${Date.now()}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })
      
    if (uploadError) {
      console.error('Item image upload error:', uploadError)
    } else {
      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName)
      
      const publicUrl = urlData.publicUrl
      await supabase.from('menu_items').update({ image_url: publicUrl }).eq('id', itemId)
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, image_url: publicUrl } : item))
    }
  }

  const handleMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (menuUrls.length + files.length > 3) {
      alert('Maximum 3 menu files allowed')
      return
    }

    setUploadingMenu(true)
    const newUrls = [...menuUrls]

    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${business.id}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('menus')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
        
      if (uploadError) {
        console.error('Menu upload error:', uploadError)
      } else {
        const { data: urlData } = supabase.storage
          .from('menus')
          .getPublicUrl(fileName)
        newUrls.push(urlData.publicUrl)
      }
    }

    await supabase.from('businesses').update({ menu_urls: newUrls }).eq('id', business.id)
    setMenuUrls(newUrls)
    setUploadingMenu(false)
  }

  const removeMenu = async (url: string) => {
    const newUrls = menuUrls.filter(u => u !== url)
    await supabase.from('businesses').update({ menu_urls: newUrls }).eq('id', business.id)
    setMenuUrls(newUrls)
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

  const addKeyword = () => {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw])
    }
    setNewKeyword('')
  }

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw))
  }

  const saveKeywords = async () => {
    setSavingKeywords(true)
    await supabase.from('businesses').update({ keywords }).eq('id', business.id)
    setSavingKeywords(false); setKeywordsSaved(true); setTimeout(() => setKeywordsSaved(false), 2000)
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
    const fileName = `${business.user_id}/${Date.now()}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })
      
    if (uploadError) {
      console.error('Logo upload error:', uploadError)
    } else {
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)
      
      const publicUrl = urlData.publicUrl
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


      {/* SEO Keywords */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-1">SEO Keywords</h3>
        <p className="text-xs text-gray-500 mb-3">These keywords help generate better reviews for Google ranking.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {keywords.map(kw => (
            <span key={kw} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="text-blue-700/60 hover:text-blue-700">
                <FaTimes size={10} />
              </button>
            </span>
          ))}
          {keywords.length === 0 && <p className="text-sm text-gray-400">No keywords added.</p>}
        </div>
        <div className="flex gap-2 mb-3">
          <input
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            placeholder="e.g. best restaurant Ahmedabad"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
          />
          <button onClick={addKeyword} className="bg-[#1B4D3E] text-white px-4 rounded-xl min-h-[44px] min-w-[48px] flex items-center justify-center">
            <FaPlus size={14} />
          </button>
        </div>
        <button
          onClick={saveKeywords}
          disabled={savingKeywords}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors min-h-[44px] ${
            keywordsSaved ? 'bg-green-600 text-white' : 'bg-[#1B4D3E] text-white'
          }`}
        >
          {savingKeywords ? 'Saving...' : keywordsSaved ? '✓ Keywords Saved!' : 'Save Keywords'}
        </button>
      </section>

      <hr className="border-gray-100" />

      {/* Menu Card */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-1">Upload Your Menu</h3>
        <p className="text-xs text-gray-500 mb-4">Upload your menu card so AI can generate more accurate and specific reviews.</p>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          {menuUrls.map((url, idx) => (
            <div key={idx} className="relative group aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
              {url.toLowerCase().endsWith('.pdf') ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2 text-center">
                  <span className="text-2xl text-red-500">📄</span>
                  <span className="text-[10px] text-gray-500 font-medium truncate w-full">Menu PDF</span>
                </div>
              ) : (
                <img src={url} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover" />
              )}
              <button
                onClick={() => removeMenu(url)}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <FaTimes size={10} />
              </button>
            </div>
          ))}
          {menuUrls.length < 3 && (
            <label className={`aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#1B4D3E]/30 hover:bg-[#1B4D3E]/5 transition-all ${uploadingMenu ? 'opacity-50 pointer-events-none' : ''}`}>
              <input type="file" className="hidden" accept="image/*,application/pdf" multiple onChange={handleMenuUpload} />
              {uploadingMenu ? (
                <FaSpinner className="animate-spin text-[#1B4D3E]" size={20} />
              ) : (
                <>
                  <FaPlus className="text-gray-300" size={20} />
                  <span className="text-[10px] text-gray-400 font-medium">Add Menu</span>
                </>
              )}
            </label>
          )}
        </div>
        <p className="text-[10px] text-gray-400">Up to 3 images or 1 PDF. Best for high-res menu photos.</p>
      </section>

      <hr className="border-gray-100" />

      {/* Bill items */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Bill Items</h3>
        <div className="space-y-2 mb-4">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <label className="relative group cursor-pointer shrink-0">
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => e.target.files?.[0] && handleItemImageUpload(item.id, e.target.files[0])}
                  />
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-[#1B4D3E]/50">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <FaImage className="text-gray-300" size={16} />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaPlus className="text-white" size={12} />
                    </div>
                  </div>
                </label>
                <span className="text-sm text-gray-700 font-medium">{item.name}</span>
              </div>
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
