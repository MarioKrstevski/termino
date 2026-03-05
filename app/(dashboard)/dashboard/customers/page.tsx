import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { Users, Phone, ChevronRight } from 'lucide-react'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user!.id).single()

  const pageNum = parseInt(page ?? '1')
  const pageSize = 50
  const from = (pageNum - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('customers')
    .select('id, name, phone_number, total_visits, no_show_count, created_at', { count: 'exact' })
    .eq('business_id', business!.id)

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone_number.ilike.%${q}%`)
  }

  const { data: customers, count } = await query
    .order('total_visits', { ascending: false })
    .range(from, to)

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">{count ?? 0} total customers</p>
        </div>
      </div>

      <form className="flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Search by name or phone..." className="max-w-sm" />
      </form>

      {!customers?.length ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No customers found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <Link key={c.id} href={`/dashboard/customers/${c.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {(c.name ?? '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{c.name ?? 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />{c.phone_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p><span className="font-semibold">{c.total_visits}</span> <span className="text-muted-foreground">visits</span></p>
                      {c.no_show_count > 0 && <p className="text-orange-600">{c.no_show_count} no-shows</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`?page=${p}${q ? `&q=${q}` : ''}`}>
              <Badge variant={p === pageNum ? 'default' : 'outline'} className="cursor-pointer">{p}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
