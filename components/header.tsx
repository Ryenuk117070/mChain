"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import Image from "next/image"

interface HeaderProps {
  user?: any
  showAuthButtons?: boolean
}

export function Header({ user, showAuthButtons = true }: HeaderProps) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/gitr-logo.png" alt="Gitr" width={32} height={32} className="h-8 w-8" />
          <span className="text-2xl font-bold">Gitr</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Social Links */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Link
              href="https://x.com/gitrdotfun"
              target="_blank"
              className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              @gitrdotfun
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {showAuthButtons && (
            <>
              {user ? (
                <>
                  <Link href="/dashboard">
                    <Button variant="ghost">Dashboard</Button>
                  </Link>
                  <Link href="/launch">
                    <Button>Launch Token</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button variant="ghost">Login</Button>
                  </Link>
                  <Link href="/auth/sign-up">
                    <Button>Sign Up</Button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
