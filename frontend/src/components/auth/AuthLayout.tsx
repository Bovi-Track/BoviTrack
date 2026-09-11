import { ArrowUpRight, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import campoImg from '../../assets/campo.png'

type AuthLayoutProps = {
  children: ReactNode
  brandIcon: 'user' | 'arrow'
}

export function AuthLayout({ children, brandIcon }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh bg-cream">
      <aside className="relative hidden w-1/2 overflow-hidden lg:block">
        <img
          src={campoImg}
          alt="Potrero con ganado al atardecer"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-black/5" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              {brandIcon === 'user' ? (
                <UserRound className="size-5" strokeWidth={1.75} />
              ) : (
                <ArrowUpRight className="size-5" strokeWidth={1.75} />
              )}
            </span>
            <div>
              <p className="font-serif text-2xl leading-tight font-semibold">
                BoviTrack
              </p>
              <p className="text-[11px] font-medium tracking-[0.2em] text-white/80">
                GANADERÍA & CAMPO
              </p>
            </div>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-white/90">
            Gestiona tu ganado, potreros y producción desde un solo lugar.
            Bienvenido a tu panel de control ganadero.
          </p>
        </div>
      </aside>

      <main className="flex w-full flex-col justify-center px-6 py-10 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <p className="font-serif text-2xl font-semibold text-stone-900">
              BoviTrack
            </p>
            <p className="text-[11px] font-medium tracking-[0.2em] text-stone-500">
              GANADERÍA & CAMPO
            </p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
