import { Link, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { postQueryOptions, postsQueryOptions } from "./lib/api";
import { queryClient } from "./lib/query";
import { CmsPostEditPage } from "./routes/cms/posts.$postId.edit";
import { CmsPostCreatePage } from "./routes/cms/posts.new";
import { CmsPostsPage } from "./routes/cms/posts";
import { HomePage } from "./routes/home";
import { PostsPage } from "./routes/posts";

const navLink =
  "text-stone-500 transition-colors hover:text-stone-900 aria-[current=page]:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 dark:aria-[current=page]:text-stone-100";

function RootLayout() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 py-5 dark:border-stone-800">
        <Link className="text-lg font-bold tracking-tight" to="/">
          Karang Pakuan
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link className={navLink} to="/">
            Beranda
          </Link>
          <Link className={navLink} to="/posts">
            Berita
          </Link>
          <Link className={navLink} to="/cms/posts">
            CMS
          </Link>
          <a className={navLink} href="/_scalar">
            API
          </a>
        </nav>
      </header>

      <main className="flex-1 py-12">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 py-6 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
        Desa Wisata Karang Pakuan · Nitro + Vite + TanStack Router + Query
      </footer>
    </div>
  );
}

function RootError() {
  return (
    <section role="alert">
      <h1 className="text-3xl font-bold tracking-tight">Gagal memuat halaman</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-300">
        Server tidak merespons. Coba muat ulang atau periksa log dev server.
      </p>
    </section>
  );
}

function NotFound() {
  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">Halaman tidak ditemukan</h1>
      <Link
        className="mt-6 inline-flex items-center rounded-full bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-emerald-50 transition-colors hover:bg-emerald-800 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300"
        to="/"
      >
        Kembali ke beranda
      </Link>
    </section>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/posts",
  loader: () => queryClient.ensureQueryData(postsQueryOptions()),
  component: PostsPage,
});

const cmsPostsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cms/posts",
  loader: () => queryClient.ensureQueryData(postsQueryOptions({ page: 1, pageSize: 10 })),
  component: CmsPostsPage,
});

const cmsPostNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cms/posts/new",
  component: CmsPostCreatePage,
});

const cmsPostEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cms/posts/$postId/edit",
  loader: ({ params }) => queryClient.ensureQueryData(postQueryOptions(Number(params.postId))),
  component: CmsPostEditPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  postsRoute,
  cmsPostsRoute,
  cmsPostNewRoute,
  cmsPostEditRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
