import { Shell } from '../shell'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Shell activeSurface="ledger" />
      <main>{children}</main>
    </>
  )
}
