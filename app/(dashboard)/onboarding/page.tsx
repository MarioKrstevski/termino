'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [type, setType] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function handleNameChange(val: string) {
    setName(val)
    setSlug(slugify(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const workingHours = {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '18:00' },
      sat: { open: '10:00', close: '17:00' },
      sun: null,
    }

    const { error } = await supabase.from('businesses').insert({
      owner_id: user.id,
      name,
      slug,
      address,
      business_type: type,
      working_hours_json: workingHours,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome to Termino</h1>
          <p className="text-muted-foreground mt-2">Set up your business to get started</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Business name</Label>
                <Input
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="Kings Cut Barbershop"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Booking URL slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">termino.app/book/</span>
                  <Input
                    value={slug}
                    onChange={e => setSlug(slugify(e.target.value))}
                    placeholder="kings-cut"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Business type</Label>
                <Select value={type} onValueChange={setType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="barber">Barbershop</SelectItem>
                    <SelectItem value="salon">Hair Salon</SelectItem>
                    <SelectItem value="nail">Nail Salon</SelectItem>
                    <SelectItem value="massage">Massage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="12 Main Street, Dublin"
                />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading || !type}>
                {loading ? 'Creating...' : 'Create my business'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
