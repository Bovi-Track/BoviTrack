import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '../../lib/passwordPolicy.ts'

type PasswordRulesProps = {
  password: string
}

export function PasswordRules({ password }: PasswordRulesProps) {
  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password)
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-2 text-xs ${
              passed ? 'text-bovi' : 'text-stone-400'
            }`}
          >
            {passed ? (
              <Check className="size-3.5" strokeWidth={2.25} />
            ) : (
              <Circle className="size-3.5" strokeWidth={1.75} />
            )}
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
