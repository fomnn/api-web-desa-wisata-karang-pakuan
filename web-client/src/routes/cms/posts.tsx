import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  type Post,
  type PostStatus,
  categoriesQueryOptions,
  deletePost,
  postsQueryOptions,
} from "../../lib/api";

const PAGE_SIZE = 10;

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

const statusLabels: Record<PostStatus, string> = {
  draft: "Draft",
  review: "Review",
  published: "Terbit",
  archived: "Arsip",
};

const statusStyles: Record<PostStatus, string> = {
  draft:
    "border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200",
  review:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
  published:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  archived:
    "border-stone-300 bg-stone-100 text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400",
};

const statusFilters = [
  { value: "all", label: "Semua" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "published", label: "Terbit" },
  { value: "archived", label: "Arsip" },
] as const;

type StatusFilter = (typeof statusFilters)[number]["value"];

function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {children}
    </p>
  );
}

export function CmsPostsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const postsQuery = useQuery({
    ...postsQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      status: status === "all" ? undefined : status,
      q: q || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const categoriesQuery = useQuery(categoriesQueryOptions());
  const categoryNames = new Map((categoriesQuery.data ?? []).map((row) => [row.id, row.name]));

  const remove = useMutation({
    mutationFn: deletePost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const posts = postsQuery.data?.data ?? [];
  const pagination = postsQuery.data?.pagination;

  useEffect(() => {
    if (pagination && posts.length === 0 && page > 1) setPage(page - 1);
  }, [pagination, posts.length, page]);

  function handleDelete(post: Post) {
    if (!window.confirm(`Hapus "${post.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    remove.mutate(post.id);
  }

  function resetFilters() {
    setSearch("");
    setQ("");
    setStatus("all");
    setPage(1);
  }

  const hasFilters = q !== "" || status !== "all";

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
            CMS
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Tulisan</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {pagination ? `${pagination.total} tulisan` : "Memuat…"}
          </p>
        </div>
        <Link
          className="rounded-full bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-emerald-50 transition-colors hover:bg-emerald-800 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300"
          to="/cms/posts/new"
        >
          Tulisan baru
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          className="w-full max-w-xs rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:border-stone-700 dark:bg-stone-900 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20"
          placeholder="Cari judul…"
          aria-label="Cari judul tulisan"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((filter) => {
            const active = status === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={active}
                className={
                  active
                    ? "rounded-full bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                    : "rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-stone-400 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-600"
                }
                onClick={() => {
                  setStatus(filter.value);
                  setPage(1);
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {postsQuery.isError ? <Alert>{postsQuery.error.message}</Alert> : null}
      {remove.isError ? <Alert>Gagal menghapus: {remove.error.message}</Alert> : null}

      {postsQuery.isPending ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">Memuat tulisan…</p>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-700">
          <p className="text-stone-600 dark:text-stone-300">
            {hasFilters
              ? "Tidak ada tulisan yang cocok dengan filter."
              : "Belum ada tulisan di database."}
          </p>
          {hasFilters ? (
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline dark:text-emerald-300"
              onClick={resetFilters}
            >
              Hapus filter
            </button>
          ) : (
            <Link
              className="mt-4 inline-flex rounded-full bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-emerald-50 transition-colors hover:bg-emerald-800 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300"
              to="/cms/posts/new"
            >
              Buat tulisan pertama
            </Link>
          )}
        </div>
      ) : (
        <div
          className={`overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm transition-opacity dark:border-stone-800 dark:bg-stone-900 ${
            postsQuery.isFetching ? "opacity-60" : ""
          }`}
        >
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
              <tr>
                <th className="px-4 py-3 font-medium">Tulisan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Diperbarui</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-stone-100 last:border-0 dark:border-stone-800"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{post.title}</p>
                    <p className="mt-0.5 font-mono text-xs text-stone-500 dark:text-stone-400">
                      /{post.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                          statusStyles[post.status]
                        }`}
                      >
                        {statusLabels[post.status]}
                      </span>
                      {post.isFeatured ? (
                        <span className="rounded-full border border-emerald-300 px-2 py-0.5 text-xs text-emerald-800 dark:border-emerald-700 dark:text-emerald-300">
                          Unggulan
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-300">
                    {post.categoryId === null
                      ? "—"
                      : (categoryNames.get(post.categoryId) ?? `#${post.categoryId}`)}
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-300">
                    <time dateTime={post.updatedAt}>
                      {dateFormat.format(new Date(post.updatedAt))}
                    </time>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3 text-sm">
                      <Link
                        className="font-medium text-emerald-800 underline-offset-4 hover:underline dark:text-emerald-300"
                        to="/cms/posts/$postId/edit"
                        params={{ postId: String(post.id) }}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="text-stone-500 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-stone-400 dark:hover:text-red-400"
                        disabled={remove.isPending && remove.variables === post.id}
                        onClick={() => handleDelete(post)}
                      >
                        {remove.isPending && remove.variables === post.id ? "Menghapus…" : "Hapus"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-stone-500 dark:text-stone-400">
            Halaman {pagination.page} dari {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium transition-colors hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:hover:border-stone-600"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium transition-colors hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:hover:border-stone-600"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
