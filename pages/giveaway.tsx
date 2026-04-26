// pages/giveaway.tsx
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import AuthGate from "@/components/AuthGate"

const discordLink = "https://discord.gg/RrbazZmzqB"

export default function GiveawayPage() {
  return (
    <>
      <Head>
        <title>$100 Giveaway | INKBASED</title>
        <meta
          name="description"
          content="Join INKBASED and enter the $100 anime and manga review giveaway."
        />
      </Head>

      <main className="min-h-screen bg-[#dfe6ec]">
        <section className="mx-auto max-w-5xl px-4 py-6">
          <div className="relative overflow-hidden rounded-md border-2 border-black bg-white">
            <Image
              src="/giveaway-landing-v2.png"
              alt="INKBASED $100 giveaway. Write reviews, use the site, and win prizes."
              width={1200}
              height={1800}
              priority
              unoptimized
              className="h-auto w-full"
            />

            <div className="absolute left-[3.5%] top-[29.6%]">
              <AuthGate>
                <Link
                  href="/signup"
                  className="rounded-md bg-black px-1 py-3 text-center text-xs font-black uppercase tracking-wide text-white hover:opacity-90 sm:px-6 sm:py-4 sm:text-sm"
                >
                  Join Now & Start Reviewing
                </Link>
              </AuthGate>
            </div>

            <div className="absolute bottom-[3.1%] left-1/2 -translate-x-1/2">
              <AuthGate>
                <Link
                  href="/signup"
                  className="rounded-md bg-black px-10 py-2 text-center text-xs font-black uppercase tracking-wide text-white hover:opacity-90 sm:px-20 sm:py-2.5 sm:text-sm"
                >
                  Join INKBASED
                </Link>
              </AuthGate>
            </div>
          </div>

          <div className="mt-4 rounded-md border-2 border-black bg-white px-4 py-4 text-center">
            <p className="text-sm font-semibold text-black">
              Questions about the giveaway or the site?
            </p>

            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-md bg-[#5865F2] px-6 py-2 text-sm font-black uppercase tracking-wide text-white hover:opacity-90"
            >
              Join the INKBASED Discord
            </a>
          </div>
        </section>
      </main>
    </>
  )
}