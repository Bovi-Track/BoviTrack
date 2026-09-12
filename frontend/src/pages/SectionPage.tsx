type SectionPageProps = {
  title: string
  description: string
}

export default function SectionPage({ title, description }: SectionPageProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="font-serif text-3xl font-semibold text-stone-900">
        {title}
      </h1>
      <section className="mt-5 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <p className="text-sm leading-relaxed text-stone-500">{description}</p>
      </section>
    </div>
  )
}
