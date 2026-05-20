import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkConnection() {
  console.log('Testing Supabase connection...')
  
  const tables = ['properties', 'units', 'tenants', 'transactions', 'violations', 'payments']
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.error(`❌ Table "${table}" error:`, error.message)
    } else {
      console.log(`✅ Table "${table}" is accessible.`)
    }
  }
}

checkConnection()
