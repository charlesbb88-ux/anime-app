import Head from "next/head";

const testerFormUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSehju81TQJe5wQOhsGfcuxi1eRBq9-NbLl3f2xVw8KvCaWEzw/viewform?usp=publish-editor";

export default function TestersPage() {
  return (
    <>
      <Head>
        <title>Become a Tester | INKBASED</title>
      </Head>

      <main className="min-h-screen bg-[#dfe6ec] px-4 py-8 text-black">
        <section className="mx-auto max-w-3xl rounded-md border-2 border-black bg-white p-6 md:p-8">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.35em]">
            Beta Testers Wanted
          </p>

          <h1 className="mb-4 text-4xl font-black leading-tight md:text-5xl">
            Help test INKBASED.
          </h1>

          <p className="mb-5 text-base leading-7 md:text-lg">
            INKBASED is a new anime and manga community where users can log,
            review, post, level up their MC, and battle other users. I’m looking
            for real anime fans to try the site and tell me what feels broken,
            confusing, or fun.
          </p>

          <div className="mb-6 rounded-md border border-black bg-[#f7f7f7] p-4">
            <p className="mb-2 font-black">What testers may do:</p>

            <ul className="list-inside list-disc space-y-1 text-sm md:text-base">
              <li>Create an account</li>
              <li>Log anime or manga</li>
              <li>Write short honest reviews</li>
              <li>Level up your MC</li>
              <li>Report bugs or confusing parts</li>
            </ul>
          </div>

          <p className="mb-6 text-sm leading-6 text-gray-700 md:text-base">
            Selected testers may receive paid rewards or bonus
            rewards for useful feedback. I’m not looking for spam — just real
            feedback from people who actually watch anime or read manga.
          </p>

          <a
            href={testerFormUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-md bg-black px-6 py-3 text-sm font-black text-white"
          >
            Apply to Become a Tester
          </a>
        </section>
      </main>
    </>
  );
}