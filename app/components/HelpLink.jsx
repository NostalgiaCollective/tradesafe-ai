'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
export default function HelpLink({company}){const path=usePathname();return <Link href={'/help?'+new URLSearchParams({...(company?{company}:{}),context:path||'/help'})}>Help and feedback</Link>}
