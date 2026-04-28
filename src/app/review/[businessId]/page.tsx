'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FaStar, FaChevronLeft, FaCheckCircle, FaRegCopy, FaGoogle, FaSpinner } from 'react-icons/fa'
import type { Business, HighlightTag, MenuItem } from '@/types'

const CATEGORIES = ["Food Quality", "Service", "Ambiance", "Cleanliness", "Value for Money"]

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildReviewContent(
  businessName: string,
  location: string,
  selectedTags: string[],
  additionalComment: string
): string {
  const openings = [
    "Had a wonderful experience at",
    "Really enjoyed my visit to",
    "Great time at",
    "Loved dining at",
  ]
  const closings = [
    "Will definitely come back!",
    "Would recommend to anyone in the area.",
    "Looking forward to my next visit.",
    "A must-visit spot.",
  ]
  const opening = openings[Math.floor(Math.random() * openings.length)]
  const closing = closings[Math.floor(Math.random() * closings.length)]
  const parts = [`${opening} ${businessName}!`]
  if (selectedTags.length > 0) parts.push(selectedTags.join('. ') + '.')
  if (additionalComment) parts.push(additionalComment.trim())
  parts.push(closing)
  return parts.join(' ')
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ReviewFlow() {
  const params = useParams()
  const businessId = params.businessId as string
  const supabase = createClient()

  // ── Data loading
  const [isLoading, setIsLoading] = useState(true)
  const [business, setBusiness] = useState<Business | null>(null)
  const [highlights, setHighlights] = useState<Record<string, string[]>>({})
  const [notFound, setNotFound] = useState(false)

  // ── Session tracking
  const [sessionId, setSessionId] = useState<string | null>(null)

  // ── Step / UI
  const [currentStep, setCurrentStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // ── Review data
  const [overallRating, setOverallRating] = useState(0)
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({})
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [additionalComment, setAdditionalComment] = useState('')
  const [generatedReview, setGeneratedReview] = useState('')
  const [privateFeedback, setPrivateFeedback] = useState('')
  const [customerContact, setCustomerContact] = useState('')

  // ── Fetch business data on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)

      const [bizResult, tagsResult] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', businessId).maybeSingle(),
        supabase.from('highlight_tags').select('*').eq('business_id', businessId).order('sort_order'),
      ])

      if (bizResult.error || !bizResult.data) {
        setNotFound(true)
        setIsLoading(false)
        return
      }

      setBusiness(bizResult.data as Business)

      // Group tags by category
      const grouped: Record<string, string[]> = {}
      if (tagsResult.data) {
        for (const tag of tagsResult.data as HighlightTag[]) {
          if (!grouped[tag.category]) grouped[tag.category] = []
          grouped[tag.category].push(tag.label)
        }
      }
      setHighlights(grouped)
      setIsLoading(false)
    }
    fetchData()
  }, [businessId])

  // ── Create session row when flow starts (step 1 → 2)
  const createSession = useCallback(async () => {
    if (sessionId) return sessionId
    const { data } = await supabase
      .from('review_sessions')
      .insert({ business_id: businessId, status: 'started' })
      .select('id')
      .single()
    if (data?.id) {
      setSessionId(data.id)
      return data.id
    }
    return null
  }, [businessId, sessionId])

  const updateSession = useCallback(async (updates: Record<string, unknown>, sid?: string) => {
    const id = sid ?? sessionId
    if (!id) return
    await supabase.from('review_sessions').update(updates).eq('id', id)
  }, [sessionId])

  // ── Navigation helpers
  const nextStep = () => setCurrentStep(p => p + 1)
  const prevStep = () => setCurrentStep(p => p - 1)

  const handleNextFromOverall = async () => {
    const sid = await createSession()
    await updateSession({ overall_rating: overallRating }, sid ?? undefined)
    if (overallRating <= 2) {
      setCurrentStep(7)
    } else {
      nextStep()
    }
  }

  // ── Review generation
  const location = business ? `${business.area}, ${business.city}` : ''

  const fetchGeneratedReview = async () => {
    try {
      const res = await fetch('/api/generate-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business?.name,
          location,
          overallRating,
          categoryRatings,
          selectedTags,
          additionalComment,
          businessDescription: business?.description,
        }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      if (data.review) {
        setGeneratedReview(data.review)
        return data.review as string
      }
      throw new Error('No review')
    } catch {
      const fallback = buildReviewContent(business?.name ?? '', location, selectedTags, additionalComment)
      setGeneratedReview(fallback)
      return fallback
    }
  }

  const generateReviewText = async () => {
    setIsGenerating(true)
    await updateSession({
      category_ratings: categoryRatings,
      selected_tags: selectedTags,
      additional_comment: additionalComment,
    })
    const review = await fetchGeneratedReview()
    await updateSession({ generated_review: review, status: 'generated' })
    setIsGenerating(false)
    nextStep()
  }

  const handleRegenerate = async () => {
    setIsGenerating(true)
    const review = await fetchGeneratedReview()
    await updateSession({ generated_review: review })
    setIsGenerating(false)
  }

  // ── Clipboard
  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        ta.style.top = '-9999px'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      await updateSession({ status: 'copied' })
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const handleCopyAndPost = async () => {
    await copyToClipboard(generatedReview)
    nextStep()
  }

  const handleOpenGoogle = async () => {
    await copyToClipboard(generatedReview)
    setTimeout(() => {
      const url = business?.google_place_id
        ? business.google_place_id
        : 'https://google.com'
      window.open(url, '_blank')
      nextStep()
    }, 500)
  }

  const handleCopyAgain = () => copyToClipboard(generatedReview)

  // ── Highlight tag helpers
  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )

  const setCategoryRating = (cat: string, rating: number) =>
    setCategoryRatings(prev => ({ ...prev, [cat]: rating }))

  // ─── Loading / Not Found ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#1B4D3E]">
          <FaSpinner className="animate-spin" size={40} />
          <p className="text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-6">
        <div className="text-center max-w-[320px]">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Business not found</h1>
          <p className="text-gray-500">This review link may be invalid or the business no longer exists.</p>
        </div>
      </div>
    )
  }

  // ─── Step Renderers ──────────────────────────────────────────────────────

  const BUSINESS_NAME = business.name
  const LOCATION = `${business.area}, ${business.city}`

  const renderStep1 = () => (
    <div className="flex flex-col h-full items-center justify-center text-center space-y-6 flex-1 mt-10">
      <div className="w-20 h-20 bg-[#1B4D3E]/10 rounded-full flex items-center justify-center mb-4 shrink-0">
        {business.logo_url
          ? <img src={business.logo_url} alt={BUSINESS_NAME} className="w-full h-full rounded-full object-cover" />
          : <span className="text-4xl">🌿</span>
        }
      </div>
      <h1 className="text-3xl font-bold text-[#1A1A1A]">{BUSINESS_NAME}</h1>
      <p className="text-gray-500 text-lg">{LOCATION}</p>

      {business.description && (
        <p className="text-gray-600 text-sm max-w-[280px] italic mt-2">"{business.description}"</p>
      )}

      <div className="my-8 max-w-[280px]">
        <p className="text-lg leading-relaxed text-gray-700">
          {business.welcome_message || "Thanks for visiting! Share your experience in 60 seconds."}
        </p>
      </div>

      <button
        onClick={nextStep}
        className="w-full bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg hover:bg-[#153e31] transition-colors mt-auto min-h-[44px]"
      >
        Start Review
      </button>
      <p className="text-xs text-gray-400 mt-6 pb-4">Powered by ReviewCraft</p>
    </div>
  )

  const renderStep2 = () => {
    const moods = ["", "Poor", "Below Average", "Average", "Great", "Amazing!"]
    return (
      <div className="flex flex-col h-full py-8 flex-1 mt-8">
        <h2 className="text-2xl font-bold text-center mb-12">How was your overall experience?</h2>

        <div className="flex justify-center space-x-2 mb-8">
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => setOverallRating(star)} className="p-2 min-h-[44px] min-w-[44px]">
              <FaStar size={44} className={star <= overallRating ? "text-[#D4A843]" : "text-gray-200"} />
            </button>
          ))}
        </div>

        <p className="text-center text-xl font-medium text-[#1B4D3E] h-8">
          {overallRating > 0 ? moods[overallRating] : ""}
        </p>

        <div className="mt-auto pt-10">
          <button
            onClick={handleNextFromOverall}
            disabled={overallRating === 0}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors min-h-[44px] ${
              overallRating > 0 ? "bg-[#1B4D3E] text-white shadow-lg" : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  const renderStep3 = () => (
    <div className="flex flex-col h-full py-8 flex-1 mt-8">
      <h2 className="text-2xl font-bold mb-8">Rate specific areas</h2>

      <div className="space-y-6 mb-8 flex-1">
        {CATEGORIES.map(category => (
          <div key={category} className="flex flex-col space-y-2">
            <span className="font-medium text-gray-700">{category}</span>
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map(star => {
                const current = categoryRatings[category] || 0
                return (
                  <button
                    key={star}
                    onClick={() => setCategoryRating(category, star)}
                    className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <FaStar size={32} className={star <= current ? "text-[#D4A843]" : "text-gray-200"} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <button onClick={nextStep} className="w-full bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px]">
          Next
        </button>
      </div>
    </div>
  )

  const renderStep4 = () => {
    const categoryMapping: Record<string, string> = {
      "Food Quality": "Food",
      "Service": "Service",
      "Ambiance": "Ambiance",
      "Cleanliness": "Cleanliness",
      "Value for Money": "Value",
    }

    const highRatedKeys = Object.entries(categoryRatings)
      .filter(([, r]) => r >= 4)
      .map(([cat]) => categoryMapping[cat])
      .filter(Boolean)

    // Use DB highlights; fall back to all sections
    let sectionsToShow = Object.entries(highlights)
    if (sectionsToShow.length === 0) {
      // No DB tags — nothing to show
    } else if (highRatedKeys.length > 0) {
      sectionsToShow = sectionsToShow.filter(([section]) => highRatedKeys.includes(section))
    }

    return (
      <div className="flex flex-col h-full py-8 flex-1 mt-8">
        <h2 className="text-2xl font-bold mb-6">What stood out?</h2>
        <p className="text-gray-500 mb-6">Tap everything that applies</p>

        <div className="space-y-8 flex-1 overflow-y-auto pb-6">
          {sectionsToShow.length > 0
            ? sectionsToShow.map(([section, tags]) => (
                <div key={section}>
                  <h3 className="font-semibold text-gray-800 mb-3">{section}</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const isSelected = selectedTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-4 py-2 min-h-[44px] rounded-full text-sm border transition-colors ${
                            isSelected
                              ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-[#1B4D3E]'
                          }`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            : (
              <p className="text-gray-400 text-sm text-center py-8">No highlight tags configured for this business.</p>
            )
          }

          <div className="mt-6">
            <h3 className="font-semibold text-gray-800 mb-3">Anything else?</h3>
            <textarea
              className="w-full border border-gray-300 rounded-xl p-4 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50"
              placeholder="Tell us more about your experience..."
              value={additionalComment}
              onChange={e => setAdditionalComment(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={generateReviewText}
            disabled={isGenerating}
            className="w-full flex items-center justify-center space-x-2 bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGenerating && <FaSpinner className="animate-spin" />}
            <span>{isGenerating ? 'Generating...' : 'Generate My Review'}</span>
          </button>
        </div>
      </div>
    )
  }

  const renderStep5 = () => (
    <div className="flex flex-col h-full py-8 flex-1 mt-8">
      <h2 className="text-2xl font-bold mb-6">Your Review</h2>

      <div className="flex mb-6">
        {[1, 2, 3, 4, 5].map(star => (
          <FaStar key={star} size={24} className={star <= overallRating ? "text-[#D4A843]" : "text-gray-200"} />
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6 relative">
        <textarea
          className="w-full min-h-[150px] text-gray-800 text-base leading-relaxed resize-none focus:outline-none bg-transparent"
          value={generatedReview}
          onChange={e => setGeneratedReview(e.target.value)}
        />
        <div className="absolute top-2 right-2">
          <span className="text-xs text-[#1B4D3E] font-medium bg-[#1B4D3E]/10 px-2 py-1 rounded">Editable</span>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <button
          onClick={handleCopyAndPost}
          className="w-full flex items-center justify-center space-x-2 bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px]"
        >
          <FaRegCopy size={20} />
          <span>Copy & Post on Google</span>
        </button>

        <button
          onClick={handleRegenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center space-x-2 bg-white text-[#1B4D3E] border-2 border-[#1B4D3E] py-4 rounded-xl font-semibold text-lg min-h-[44px] disabled:opacity-70"
        >
          {isGenerating && <FaSpinner className="animate-spin" />}
          <span>{isGenerating ? 'Regenerating...' : 'Regenerate'}</span>
        </button>
      </div>
    </div>
  )

  const renderStep6 = () => {
    const hasPlaceId = !!business.google_place_id
    return (
      <div className="flex flex-col items-center h-full py-12 flex-1 mt-8 text-center">
        <FaCheckCircle className="text-[#1B4D3E] mb-6" size={80} />
        <h2 className="text-3xl font-bold mb-8">Almost done!</h2>

        <div className="space-y-6 text-left w-full mb-12 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start space-x-4">
            <div className="bg-[#1B4D3E]/10 text-[#1B4D3E] w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
            <p className={`text-lg mt-0.5 ${copied ? 'text-green-600 font-medium' : 'text-gray-700'}`}>
              {copied ? '✓ Review copied to clipboard' : 'Review copied to clipboard'}
            </p>
          </div>
          <div className="flex items-start space-x-4">
            <div className="bg-[#1B4D3E]/10 text-[#1B4D3E] w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
            <p className="text-lg text-gray-700 mt-0.5">Google Reviews will open</p>
          </div>
          <div className="flex items-start space-x-4">
            <div className="bg-[#1B4D3E]/10 text-[#1B4D3E] w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
            <p className="text-lg text-gray-700 mt-0.5">Paste and tap <span className="font-semibold">Post</span></p>
          </div>
        </div>

        <div className="mt-auto w-full space-y-4">
          {hasPlaceId ? (
            <button
              onClick={handleOpenGoogle}
              className="w-full flex items-center justify-center space-x-3 bg-[#4285F4] hover:bg-[#3367d6] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px]"
            >
              <FaGoogle size={20} />
              <span>Open Google Reviews</span>
            </button>
          ) : (
            <button
              disabled
              className="w-full flex items-center justify-center space-x-3 bg-gray-200 text-gray-400 py-4 rounded-xl font-semibold text-lg min-h-[44px] cursor-not-allowed"
            >
              <FaGoogle size={20} />
              <span>Google Review link not configured</span>
            </button>
          )}

          <button
            onClick={handleCopyAgain}
            className={`text-sm font-medium py-2 min-h-[44px] w-full text-center transition-colors ${
              copied ? 'text-green-600' : 'text-gray-500 underline'
            }`}
          >
            {copied ? '✓ Copied!' : 'Tap to copy again'}
          </button>
        </div>
      </div>
    )
  }

  const renderStep7 = () => {
    if (overallRating > 2) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12 flex-1 mt-8 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <FaCheckCircle className="text-green-500" size={50} />
          </div>
          <h2 className="text-3xl font-bold mb-4">Thank you!</h2>
          <p className="text-xl text-gray-600">Your review helps {BUSINESS_NAME} grow.</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full py-8 flex-1 mt-8">
        <h2 className="text-3xl font-bold mb-4 text-center">We're sorry</h2>
        <p className="text-gray-600 mb-8 text-center">We want to make things right. Please tell us what went wrong.</p>

        <div className="space-y-6">
          <textarea
            className="w-full border border-gray-300 rounded-xl p-4 min-h-[150px] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50"
            placeholder="Tell us what happened..."
            value={privateFeedback}
            onChange={e => setPrivateFeedback(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact info (optional)</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
              placeholder="Email or phone number"
              value={customerContact}
              onChange={e => setCustomerContact(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-auto pt-8">
          <button
            onClick={async () => {
              await updateSession({
                private_feedback: privateFeedback,
                customer_contact: customerContact,
                status: 'private_feedback',
              })
              nextStep()
            }}
            className="w-full bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px]"
          >
            Send Feedback
          </button>
        </div>
      </div>
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1: return renderStep1()
      case 2: return renderStep2()
      case 3: return renderStep3()
      case 4: return renderStep4()
      case 5: return renderStep5()
      case 6: return renderStep6()
      case 7: return renderStep7()
      default: return renderStep1()
    }
  }

  // ─── Shell ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans flex justify-center">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in { animation: slideIn 0.3s ease-out forwards; }
      `}</style>

      <div className="w-full max-w-[420px] min-h-screen bg-white shadow-xl flex flex-col relative overflow-x-hidden">

        {/* Progress bar */}
        {currentStep > 1 && currentStep < 7 && (
          <div className="absolute top-0 left-0 h-1 bg-gray-100 w-full z-50">
            <div
              className="h-full bg-[#1B4D3E] transition-all duration-500 ease-out"
              style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
            />
          </div>
        )}

        {/* Back button */}
        {currentStep > 1 && currentStep < 7 && (
          <div className="absolute top-6 left-6 z-40">
            <button
              onClick={prevStep}
              className="p-2 -ml-2 text-gray-400 hover:text-black transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Go back"
            >
              <FaChevronLeft size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div key={currentStep} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col animate-slide-in">
          {renderStep()}
        </div>

      </div>
    </div>
  )
}