// Shared renderer for POLICY_DOCUMENT.
// Used by both DisclaimerModal (onboarding) and the Profile health sheet.
// Renders exact policy text with correct heading hierarchy and mobile-safe typography.

import { POLICY_DOCUMENT } from "@/content/disclaimerCopy";

export function PolicyContent() {
  return (
    <div className="space-y-6">
      {POLICY_DOCUMENT.map((group, gi) => (
        <div key={gi} className="space-y-3">
          {/* Major section title */}
          <p className="text-[13px] font-semibold text-foreground/90 leading-snug">
            {group.groupTitle}
          </p>

          {/* Optional intro paragraph directly under group title */}
          {group.intro && (
            <p className="text-[12.5px] leading-relaxed text-foreground/75">
              {group.intro}
            </p>
          )}

          {/* Direct labeled items (e.g. ToS section) */}
          {group.items && group.items.length > 0 && (
            <div className="space-y-2.5">
              {group.items.map((item, ii) => (
                <p key={ii} className="text-[12.5px] leading-relaxed text-foreground/75">
                  <span className="font-semibold text-foreground/85">{item.label}: </span>
                  {item.text}
                </p>
              ))}
            </div>
          )}

          {/* Subsections (e.g. Privacy Policy) */}
          {group.subsections && group.subsections.length > 0 && (
            <div className="space-y-4 pl-0.5">
              {group.subsections.map((sub, si) => (
                <div key={si} className="space-y-2">
                  {/* Subsection title */}
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {sub.title}
                  </p>

                  {/* Optional intro paragraph */}
                  {sub.intro && (
                    <p className="text-[12.5px] leading-relaxed text-foreground/75">
                      {sub.intro}
                    </p>
                  )}

                  {/* Bullet list */}
                  {sub.bullets && sub.bullets.length > 0 && (
                    <ul className="space-y-1 pl-1">
                      {sub.bullets.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-foreground/75">
                          <span className="flex-shrink-0 mt-0.5 text-foreground/50">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Labeled items within subsection */}
                  {sub.items && sub.items.length > 0 && (
                    <div className="space-y-2">
                      {sub.items.map((item, ii) => (
                        <p key={ii} className="text-[12.5px] leading-relaxed text-foreground/75">
                          <span className="font-semibold text-foreground/85">{item.label}: </span>
                          {item.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
