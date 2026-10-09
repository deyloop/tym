<script lang="ts">
  import { COLORS, type Color } from "../../domain/models/color.model";
  import { SWATCH_CLASSES } from "../styles";

  let {
    value = $bindable(),
    label,
    onchange,
  }: { value: Color; label: string; onchange?: (color: Color) => void } = $props();
</script>

<div role="radiogroup" aria-label={label} class="flex items-center gap-1">
  {#each COLORS as color (color)}
    <button
      type="button"
      role="radio"
      aria-checked={value === color}
      aria-label={color}
      title={color}
      class="size-5 rounded-full {SWATCH_CLASSES[color]} transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background {value ===
      color
        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
        : 'opacity-70 hover:opacity-100'}"
      onclick={() => {
        value = color;
        onchange?.(color);
      }}
    ></button>
  {/each}
</div>
