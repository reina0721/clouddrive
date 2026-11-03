/** Browser clipboard adapter. Permission failures are returned to the owning view. */
export async function copyResourceId(id: string): Promise<void> {
  await navigator.clipboard.writeText(id);
}
