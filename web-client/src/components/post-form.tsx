import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  ApiError,
  type PostDetail,
  type PostInput,
  type PostStatus,
  categoriesQueryOptions,
  tagsQueryOptions,
  usersQueryOptions,
} from "../lib/api";

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:border-stone-700 dark:bg-stone-900 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20";

const statusOptions: { value: PostStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "published", label: "Terbit" },
  { value: "archived", label: "Arsip" },
];

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: PostStatus;
  categoryId: string;
  authorId: string;
  publishedAt: string;
  isFeatured: boolean;
  metaTitle: string;
  metaDescription: string;
  tagIds: number[];
}

interface PostFormProps {
  initial?: PostDetail;
  submitLabel: string;
  onSubmit: (input: PostInput) => Promise<void>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function isPostStatus(value: string): value is PostStatus {
  return statusOptions.some((option) => option.value === value);
}

function padPart(part: number): string {
  return String(part).padStart(2, "0");
}

function toLocalDateTime(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${padPart(date.getMonth() + 1)}-${padPart(date.getDate())}T${padPart(
    date.getHours(),
  )}:${padPart(date.getMinutes())}`;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toFormState(post?: PostDetail): FormState {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? "",
    status: post?.status ?? "draft",
    categoryId: post?.categoryId == null ? "" : String(post.categoryId),
    authorId: post?.authorId == null ? "" : String(post.authorId),
    publishedAt: toLocalDateTime(post?.publishedAt ?? null),
    isFeatured: post?.isFeatured ?? false,
    metaTitle: post?.metaTitle ?? "",
    metaDescription: post?.metaDescription ?? "",
    tagIds: post?.tags.map((tag) => tag.id) ?? [],
  };
}

function toInput(state: FormState): PostInput {
  return {
    title: state.title.trim(),
    slug: state.slug.trim(),
    excerpt: blankToNull(state.excerpt),
    content: state.content,
    categoryId: state.categoryId === "" ? null : Number(state.categoryId),
    authorId: Number(state.authorId),
    status: state.status,
    publishedAt: state.publishedAt === "" ? null : new Date(state.publishedAt).toISOString(),
    isFeatured: state.isFeatured,
    metaTitle: blankToNull(state.metaTitle),
    metaDescription: blankToNull(state.metaDescription),
    tagIds: state.tagIds,
  };
}

function validate(state: FormState): string | null {
  if (!state.title.trim()) return "Judul wajib diisi.";
  if (!state.slug.trim()) return "Slug wajib diisi.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.slug.trim())) {
    return "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.";
  }
  if (!state.content.trim()) return "Konten wajib diisi.";
  if (!state.authorId) return "Pilih penulis terlebih dahulu.";
  return null;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "Slug sudah dipakai. Gunakan slug lain.";
    if (error.status === 422) {
      return "Penulis, kategori, atau tag yang dipilih tidak ada di server.";
    }
    return `Server menolak data: ${error.message}`;
  }

  return "Gagal menyimpan tulisan. Periksa koneksi ke server lalu coba lagi.";
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-stone-500 dark:text-stone-400">{hint}</span> : null}
    </label>
  );
}

export function PostForm({ initial, submitLabel, onSubmit }: PostFormProps) {
  const [state, setState] = useState<FormState>(() => toFormState(initial));
  const [slugLocked, setSlugLocked] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usersQuery = useQuery(usersQueryOptions());
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const tagsQuery = useQuery(tagsQueryOptions());

  const users = usersQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const tags = tagsQuery.data ?? [];

  const fallbackAuthorId = users.find((user) => user.isActive)?.id ?? users[0]?.id;

  useEffect(() => {
    if (state.authorId || fallbackAuthorId === undefined) return;

    setState((prev) => (prev.authorId ? prev : { ...prev, authorId: String(fallbackAuthorId) }));
  }, [fallbackAuthorId, state.authorId]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(tagId: number, checked: boolean) {
    setState((prev) => ({
      ...prev,
      tagIds: checked ? [...prev.tagIds, tagId] : prev.tagIds.filter((id) => id !== tagId),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = validate(state);
    if (message) {
      setError(message);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit(toInput(state));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
      <Field label="Judul" hint={`${state.title.length}/200 karakter`}>
        <input
          className={inputClass}
          value={state.title}
          maxLength={200}
          required
          onChange={(event) => {
            const title = event.target.value;
            setState((prev) => ({
              ...prev,
              title,
              slug: slugLocked ? prev.slug : slugify(title),
            }));
          }}
        />
      </Field>

      <Field label="Slug" hint="Dipakai di URL publik: huruf kecil, angka, dan tanda hubung.">
        <input
          className={`${inputClass} font-mono`}
          value={state.slug}
          maxLength={200}
          required
          onChange={(event) => {
            setSlugLocked(true);
            setField("slug", event.target.value);
          }}
        />
      </Field>

      <Field label="Ringkasan" hint={`${state.excerpt.length}/500 karakter`}>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={500}
          value={state.excerpt}
          onChange={(event) => setField("excerpt", event.target.value)}
        />
      </Field>

      <Field label="Konten">
        <textarea
          className={`${inputClass} min-h-56 font-mono`}
          rows={12}
          required
          value={state.content}
          onChange={(event) => setField("content", event.target.value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Status">
          <select
            className={inputClass}
            value={state.status}
            onChange={(event) => {
              const value = event.target.value;
              if (isPostStatus(value)) setField("status", value);
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tanggal terbit" hint="Opsional; kosongkan bila tulisan belum terbit.">
          <input
            type="datetime-local"
            className={inputClass}
            value={state.publishedAt}
            onChange={(event) => setField("publishedAt", event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Kategori">
          <select
            className={inputClass}
            value={state.categoryId}
            onChange={(event) => setField("categoryId", event.target.value)}
          >
            <option value="">Tanpa kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Penulis"
          hint={
            usersQuery.isSuccess && users.length === 0 ? (
              <>
                Belum ada user. Jalankan <code>pnpm db:seed:local</code> untuk data contoh.
              </>
            ) : (
              "Wajib diisi karena kolom author_id tidak boleh kosong."
            )
          }
        >
          <select
            className={inputClass}
            value={state.authorId}
            required
            onChange={(event) => setField("authorId", event.target.value)}
          >
            <option value="" disabled>
              Pilih penulis…
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
                {user.isActive ? "" : " (nonaktif)"} · {user.role}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="grid gap-1.5 text-sm">
        <legend className="font-medium">Tag</legend>
        {tags.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Belum ada tag di database. Tag dibuat lewat <code>POST /api/cms/tags</code>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-emerald-700 dark:accent-emerald-400"
                  checked={state.tagIds.includes(tag.id)}
                  onChange={(event) => toggleTag(tag.id, event.target.checked)}
                />
                {tag.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-emerald-700 dark:accent-emerald-400"
          checked={state.isFeatured}
          onChange={(event) => setField("isFeatured", event.target.checked)}
        />
        Tampilkan sebagai tulisan unggulan
      </label>

      <details className="rounded-xl border border-stone-200 px-4 py-3 dark:border-stone-800">
        <summary className="cursor-pointer text-sm font-medium">SEO (opsional)</summary>
        <div className="mt-4 grid gap-4">
          <Field label="Meta title" hint={`${state.metaTitle.length}/200 karakter`}>
            <input
              className={inputClass}
              maxLength={200}
              value={state.metaTitle}
              onChange={(event) => setField("metaTitle", event.target.value)}
            />
          </Field>

          <Field label="Meta description" hint={`${state.metaDescription.length}/300 karakter`}>
            <textarea
              className={inputClass}
              rows={3}
              maxLength={300}
              value={state.metaDescription}
              onChange={(event) => setField("metaDescription", event.target.value)}
            />
          </Field>
        </div>
      </details>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-t border-stone-200 pt-5 dark:border-stone-800">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-emerald-50 transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300"
        >
          {submitting ? "Menyimpan…" : submitLabel}
        </button>
        <Link
          className="text-sm text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          to="/cms/posts"
        >
          Batal
        </Link>
      </div>
    </form>
  );
}
