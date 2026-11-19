import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { PostForm } from "../../components/post-form";
import { postQueryOptions, updatePost } from "../../lib/api";

export function CmsPostEditPage() {
  const { postId } = useParams({ strict: false });
  const id = Number(postId);
  const { data: post } = useSuspenseQuery(postQueryOptions(id));

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
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit tulisan</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{post.title}</p>
      </header>

      <PostForm
        initial={post}
        submitLabel="Simpan perubahan"
        onSubmit={async (input) => {
          await updatePost(id, input);
          await queryClient.invalidateQueries({ queryKey: ["posts"] });
          await queryClient.invalidateQueries({ queryKey: ["post", id] });
          await navigate({ to: "/cms/posts" });
        }}
      />
    </section>
  );
}
