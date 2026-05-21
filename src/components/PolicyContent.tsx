import { POLICY_DOCUMENT } from "@/content/disclaimerCopy";

export function PolicyContent() {
  return (
    <div className="space-y-4">
      {POLICY_DOCUMENT.map((group, gi) => (
        <div
          key={gi}
          className="rounded-2xl overflow-hidden border border-border/30 bg-muted/20"
        >
          {/* Group header */}
          <div className="px-4 pt-4 pb-3 bg-muted/20 border-b border-border/25">
            <p className="text-[13px] font-semibold text-foreground/90 leading-snug">
              {group.groupTitle}
            </p>
          </div>

          {/* Group body */}
          <div className="px-4 pt-4 pb-4 space-y-4">
            {group.intro && (
              <p className="text-[12.5px] leading-[1.7] text-foreground/70">
                {group.intro}
              </p>
            )}

            {group.items && group.items.length > 0 && (
              <div className="space-y-4">
                {group.items.map((item, ii) => (
                  <div key={ii} className="space-y-1">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-foreground/45">
                      {item.label}
                    </p>
                    <p className="text-[12.5px] leading-[1.7] text-foreground/72">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {group.subsections && group.subsections.length > 0 && (
              <div className="space-y-5">
                {group.subsections.map((sub, si) => (
                  <div key={si} className="space-y-2.5">
                    {si > 0 && <div className="h-px bg-border/25" />}

                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/60 pt-0.5">
                      {sub.title}
                    </p>

                    {sub.intro && (
                      <p className="text-[12.5px] leading-[1.7] text-foreground/70">
                        {sub.intro}
                      </p>
                    )}

                    {sub.bullets && sub.bullets.length > 0 && (
                      <ul className="space-y-2">
                        {sub.bullets.map((b, bi) => (
                          <li
                            key={bi}
                            className="flex items-start gap-2.5 text-[12.5px] leading-[1.7] text-foreground/70"
                          >
                            <span className="mt-[6px] h-[5px] w-[5px] flex-shrink-0 rounded-full bg-primary/40" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {sub.items && sub.items.length > 0 && (
                      <div className="space-y-3.5">
                        {sub.items.map((item, ii) => (
                          <div key={ii} className="space-y-1">
                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-foreground/45">
                              {item.label}
                            </p>
                            <p className="text-[12.5px] leading-[1.7] text-foreground/70">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
