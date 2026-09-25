import { landingModules } from '@/landing/modules'
import { ModuleCard } from './ModuleCard'

interface FeatureGridProps {
  languageName?: string | null
}

/** The central hub: every learning module as one card, filtered by nothing and curated by all. */
export const FeatureGrid = ({ languageName }: FeatureGridProps) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {landingModules.map((module) => (
      <ModuleCard key={module.id} module={module} languageName={languageName} />
    ))}
  </div>
)
