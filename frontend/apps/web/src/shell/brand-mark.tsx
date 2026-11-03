export function BrandMark() {
  return (
    <span
      className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-brand text-sm font-black text-white shadow-sm"
      aria-hidden="true"
    >
      C
      <span className="absolute -right-1 -top-1 size-3 rounded-full bg-white/35" />
    </span>
  );
}
