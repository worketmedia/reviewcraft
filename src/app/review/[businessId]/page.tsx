'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FaSpinner } from 'react-icons/fa'
import type { Business, HighlightTag } from '@/types'

// ─── Fallback tags ────────────────────────────────────────────
const FALLBACK_TAGS: Record<string, string[]> = {
  Food:    ['🍗 Butter Chicken', '🥘 Paneer Tikka', '🍛 Great Thali', '🥗 Fresh & Tasty', '🔥 Perfect Spice'],
  Service: ['😊 Friendly Staff', '⚡ Quick Service', '👍 Helpful Tips'],
  Vibe:    ['🪑 Cozy Vibe', '👨‍👩‍👧‍👦 Family Friendly', '🌙 Perfect Date Spot'],
  Value:   ['💯 Paisa Vasool', '📦 Big Portions', '💰 Fair Prices'],
}

const MOODS = [
  { emoji: '😡', label: 'Bad',      stars: 1 },
  { emoji: '😕', label: 'Meh',      stars: 2 },
  { emoji: '😐', label: 'OK',       stars: 3 },
  { emoji: '🙂', label: 'Good',     stars: 4 },
  { emoji: '🤩', label: 'Loved it!', stars: 5 },
]

const CAT_EMOJIS: Record<string, string> = { Food: '🤤', Service: '🙋', Vibe: '✨', Value: '💰' }
const CAT_FACES = [
  { emoji: '😐', val: 3 },
  { emoji: '🙂', val: 4 },
  { emoji: '🤩', val: 5 },
]

type Lang = 'english' | 'hindi' | 'hinglish' | 'gujarati'
type Tone = 'friendly' | 'professional' | 'enthusiastic'

