'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FaSpinner, FaTimes, FaPlus, FaExternalLinkAlt, FaImage } from 'react-icons/fa'

const CATEGORY_TAGS: Record<string, string[]> = {
  Restaurant: ["Delicious food", "Fresh ingredients", "Great portions", "Quick service", "Friendly staff", "Cozy atmosphere", "Clean and hygienic", "Value for money", "Perfect for families", "Great for date night"],
  Cafe: ["Delicious food", "Fresh ingredients", "Great portions", "Quick service", "Friendly staff", "Cozy atmosphere", "Clean and hygienic", "Value for money", "Perfect for families", "Great for date night"],
  Hotel: ["Comfortable rooms", "Clean bathrooms", "Friendly reception", "Great breakfast", "Good location", "Value for money"],
  'Salon & Spa': ["Skilled stylists", "Relaxing ambiance", "Clean and hygienic", "Great value", "Friendly staff", "On-time service"],
  Clinic: ["Experienced doctor", "Short wait time", "Clean facility", "Friendly staff", "Clear explanations"],
  'Retail Store': ["Wide selection", "Good prices", "Helpful staff", "Clean store", "Easy returns"],
}

const ITEM_LABEL: Record<string, string> = {
  Restaurant: 'dish',
  Cafe: 'item',
  Hotel: 'service',
  'Salon & Spa': 'service',
  Clinic: 'service',
  'Retail Store': 'product',
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [businessName, setBusinessName] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [category, setCategory] = useState('Restaurant')
  const [description, setDescription] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Step 2
  const [placeId, setPlaceId] = useState('')

  // Step 3
  const [tags, setTags] = useState<string[]>(CATEGORY_TAGS['Restaurant'])
  const [customTag, setCustomTag] = useState('')

  // Step 4
  const [menuItems, setMenuItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState('')

  const handleCategoryChange = (val: string) => {
    setCategory(val)
    setTags(CATEGORY_TAGS[val] || CATEGORY_TAGS['Restaurant'])
  }

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag))
  const addCustomTag = () => {
    const trimmed = customTag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
    }
    setCustomTag('')
  }

  const removeItem = (item: string) => setMenuItems(prev => prev.filter(i => i !== item))
  const addItem = () => {
    const trimmed = newItem.trim()
    if (trimmed && !menuItems.includes(trimmed)) {
      setMenuItems(prev => [...prev, trimmed])
    }
    setNewItem('')
  }

  const handleFinish = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be logged in')

      let logo_url = null

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile, {
            cacheControl: '3600',
            upsert: false
          })
          
        if (uploadError) {
          console.error('Logo upload error:', uploadError)
        } else {
          const { data: urlData } = supabase.storage
            .from('logos')
            .getPublicUrl(fileName)
          logo_url = urlData.publicUrl
        }
      }

      // Insert business
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
          user_id: user.id,
          name: businessName,
          city,
          area,
          category,
          description,
          logo_url,
          google_place_id: placeId || null,
        })
        .select()
        .single()

      if (bizError) throw bizError

      // Insert highlight tags
      if (tags.length > 0) {
        const tagRows = tags.map((label, index) => ({
          business_id: business.id,
          category,
          label,
          sort_order: index,
        }))
        const { error: tagError } = await supabase.from('highlight_tags').insert(tagRows)
        if (tagError) throw tagError
      }

      // Insert menu items
      if (menuItems.length > 0) {
        const itemRows = menuItems.map((name, index) => ({
          business_id: business.id,
          name,
          sort_order: index,
        }))
        const { error: itemError } = await supabase.from('menu_items').insert(itemRows)
        if (itemError) throw itemError
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const progressPct = ((step - 1) / 3) * 100

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white shadow-xl flex flex-col relative">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 w-full">
          <div
            className="h-full bg-[#1B4D3E] transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <span className="text-sm text-gray-400 font-medium">Step {step} of 4</span>
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              ← Back
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col">

          {/* ── STEP 1: Business Details ── */}
          {step === 1 && (
            <div className="flex flex-col flex-1 pt-4 space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Set up your business</h2>
                <p className="text-gray-500 mt-1 text-sm">Tell us a bit about your business.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Name *</label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="The Green Leaf Cafe"
                    className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Ahmedabad"
                    className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Area / Locality *</label>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={e => setArea(e.target.value)}
                    placeholder="Navrangpura"
                    className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <select
                    value={category}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px] bg-white"
                  >
                    {Object.keys(CATEGORY_TAGS).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Short Description</label>
                  <div className="relative">
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value.slice(0, 200))}
                      placeholder="Describe your business in one line, e.g. 'Authentic Gujarati thali restaurant serving home-style food since 2015'"
                      rows={3}
                      className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 resize-none text-sm"
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                      {description.length}/200
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                      ) : (
                        <FaImage className="text-gray-400 text-2xl" />
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/svg+xml"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setLogoFile(file)
                            setLogoPreview(URL.createObjectURL(file))
                          }
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1B4D3E]/10 file:text-[#1B4D3E] hover:file:bg-[#1B4D3E]/20 transition-colors"
                      />
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG or SVG</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <button
                  onClick={() => {
                    if (!businessName.trim() || !city.trim() || !area.trim()) {
                      setError('Please fill in all required fields.')
                      return
                    }
                    setError(null)
                    setStep(2)
                  }}
                  className="w-full bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px]"
                >
                  Next
                </button>
                {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
              </div>
            </div>
          )}

          {/* ── STEP 2: Google Place ID ── */}
          {step === 2 && (
            <div className="flex flex-col flex-1 pt-4 space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Connect to Google Reviews</h2>
                <p className="text-gray-500 mt-1 text-sm">Link your Google Business profile to enable direct review links.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Google Review Link</label>
                <input
                  type="text"
                  value={placeId}
                  onChange={e => setPlaceId(e.target.value)}
                  placeholder="Paste your full Google review link here"
                  className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
                />
              </div>

              <div className="bg-[#1B4D3E]/5 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-[#1B4D3E]">How to find your link:</p>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Open Google Maps on your phone or computer</li>
                  <li>Search for your business name</li>
                  <li>Tap on your business listing</li>
                  <li>Tap 'Ask for reviews'</li>
                  <li>Copy the link and paste it here</li>
                </ol>
              </div>

              <div className="mt-auto pt-6 space-y-3">
                <button
                  onClick={() => setStep(3)}
                  className="w-full bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px]"
                >
                  Next
                </button>
                <button
                  onClick={() => { setPlaceId(''); setStep(3) }}
                  className="w-full text-gray-500 text-sm font-medium min-h-[44px] hover:underline"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Highlight Tags ── */}
          {step === 3 && (
            <div className="flex flex-col flex-1 pt-4 space-y-6">
              <div>
                <h2 className="text-2xl font-bold">What should customers highlight?</h2>
                <p className="text-gray-500 mt-1 text-sm">These appear as selectable chips in the review flow.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 bg-[#1B4D3E]/10 text-[#1B4D3E] px-3 py-2 rounded-full text-sm font-medium"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-[#1B4D3E]/60 hover:text-[#1B4D3E] transition-colors"
                      aria-label={`Remove ${tag}`}
                    >
                      <FaTimes size={11} />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTag}
                  onChange={e => setCustomTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                  placeholder="Add a custom tag..."
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
                />
                <button
                  onClick={addCustomTag}
                  className="bg-[#1B4D3E] text-white px-4 py-3 rounded-xl font-semibold min-h-[44px] min-w-[56px] flex items-center justify-center"
                >
                  <FaPlus />
                </button>
              </div>

              <div className="mt-auto pt-6">
                <button
                  onClick={() => setStep(4)}
                  className="w-full bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px]"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Bill Items ── */}
          {step === 4 && (
            <div className="flex flex-col flex-1 pt-4 space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Add your bill items</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Add items from your menu or services that customers can mention in reviews.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
                  placeholder={`Add a ${ITEM_LABEL[category] || 'item'}...`}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
                />
                <button
                  onClick={addItem}
                  className="bg-[#1B4D3E] text-white px-4 py-3 rounded-xl font-semibold min-h-[44px] min-w-[56px] flex items-center justify-center"
                >
                  <FaPlus />
                </button>
              </div>

              {menuItems.length > 0 && (
                <ul className="space-y-2">
                  {menuItems.map(item => (
                    <li
                      key={item}
                      className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
                    >
                      <span className="text-gray-800 text-sm">{item}</span>
                      <button
                        onClick={() => removeItem(item)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        aria-label={`Remove ${item}`}
                      >
                        <FaTimes size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {menuItems.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">
                  No items added yet. You can skip this and add later.
                </p>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
                  {error}
                </div>
              )}

              <div className="mt-auto pt-6">
                <button
                  onClick={handleFinish}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px] disabled:opacity-70"
                >
                  {isLoading && <FaSpinner className="animate-spin" />}
                  <span>{isLoading ? 'Saving...' : 'Finish Setup'}</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
