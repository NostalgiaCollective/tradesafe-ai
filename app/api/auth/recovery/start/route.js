import { recoveryAction } from '@/lib/server/recovery'
export const runtime='nodejs'
export async function POST(request){return recoveryAction(request,'start')}