// ─── Main Component ───────────────────────────────────────────
export default function ReviewPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params)
  const supabase = createClient()

  // Data
  const [business, setBusiness]     = useState<Business | null>(null)
  const [highlights, setHighlights] = useState<Record<string, string[]>>({})
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [notFound, setNotFound]     = useState(false)

  // Flow
  const [screen, setScreen]         = useState(1)
  const [sessionId, setSessionId]   = useState<string | null>(null)

  // Screen 2 state
  const [mood, setMood]                     = useState<number | null>(null)
  const [catRatings, setCatRatings]         = useState<Record<string, number>>({})
  const [selectedTags, setSelectedTags]     = useState<string[]>([])
  const [comment, setComment]               = useState('')
  const [lang, setLang]                     = useState<Lang>('hinglish')
  const [tone, setTone]                     = useState<Tone>('friendly')
  const [privateFeedback, setPrivateFeedback] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [showPublicAnyway, setShowPublicAnyway] = useState(false)
  const [feedbackSent, setFeedbackSent]     = useState(false)

  // Screen 3 - Customer fields
  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // Screen 3 state
  const [generatedReview, setGeneratedReview] = useState('')
  const [isGenerating, setIsGenerating]       = useState(false)
  const [copied, setCopied]                   = useState(false)
  const [isEditing, setIsEditing]             = useState(false)

  // ─── Load business & tags ───────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: biz } = await supabase
        .from('businesses').select('*').eq('id', businessId).maybeSingle()
      if (!biz) { setNotFound(true); setIsLoading(false); return }
      setBusiness(biz as Business)

      const { data: tags } = await supabase
        .from('highlight_tags').select('*').eq('business_id', businessId).order('sort_order')
      if (tags && tags.length > 0) {
        const grouped: Record<string, string[]> = {}
        for (const t of tags as HighlightTag[]) {
          const cat = t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()
          const key = cat === 'Ambiance' ? 'Vibe' : cat === 'Cleanliness' ? 'Vibe' : cat === 'Food quality' ? 'Food' : cat === 'Value for money' ? 'Value' : cat
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(t.label)
        }
        setHighlights(grouped)
      }

      const { data: mItems } = await supabase
        .from('menu_items').select('*').eq('business_id', businessId).order('sort_order')
      setMenuItems((mItems ?? []) as MenuItem[])

      setIsLoading(false)
    }
    load()
  }, [businessId])

  // ─── Session helpers ────────────────────────────────────────
  const createSession = useCallback(async () => {
    if (sessionId) return sessionId
    const { data } = await supabase
      .from('review_sessions')
      .insert({ business_id: businessId, status: 'started' })
      .select('id').single()
    if (data?.id) { setSessionId(data.id); return data.id }
    return null
  }, [businessId, sessionId])

  const updateSession = useCallback(async (updates: Record<string, unknown>, sid?: string) => {
    const id = sid ?? sessionId
    if (!id) return
    await supabase.from('review_sessions').update(updates).eq('id', id)
  }, [sessionId])

  // ─── Clipboard ──────────────────────────────────────────────
  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'
        document.body.appendChild(ta); ta.focus(); ta.select()
        document.execCommand('copy'); document.body.removeChild(ta)
      }
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch (e) { console.error('Copy failed:', e) }
  }

  // ─── Generate review ───────────────────────────────────────
  const generateReview = async () => {
    setIsGenerating(true)
    const moodStars = mood !== null ? MOODS[mood].stars : 4
    try {
      const res = await fetch('/api/generate-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business?.name, location: `${business?.area}, ${business?.city}`,
          overallRating: moodStars, categoryRatings: catRatings,
          selectedTags, additionalComment: comment,
          businessDescription: business?.description,
          language: lang, tone,
          keywords: business?.keywords,
          menuItems: menuItems.map(i => i.name),
        }),
      })
      const data = await res.json()
      const review = data.review || `Great experience at ${business?.name}!`
      setGeneratedReview(review)
      await updateSession({
        category_ratings: catRatings, selected_tags: selectedTags,
        additional_comment: comment, generated_review: review, status: 'generated',
      })
    } catch {
      setGeneratedReview(`Great experience at ${business?.name}!`)
    }
    setIsGenerating(false)
    setScreen(3)
  }

  // ─── Handlers ───────────────────────────────────────────────
  const handleMoodSelect = async (idx: number) => {
    setMood(idx)
    const sid = await createSession()
    await updateSession({ overall_rating: MOODS[idx].stars, status: 'rated' }, sid ?? undefined)
  }

  const handleSendFeedback = async () => {
    await updateSession({
      private_feedback: privateFeedback, customer_contact: customerContact,
      status: 'private_feedback',
    })
    setFeedbackSent(true)
  }

  const handleCopyAndGo = async () => {
    await updateSession({
      customer_name: customerName,
      customer_phone: customerPhone,
      status: 'copied'
    })
    await copyText(generatedReview)
    setTimeout(() => {
      const url = business?.google_place_id || 'https://google.com'
      window.open(url, '_blank')
    }, 500)
  }

  const handleRegenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business?.name, location: `${business?.area}, ${business?.city}`,
          overallRating: mood !== null ? MOODS[mood].stars : 4,
          categoryRatings: catRatings, selectedTags, additionalComment: comment,
          businessDescription: business?.description, language: lang, tone,
          keywords: business?.keywords,
          menuItems: menuItems.map(i => i.name),
          previousReviews: [generatedReview.split('.')[0]],
        }),
      })
      const data = await res.json()
      if (data.review) { setGeneratedReview(data.review); await updateSession({ generated_review: data.review }) }
    } catch { /* silent */ }
    setIsGenerating(false)
  }

  // ─── Loading / Not Found ────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
      <FaSpinner className="animate-spin text-[#1B4D3E]" size={32} />
    </div>
  )
  if (notFound || !business) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-6">
      <div className="text-center"><div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Business not found</h1>
        <p className="text-gray-500 text-sm">This link may be invalid.</p>
      </div>
    </div>
  )

  // ─── Derived ────────────────────────────────────────────────
  const isLow = mood !== null && mood <= 2
  const isHigh = mood !== null && mood >= 3
  const tagSource = Object.keys(highlights).length > 0 ? highlights : FALLBACK_TAGS
  const highCats = Object.entries(catRatings).filter(([, v]) => v >= 4).map(([k]) => k)
  const visibleTagCats = highCats.length > 0
    ? Object.entries(tagSource).filter(([k]) => highCats.includes(k))
    : Object.entries(tagSource)

  // ─── Progress dots ──────────────────────────────────────────
  const ProgressDots = () => (
    <div className="flex justify-center gap-2 pt-4 pb-2">
      {[1, 2, 3].map(i => (
        <div key={i} className={`w-2 h-2 rounded-full transition-colors duration-300 ${
          i <= screen ? 'bg-[#1B4D3E]' : 'bg-gray-300'
        }`} />
      ))}
    </div>
  )

  // ═══ SCREEN 1 — Welcome ═════════════════════════════════════
  const renderScreen1 = () => (
    <div className="flex flex-col items-center justify-center text-center flex-1 px-6 py-12">
      {business.logo_url ? (
        <img src={business.logo_url} alt={business.name} className="w-20 h-20 rounded-full object-cover mb-5" />
      ) : (
        <div className="w-20 h-20 rounded-full bg-[#1B4D3E] flex items-center justify-center mb-5">
          <span className="text-3xl font-bold text-white">{business.name.charAt(0)}</span>
        </div>
      )}
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-1">{business.name}</h1>
      <p className="text-sm text-gray-400 mb-3">{business.area}, {business.city}</p>
      {business.description && (
        <p className="text-xs text-gray-400 italic max-w-[280px] mb-8">"{business.description}"</p>
      )}
      <button
        onClick={() => setScreen(2)}
        className="w-full max-w-[300px] bg-[#1B4D3E] text-white py-3.5 rounded-2xl font-semibold text-lg shadow-md hover:bg-[#153e31] transition-colors min-h-[48px]"
      >
        Rate Your Experience ⭐
      </button>
      <p className="text-[10px] text-gray-300 mt-auto pt-8">Powered by ReviewCraft</p>
    </div>
  )

  // ═══ SCREEN 2 — Review Builder ══════════════════════════════
  const renderScreen2 = () => (
    <div className="flex flex-col px-5 py-6 gap-6">
      {/* Mood selector */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-[#1A1A1A] mb-5">How was it?</h2>
        <div className="flex justify-center gap-3">
          {MOODS.map((m, i) => (
            <button key={i} onClick={() => handleMoodSelect(i)}
              className={`flex flex-col items-center gap-1 min-w-[52px] min-h-[44px] transition-transform ${mood === i ? 'scale-110' : ''}`}>
              <span className={`text-[32px] leading-none rounded-full p-1 transition-shadow ${
                mood === i ? 'shadow-[0_0_0_3px_#1B4D3E33]' : ''
              }`}>{m.emoji}</span>
              <span className={`text-[10px] font-medium ${mood === i ? 'text-[#1B4D3E]' : 'text-gray-400'}`}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* LOW MOOD → Private feedback */}
      {isLow && !showPublicAnyway && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 space-y-4">
          {feedbackSent ? (
            <div className="text-center space-y-2">
              <div className="text-3xl">🙏</div>
              <p className="font-medium text-gray-800">Thank you for your feedback.</p>
              <p className="text-sm text-gray-500">We'll work on improving.</p>
            </div>
          ) : (<>
            <p className="text-center text-orange-700 font-medium">We're sorry. Help us improve. 😔</p>
            <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/30 bg-white"
              placeholder="What went wrong?" value={privateFeedback} onChange={e => setPrivateFeedback(e.target.value)} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0">+91</span>
              <input type="tel" className="flex-1 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/30 bg-white min-h-[44px]"
                placeholder="Phone (optional)" value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
            </div>
            <button onClick={handleSendFeedback}
              className="w-full bg-[#1B4D3E] text-white py-3 rounded-xl font-semibold min-h-[48px]">
              Send Feedback
            </button>
          </>)}
          <button onClick={() => setShowPublicAnyway(true)}
            className="w-full text-xs text-gray-500 underline py-2 min-h-[44px]">
            I'd still like to leave a public review →
          </button>
        </div>
      )}

      {/* HIGH MOOD or public-anyway → full builder */}
      {(isHigh || showPublicAnyway) && (<>
        {/* Category quick taps */}
        <div className="space-y-3">
          {Object.keys(CAT_EMOJIS).map(cat => (
            <div key={cat} className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-[#E8E5DE]">
              <span className="text-sm font-medium text-gray-700">{CAT_EMOJIS[cat]} {cat}</span>
              <div className="flex gap-2">
                {CAT_FACES.map(f => (
                  <button key={f.val} onClick={() => setCatRatings(p => ({ ...p, [cat]: f.val }))}
                    className={`text-xl w-10 h-10 rounded-full flex items-center justify-center transition-shadow ${
                      catRatings[cat] === f.val ? 'shadow-[0_0_0_2px_#1B4D3E] bg-[#EDF5F0]' : 'hover:bg-gray-50'
                    }`}>{f.emoji}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tag chips */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">What did you love?</h3>
          {visibleTagCats.map(([cat, tags]) => (
            <div key={cat}>
              <p className="text-xs text-gray-400 font-medium mb-2">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const sel = selectedTags.includes(tag)
                  return (
                    <button key={tag} onClick={() => setSelectedTags(p => sel ? p.filter(t => t !== tag) : [...p, tag])}
                      className={`px-3.5 py-2 rounded-[20px] text-sm border min-h-[44px] transition-colors ${
                        sel ? 'bg-[#EDF5F0] text-[#1B4D3E] border-[#1B4D3E]/30 font-medium' : 'bg-white text-gray-600 border-[#E8E5DE]'
                      }`}>{tag}</button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bill items (Menu) */}
        {menuItems.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm">What did you order?</h3>
            <div className="flex flex-wrap gap-2">
              {menuItems.map(item => {
                const sel = selectedTags.includes(item.name)
                if (item.image_url) {
                  return (
                    <button key={item.id} onClick={() => setSelectedTags(p => sel ? p.filter(t => t !== item.name) : [...p, item.name])}
                      className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all w-[calc(33.33%-8px)] ${
                        sel ? 'bg-[#EDF5F0] border-[#1B4D3E] shadow-sm' : 'bg-white border-gray-100 shadow-xs'
                      }`}>
                      <div className="w-full aspect-square rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 border border-gray-100">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <span className={`text-[10px] text-center font-medium leading-tight line-clamp-2 ${sel ? 'text-[#1B4D3E]' : 'text-gray-600'}`}>
                        {item.name}
                      </span>
                    </button>
                  )
                }
                return (
                  <button key={item.id} onClick={() => setSelectedTags(p => sel ? p.filter(t => t !== item.name) : [...p, item.name])}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      sel ? 'bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-md' : 'bg-white text-gray-600 border-[#E8E5DE]'
                    }`}>
                    {item.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Comment */}
        <textarea className="w-full border border-[#E8E5DE] rounded-xl p-3 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/30 bg-white"
          placeholder="Add your own words (optional)" value={comment} onChange={e => setComment(e.target.value)} />

        {/* Language + Tone */}
        <div className="space-y-3">
          <div className="flex gap-2">
            {([['english','English'],['hindi','हिंदी'],['hinglish','Hinglish'],['gujarati','ગુજરાતી']] as const).map(([v,l]) => (
              <button key={v} onClick={() => setLang(v)}
                className={`flex-1 py-2 rounded-xl text-[10px] font-medium min-h-[44px] border transition-colors ${
                  lang === v ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]' : 'bg-white text-gray-600 border-[#E8E5DE]'
                }`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {([['friendly','😊 Friendly'],['professional','👔 Professional'],['enthusiastic','🔥 Enthusiastic']] as const).map(([v,l]) => (
              <button key={v} onClick={() => setTone(v)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium min-h-[44px] border transition-colors ${
                  tone === v ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]' : 'bg-white text-gray-600 border-[#E8E5DE]'
                }`}>{l}</button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button onClick={generateReview} disabled={isGenerating}
          className="w-full bg-[#1B4D3E] text-white py-3.5 rounded-2xl font-semibold text-lg shadow-md min-h-[48px] disabled:opacity-60 flex items-center justify-center gap-2">
          {isGenerating ? <><FaSpinner className="animate-spin" /><span>Generating...</span></> : <span>Generate My Review ✨</span>}
        </button>

      </>)}
    </div>
  )

  // ═══ SCREEN 3 — Copy & Go ══════════════════════════════════
  const renderScreen3 = () => (
    <div className="flex flex-col px-5 py-8 gap-6 flex-1">
      <div className="text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-[#1A1A1A]">Your review is ready!</h2>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[#E8E5DE] shadow-sm relative">
        {isEditing ? (
          <textarea className="w-full min-h-[120px] text-sm text-gray-800 leading-relaxed resize-none focus:outline-none bg-transparent"
            value={generatedReview} onChange={e => setGeneratedReview(e.target.value)} autoFocus />
        ) : (
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{generatedReview}</p>
        )}
        <button onClick={() => setIsEditing(!isEditing)}
          className="absolute top-3 right-3 text-xs text-[#1B4D3E] font-medium bg-[#EDF5F0] px-2 py-1 rounded min-h-[28px]">
          {isEditing ? 'Done' : 'Edit ✏️'}
        </button>
      </div>

      <button onClick={handleRegenerate} disabled={isGenerating}
        className="text-sm text-[#1B4D3E] font-medium underline min-h-[44px] flex items-center justify-center gap-2 self-center">
        {isGenerating ? <><FaSpinner className="animate-spin" size={12} /> Regenerating...</> : '🔄 Regenerate'}
      </button>

      {/* Optional Customer Fields */}
      <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Your name (optional)"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/30 bg-white min-h-[44px]"
          />
          <div className="flex items-center gap-2">
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-500 font-medium min-h-[44px] flex items-center">
              +91
            </div>
            <input
              type="tel"
              placeholder="Phone number (optional)"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/30 bg-white min-h-[44px]"
            />
          </div>
          <p className="text-[10px] text-gray-400 text-center">So the business can thank you personally</p>
        </div>
      </div>

      <button onClick={handleCopyAndGo}
        className="w-full bg-[#1B4D3E] text-white py-3.5 rounded-2xl font-semibold text-base shadow-md min-h-[48px] flex items-center justify-center gap-2">
        {copied ? '✓ Copied!' : '📋 Copy & Open Google Reviews'}
      </button>

      <p className="text-[10px] text-gray-300 text-center mt-auto">Powered by ReviewCraft</p>
    </div>
  )

  // ═══ Shell ══════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] flex justify-center" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div className="w-full max-w-[420px] min-h-screen flex flex-col">
        <ProgressDots />
        <div className="flex-1 flex flex-col">
          {screen === 1 && renderScreen1()}
          {screen === 2 && renderScreen2()}
          {screen === 3 && renderScreen3()}
        </div>
      </div>
    </div>
  )
}