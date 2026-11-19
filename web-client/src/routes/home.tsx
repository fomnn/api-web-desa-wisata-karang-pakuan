import { Link } from "@tanstack/react-router";

export function HomePage() {
  return (
    <section className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
        Desa Wisata
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Karang Pakuan</h1>
      <p className="mt-4 text-stone-600 dark:text-stone-300">
        Jelajahi berita, acara, dan produk unggulan desa. Halaman ini memuat data langsung dari REST
        API Nitro yang berjalan di origin yang sama.
      </p>
      <Link
        className="mt-8 inline-flex items-center rounded-full bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-emerald-50 transition-colors hover:bg-emerald-800 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300"
        to="/posts"
      >
        Lihat berita desa
      </Link>
    </section>
  );
}
