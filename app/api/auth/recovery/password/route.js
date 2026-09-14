import { recoveryAction } from '@/lib/server/recovery'
export const runtime='nodejs'
export const maxDuration=60
export async function POST(request){return recoveryAction(request,'password')}
