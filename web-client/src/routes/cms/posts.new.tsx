import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { PostForm } from "../../components/post-form";
import { createPost } from "../../lib/api";

export function CmsPostCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <section className="max-w-2xl">
      <header className="mb-6">
        <Link
          className="text-sm text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          to="/cms/posts"
        >
          ← Kembali ke daftar
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Tulisan baru</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Slug dibuat otomatis dari judul dan masih bisa diubah sebelum disimpan.
        </p>
      </header>

      <PostForm
        submitLabel="Buat tulisan"
        onSubmit={async (input) => {
          await createPost(input);
          await queryClient.invalidateQueries({ queryKey: ["posts"] });
          await navigate({ to: "/cms/posts" });
        }}
      />
    </section>
  );
}
