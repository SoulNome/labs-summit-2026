"use client"

import { motion } from "motion/react"

import {
  CutoutCard,
  CutoutCardAction,
  CutoutCardContent,
  CutoutCardFooter,
  CutoutCardImage,
  CutoutCardInsetLabel,
  CutoutCardMedia,
  CutoutCardOverlay,
  CutoutCardPin,
  cutoutCardSurfaceClassName,
  CutoutCorner,
  useCutoutContentStaggerVariants,
} from "@/registry/default/ui/cutout-card"

// ============================================================================
// Demo — full-page showcase matching the original single-component layout
// ============================================================================

function CutoutCardDemo() {
  const stagger = useCutoutContentStaggerVariants()

  return (
    <div className="flex min-h-screen items-center justify-center ">
      <div className="relative w-full max-w-md">
        <CutoutCard className={cutoutCardSurfaceClassName}>
          <CutoutCardMedia className="h-72">
            <CutoutCardImage
              alt="Mountain landscape"
              sizes="(max-width: 768px) 100vw, 448px"
              src="/placeholders/apple-wallpaper.jpg"
            />
            <CutoutCardOverlay />
            <CutoutCardInsetLabel className="bottom-0 left-0 rounded-tr-[20px] bg-card px-5 py-3">
              <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-widest">
                Featured
              </span>
              <CutoutCorner className="absolute -right-[31px] -bottom-px rotate-90 text-card" />
              <CutoutCorner className="absolute -top-[31px] -left-px rotate-90 text-card" />
            </CutoutCardInsetLabel>
            <CutoutCardPin className="top-0 right-0 rounded-bl-[16px] bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm shadow-foreground/10 shadow-md ring-1 ring-border/30">
              New
              <CutoutCorner
                className="absolute top-0 -left-[23px] -rotate-90 text-primary"
                size={24}
              />
              <CutoutCorner
                className="absolute right-0 -bottom-[23px] -rotate-90 text-primary"
                size={24}
              />
            </CutoutCardPin>
          </CutoutCardMedia>
          <CutoutCardContent>
            <motion.div
              animate="show"
              className="contents"
              initial="hidden"
              variants={stagger.container}
            >
              <motion.h2
                className="mb-2 text-balance font-semibold text-card-foreground text-xl leading-snug"
                variants={stagger.item}
              >
                Alpine Adventures
              </motion.h2>
              <motion.p
                className="mb-4 text-pretty text-muted-foreground text-sm leading-relaxed"
                variants={stagger.item}
              >
                Discover breathtaking mountain landscapes and experience the
                serenity of nature at its finest.
              </motion.p>
              <motion.div variants={stagger.item}>
                <CutoutCardFooter className="border-border/80 border-t pt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-linear-to-br from-chart-4 to-chart-5 shadow-sm ring-2 ring-card" />
                    <span className="font-medium text-card-foreground text-sm">
                      Sarah Chen
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    5 min read
                  </span>
                </CutoutCardFooter>
              </motion.div>
            </motion.div>
          </CutoutCardContent>
          <CutoutCardAction className="right-5 bottom-5">
            <button
              className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-md transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
              type="button"
            >
              Read More
            </button>
          </CutoutCardAction>
        </CutoutCard>
      </div>
    </div>
  )
}

export default CutoutCardDemo
