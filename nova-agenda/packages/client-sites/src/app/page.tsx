import Link from 'next/link';

export default function RootPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-xl">
        <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-on-primary mx-auto mb-lg shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-3xl">spa</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-sm">Nova Agenda - Client Portals</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-lg max-w-md">
          Each business gets their own booking page. Visit a business portal to book an appointment.
        </p>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
          Example: <code className="bg-surface-container px-2 py-1 rounded-lg font-label-sm text-label-sm">http://demo.localhost:3004</code>
        </p>
        <Link href="http://demo.localhost:3004" className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95">
          <span className="material-symbols-outlined">open_in_new</span>
          View Demo Client
        </Link>
      </div>
    </div>
  );
}
