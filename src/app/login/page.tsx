'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FaSpinner } from 'react-icons/fa'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/dashboard')
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        alert('Signup successful! Check your email to confirm your account if required, or log in.')
        setIsLogin(true)
        setPassword('')
        setConfirmPassword('')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-white shadow-xl flex flex-col p-8">
        
        <div className="flex flex-col items-center justify-center mt-12 mb-12">
          <div className="w-16 h-16 bg-[#1B4D3E]/10 rounded-xl flex items-center justify-center mb-4">
             <span className="text-3xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1B4D3E]">ReviewCraft</h1>
          <p className="text-gray-500 mt-2 text-center">
            {isLogin ? 'Welcome back! Log in to your account.' : 'Create your account to get started.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-5 flex-1">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input 
              type="email"
              required
              className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input 
              type="password"
              required
              className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input 
                type="password"
                required
                className="w-full border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/50 min-h-[44px]"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <div className="pt-4 mt-auto">
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 bg-[#1B4D3E] text-white py-4 rounded-xl font-semibold text-lg shadow-lg min-h-[44px] disabled:opacity-70"
            >
              {isLoading && <FaSpinner className="animate-spin" />}
              <span>{isLogin ? 'Log In' : 'Sign Up'}</span>
            </button>
          </div>
          
          <div className="text-center mt-6 pb-6">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
              }}
              className="text-[#1B4D3E] font-medium text-sm hover:underline p-2 min-h-[44px]"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
