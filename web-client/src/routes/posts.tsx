import { useSuspenseQuery } from "@tanstack/react-query";
import { postsQueryOptions } from "../lib/api";

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" });

export function PostsPage() {
  const { data } = useSuspenseQuery(postsQueryOptions());
  const { data: posts, pagination } = data;

  return (
    <section>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Berita Desa</h1>
        <p className="mt-1 text-stone-500 dark:text-stone-400">
          {pagination.total} tulisan dari CMS
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-5 text-stone-500 dark:border-stone-700 dark:text-stone-400">
          Belum ada tulisan. Tambahkan lewat <code>POST /api/cms/posts</code> lalu muat ulang.
        </p>
      ) : (
        <ul className="grid gap-4">
          {posts.map((post) => (
            <li key={post.id}>
              <article className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                <h2 className="text-lg font-semibold">{post.title}</h2>
                <p className="mt-1 text-stone-600 dark:text-stone-300">
                  {post.excerpt ?? post.metaDescription ?? "Tanpa ringkasan."}
                </p>
                <div className="mt-3 flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400">
                  <span className="rounded-full border border-stone-200 px-2 py-0.5 text-xs dark:border-stone-700">
                    {post.status}
                  </span>
                  <time dateTime={post.publishedAt ?? post.createdAt}>
                    {dateFormat.format(new Date(post.publishedAt ?? post.createdAt))}
                  </time>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
