import Link from "next/link";

/**
 * Home page - This page is not used by the extension directly.
 * The extension uses popup.html and options.html instead.
 * This page exists only because Next.js App Router requires a root page.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">WorkAround Extension</h1>
      <p className="text-muted-foreground text-center max-w-md">
        This is a Chrome Extension. Please load the <code>out/</code> folder 
        as an unpacked extension in Chrome to use it.
      </p>
      <div className="flex gap-4">
        <Link 
          href="/popup" 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          View Popup
        </Link>
        <Link 
          href="/options" 
          className="px-4 py-2 border rounded-md hover:bg-muted"
        >
          View Options
        </Link>
      </div>
    </div>
  );
}
