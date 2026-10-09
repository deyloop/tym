<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Color } from "../../domain/models/color.model";
  import { BADGE_CLASSES } from "../styles";

  let { color, title, children }: { color: Color; title?: string; children: Snippet } = $props();
</script>

<span
  {title}
  class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap {BADGE_CLASSES[color]}"
>
  {@render children()}
</span>
