import { Shell } from '../shell'

/** Mounts the shell on this surface. Three small layouts rather than a route group,
 *  because a group would move these directories and break the relative imports the
 *  pages already use — churn with no benefit to the reader. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Shell />
      <main>{children}</main>
    </>
  )
}
